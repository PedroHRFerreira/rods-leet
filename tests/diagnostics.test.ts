import { expect, it } from "vitest";
import { functionDiagnostic } from "../judge/diagnostics";

it("explains the missing JavaScript exported entry point instead of quoting internal paths", () => {
  const message = functionDiagnostic({
    languageId: "javascript",
    functionName: "solve",
    publicInput: { a: 2, b: 3 },
    stderr:
      "file:///workspace/adapter.mjs:4\nTypeError: student.solve is not a function",
  });
  expect(message).toContain("export function solve(input)");
  expect(message).toContain("input.a e input.b");
  expect(message).toContain("não precisa chamá-la manualmente");
  expect(message).not.toContain("adapter.mjs");
});

it.each(["solve", "find_max"])(
  "explains Python's missing %s function",
  (name) => {
    const message = functionDiagnostic({
      languageId: "python",
      functionName: name === "find_max" ? "findMax" : name,
      publicInput: name === "solve" ? { a: 2, b: 3 } : [1, 2],
      stderr: `AttributeError: module 'solution' has no attribute '${name}'`,
    });
    expect(message).toContain(`def ${name}(input):`);
    expect(message).toContain("print");
    expect(message).toContain("return");
  },
);

it("distinguishes an undefined JavaScript return from valid null and console diagnostics", () => {
  const base = {
    languageId: "javascript",
    functionName: "solve",
    publicInput: 3,
  };
  expect(
    functionDiagnostic({ ...base, stdout: "debug\nundefined\n" }),
  ).toContain("sem devolver uma resposta");
  expect(
    functionDiagnostic({ ...base, stdout: "undefined\n5\n" }),
  ).toBeUndefined();
  expect(functionDiagnostic({ ...base, stdout: "null\n" })).toBeUndefined();
  expect(
    functionDiagnostic({ ...base, languageId: "python", stdout: "null\n" }),
  ).toBeUndefined();
});

it("does not misidentify learner errors or SQL as a missing function", () => {
  const base = {
    languageId: "javascript",
    functionName: "solve",
    publicInput: 3,
  };
  expect(
    functionDiagnostic({
      ...base,
      stderr: "TypeError: helper.solve is not a function",
    }),
  ).toBeUndefined();
  expect(
    functionDiagnostic({
      ...base,
      languageId: "sql",
      stderr: "student.solve is not a function",
    }),
  ).toBeUndefined();
});
