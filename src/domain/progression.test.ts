import { describe, expect, it } from "vitest";
import {
  accessSolution,
  applyFinalVerdict,
  assistanceSnapshot,
  canAccessSolution,
  createProgressState,
  levelProgress,
  sortRanking,
  useHint,
} from "./progression";
import type { FinalVerdictInput, ProgressState } from "./progression";

const result = (
  state: ProgressState,
  overrides: Partial<FinalVerdictInput> = {},
) =>
  applyFinalVerdict(state, {
    submissionId: "s1",
    challengeId: "max",
    mode: "normal",
    baseXp: 100,
    verdict: "accepted",
    assistance: assistanceSnapshot(state, "max"),
    at: "2026-09-05T00:00:00Z",
    ...overrides,
  });
describe("progression rules", () => {
  it("only rewards the first accepted submission per challenge across modes", () => {
    const first = result(createProgressState());
    expect(first.xpDelta).toBe(100);
    expect(result(first.state).duplicate).toBe(true);
    expect(result(first.state, { submissionId: "s2" }).xpDelta).toBe(0);
    const hard = result(first.state, { submissionId: "s3", mode: "hard" });
    expect(hard.xpDelta).toBe(0);
    expect(hard.state.completedChallengeIds).toEqual(["max"]);
  });
  it("uses cumulative assistance and idempotent hint consumption", () => {
    const start = createProgressState();
    start.hintBalance = 2;
    const hint = useHint(start, "max", "h1");
    expect(useHint(hint.state, "max", "h1").state.hintBalance).toBe(1);
    expect(result(hint.state).xpDelta).toBe(95);
    const second = useHint(hint.state, "max", "h2");
    expect(result(second.state, { mode: "hard" }).xpDelta).toBe(255);
    expect(() => useHint(second.state, "max", "h3")).toThrow();
  });
  it("grants another hint only after ten distinct completions", () => {
    let state = createProgressState();
    for (let index = 0; index < 10; index++)
      state = result(state, {
        submissionId: `s${index}`,
        challengeId: `c${index}`,
      }).state;
    expect(state.hintBalance).toBe(2);
    state = result(state, {
      submissionId: "again",
      challengeId: "c0",
      mode: "hard",
    }).state;
    expect(state.hintBalance).toBe(2);
  });
  it("rejections reduce future reward without deducting existing XP", () => {
    const initial = result(createProgressState(), { baseXp: 20 }).state;
    const normal = result(initial, {
      submissionId: "normal-fail",
      verdict: "wrong_answer",
      challengeId: "retry",
    });
    expect(normal.xpDelta).toBe(0);
    const hard = result(normal.state, {
      submissionId: "hard-fail",
      verdict: "compile_error",
      mode: "hard",
      challengeId: "retry",
    });
    expect(hard.xpDelta).toBe(0);
    expect(hard.state.xp).toBe(20);
    expect(
      hard.state.xpEvents.reduce((sum, event) => sum + event.amount, 0),
    ).toBe(20);
    expect(hard.state.incorrectByChallenge.retry).toBe(2);
    expect(
      result(hard.state, { submissionId: "retry-ok", challengeId: "retry" })
        .xpDelta,
    ).toBe(70);
    expect(hard.state.completedChallengeIds).toEqual(["max"]);
  });
  it("does not penalize or finalize progress on infrastructure failure", () => {
    const state = createProgressState();
    expect(
      result(state, { mode: "hard", verdict: "infrastructure_error" }).state,
    ).toBe(state);
    expect(result(state).xpDelta).toBe(100);
  });
  it("reduces future reward by 15% per rejection and floors it at zero", () => {
    let state = createProgressState();
    for (let index = 0; index < 7; index++) {
      const failed = result(state, {
        submissionId: `failed-${index}`,
        verdict: "wrong_answer",
      });
      expect(failed.xpDelta).toBe(0);
      expect(
        result(failed.state, {
          submissionId: `failed-${index}`,
          verdict: "wrong_answer",
        }).duplicate,
      ).toBe(true);
      state = failed.state;
    }
    expect(state.incorrectByChallenge.max).toBe(7);
    const approved = result(state, { submissionId: "accepted-final" });
    expect(approved.xpDelta).toBe(0);
    expect(approved.state.completedChallengeIds).toEqual(["max"]);
  });
  it("unlocks solution after three errors and persists practice across sessions", () => {
    let state = createProgressState();
    expect(() => accessSolution(state, "max")).toThrow();
    for (let index = 0; index < 3; index++)
      state = result(state, {
        submissionId: `bad${index}`,
        verdict: "wrong_answer",
      }).state;
    expect(canAccessSolution(state, "max")).toBe(true);
    const queuedSnapshot = assistanceSnapshot(state, "max");
    state = accessSolution(state, "max");
    expect(result(state, { submissionId: "practice" }).xpDelta).toBe(0);
    expect(
      result(state, {
        submissionId: "already-queued",
        assistance: queuedSnapshot,
      }).xpDelta,
    ).toBe(55);
  });
  it("does not make a solved challenge practice-only by reading its solution", () => {
    const state = accessSolution(result(createProgressState()).state, "max");
    expect(result(state, { submissionId: "hard", mode: "hard" }).xpDelta).toBe(
      0,
    );
  });
  it("calculates cumulative level boundaries", () => {
    expect(levelProgress(0)).toEqual({
      level: 0,
      xpIntoLevel: 0,
      xpForNextLevel: 150,
    });
    expect(levelProgress(149).level).toBe(0);
    expect(levelProgress(150)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForNextLevel: 300,
    });
    expect(levelProgress(449).level).toBe(1);
    expect(levelProgress(450).level).toBe(2);
  });
  it("ranks by XP, completions, then reaching time", () => {
    const common = { displayName: "Aluno", xp: 100, completedCount: 1 };
    const entries = [
      { ...common, userId: "late", reachedAt: "2026-09-05T01:00:00Z" },
      { ...common, userId: "early", reachedAt: "2026-09-05T00:00:00Z" },
      {
        ...common,
        userId: "more",
        completedCount: 2,
        reachedAt: "2026-09-05T02:00:00Z",
      },
    ];
    expect(sortRanking(entries).map((row) => row.userId)).toEqual([
      "more",
      "early",
      "late",
    ]);
  });
});
