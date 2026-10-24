"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useChainId, useReadContract } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import ConnectButton from "@/components/ui/ConnectButton";
import { ballotAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { isBotChainId } from "@/lib/botchain/chain";
import { countdown, formatCloses, type PollView } from "@/lib/ballot";

function CreatedPollRow({ id, nowSec }: { id: bigint; nowSec: number }) {
  const chainId = useChainId();
  const deployment = useMemo(
    () => (isBotChainId(chainId) && isDeployed(chainId) ? getDeployment(chainId) : null),
    [chainId]
  );

  const { data, isLoading } = useReadContract({
    address: deployment?.address,
    abi: ballotAbi,
    functionName: "pollOf",
    args: [id],
    query: {
      enabled: Boolean(deployment?.address),
    },
  });

  const poll = data as PollView | undefined;

  if (isLoading || !poll) {
    return (
      <div className="py-3 px-2 border-b border-[var(--border-subtle)] text-[13px] text-[var(--text-muted)] animate-pulse font-serif">
        Loading poll #{id.toString()}…
      </div>
    );
  }

  const isClosed = !poll.open || nowSec >= Number(poll.closesAt);

  return (
    <article className="py-4 border-b border-[var(--border-subtle)] space-y-2 hover:bg-[var(--bg-surface)] px-2 -mx-2 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/p/${id}`} className="no-underline hover:underline text-inherit group">
          <h3 className="font-serif text-[18px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
            {poll.question}
          </h3>
        </Link>
        <span
          className={`text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 border flex-shrink-0 ${
            isClosed
              ? "border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-base)]"
              : "border-[var(--text-primary)] text-[var(--text-primary)] bg-[var(--bg-surface)]"
          }`}
        >
          {isClosed ? "Closed" : "Open"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
        <span className="tabular-nums font-semibold text-[var(--text-primary)]">
          {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        </span>
        <span aria-hidden="true">·</span>
        <span>{isClosed ? "Final" : countdown(poll.closesAt, nowSec)}</span>
        <span aria-hidden="true">·</span>
        <span>Closes {formatCloses(poll.closesAt)}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono text-[11px]">#{id.toString()}</span>
      </div>
    </article>
  );
}

export default function MyPollsPage() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const deployment = useMemo(
    () => (isBotChainId(chainId) && isDeployed(chainId) ? getDeployment(chainId) : null),
    [chainId]
  );

  const { data: myPollIdsData, isLoading } = useReadContract({
    address: deployment?.address,
    abi: ballotAbi,
    functionName: "pollsBy",
    args: [address ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`)],
    query: {
      enabled: Boolean(deployment?.address && address),
    },
  });

  const myPollIds = useMemo(() => {
    if (!myPollIdsData) return [];
    return [...(myPollIdsData as bigint[])].reverse(); // newest first
  }, [myPollIdsData]);

  return (
    <PageShell
      title="My Questions"
      description="Inquiries published to BOT Chain by your connected wallet."
    >
      <div className="space-y-6">
        {!isConnected ? (
          <Panel className="text-center py-12 space-y-4">
            <h3 className="font-serif text-[22px] font-bold text-[var(--text-primary)]">
              Connect your wallet
            </h3>
            <p className="text-[13px] text-[var(--text-muted)] max-w-[400px] mx-auto">
              Connect a wallet to view the list of polls you have created on BOT Chain.
            </p>
            <div className="pt-2 flex justify-center">
              <div className="w-[180px]">
                <ConnectButton />
              </div>
            </div>
          </Panel>
        ) : isLoading ? (
          <Panel className="text-center py-12">
            <p className="font-serif italic text-[15px] text-[var(--text-muted)] animate-pulse">
              Reading your questions from the registry…
            </p>
          </Panel>
        ) : myPollIds.length === 0 ? (
          <Panel className="text-center py-12 space-y-4">
            <h3 className="font-serif text-[22px] font-bold text-[var(--text-primary)]">
              You haven't asked any questions yet.
            </h3>
            <p className="text-[13px] text-[var(--text-muted)] max-w-[400px] mx-auto">
              Any poll you publish from this wallet will be listed here.
            </p>
            <div className="pt-2">
              <Link href="/new">
                <Button variant="primary">Ask a question →</Button>
              </Link>
            </div>
          </Panel>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[12px] text-[var(--text-muted)] font-serif italic border-b border-[var(--border-subtle)] pb-2">
              <span>{myPollIds.length} {myPollIds.length === 1 ? "poll" : "polls"} created by your address</span>
              <Link href="/new" className="text-[var(--text-primary)] font-sans not-italic font-semibold underline">
                + Ask another
              </Link>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {myPollIds.map((id) => (
                <CreatedPollRow key={id.toString()} id={id} nowSec={nowSec} />
              ))}
            </div>
          </div>
        )}

        {/* Indexing Note */}
        <div className="p-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)] space-y-1">
          <p className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[11px]">
            Privacy & Indexing
          </p>
          <p>
            "Voted in" polls are intentionally not indexed on-chain. Ballot records your choice on
            each specific poll to enforce the one-wallet-one-vote rule, but avoids building an
            on-chain registry of your voting history. Only polls you created appear here.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
