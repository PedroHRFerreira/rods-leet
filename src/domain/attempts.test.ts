import { describe, expect, it } from "vitest";
import {
  abandonAttempt,
  canStartBossSession,
  createAttempt,
  expireAttempt,
  finishSubmission,
  queueSubmission,
} from "./attempts";

const start = () =>
  createAttempt({
    id: "a",
    challengeId: "max",
    challengeVersionId: "v1",
    mode: "hard",
    difficulty: "easy",
    serverNow: "2026-09-05T00:00:00Z",
  });
describe("server-authoritative hard sessions", () => {
  it("keeps the original deadline and accepts work received before expiry", () => {
    const attempt = start();
    expect(attempt.deadlineAt).toBe("2026-09-05T00:45:00.000Z");
    const queued = queueSubmission(attempt, "s", "2026-09-05T00:44:59Z");
    const expired = expireAttempt(queued, "2026-09-05T01:00:00Z");
    expect(expired.status).toBe("expired");
    expect(finishSubmission(expired, "s", "accepted").status).toBe("accepted");
    expect(() =>
      queueSubmission(attempt, "late", "2026-09-05T00:45:01Z"),
    ).toThrow();
  });
  it("reserves pending attempts and handles duplicate delivery only once", () => {
    const queued = queueSubmission(start(), "s", "2026-09-05T00:01:00Z");
    expect(queueSubmission(queued, "s", "2026-09-05T00:01:00Z")).toBe(queued);
    expect(() =>
      queueSubmission(queued, "s2", "2026-09-05T00:01:00Z"),
    ).toThrow();
    const finished = finishSubmission(queued, "s", "wrong_answer");
    expect(finishSubmission(finished, "s", "wrong_answer")).toBe(finished);
    expect(finished.rejectedCount).toBe(1);
  });
  it("closes after three errors and refunds infrastructure failures", () => {
    let attempt = finishSubmission(
      queueSubmission(start(), "infra", "2026-09-05T00:01:00Z"),
      "infra",
      "infrastructure_error",
    );
    expect(attempt.rejectedCount).toBe(0);
    for (let index = 0; index < 3; index++)
      attempt = finishSubmission(
        queueSubmission(attempt, `s${index}`, "2026-09-05T00:02:00Z"),
        `s${index}`,
        "compile_error",
      );
    expect(attempt.status).toBe("failed");
    expect(attempt.solutionAvailable).toBe(true);
  });
  it("does not add an error for expiration or abandonment", () => {
    expect(expireAttempt(start(), "2026-09-05T01:00:00Z").rejectedCount).toBe(
      0,
    );
    expect(abandonAttempt(start()).rejectedCount).toBe(0);
  });
  it("uses a rolling 24-hour boss window", () => {
    const sessions = [
      "2026-09-04T12:00:00Z",
      "2026-09-04T13:00:00Z",
      "2026-09-04T14:00:00Z",
    ];
    expect(canStartBossSession(sessions, "2026-09-05T11:59:00Z")).toBe(false);
    expect(canStartBossSession(sessions, "2026-09-05T12:00:00Z")).toBe(true);
  });
});
