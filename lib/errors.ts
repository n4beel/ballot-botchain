import { BaseError, ContractFunctionRevertedError } from "viem";

export interface RevertDetails {
  errorName?: string;
  args?: readonly unknown[];
}

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Traverses an error to extract the custom revert error name and arguments.
 */
export function extractRevert(err: unknown): RevertDetails | undefined {
  if (typeof err !== "object" || err === null) return undefined;

  // Direct property check
  if (
    "data" in err &&
    (err as any).data &&
    typeof (err as any).data === "object" &&
    (err as any).data.errorName
  ) {
    return {
      errorName: (err as any).data.errorName,
      args: (err as any).data.args,
    };
  }
  if ("errorName" in err && typeof (err as any).errorName === "string") {
    return {
      errorName: (err as any).errorName,
      args: (err as any).args,
    };
  }

  // If it's a viem BaseError, use walk
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => {
      if (e instanceof ContractFunctionRevertedError) return true;
      if (
        typeof e === "object" &&
        e !== null &&
        "data" in e &&
        Boolean((e as any).data?.errorName)
      )
        return true;
      if (
        typeof e === "object" &&
        e !== null &&
        "errorName" in e &&
        Boolean((e as any).errorName)
      )
        return true;
      return false;
    });

    if (reverted) {
      const errorObj = reverted as any;
      if (errorObj.data?.errorName) {
        return {
          errorName: errorObj.data.errorName,
          args: errorObj.data.args,
        };
      }
      if (errorObj.errorName) {
        return {
          errorName: errorObj.errorName,
          args: errorObj.args,
        };
      }
    }
  }

  return undefined;
}

/**
 * Checks whether an error represents the user rejecting the prompt in their wallet.
 */
export function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("User rejected") ||
    msg.includes("User denied") ||
    msg.includes("user rejected") ||
    msg.includes("ACTION_REJECTED") ||
    (typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 4001)
  );
}

/**
 * Translates an error into user-facing editorial copy for Ballot.
 */
export function describeError(err: unknown): string {
  if (isUserRejection(err)) {
    return "Transaction cancelled in wallet.";
  }

  const rev = extractRevert(err);
  if (rev?.errorName) {
    switch (rev.errorName) {
      case "AlreadyVoted": {
        const prev = rev.args?.[1] !== undefined ? Number(rev.args[1]) + 1 : undefined;
        return prev
          ? `You have already voted on this poll (option #${prev}). Votes cannot be changed.`
          : "You have already voted on this poll. Votes cannot be changed.";
      }
      case "PollClosed":
        return "This poll has closed and is no longer accepting votes.";
      case "BadChoice": {
        const count = rev.args?.[1];
        return count
          ? `Invalid option. This poll only offers ${count} choices.`
          : "Invalid option selection.";
      }
      case "NoSuchPoll": {
        const id = rev.args?.[0];
        return id ? `There is no poll #${id}.` : "Poll not found.";
      }
      case "DuplicateOption":
        return "All poll options must be unique.";
      case "BadQuestion":
        return "Question must be between 1 and 140 UTF-8 bytes.";
      case "BadOption": {
        const idx = rev.args?.[0] !== undefined ? Number(rev.args[0]) + 1 : undefined;
        return idx
          ? `Option #${idx} must be between 1 and 48 UTF-8 bytes.`
          : "Option must be between 1 and 48 UTF-8 bytes.";
      }
      case "BadOptionCount":
        return "Poll must have between 2 and 6 options.";
      case "BadDuration":
        return "Poll duration must be between 1 hour and 30 days.";
    }
  }

  if (err instanceof Error) {
    // Check for common error substrings
    const m = err.message;
    if (m.includes("AlreadyVoted")) {
      return "You have already voted on this poll. Votes cannot be changed.";
    }
    if (m.includes("PollClosed")) {
      return "This poll has closed and is no longer accepting votes.";
    }
    if (m.includes("NoSuchPoll")) {
      return "Poll not found.";
    }
    if (m.includes("DuplicateOption")) {
      return "All poll options must be unique.";
    }
    if (m.includes("connector not connected")) {
      return "Please connect your wallet.";
    }
    return m.length < 120 ? m : `${m.slice(0, 117)}…`;
  }

  return "An unexpected error occurred. Please try again.";
}
