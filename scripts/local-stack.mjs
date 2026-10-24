/**
 * Local stack runner and seeder for Ballot.
 *
 * Spawns anvil on port 8703 with chain id 968, deploys Ballot, and seeds
 * realistic states across accounts:
 * - Poll 1: Open poll with 14 votes across 4 options
 * - Poll 2: Open poll with 6 options and 0 votes
 * - Poll 3: Open poll closing in 4 minutes (near-boundary state)
 * - Poll 4: Closed poll with a tie between options
 * - Poll 5: Closed poll with a clear winner
 * - Poll 6: Open poll where account 0 has already cast a vote
 *
 * Usage:
 *   node scripts/local-stack.mjs
 *   npm run dev
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const PORT = 8703;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const MNEMONIC = "test test test test test test test test test test test junk";

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

console.log(`Starting anvil on port ${PORT}...`);
spawn("anvil", ["--port", String(PORT), "--chain-id", String(CHAIN_ID), "--accounts", "25", "--silent"], {
  detached: true,
  stdio: "ignore",
}).unref();

const pub = createPublicClient({ chain: local, transport: http() });

const accounts = Array.from({ length: 20 }, (_, i) =>
  mnemonicToAccount(MNEMONIC, { addressIndex: i })
);
const wallets = accounts.map((acc) =>
  createWalletClient({ account: acc, chain: local, transport: http() })
);

// Wait for anvil to answer
for (let i = 0; ; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(new URL("../contracts/out/Ballot.sol/Ballot.json", import.meta.url), "utf8")
);

// Deploy Ballot
const deployHash = await wallets[0].deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
  args: [],
});
const deployed = await pub.waitForTransactionReceipt({ hash: deployHash });
const contractAddress = deployed.contractAddress;

console.log(`Ballot deployed at ${contractAddress} (block ${deployed.blockNumber})`);

const abi = artifact.abi;

async function createPoll(wallet, question, options, durationSec) {
  const hash = await wallet.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: [question, options, BigInt(durationSec)],
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  return rc;
}

async function vote(wallet, pollId, option) {
  const hash = await wallet.writeContract({
    address: contractAddress,
    abi,
    functionName: "vote",
    args: [BigInt(pollId), option],
  });
  return await pub.waitForTransactionReceipt({ hash });
}

console.log("Seeding initial polls...");

// 1. Create Poll for closed tie (Poll 1)
console.log("Creating Poll 1 (to be closed with tie)...");
await createPoll(
  wallets[1],
  "Design aesthetic for the next terminal release:",
  ["Classic Monospace Amber", "Cyan Phosphor Matrix", "High-Contrast Monochrome"],
  3600
);
// Votes: 5 for opt 0, 5 for opt 1, 2 for opt 2 -> 12 votes total (Tied between 0 & 1)
for (let i = 1; i <= 5; i++) await vote(wallets[i], 1, 0);
for (let i = 6; i <= 10; i++) await vote(wallets[i], 1, 1);
for (let i = 11; i <= 12; i++) await vote(wallets[i], 1, 2);

// 2. Create Poll for closed clear winner (Poll 2)
console.log("Creating Poll 2 (to be closed with clear winner)...");
await createPoll(
  wallets[2],
  "Primary network upgrade focus for Q4:",
  ["EVM Gas Optimization", "Light Client Syncing", "State Rent Exploration"],
  3600
);
// Votes: 8 for opt 0, 1 for opt 1, 1 for opt 2 -> 10 votes
for (let i = 1; i <= 8; i++) await vote(wallets[i], 2, 0);
await vote(wallets[9], 2, 1);
await vote(wallets[10], 2, 2);

// Advance time by 3601s to close Poll 1 and Poll 2
await pub.request({ method: "evm_increaseTime", params: [3601] });
await pub.request({ method: "anvil_mine", params: [1] });
console.log("Polls 1 & 2 closed.");

// 3. Create Poll 3: Open poll closing in 4 minutes (near-boundary state)
console.log("Creating Poll 3 (open, closing in 4 minutes)...");
await createPoll(
  wallets[3],
  "Should the protocol parameter adjustment proposal be fast-tracked?",
  ["Approve Fast-Track", "Require Normal 7-Day Window"],
  3600
);
// 3 votes on Poll 3
await vote(wallets[4], 3, 0);
await vote(wallets[5], 3, 0);
await vote(wallets[6], 3, 1);

// Advance time by 3360s (3600 - 240) so 240s (4 mins) remain on Poll 3
await pub.request({ method: "evm_increaseTime", params: [3360] });
await pub.request({ method: "anvil_mine", params: [1] });
console.log("Poll 3 set to 4 minutes remaining.");

// 4. Create Poll 4: Open poll with 14 votes across 4 options
console.log("Creating Poll 4 (open, 14 votes across 4 options)...");
await createPoll(
  wallets[0],
  "Which cryptographic primitive is most foundational to trustless systems?",
  ["Zero-Knowledge Proofs", "Hash Functions", "Elliptic Curves", "Verifiable Delay Functions"],
  86400 * 7 // 7 days
);
// Cast 14 votes from wallets[1..14]
const dist = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3];
for (let i = 0; i < 14; i++) {
  await vote(wallets[i + 1], 4, dist[i]);
}

// 5. Create Poll 5: Open poll with 6 options and 0 votes
console.log("Creating Poll 5 (open, 6 options, 0 votes)...");
await createPoll(
  wallets[1],
  "Which consensus mechanism best balances throughput and decentralization?",
  [
    "Pure Proof of Stake",
    "Proof of Work",
    "Directed Acyclic Graph",
    "Delegated PoS",
    "Proof of Authority",
    "Asynchronous BFT",
  ],
  86400 * 14 // 14 days
);

// 6. Create Poll 6: Open poll where account 0 has already cast a vote
console.log("Creating Poll 6 (open, account 0 voted)...");
await createPoll(
  wallets[2],
  "Do you verify contract bytecode before interacting with unverified UI?",
  ["Always", "Only for high-value transactions", "Rarely / Rely on audits", "Never"],
  86400 * 3 // 3 days
);
// Account 0 votes option 0 ("Always")
await vote(wallets[0], 6, 0);
// Account 1 votes option 1
await vote(wallets[1], 6, 1);

console.log("All 6 polls successfully seeded!");

// Write .env.local
const startBlock = deployed.blockNumber > 1n ? deployed.blockNumber - 1n : 1n;
const envContent = [
  `# Generated by scripts/local-stack.mjs`,
  `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
  `NEXT_PUBLIC_DEPLOY_BLOCK_968=${startBlock.toString()}`,
  "",
].join("\n");

writeFileSync(".env.local", envContent);
console.log("Wrote .env.local with deployed contract address and start block.");

console.log("\n=======================================================");
console.log(`Ballot local stack ready on port ${PORT}!`);
console.log(`Contract: ${contractAddress}`);
console.log(`Polls available:`);
console.log(`  /p/1 - Closed poll (Tied result: 5 vs 5)`);
console.log(`  /p/2 - Closed poll (Clear winner)`);
console.log(`  /p/3 - Open poll (Closing in ~4 minutes)`);
console.log(`  /p/4 - Open poll (14 votes across 4 options)`);
console.log(`  /p/5 - Open poll (6 options, 0 votes)`);
console.log(`  /p/6 - Open poll (Account 0 already voted option 0)`);
console.log("=======================================================\n");
