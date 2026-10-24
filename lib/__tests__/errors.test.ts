import { describe, expect, it } from "vitest";
import { describeError, isUserRejection } from "../errors";

describe("errors lib", () => {
  describe("isUserRejection", () => {
    it("detects wallet rejection messages", () => {
      expect(isUserRejection(new Error("User rejected the request."))).toBe(true);
      expect(isUserRejection(new Error("User denied transaction signature."))).toBe(true);
      expect(isUserRejection({ code: 4001, message: "User rejected" })).toBe(true);
      expect(isUserRejection(new Error("RPC timeout"))).toBe(false);
      expect(isUserRejection(null)).toBe(false);
    });
  });

  describe("describeError", () => {
    it("handles user rejection", () => {
      const err = new Error("User rejected the request.");
      expect(describeError(err)).toBe("Transaction cancelled in wallet.");
    });

    it("decodes AlreadyVoted custom error", () => {
      const err = {
        data: {
          errorName: "AlreadyVoted",
          args: [1n, 1], // option index 1 -> option #2
        },
      };
      expect(describeError(err)).toContain("option #2");
      expect(describeError(err)).toContain("cannot be changed");
    });

    it("decodes PollClosed custom error", () => {
      const err = {
        data: {
          errorName: "PollClosed",
          args: [1n, 1760086400n],
        },
      };
      expect(describeError(err)).toContain("has closed and is no longer accepting votes");
    });

    it("decodes BadChoice custom error", () => {
      const err = {
        data: {
          errorName: "BadChoice",
          args: [4, 3],
        },
      };
      expect(describeError(err)).toContain("only offers 3 choices");
    });

    it("decodes NoSuchPoll custom error", () => {
      const err = {
        data: {
          errorName: "NoSuchPoll",
          args: [999n],
        },
      };
      expect(describeError(err)).toBe("There is no poll #999.");
    });

    it("decodes DuplicateOption custom error", () => {
      const err = {
        data: {
          errorName: "DuplicateOption",
          args: [0n, 1n],
        },
      };
      expect(describeError(err)).toBe("All poll options must be unique.");
    });

    it("decodes BadQuestion custom error", () => {
      const err = {
        data: {
          errorName: "BadQuestion",
          args: [150n, 140n],
        },
      };
      expect(describeError(err)).toBe("Question must be between 1 and 140 UTF-8 bytes.");
    });

    it("decodes BadOption custom error", () => {
      const err = {
        data: {
          errorName: "BadOption",
          args: [1n, 50n, 48n],
        },
      };
      expect(describeError(err)).toBe("Option #2 must be between 1 and 48 UTF-8 bytes.");
    });

    it("decodes BadOptionCount custom error", () => {
      const err = {
        data: {
          errorName: "BadOptionCount",
          args: [1n],
        },
      };
      expect(describeError(err)).toBe("Poll must have between 2 and 6 options.");
    });

    it("decodes BadDuration custom error", () => {
      const err = {
        data: {
          errorName: "BadDuration",
          args: [100n],
        },
      };
      expect(describeError(err)).toBe("Poll duration must be between 1 hour and 30 days.");
    });

    it("falls back gracefully for unknown errors", () => {
      expect(describeError(new Error("Custom network failure"))).toBe("Custom network failure");
      expect(describeError("mystery")).toBe("An unexpected error occurred. Please try again.");
    });
  });
});
