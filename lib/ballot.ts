import type { Address } from "viem";
import {
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_QUESTION_BYTES,
  MAX_OPTION_BYTES,
  MIN_DURATION,
  MAX_DURATION,
} from "./limits";

export interface PollView {
  creator: Address;
  closesAt: bigint;
  createdAt: bigint;
  totalVotes: number;
  open: boolean;
  question: string;
  options: readonly string[];
  tally: readonly number[];
}

export interface PollSummary {
  id: bigint;
  creator: Address;
  closesAt: bigint;
  totalVotes: number;
  open: boolean;
  question: string;
}

export interface PollInput {
  question: string;
  options: string[];
  duration: number;
}

export interface FieldErrors {
  question?: string;
  options?: Record<number, string>;
  duration?: string;
  general?: string;
}

export function byteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export const DURATION_OPTIONS = [
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "1 day", value: 86400 },
  { label: "3 days", value: 259200 },
  { label: "7 days", value: 604800 },
  { label: "30 days", value: 2592000 },
] as const;

/**
 * Validates poll input against contract constraints.
 * Duplicate options are flagged on both offending rows.
 */
export function validatePoll(input: PollInput): FieldErrors {
  const errors: FieldErrors = {};

  const qTrimmed = input.question.trim();
  const qBytes = byteLength(qTrimmed);
  if (qBytes === 0) {
    errors.question = "A question is required.";
  } else if (qBytes > MAX_QUESTION_BYTES) {
    errors.question = `Question is ${qBytes} bytes (maximum is ${MAX_QUESTION_BYTES}).`;
  }

  const optCount = input.options.length;
  if (optCount < MIN_OPTIONS || optCount > MAX_OPTIONS) {
    errors.general = `Polls must provide between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.`;
  }

  const optErrors: Record<number, string> = {};

  // Check individual option lengths
  for (let i = 0; i < input.options.length; i++) {
    const opt = input.options[i].trim();
    const len = byteLength(opt);
    if (len === 0) {
      optErrors[i] = "Option cannot be empty.";
    } else if (len > MAX_OPTION_BYTES) {
      optErrors[i] = `Option is ${len} bytes (maximum is ${MAX_OPTION_BYTES}).`;
    }
  }

  // Check pairwise duplicates (flagged on both rows)
  for (let i = 0; i < input.options.length; i++) {
    const optI = input.options[i].trim();
    if (!optI) continue;
    for (let j = i + 1; j < input.options.length; j++) {
      const optJ = input.options[j].trim();
      if (!optJ) continue;
      if (optI === optJ) {
        optErrors[i] = "Duplicate option.";
        optErrors[j] = "Duplicate option.";
      }
    }
  }

  if (Object.keys(optErrors).length > 0) {
    errors.options = optErrors;
  }

  if (input.duration < MIN_DURATION || input.duration > MAX_DURATION) {
    errors.duration = "Duration must be between 1 hour and 30 days.";
  }

  return errors;
}

/**
 * Largest-remainder method: converts vote tallies to integer percentages summing to 100.
 * If total votes is 0, returns an array of 0s.
 */
export function shares(tally: readonly (number | bigint)[]): number[] {
  const bigTally = tally.map((v) => BigInt(v));
  const total = bigTally.reduce((a, b) => a + b, 0n);

  if (total === 0n) {
    return bigTally.map(() => 0);
  }

  const totalNum = Number(total);
  const exact = bigTally.map((v) => (Number(v) * 100) / totalNum);
  const floors = exact.map((v) => Math.floor(v));
  const remainders = exact.map((v, i) => ({ index: i, remainder: v - floors[i] }));

  let sumFloors = floors.reduce((a, b) => a + b, 0);
  const remainderCount = 100 - sumFloors;

  remainders.sort((a, b) => b.remainder - a.remainder);

  const result = [...floors];
  for (let i = 0; i < remainderCount; i++) {
    result[remainders[i].index]++;
  }

  return result;
}

export interface WinnersResult {
  indices: number[];
  isTie: boolean;
  maxVotes: bigint;
}

/**
 * Determines which options won or tied.
 */
export function winners(tally: readonly (number | bigint)[]): WinnersResult {
  if (tally.length === 0) {
    return { indices: [], isTie: false, maxVotes: 0n };
  }

  const bigTally = tally.map((v) => BigInt(v));
  let maxVotes = 0n;
  for (const v of bigTally) {
    if (v > maxVotes) maxVotes = v;
  }

  if (maxVotes === 0n) {
    return { indices: [], isTie: false, maxVotes: 0n };
  }

  const indices: number[] = [];
  for (let i = 0; i < bigTally.length; i++) {
    if (bigTally[i] === maxVotes) {
      indices.push(i);
    }
  }

  return {
    indices,
    isTie: indices.length > 1,
    maxVotes,
  };
}

/**
 * Format timestamp into readable editorial date line:
 * e.g. "Saturday 25 October, 14:00 UTC"
 */
export function formatCloses(closesAtSec: number | bigint): string {
  const ms = Number(closesAtSec) * 1000;
  const date = new Date(ms);
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
  const day = date.getUTCDate();
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(date);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${dayName} ${day} ${month}, ${hours}:${minutes} UTC`;
}

/**
 * Concise countdown text relative to current time.
 */
export function countdown(closesAtSec: number | bigint, nowSec?: number): string {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const closes = Number(closesAtSec);
  const diff = closes - now;

  if (diff <= 0) {
    return "Closed";
  }

  if (diff >= 86400) {
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return hours > 0 ? `closes in ${days}d ${hours}h` : `closes in ${days}d`;
  }

  if (diff >= 3600) {
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return mins > 0 ? `closes in ${hours}h ${mins}m` : `closes in ${hours}h`;
  }

  if (diff >= 60) {
    const mins = Math.floor(diff / 60);
    return `closes in ${mins}m`;
  }

  return "closes in < 1m";
}

/**
 * Approximate gas cost estimation for creating a poll with n options.
 */
export function estimateCreateGas(optionCount: number): bigint {
  return 200_000n + BigInt(optionCount) * 35_000n;
}
