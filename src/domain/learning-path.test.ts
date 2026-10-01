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
  test("starts with concept questions and keeps code lessons available for later exploration", () => {
    const states = learningPathStates(logic, new Set());
    expect(states.get("concept-values")).toBe("current");
    expect(states.get("concept-variables")).toBe("available");
    expect(states.get("literal-number")).toBe("locked");
    expect(states.get("is-even-integer")).toBe("locked");
  });

  test("keeps completed nodes and advances the guided route", () => {
    const states = learningPathStates(
      logic,
      new Set(["concept-values", "sum-two-integers", "is-even-integer"]),
    );
    expect(states.get("sum-two-integers")).toBe("completed");
    expect(states.get("concept-variables")).toBe("current");
    expect(states.get("is-even-integer")).toBe("completed");
    expect(states.get("concept-numbers")).toBe("available");
    expect(states.get("sum-even")).toBe("locked");
  });
});

describe("guided recommendations and map geometry", () => {
  test("teaches concepts before code and preserves older completions", () => {
    expect(nextLearningChallenge(challenges, new Set())?.id).toBe(
      "concept-values",
    );
    expect(
      nextLearningChallenge(
        challenges,
        new Set(["concept-values", "sum-two-integers"]),
      )?.id,
    ).toBe("concept-variables");
    const questions = logic
      .filter((challenge) => challenge.kind === "quiz")
      .map((challenge) => challenge.id);
    expect(questions).toHaveLength(10);
    expect(nextLearningChallenge(challenges, new Set(questions))?.id).toBe(
      "literal-number",
    );
    const introduction = logic.slice(0, 16).map((challenge) => challenge.id);
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

  test("places all 29 lessons separately and connects adjacent steps without a row jump", () => {
    expect(logic).toHaveLength(29);
    const positions = learningPathPositions(logic.length);
    expect(new Set(positions.map(([x, y]) => `${x},${y}`)).size).toBe(29);
    for (let index = 1; index < positions.length; index++) {
      const [x, y] = positions[index];
      const [previousX, previousY] = positions[index - 1];
      expect(Math.abs(x - previousX) + Math.abs(y - previousY)).toBe(140);
    }
  });
});
