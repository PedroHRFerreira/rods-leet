import { expect, it } from "vitest";
import {
  validateLocalPractice,
  LOCAL_PRACTICE_MAX_INPUT_BYTES,
  LOCAL_PRACTICE_MAX_SOURCE_BYTES,
  type LocalPracticeValidationInput,
} from "./local-practice-validation";

const base: LocalPracticeValidationInput = {
  languageId: "javascript",
  files: [
    {
      path: "src/solution.js",
      content: "export function solve(input) { return input; }",
    },
  ],
  functionName: "solve",
  input: { text: "olá", values: [null, true, 3] },
};
const validate = (changes: Partial<LocalPracticeValidationInput> = {}) =>
  validateLocalPractice({ ...base, ...changes });

it("preserves a single JS or TS function source and JSON study input without running code", () => {
  for (const [languageId, extension] of [
    ["javascript", "js"],
    ["typescript", "ts"],
  ] as const) {
    const source =
      "// import eval constructor words are ordinary source\nexport async function solve(x) { return x; }";
    const result = validate({
      languageId,
      files: [{ path: `solution.${extension}`, content: source }],
    });
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("unavailable");
    expect(result.source).toBe(source);
    expect(JSON.parse(result.inputJson)).toEqual(base.input);
  }
});

it("routes unsupported languages and multiple files to server fallback", () => {
  expect(validate({ languageId: "python" })).toMatchObject({
    available: false,
    reason: "unsupported_language",
  });
  expect(
    validate({ files: [...base.files, { path: "helper.js", content: "" }] }),
  ).toMatchObject({ available: false, reason: "unsupported_workspace" });
  expect(validate({ files: [] }).available).toBe(false);
  expect(
    validate({ files: [{ path: "solution.ts", content: "" }] }).available,
  ).toBe(false);
});

it.each([
  "../solution.js",
  "/solution.js",
  "a/../solution.js",
  "a//solution.js",
  "a/./solution.js",
  "C:\\solution.js",
  "solution\u0000.js",
])("falls back for unsafe source paths %s", (path) => {
  expect(validate({ files: [{ path, content: "" }] })).toMatchObject({
    available: false,
    reason: "unsupported_workspace",
  });
});

it.each([
  "__proto__",
  "constructor",
  "prototype",
  "solve()",
  "module.solve",
  "1solve",
  "função",
])("does not resolve unsafe function names %s", (functionName) => {
  expect(validate({ functionName })).toMatchObject({
    available: false,
    reason: "invalid_input",
  });
});

it("bounds UTF-8 source and input bytes rather than character count", () => {
  expect(
    validate({
      files: [
        {
          path: "solution.js",
          content: "é".repeat(LOCAL_PRACTICE_MAX_SOURCE_BYTES / 2),
        },
      ],
    }).available,
  ).toBe(true);
  expect(
    validate({
      files: [
        {
          path: "solution.js",
          content: "é".repeat(LOCAL_PRACTICE_MAX_SOURCE_BYTES / 2 + 1),
        },
      ],
    }),
  ).toMatchObject({ available: false, reason: "unsupported_workspace" });
  expect(
    validate({ input: "é".repeat((LOCAL_PRACTICE_MAX_INPUT_BYTES - 2) / 2) })
      .available,
  ).toBe(true);
  expect(
    validate({ input: "é".repeat(LOCAL_PRACTICE_MAX_INPUT_BYTES / 2) }),
  ).toMatchObject({ available: false, reason: "invalid_input" });
});

it.each([
  undefined,
  NaN,
  Infinity,
  -Infinity,
  BigInt(1),
  () => 1,
  { value: undefined },
  { value: NaN },
  [undefined],
  new Date(),
  new Map(),
])("rejects input whose JSON meaning would change: %s", (input) => {
  expect(validate({ input })).toMatchObject({
    available: false,
    reason: "invalid_input",
  });
});

it("rejects cycles, sparse arrays and getters without executing them", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  let invoked = false;
  const getter = {
    get value() {
      invoked = true;
      return 1;
    },
  };
  expect(validate({ input: cycle }).available).toBe(false);
  expect(validate({ input: Array(2) }).available).toBe(false);
  expect(validate({ input: getter }).available).toBe(false);
  expect(invoked).toBe(false);
});

it("keeps repeated acyclic references and prototype-looking JSON keys as ordinary data", () => {
  const shared = { value: 1 };
  const input = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":"data"}',
  );
  input.references = [shared, shared];
  const result = validate({ input });
  expect(result.available).toBe(true);
  if (result.available) expect(JSON.parse(result.inputJson)).toEqual(input);
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
});

it("falls back for deeply nested or oversized collections before transferring them", () => {
  let input: unknown = null;
  for (let index = 0; index < 40; index++) input = { next: input };
  expect(validate({ input })).toMatchObject({
    available: false,
    reason: "invalid_input",
  });
  expect(
    validate({ input: Array.from({ length: 10_001 }, () => null) }),
  ).toMatchObject({ available: false, reason: "invalid_input" });
});

it("does not execute custom serializers", () => {
  let invoked = false;
  const input = {
    toJSON() {
      invoked = true;
      return "replacement";
    },
  };
  expect(validate({ input })).toMatchObject({
    available: false,
    reason: "invalid_input",
  });
  expect(invoked).toBe(false);
});
