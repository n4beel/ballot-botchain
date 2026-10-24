import Link from "next/link";
import type { PollSummary } from "@/lib/ballot";
import { countdown, formatCloses } from "@/lib/ballot";

export default function PollCard({
  poll,
  nowSec,
}: {
  poll: PollSummary;
  nowSec?: number;
}) {
  const isClosed = !poll.open;
  const timeDesc = isClosed ? "Closed" : countdown(poll.closesAt, nowSec);

  return (
    <article className="py-4 border-b border-[var(--border-subtle)] space-y-2 hover:bg-[var(--bg-surface)] px-2 -mx-2 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/p/${poll.id}`}
          className="no-underline hover:underline text-inherit group"
        >
          <h2 className="font-serif text-[18px] md:text-[20px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
            {poll.question}
          </h2>
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)] font-sans">
        <span className="tabular-nums font-semibold text-[var(--text-primary)]">
          {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        </span>
        <span aria-hidden="true">·</span>
        <span>{timeDesc}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono text-[11px]">#{poll.id.toString()}</span>
      </div>
    </article>
  );
}
