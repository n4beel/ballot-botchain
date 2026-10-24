"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useChainId, useReadContract } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import PollCard from "@/components/ballot/PollCard";
import { ballotAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { isBotChainId } from "@/lib/botchain/chain";
import type { PollSummary } from "@/lib/ballot";

const PAGE_SIZE = 10;

export default function Home() {
  const chainId = useChainId();
  const [offset, setOffset] = useState<number>(0);
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

  // Total poll count
  const { data: totalCountData, isLoading: countLoading } = useReadContract({
    address: deployment?.address,
    abi: ballotAbi,
    functionName: "pollCount",
    query: {
      enabled: Boolean(deployment?.address),
    },
  });

  const totalPolls = useMemo(() => {
    return totalCountData !== undefined ? Number(totalCountData) : 0;
  }, [totalCountData]);

  // Read latest polls with offset
  const { data: latestData, isLoading: pollsLoading } = useReadContract({
    address: deployment?.address,
    abi: ballotAbi,
    functionName: "latest",
    args: [BigInt(offset), BigInt(PAGE_SIZE)],
    query: {
      enabled: Boolean(deployment?.address && totalPolls > 0),
    },
  });

  const allPolls: PollSummary[] = useMemo(() => {
    if (!latestData) return [];
    return (latestData as PollSummary[]).map((p) => ({
      ...p,
      open: Boolean(p.open) && nowSec < Number(p.closesAt),
    }));
  }, [latestData, nowSec]);

  const openPolls = useMemo(() => allPolls.filter((p) => p.open), [allPolls]);
  const closedPolls = useMemo(() => allPolls.filter((p) => !p.open), [allPolls]);

  const hasEarlier = offset + PAGE_SIZE < totalPolls;
  const hasNewer = offset > 0;

  return (
    <PageShell>
      <div className="space-y-8">
        {/* Editorial Subheader Banner */}
        <div className="border-b border-[var(--border-subtle)] pb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-serif text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
              Dispatches & Inquiries
            </h2>
            <p className="text-[13px] font-serif italic text-[var(--text-muted)]">
              Equal-weight community ballots published to BOT Chain.
            </p>
          </div>
          <Link href="/new" className="no-underline">
            <Button variant="primary" size="sm">
              + Ask a question
            </Button>
          </Link>
        </div>

        {/* Loading state */}
        {(countLoading || pollsLoading) && (
          <Panel className="text-center py-12">
            <p className="font-serif italic text-[15px] text-[var(--text-muted)] animate-pulse">
              Consulting the ledger…
            </p>
          </Panel>
        )}

        {/* Empty state */}
        {!countLoading && !pollsLoading && totalPolls === 0 && (
          <Panel className="text-center py-12 space-y-4">
            <h3 className="font-serif text-[22px] font-bold text-[var(--text-primary)]">
              No questions have been asked yet.
            </h3>
            <p className="text-[13px] text-[var(--text-muted)] max-w-[420px] mx-auto leading-relaxed">
              Open the first poll on BOT Chain. Anyone with a connected wallet can cast one vote.
            </p>
            <div className="pt-2">
              <Link href="/new">
                <Button variant="primary">Ask the first question →</Button>
              </Link>
            </div>
          </Panel>
        )}

        {/* Open Polls Section */}
        {openPolls.length > 0 && (
          <section className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--text-primary)]" aria-hidden="true" />
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-primary)]">
                Active Polling
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {openPolls.map((poll) => (
                <PollCard key={poll.id.toString()} poll={poll} nowSec={nowSec} />
              ))}
            </div>
          </section>
        )}

        {/* Closed Polls Section */}
        {closedPolls.length > 0 && (
          <section className="space-y-1 pt-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Closed & Finalized
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-subtle)] opacity-90">
              {closedPolls.map((poll) => (
                <PollCard key={poll.id.toString()} poll={poll} nowSec={nowSec} />
              ))}
            </div>
          </section>
        )}

        {/* Pagination */}
        {totalPolls > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)] text-[13px]">
            {hasNewer ? (
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="underline cursor-pointer hover:text-[var(--accent)] font-serif"
              >
                ← Later polls
              </button>
            ) : (
              <div />
            )}
            <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalPolls)} of {totalPolls}
            </span>
            {hasEarlier && (
              <button
                type="button"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="underline cursor-pointer hover:text-[var(--accent)] font-serif"
              >
                Earlier polls →
              </button>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
