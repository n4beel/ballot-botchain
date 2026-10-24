import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { ballotAbi } from "@/lib/botchain/abi";

const PORT = 8603;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968 as const;

const MNEMONIC = "test test test test test test test test test test test junk";
const account0 = mnemonicToAccount(MNEMONIC, { addressIndex: 0 });
const account1 = mnemonicToAccount(MNEMONIC, { addressIndex: 1 });
const account2 = mnemonicToAccount(MNEMONIC, { addressIndex: 2 });
const account3 = mnemonicToAccount(MNEMONIC, { addressIndex: 3 });

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

let node: ChildProcess;
let publicClient: PublicClient;
let wallet0: WalletClient;
let wallet1: WalletClient;
let wallet2: WalletClient;
let wallet3: WalletClient;
let contractAddress: Address;

function revertDetails(err: unknown): { errorName?: string; args?: readonly unknown[] } | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const found = err.walk(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      "data" in e &&
      Boolean((e as { data?: { errorName?: string } }).data?.errorName)
  ) as { data?: { errorName?: string; args?: readonly unknown[] } } | null;
  return found?.data;
}

beforeAll(async () => {
  node = spawn("anvil", ["--port", String(PORT), "--chain-id", String(CHAIN_ID), "--silent"], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  publicClient = createPublicClient({ chain: local, transport: http() }) as PublicClient;
  wallet0 = createWalletClient({ account: account0, chain: local, transport: http() });
  wallet1 = createWalletClient({ account: account1, chain: local, transport: http() });
  wallet2 = createWalletClient({ account: account2, chain: local, transport: http() });
  wallet3 = createWalletClient({ account: account3, chain: local, transport: http() });

  for (let i = 0; ; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const artifact = JSON.parse(
    readFileSync("contracts/out/Ballot.sol/Ballot.json", "utf8")
  ) as { abi: any; bytecode: { object: Hex } };

  const hash = await wallet0.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [],
    chain: local,
    account: account0,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractAddress = receipt.contractAddress!;
});

afterAll(async () => {
  if (node) {
    node.kill("SIGTERM");
  }
});

describe("Ballot integration on live local anvil", () => {
  it("deploys cleanly with zero initial polls", async () => {
    expect(contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

    const count = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollCount",
    });
    expect(count).toBe(0n);
  });

  it("creates a poll and reads back its parameters", async () => {
    const tx = await wallet0.writeContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "create",
      args: [
        "Should we expand to L2?",
        ["Yes", "No", "Undecided"],
        86400n, // 1 day
      ],
      chain: local,
      account: account0,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    expect(receipt.status).toBe("success");

    const count = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollCount",
    });
    expect(count).toBe(1n);

    const poll = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollOf",
      args: [1n],
    });

    expect(poll.creator.toLowerCase()).toBe(account0.address.toLowerCase());
    expect(poll.question).toBe("Should we expand to L2?");
    expect(poll.options).toEqual(["Yes", "No", "Undecided"]);
    expect(poll.tally).toEqual([0, 0, 0]);
    expect(poll.totalVotes).toBe(0);
    expect(poll.open).toBe(true);
  });

  it("records votes from multiple wallets and updates tallies", async () => {
    // account0 votes "Yes" (option 0)
    const tx0 = await wallet0.writeContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "vote",
      args: [1n, 0],
      chain: local,
      account: account0,
    });
    const rc0 = await publicClient.waitForTransactionReceipt({ hash: tx0 });
    expect(rc0.status).toBe("success");
    // Verify gas used is reasonable
    expect(rc0.gasUsed).toBeLessThan(85_000n);

    // account1 votes "Yes" (option 0)
    const tx1 = await wallet1.writeContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "vote",
      args: [1n, 0],
      chain: local,
      account: account1,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx1 });

    // account2 votes "No" (option 1)
    const tx2 = await wallet2.writeContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "vote",
      args: [1n, 1],
      chain: local,
      account: account2,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    const poll = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollOf",
      args: [1n],
    });

    expect(poll.totalVotes).toBe(3);
    expect(poll.tally).toEqual([2, 1, 0]);

    // Check choiceOf
    const choice0 = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "choiceOf",
      args: [1n, account0.address],
    });
    expect(choice0).toEqual([true, 0]);

    const choice2 = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "choiceOf",
      args: [1n, account2.address],
    });
    expect(choice2).toEqual([true, 1]);

    const choice3 = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "choiceOf",
      args: [1n, account3.address],
    });
    expect(choice3).toEqual([false, 0]);
  });

  it("reverts when a wallet votes a second time", async () => {
    let thrown: unknown;
    try {
      await wallet0.writeContract({
        address: contractAddress,
        abi: ballotAbi,
        functionName: "vote",
        args: [1n, 1],
        chain: local,
        account: account0,
      });
    } catch (err) {
      thrown = err;
    }

    const rev = revertDetails(thrown);
    expect(rev?.errorName).toBe("AlreadyVoted");
    expect(rev?.args?.[0]).toBe(1n);
    expect(rev?.args?.[1]).toBe(0); // previous choice was option 0
  });

  it("reverts on invalid option choice", async () => {
    let thrown: unknown;
    try {
      await wallet3.writeContract({
        address: contractAddress,
        abi: ballotAbi,
        functionName: "vote",
        args: [1n, 5],
        chain: local,
        account: account3,
      });
    } catch (err) {
      thrown = err;
    }

    const rev = revertDetails(thrown);
    expect(rev?.errorName).toBe("BadChoice");
  });

  it("supports pagination and newest-first ordering with latest()", async () => {
    // Create poll 2
    const tx = await wallet1.writeContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "create",
      args: [
        "What is your favorite beverage?",
        ["Coffee", "Tea"],
        3600n, // 1 hour
      ],
      chain: local,
      account: account1,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    // Poll 2 and Poll 1
    const latestAll = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "latest",
      args: [0n, 10n],
    });

    expect(latestAll.length).toBe(2);
    expect(latestAll[0].id).toBe(2n);
    expect(latestAll[0].question).toBe("What is your favorite beverage?");
    expect(latestAll[1].id).toBe(1n);
    expect(latestAll[1].question).toBe("Should we expand to L2?");

    // Pagination
    const page = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "latest",
      args: [1n, 1n],
    });
    expect(page.length).toBe(1);
    expect(page[0].id).toBe(1n);

    // Empty past end
    const empty = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "latest",
      args: [2n, 5n],
    });
    expect(empty.length).toBe(0);
  });

  it("lists polls created by a specific wallet with pollsBy()", async () => {
    const pollsBy0 = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollsBy",
      args: [account0.address],
    });
    expect(pollsBy0).toEqual([1n]);

    const pollsBy1 = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollsBy",
      args: [account1.address],
    });
    expect(pollsBy1).toEqual([2n]);

    const pollsBy2 = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollsBy",
      args: [account2.address],
    });
    expect(pollsBy2).toEqual([]);
  });

  it("handles poll expiry when time advances", async () => {
    // Advance time by 3601 seconds so poll 2 closes
    await (publicClient.request as any)({
      method: "evm_increaseTime",
      params: [3601],
    });
    await (publicClient.request as any)({
      method: "anvil_mine",
      params: [1],
    });

    const poll2 = await publicClient.readContract({
      address: contractAddress,
      abi: ballotAbi,
      functionName: "pollOf",
      args: [2n],
    });
    expect(poll2.open).toBe(false);

    // Attempting to vote reverts PollClosed
    let thrown: unknown;
    try {
      await wallet0.writeContract({
        address: contractAddress,
        abi: ballotAbi,
        functionName: "vote",
        args: [2n, 0],
        chain: local,
        account: account0,
      });
    } catch (err) {
      thrown = err;
    }

    const rev = revertDetails(thrown);
    expect(rev?.errorName).toBe("PollClosed");
  });
});
