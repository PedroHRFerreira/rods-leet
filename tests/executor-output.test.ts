import { describe, expect, it } from "vitest";
import { getEvaluation, parseProgramOutput } from "../judge/index";

describe("standalone program judging", () => {
  it("reads actual stdout without manufacturing an expected result", () => {
    expect(parseProgramOutput(" 5\n")).toBe(5);
    expect(parseProgramOutput("[1,2]\n")).toEqual([1, 2]);
    expect(parseProgramOutput('{"ok":true,"value":null}\n')).toEqual({
      ok: true,
      value: null,
    });
    expect(parseProgramOutput('"texto"\n')).toBe("texto");
    expect(parseProgramOutput("true\n")).toBe(true);
    expect(parseProgramOutput("null\n")).toBe(null);
    expect(parseProgramOutput("aprendi\n")).toBe("aprendi");
    expect(parseProgramOutput("False\n")).toBe(false);
    expect(parseProgramOutput("None\n")).toBe(null);
    expect(parseProgramOutput("debug\n5\n")).toBe("debug\n5");
  });

  it("compares program results while function solutions retain their contract", () => {
    const program = getEvaluation(
      "find-max",
      "python",
      "submission",
      "program",
    );
    const functionMode = getEvaluation("find-max", "python");
    expect(program.cases.some((item) => !item.public)).toBe(true);
    for (const item of program.cases) {
      expect(program.compare(item.input, item.expected, item.expected)).toBe(
        true,
      );
      expect(program.compare(item.input, item.expected, "wrong")).toBe(false);
      expect(
        functionMode.compare(item.input, item.expected, item.expected),
      ).toBe(false);
      expect(
        functionMode.compare(item.input, item.expected, {
          result: item.expected,
          inputUnchanged: true,
        }),
      ).toBe(true);
    }
  });
});
