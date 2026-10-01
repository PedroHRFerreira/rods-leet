import { describe, expect, test } from "vitest";
import type { PublicSubmission, Verdict } from "../lib/contracts";
import {
  createResultReactionLedger,
  resultReactionTone,
} from "./resultReactionState";

const submission: PublicSubmission = {
  id: "submission-1",
  attemptId: "attempt-1",
  status: "completed",
  verdict: "accepted",
  submittedAt: "2026-10-01T12:00:00Z",
};

describe("backend result reaction eligibility", () => {
  test("only a completed official accepted submission celebrates", () => {
    expect(resultReactionTone(submission, "submit")).toBe("success");
    expect(resultReactionTone(submission, "run")).toBeNull();
    for (const status of ["queued", "running"] as const) {
      expect(
        resultReactionTone({ ...submission, status }, "submit"),
      ).toBeNull();
    }
  });

  test("attributable rejection encourages while technical failure stays neutral", () => {
    const rejections: Verdict[] = [
      "wrong_answer",
      "compile_error",
      "runtime_error",
      "time_limit",
      "memory_limit",
      "output_limit",
    ];
    for (const verdict of rejections) {
      expect(resultReactionTone({ ...submission, verdict }, "submit")).toBe(
        "encouragement",
      );
      expect(resultReactionTone({ ...submission, verdict }, "run")).toBeNull();
    }
    expect(
      resultReactionTone(
        { ...submission, verdict: "infrastructure_error" },
        "submit",
      ),
    ).toBeNull();
    expect(
      resultReactionTone({ ...submission, verdict: undefined }, "submit"),
    ).toBeNull();
  });
});

describe("result reaction replay protection", () => {
  test("persists across remounts and a new page ledger, scoped to identity", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const ledger = createResultReactionLedger();
    expect(ledger.claim("user-a", "result-1", storage)).toBe(true);
    expect(ledger.claim("user-a", "result-1", storage)).toBe(false);
    expect(
      createResultReactionLedger().claim("user-a", "result-1", storage),
    ).toBe(false);
    expect(ledger.claim("user-b", "result-1", storage)).toBe(true);
    expect(ledger.claim("user-a", "result-2", storage)).toBe(true);
  });

  test("blocked storage keeps the page usable and suppresses page-local replay", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const ledger = createResultReactionLedger();
    expect(ledger.claim("user-a", "result-1", storage)).toBe(true);
    expect(ledger.claim("user-a", "result-1", storage)).toBe(false);
    expect(ledger.claim("user-a", "result-2", null)).toBe(true);
    expect(ledger.claim("user-a", "result-2", null)).toBe(false);
  });

  test("cannot claim without a stable identity and submission ID", () => {
    const ledger = createResultReactionLedger();
    expect(ledger.claim("", "result-1", null)).toBe(false);
    expect(ledger.claim("user-a", "", null)).toBe(false);
  });
});
