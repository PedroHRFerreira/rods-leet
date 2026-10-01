import { describe, expect, it } from "vitest";
import { evaluateConceptQuiz } from "../judge/concept-quiz";

const answers = {
  "concept-values": "b",
  "concept-variables": "a",
  "concept-numbers": "c",
  "concept-text": "b",
  "concept-booleans": "a",
  "concept-functions": "c",
  "concept-parameters": "b",
  "concept-return": "a",
  "concept-export": "c",
  "concept-classes": "b",
};
describe("private concept quiz grading", () => {
  it.each(Object.entries(answers))(
    "%s accepts exactly one of the three alternatives and explains each result",
    (id, answer) => {
      for (const option of ["a", "b", "c"]) {
        const result = evaluateConceptQuiz(id, option);
        expect(result.verdict).toBe(
          option === answer ? "accepted" : "wrong_answer",
        );
        expect(result.message.length).toBeGreaterThan(40);
        expect(Object.keys(result).sort()).toEqual(["message", "verdict"]);
      }
    },
  );
  it.each(["", "d", "A", "a ", "__proto__", "constructor"])(
    "rejects invalid alternative %j",
    (option) => {
      expect(() => evaluateConceptQuiz("concept-values", option)).toThrow(
        RangeError,
      );
    },
  );
  it.each(["", "unknown", "sum-two-integers", "__proto__", "constructor"])(
    "rejects unavailable questionnaire %j",
    (id) => {
      expect(() => evaluateConceptQuiz(id, "a")).toThrow(RangeError);
    },
  );
});
