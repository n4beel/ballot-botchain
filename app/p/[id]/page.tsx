"use client";

import { use } from "react";
import PageShell from "@/components/layout/PageShell";
import PollVoteView from "@/components/ballot/PollVoteView";

export default function BallotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  let id = 0n;
  try {
    id = BigInt(resolvedParams.id);
  } catch {
    id = 0n;
  }

  return (
    <PageShell>
      <PollVoteView id={id} />
    </PageShell>
  );
}
