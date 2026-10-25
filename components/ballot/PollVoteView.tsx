"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useAccount,
  useChainId,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import type { Address, Hex } from "viem";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { ballotAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { isBotChainId, txUrl } from "@/lib/botchain/chain";
import { countdown, formatCloses, shares, winners, type PollView } from "@/lib/ballot";
import { describeError, shortAddress } from "@/lib/errors";

export default function PollVoteView({ id }: { id: bigint }) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { toast } = useToast();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [stage, setStage] = useState<TxStage>("idle");
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  const settledRef = useRef<Set<string>>(new Set());

  // Tick every 10s to update countdown
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

  // Read poll details
  const {
    data: pollData,
    error: pollError,
    isLoading: pollLoading,
    refetch: refetchPoll,
  } = useReadContract({
    address: deployment?.address,
    abi: ballotAbi,
    functionName: "pollOf",
    args: [id],
    query: {
      enabled: Boolean(deployment?.address && id > 0n),
      retry: false,
    },
  });

  // Read choice of connected wallet
  const {
    data: choiceData,
    refetch: refetchChoice,
  } = useReadContract({
    address: deployment?.address,
    abi: ballotAbi,
    functionName: "choiceOf",
    args: [id, address ?? ("0x0000000000000000000000000000000000000000" as Address)],
    query: {
      enabled: Boolean(deployment?.address && id > 0n && address),
    },
  });

  const { writeContractAsync, data: hash, error: writeError, isPending: isWriting } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: receiptSuccess,
    isError: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  // Settled ref pattern
  useEffect(() => {
    if (!hash || settledRef.current.has(hash)) return;

    if (receiptSuccess) {
      settledRef.current.add(hash);
      setStage("confirmed");
      refetchPoll();
      refetchChoice();
      toast("success", "Vote recorded", "Your vote has been mined onto BOT Chain.");
    } else if (receiptError) {
      settledRef.current.add(hash);
      setStage("failed");
      toast("error", "Vote failed", "The transaction could not be confirmed.");
    }
  }, [hash, receiptSuccess, receiptError, refetchPoll, refetchChoice, toast]);

  const poll: PollView | null = useMemo(() => {
    if (!pollData) return null;
    return pollData as PollView;
  }, [pollData]);

  const [hasVoted, votedOption] = useMemo(() => {
    if (!choiceData) return [false, 0];
    const [voted, opt] = choiceData as [boolean, number];
    return [voted, opt];
  }, [choiceData]);

  const handleCastVote = async () => {
    if (selectedOption === null || !deployment) return;

    try {
      setStage("signing");
      await writeContractAsync({
        address: deployment.address,
        abi: ballotAbi,
        functionName: "vote",
        args: [id, selectedOption],
      });
      setStage("pending");
    } catch (err) {
      setStage("idle");
      toast("error", "Could not cast vote", describeError(err));
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast("info", "Link copied", "Poll URL copied to clipboard.");
    }
  };

  // 1. Loading state
  if (pollLoading) {
    return (
      <Panel className="text-center py-12">
        <p className="font-serif italic text-[16px] text-[var(--text-muted)] animate-pulse">
          Retrieving ballot from BOT Chain…
        </p>
      </Panel>
    );
  }

  // 2. Poll not found state
  if (pollError || !poll || poll.creator === "0x0000000000000000000000000000000000000000") {
    return (
      <Panel className="text-center py-12 space-y-4">
        <h2 className="font-serif text-[24px] font-bold text-[var(--text-primary)]">
          There is no poll #{id.toString()}.
        </h2>
        <p className="text-[13px] text-[var(--text-muted)]">
          This question has either never been asked, or is on a different network.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button variant="outline">← Return to open polls</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  // Computed state
  const isClosed = !poll.open || nowSec >= Number(poll.closesAt);
  const tallyShares = shares(poll.tally);
  const winInfo = winners(poll.tally);

  return (
    <div className="space-y-6">
      {/* Editorial Headline Question */}
      <article className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-2 font-serif">
          <span>
            Question #{id.toString()} · Asked by {shortAddress(poll.creator)}
          </span>
          <span className="font-sans tabular-nums">
            {isClosed ? "Final" : countdown(poll.closesAt, nowSec)}
          </span>
        </div>

        <h1 className="font-serif text-[28px] sm:text-[34px] md:text-[38px] font-bold leading-tight text-[var(--text-primary)]">
          {poll.question}
        </h1>

        <div className="flex flex-wrap items-center justify-between text-[13px] text-[var(--text-muted)] pt-1">
          <span>
            Closes: <strong className="font-semibold text-[var(--text-primary)]">{formatCloses(poll.closesAt)}</strong>
          </span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-[12px] underline cursor-pointer hover:text-[var(--text-primary)]"
          >
            Share poll link
          </button>
        </div>
      </article>

      {/* Main Ballot Area */}
      <Panel className="space-y-6">
        <div className="flex justify-between items-center text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-2">
          <span>Options ({poll.options.length})</span>
          <span>
            {isClosed ? "Final Results" : `${poll.totalVotes} votes cast`}
          </span>
        </div>

        {/* Options rows */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {poll.options.map((optionText, idx) => {
            const isWinner = isClosed && winInfo.indices.includes(idx);
            const isSelected = selectedOption === idx;
            const isMyChoice = hasVoted && votedOption === idx;
            const voteCount = poll.tally[idx] ?? 0;
            const sharePercent = tallyShares[idx] ?? 0;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (!isClosed && !hasVoted) {
                    setSelectedOption(idx);
                  }
                }}
                className={`py-3.5 px-2 transition-colors ${
                  !isClosed && !hasVoted ? "cursor-pointer hover:bg-[var(--bg-base)]" : ""
                } ${isSelected ? "bg-[var(--bg-base)]" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Bubble + Text */}
                  <div className="flex items-center gap-3 min-w-0">
                    {!isClosed && !hasVoted && (
                      <span
                        className={`ballot-bubble ${
                          isSelected ? "ballot-bubble-filled" : ""
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    <span
                      className={`text-[15px] font-sans break-words ${
                        isWinner ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {optionText}
                    </span>

                    {/* Stamped Badge if this was your choice */}
                    {isMyChoice && (
                      <span className="editorial-stamp ml-2">VOTE RECORDED</span>
                    )}

                    {/* Tied flag */}
                    {isClosed && winInfo.isTie && isWinner && (
                      <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold border border-[var(--border-strong)] px-1.5 py-0.5">
                        Tied
                      </span>
                    )}
                  </div>

                  {/* Right: Numbers */}
                  <div className="text-right flex-shrink-0 tabular-nums font-sans text-[13px]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {sharePercent}%
                    </span>
                    <span className="text-[var(--text-muted)] text-[12px] ml-1.5">
                      ({voteCount})
                    </span>
                  </div>
                </div>

                {/* Thin horizontal result rule */}
                <div className="mt-2 w-full bg-[var(--border-subtle)] h-[3px]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isMyChoice || isWinner ? "bg-[var(--accent)]" : "bg-[var(--text-primary)]"
                    }`}
                    style={{ width: `${sharePercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Voting Actions */}
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
          {isClosed ? (
            <div className="p-3 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-muted)] text-center font-serif italic">
              Polling has concluded. Results are final and permanently recorded on-chain.
            </div>
          ) : hasVoted ? (
            <div className="p-3 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[13px] space-y-1">
              <p className="font-semibold text-[var(--text-primary)]">
                You have voted in this poll.
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">
                Votes cannot be changed, replaced, or withdrawn. Your choice is permanently recorded.
              </p>
              {hash && (
                <div className="pt-1">
                  <a
                    href={txUrl(chainId, hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono underline"
                    style={{ color: "var(--accent)" }}
                  >
                    View transaction receipt →
                  </a>
                </div>
              )}
            </div>
          ) : !isConnected ? (
            <div className="space-y-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  const injected = connectors.find((c) => c.id === "injected" || c.id === "metaMaskSDK");
                  if (injected) connect({ connector: injected });
                }}
              >
                Connect a wallet to vote
              </Button>
              <p className="text-[12px] text-center text-[var(--text-muted)]">
                Anyone with a wallet extension can vote once.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={selectedOption === null || isWriting || isConfirming}
                loading={isWriting || isConfirming}
                onClick={handleCastVote}
              >
                {selectedOption === null
                  ? "Select an option above"
                  : isWriting
                  ? "Confirm in wallet…"
                  : isConfirming
                  ? "Recording vote…"
                  : "Cast your vote"}
              </Button>
              <TxStatus stage={stage} hash={hash} />
              {writeError && (
                <p className="text-[12px] text-[var(--accent)] font-medium">
                  {describeError(writeError)}
                </p>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Honest Limits Block */}
      <footer className="p-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)] space-y-1.5">
        <p className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-primary)]">
          Protocol Invariants
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>One vote per wallet, not per person. Multiple wallets can vote independently.</li>
          <li>A vote cannot be changed, replaced, or retracted once cast.</li>
          <li>Tallies are live and public; late voters see current standings.</li>
          <li>Polls run their full duration unconditionally without early closing.</li>
        </ul>
      </footer>
    </div>
  );
}
