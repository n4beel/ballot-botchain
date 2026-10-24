"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog, type Hex } from "viem";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { ballotAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { isBotChainId, txUrl } from "@/lib/botchain/chain";
import {
  byteLength,
  DURATION_OPTIONS,
  estimateCreateGas,
  validatePoll,
  type FieldErrors,
} from "@/lib/ballot";
import { describeError } from "@/lib/errors";
import { MAX_OPTION_BYTES, MAX_OPTIONS, MAX_QUESTION_BYTES, MIN_OPTIONS } from "@/lib/limits";

export default function CreatePollForm() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { toast } = useToast();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [duration, setDuration] = useState<number>(86400 * 3); // default 3 days
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState<TxStage>("idle");
  const [createdPollId, setCreatedPollId] = useState<bigint | null>(null);

  const formId = useId();
  const settledRef = useRef<Set<string>>(new Set());

  const deployment = useMemo(
    () => (isBotChainId(chainId) && isDeployed(chainId) ? getDeployment(chainId) : null),
    [chainId]
  );

  const { writeContractAsync, data: hash, error: writeError, isPending: isWriting } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: receiptSuccess,
    isError: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const receiptRef = useRef<typeof receipt>(undefined);
  receiptRef.current = receipt;

  // Settled ref pattern
  useEffect(() => {
    if (!hash || settledRef.current.has(hash)) return;

    if (receiptSuccess && receiptRef.current) {
      settledRef.current.add(hash);
      setStage("confirmed");

      // Find PollCreated event log to extract ID
      for (const log of receiptRef.current.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ballotAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "PollCreated" && decoded.args) {
            setCreatedPollId((decoded.args as { id: bigint }).id);
            break;
          }
        } catch {
          // ignore logs from other events
        }
      }

      toast("success", "Poll published", "Your question is now live and accepting votes.");
    } else if (receiptError) {
      settledRef.current.add(hash);
      setStage("failed");
      toast("error", "Publish failed", "The transaction could not be confirmed.");
    }
  }, [hash, receiptSuccess, receiptError, toast]);

  const validationErrors: FieldErrors = useMemo(() => {
    return validatePoll({ question, options, duration });
  }, [question, options, duration]);

  const isValid = Object.keys(validationErrors).length === 0;

  const handleAddOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!isValid || !deployment) {
      toast("error", "Check fields", "Please fix validation errors before publishing.");
      return;
    }

    try {
      setStage("signing");
      await writeContractAsync({
        address: deployment.address,
        abi: ballotAbi,
        functionName: "create",
        args: [question.trim(), options.map((o) => o.trim()), BigInt(duration)],
      });
      setStage("pending");
    } catch (err) {
      setStage("idle");
      toast("error", "Could not publish poll", describeError(err));
    }
  };

  // Stage confirmed ordered FIRST
  if (stage === "confirmed" && hash) {
    return (
      <Panel className="space-y-6">
        <div className="border-b border-[var(--border-subtle)] pb-4">
          <span className="editorial-stamp mb-3">PUBLISHED</span>
          <h2 className="font-serif text-[26px] font-bold text-[var(--text-primary)] mt-2">
            Poll #{createdPollId ? createdPollId.toString() : ""} is open
          </h2>
          <p className="font-serif italic text-[14px] text-[var(--text-muted)] mt-1">
            "{question.trim()}"
          </p>
        </div>

        <div className="text-[13px] text-[var(--text-primary)] space-y-2">
          <p>
            Your question has been recorded to BOT Chain. Anyone with a wallet may now cast one
            immutable vote.
          </p>
          <div className="pt-2">
            <a
              href={txUrl(chainId, hash)}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-mono underline"
              style={{ color: "var(--accent)" }}
            >
              View transaction receipt on Explorer →
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-4 border-t border-[var(--border-subtle)]">
          {createdPollId && (
            <Link href={`/p/${createdPollId}`} className="no-underline">
              <Button variant="primary">View the ballot →</Button>
            </Link>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setQuestion("");
              setOptions(["", ""]);
              setStage("idle");
              setCreatedPollId(null);
              setTouched(false);
            }}
          >
            Ask another question
          </Button>
        </div>
      </Panel>
    );
  }

  const qBytes = byteLength(question.trim());
  const estGas = estimateCreateGas(options.length);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Panel className="space-y-6">
        {/* Question Input */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label
              htmlFor={`${formId}-question`}
              className="block font-serif text-[15px] font-semibold text-[var(--text-primary)]"
            >
              The Question
            </label>
            <span
              className={`text-[11px] tabular-nums ${
                qBytes > MAX_QUESTION_BYTES ? "text-[var(--accent)] font-semibold" : "text-[var(--text-muted)]"
              }`}
            >
              {qBytes} / {MAX_QUESTION_BYTES} bytes
            </span>
          </div>
          <textarea
            id={`${formId}-question`}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Should the protocol expand its active validator set?"
            className="w-full p-3 font-serif text-[16px] bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:border-[var(--text-primary)] outline-none resize-none"
          />
          {touched && validationErrors.question && (
            <p className="mt-1 text-[12px] text-[var(--accent)] font-medium">
              {validationErrors.question}
            </p>
          )}
        </div>

        {/* Options List */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <label className="block font-serif text-[15px] font-semibold text-[var(--text-primary)]">
              Options ({options.length} of {MAX_OPTIONS})
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">
              2 to 6 unique choices · max 48 bytes each
            </span>
          </div>

          <div className="space-y-3">
            {options.map((opt, idx) => {
              const optBytes = byteLength(opt.trim());
              const optError = touched ? validationErrors.options?.[idx] : undefined;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="ballot-bubble" aria-hidden="true" />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-3 py-2 text-[14px] bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:border-[var(--text-primary)] outline-none"
                    />
                    <span
                      className={`text-[11px] tabular-nums w-[60px] text-right ${
                        optBytes > MAX_OPTION_BYTES
                          ? "text-[var(--accent)] font-semibold"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {optBytes}/48b
                    </span>
                    {options.length > MIN_OPTIONS && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="px-2 py-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer"
                        title="Remove option"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {optError && (
                    <p className="ml-6 text-[12px] text-[var(--accent)] font-medium">
                      {optError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {options.length < MAX_OPTIONS && (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
              >
                + Add another option
              </Button>
            </div>
          )}
        </div>

        {/* Duration Select */}
        <div>
          <label className="block font-serif text-[15px] font-semibold text-[var(--text-primary)] mb-2">
            Voting Duration
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DURATION_OPTIONS.map((item) => (
              <label
                key={item.value}
                className={`flex flex-col items-center justify-center p-2.5 text-center cursor-pointer border ${
                  duration === item.value
                    ? "border-[var(--text-primary)] bg-[var(--bg-base)] font-semibold"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="duration"
                  value={item.value}
                  checked={duration === item.value}
                  onChange={() => setDuration(item.value)}
                  className="sr-only"
                />
                <span className="text-[12px]">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Gas estimation hint */}
        <div className="rule-hairline pt-3 flex justify-between items-center text-[12px] text-[var(--text-muted)]">
          <span>Estimated publishing gas:</span>
          <span className="tabular-nums font-mono">~{estGas.toString()} gas</span>
        </div>
      </Panel>

      {/* Honest Limits Notice */}
      <div className="p-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)] space-y-1">
        <p className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[11px]">
          Editorial Policy & Immutability
        </p>
        <p>
          Once published, a poll runs its full duration unconditionally. Poll questions and options
          cannot be edited, replaced, or closed early. Results and voter choices are public on BOT
          Chain.
        </p>
      </div>

      <TxStatus stage={stage} hash={hash} />

      {writeError && (
        <p className="text-[13px] text-[var(--accent)] font-medium">
          {describeError(writeError)}
        </p>
      )}

      <div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!isConnected || isWriting || isConfirming || (touched && !isValid)}
          loading={isWriting || isConfirming}
          className="w-full"
        >
          {isWriting ? "Confirm in wallet…" : isConfirming ? "Publishing poll…" : "Publish poll"}
        </Button>
      </div>
    </form>
  );
}
