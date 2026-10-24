import { describe, expect, it } from "vitest";
import {
  byteLength,
  countdown,
  estimateCreateGas,
  formatCloses,
  shares,
  validatePoll,
  winners,
} from "../ballot";

describe("ballot lib", () => {
  describe("byteLength", () => {
    it("measures ASCII and UTF-8 multibyte characters accurately", () => {
      expect(byteLength("hello")).toBe(5);
      expect(byteLength("🔥")).toBe(4);
      expect(byteLength("café")).toBe(5);
    });
  });

  describe("validatePoll", () => {
    it("accepts valid poll parameters", () => {
      const errors = validatePoll({
        question: "Should we build on BOT Chain?",
        options: ["Yes", "No"],
        duration: 86400,
      });
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("rejects empty question", () => {
      const errors = validatePoll({
        question: "   ",
        options: ["Yes", "No"],
        duration: 86400,
      });
      expect(errors.question).toBe("A question is required.");
    });

    it("rejects question exceeding 140 bytes", () => {
      const errors = validatePoll({
        question: "a".repeat(141),
        options: ["Yes", "No"],
        duration: 86400,
      });
      expect(errors.question).toContain("141 bytes");
    });

    it("rejects fewer than 2 options or more than 6 options", () => {
      const errors1 = validatePoll({
        question: "Test?",
        options: ["Solo"],
        duration: 86400,
      });
      expect(errors1.general).toContain("between 2 and 6 options");

      const errors7 = validatePoll({
        question: "Test?",
        options: ["1", "2", "3", "4", "5", "6", "7"],
        duration: 86400,
      });
      expect(errors7.general).toContain("between 2 and 6 options");
    });

    it("rejects empty options and options exceeding 48 bytes", () => {
      const errors = validatePoll({
        question: "Test?",
        options: ["Valid", "", "x".repeat(49)],
        duration: 86400,
      });
      expect(errors.options?.[1]).toBe("Option cannot be empty.");
      expect(errors.options?.[2]).toContain("49 bytes");
    });

    it("flags duplicate options on both offending rows", () => {
      const errors = validatePoll({
        question: "Test?",
        options: ["Alpha", "Beta", "Alpha"],
        duration: 86400,
      });
      expect(errors.options?.[0]).toBe("Duplicate option.");
      expect(errors.options?.[2]).toBe("Duplicate option.");
      expect(errors.options?.[1]).toBeUndefined();
    });

    it("validates duration boundaries", () => {
      const tooShort = validatePoll({
        question: "Test?",
        options: ["Yes", "No"],
        duration: 3599,
      });
      expect(tooShort.duration).toBe("Duration must be between 1 hour and 30 days.");

      const tooLong = validatePoll({
        question: "Test?",
        options: ["Yes", "No"],
        duration: 2592001,
      });
      expect(tooLong.duration).toBe("Duration must be between 1 hour and 30 days.");
    });
  });

  describe("shares (largest-remainder 100%)", () => {
    it("returns all zeros when total votes is 0", () => {
      expect(shares([0, 0, 0])).toEqual([0, 0, 0]);
      expect(shares([0n, 0n])).toEqual([0, 0]);
    });

    it("sums exactly to 100 for equal split 3 ways", () => {
      const res = shares([1, 1, 1]);
      const sum = res.reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
      // 33.333% each -> two 33% and one 34%
      expect(res).toContain(34);
      expect(res).toContain(33);
    });

    it("sums exactly to 100 for uneven splits", () => {
      const testCases = [
        [10, 20, 30],
        [1, 2],
        [100, 0],
        [7, 3, 2, 1],
        [13, 17, 23, 47],
      ];
      for (const tc of testCases) {
        const s = shares(tc);
        expect(s.reduce((a, b) => a + b, 0)).toBe(100);
      }
    });
  });

  describe("winners", () => {
    it("handles zero votes", () => {
      const res = winners([0, 0, 0]);
      expect(res.indices).toEqual([]);
      expect(res.isTie).toBe(false);
      expect(res.maxVotes).toBe(0n);
    });

    it("identifies single clear winner", () => {
      const res = winners([5, 12, 3]);
      expect(res.indices).toEqual([1]);
      expect(res.isTie).toBe(false);
      expect(res.maxVotes).toBe(12n);
    });

    it("identifies ties between top options", () => {
      const res = winners([10, 10, 4]);
      expect(res.indices).toEqual([0, 1]);
      expect(res.isTie).toBe(true);
      expect(res.maxVotes).toBe(10n);
    });
  });

  describe("countdown and formatCloses", () => {
    it("returns 'Closed' when time has passed", () => {
      expect(countdown(1000, 1001)).toBe("Closed");
      expect(countdown(1000, 1000)).toBe("Closed");
    });

    it("formats days, hours, and minutes countdowns", () => {
      const now = 1_000_000;
      expect(countdown(now + 90000, now)).toBe("closes in 1d 1h");
      expect(countdown(now + 7200, now)).toBe("closes in 2h");
      expect(countdown(now + 300, now)).toBe("closes in 5m");
      expect(countdown(now + 30, now)).toBe("closes in < 1m");
    });

    it("formats editorial close date", () => {
      // 1760086400 -> Friday 10 October 2025, 08:53 UTC (example timestamp)
      const formatted = formatCloses(1760086400);
      expect(formatted).toContain("UTC");
      expect(formatted).toMatch(/^[A-Z][a-z]+ \d{1,2} [A-Z][a-z]+, \d{2}:\d{2} UTC$/);
    });
  });

  describe("estimateCreateGas", () => {
    it("scales appropriately with option count", () => {
      expect(estimateCreateGas(2)).toBe(270_000n);
      expect(estimateCreateGas(6)).toBe(410_000n);
    });
  });
});
