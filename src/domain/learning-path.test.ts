import { describe, expect, test } from "vitest";
import { challenges } from "../content/catalog";
import { learningPathStates } from "./learning-path";

const logic = challenges
  .filter((challenge) => challenge.topicId === "logic")
  .sort(
    (a, b) => (a.learningPath?.position ?? 0) - (b.learningPath?.position ?? 0),
  );

describe("learning-path states", () => {
  test("marks the first three fundamentals as current, available, and locked", () => {
    const states = learningPathStates(logic, new Set());
    expect(states.get("sum-two-integers")).toBe("current");
    expect(states.get("variable-bonus")).toBe("available");
    expect(states.get("is-even-integer")).toBe("locked");
  });

  test("keeps completed nodes and advances the guided route", () => {
    const states = learningPathStates(
      logic,
      new Set(["sum-two-integers", "is-even-integer"]),
    );
    expect(states.get("sum-two-integers")).toBe("completed");
    expect(states.get("variable-bonus")).toBe("current");
    expect(states.get("is-even-integer")).toBe("completed");
    expect(states.get("find-max")).toBe("available");
    expect(states.get("sum-even")).toBe("locked");
  });
});
