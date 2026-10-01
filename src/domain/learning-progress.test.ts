import { describe, expect, test } from "vitest";
import { challenges } from "../content/catalog";
import { learningProgress } from "./learning-progress";

describe("learning progress", () => {
  const quiz = challenges.find((item) => item.id === "concept-values")!;
  const code = challenges.find((item) => item.id === "literal-number")!;

  test("counts the quiz module and ignores duplicate and unrelated completions", () => {
    expect(
      learningProgress(challenges, quiz, [
        quiz.id,
        quiz.id,
        code.id,
        "unpublished",
      ]),
    ).toEqual({
      label: "Módulo de conceitos",
      completed: 1,
      total: 10,
      remaining: 9,
    });
  });

  test("counts the published guided route, including completed concept lessons", () => {
    expect(learningProgress(challenges, code, [quiz.id, code.id])).toEqual({
      label: "Trilha de aprendizado",
      completed: 2,
      total: 29,
      remaining: 27,
    });
  });

  test("deduplicates published IDs and completes at zero remaining", () => {
    const lessons = challenges.filter((item) => item.kind === "quiz");
    expect(
      learningProgress(
        [...lessons, quiz],
        quiz,
        lessons.map((item) => item.id),
      ),
    ).toEqual({
      label: "Módulo de conceitos",
      completed: 10,
      total: 10,
      remaining: 0,
    });
  });

  test("uses only the current topic for challenges outside a guided route", () => {
    const current = challenges.find((item) => item.topicId === "algorithms")!;
    const total = new Set(
      challenges
        .filter((item) => item.topicId === "algorithms")
        .map((item) => item.id),
    ).size;
    expect(
      learningProgress(challenges, current, [quiz.id, current.id]),
    ).toEqual({
      label: "Desafios do tema",
      completed: 1,
      total,
      remaining: total - 1,
    });
  });

  test("counts all published concepts without inventing module boundaries", () => {
    const lessons = Array.from({ length: 12 }, (_, index) => ({
      ...quiz,
      id: `quiz-${index}`,
      learningPath: { position: index + 1, total: 12 },
    }));
    expect(
      learningProgress([...lessons].reverse(), lessons[10], [
        "quiz-0",
        "quiz-10",
      ]),
    ).toEqual({
      label: "Módulo de conceitos",
      completed: 2,
      total: 12,
      remaining: 10,
    });
  });

  test("does not invent unpublished lessons from route metadata", () => {
    expect(learningProgress([], code, [code.id])).toEqual({
      label: "Trilha de aprendizado",
      completed: 0,
      total: 0,
      remaining: 0,
    });
  });
});
