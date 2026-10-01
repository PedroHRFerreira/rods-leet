import { describe, expect, test } from "vitest";
import { challenges } from "../content/catalog";
import {
  learningPathStates,
  learningPathPositions,
  nextLearningChallenge,
} from "./learning-path";

const logic = challenges
  .filter((challenge) => challenge.topicId === "logic")
  .sort(
    (a, b) => (a.learningPath?.position ?? 0) - (b.learningPath?.position ?? 0),
  );

describe("learning-path states", () => {
  test("recommends the first two guided lessons and keeps later lessons for exploration", () => {
    const states = learningPathStates(logic, new Set());
    expect(states.get("literal-number")).toBe("current");
    expect(states.get("literal-text")).toBe("available");
    expect(states.get("is-even-integer")).toBe("locked");
  });

  test("keeps completed nodes and advances the guided route", () => {
    const states = learningPathStates(
      logic,
      new Set(["literal-number", "sum-two-integers", "is-even-integer"]),
    );
    expect(states.get("sum-two-integers")).toBe("completed");
    expect(states.get("literal-text")).toBe("current");
    expect(states.get("is-even-integer")).toBe("completed");
    expect(states.get("named-value")).toBe("available");
    expect(states.get("sum-even")).toBe("locked");
  });
});

describe("guided recommendations and map geometry", () => {
  test("starts from syntax and advances without discarding older completions", () => {
    expect(nextLearningChallenge(challenges, new Set())?.id).toBe(
      "literal-number",
    );
    expect(
      nextLearningChallenge(
        challenges,
        new Set(["literal-number", "sum-two-integers"]),
      )?.id,
    ).toBe("literal-text");
    const introduction = logic.slice(0, 6).map((challenge) => challenge.id);
    expect(nextLearningChallenge(challenges, new Set(introduction))?.id).toBe(
      "sum-two-integers",
    );
    expect(
      nextLearningChallenge(
        challenges,
        new Set([...introduction, "sum-two-integers"]),
      )?.id,
    ).toBe("variable-bonus");
    expect(
      nextLearningChallenge(
        challenges,
        new Set(logic.map((challenge) => challenge.id)),
      ),
    ).toBeUndefined();
  });

  test("places all 19 lessons separately and connects adjacent steps without a row jump", () => {
    expect(logic).toHaveLength(19);
    const positions = learningPathPositions(logic.length);
    expect(new Set(positions.map(([x, y]) => `${x},${y}`)).size).toBe(19);
    for (let index = 1; index < positions.length; index++) {
      const [x, y] = positions[index];
      const [previousX, previousY] = positions[index - 1];
      expect(Math.abs(x - previousX) + Math.abs(y - previousY)).toBe(140);
    }
  });
});
