import { describe, expect, it } from "vitest";
import { parsePublicSubmission } from "./submission-validation";

const queued = {
  id: "submission-1",
  attemptId: "attempt-1",
  status: "queued",
  submittedAt: "2026-10-01T12:00:00Z",
};
const completed = {
  ...queued,
  status: "completed",
  verdict: "accepted",
  completedAt: "2026-10-01T12:00:01Z",
  xpAwarded: 40,
};
describe("submission response validation", () => {
  it("accepts pending jobs and accepted completions", () => {
    expect(
      parsePublicSubmission(queued, {
        id: "submission-1",
        attemptId: "attempt-1",
      }),
    ).toEqual(queued);
    expect(
      parsePublicSubmission({ ...queued, status: "running", xpAwarded: 0 }),
    ).toMatchObject({ status: "running" });
    expect(parsePublicSubmission(completed)).toEqual(completed);
  });
  it("rejects fabricated statuses, incomplete results and mismatched identity", () => {
    for (const value of [
      {},
      null,
      { ...queued, id: "" },
      { ...queued, attemptId: 123 },
      { ...queued, status: "success" },
      { ...queued, status: "completed" },
      { ...completed, verdict: "passed" },
      { ...queued, submittedAt: "invalid" },
      { ...completed, completedAt: "2026-09-30T12:00:00Z" },
    ])
      expect(() => parsePublicSubmission(value)).toThrow();
    expect(() => parsePublicSubmission(queued, { id: "other" })).toThrow();
    expect(() =>
      parsePublicSubmission(queued, { attemptId: "other" }),
    ).toThrow();
  });
  it("rejects XP rewards on pending or rejected jobs and invalid XP values", () => {
    for (const value of [
      { ...queued, xpAwarded: 5 },
      { ...queued, verdict: "accepted" },
      { ...queued, completedAt: completed.completedAt },
      { ...completed, verdict: "wrong_answer" },
      { ...completed, xpAwarded: -1 },
      { ...completed, xpAwarded: 0.5 },
      { ...completed, xpAwarded: Infinity },
    ])
      expect(() => parsePublicSubmission(value)).toThrow();
    expect(
      parsePublicSubmission({
        ...completed,
        verdict: "wrong_answer",
        xpAwarded: 0,
      }),
    ).toMatchObject({ verdict: "wrong_answer" });
  });
  it("rejects malformed diagnostics used by the result screen", () => {
    for (const field of [
      { message: {} },
      { stdout: 3 },
      { publicCases: [{ label: "case", passed: "yes" }] },
      { metrics: { wallMs: -1 } },
      { metrics: null },
      {
        complexity: {
          status: "compatible",
          label: "linear",
          measuredRange: [10, 1],
        },
      },
    ])
      expect(() => parsePublicSubmission({ ...completed, ...field })).toThrow();
    expect(
      parsePublicSubmission({
        ...completed,
        publicCases: [{ label: "case", passed: true, actual: "ok" }],
        metrics: { wallMs: 20 },
        complexity: { status: "inconclusive", label: "Dados insuficientes" },
      }),
    ).toMatchObject({ status: "completed" });
  });
});
