import { challengeById } from "../src/content/catalog.ts";
import { hiddenInputs } from "./cases.ts";
import { referenceSolutions } from "./references/algorithms.ts";
import { comparePath, type PathInput } from "./references/shortest-path.ts";
import { compareSql, equalJson, type SqlResult } from "./comparators.ts";
import { sqlFixtures } from "./sql.ts";

export { getEditorial } from "./editorial.ts";
export type ExecutionMode = "function" | "program";

/** A program prints its result as JSON; plain text remains a string. */
export function parseProgramOutput(stdout: string): unknown {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Python's scalar print syntax is convenient for first lessons.
    if (text === "True") return true;
    if (text === "False") return false;
    if (text === "None") return null;
    return text;
  }
}
export interface EvaluationCase {
  input: unknown;
  expected: unknown;
  public: boolean;
}
export interface Evaluation {
  cases: EvaluationCase[];
  compare(input: unknown, expected: unknown, actual: unknown): boolean;
}

/** Server-only factory. Never send cases with public=false to an untrusted client. */
export function getEvaluation(
  challengeId: string,
  languageId: string,
  kind: string = "submission",
  executionMode: ExecutionMode = "function",
): Evaluation {
  const challenge = challengeById.get(challengeId);
  if (!challenge || !challenge.languageIds.includes(languageId as never))
    throw new Error("Desafio ou linguagem indisponível.");
  const publicOnly = kind === "run" || kind === "runs" || kind === "public";
  if (challenge.kind === "sql") {
    const cases = sqlFixtures(
      challengeId,
      challenge.sqlSchema!,
      challenge.examples,
    );
    return {
      cases: publicOnly ? cases.filter((item) => item.public) : cases,
      compare: (_input, expected, actual) =>
        compareSql(expected as SqlResult, actual, true),
    };
  }
  const reference = referenceSolutions[challengeId];
  if (!reference || !hiddenInputs[challengeId]?.length)
    throw new Error("Perfil sem referência ou testes oficiais.");
  const cases: EvaluationCase[] = challenge.examples.map((example) => ({
    input: structuredClone(example.input),
    expected: structuredClone(example.output),
    public: true,
  }));
  if (!publicOnly)
    for (const input of hiddenInputs[challengeId])
      cases.push({
        input: structuredClone(input),
        expected: reference(structuredClone(input)),
        public: false,
      });
  return {
    cases,
    compare(input, expected, actual) {
      if (challengeId === "shortest-path")
        return comparePath(input as PathInput, expected, actual);
      if (challengeId === "find-max") {
        if (executionMode === "program") return equalJson(expected, actual);
        if (!actual || typeof actual !== "object") return false;
        const result = actual as {
          result?: unknown;
          inputUnchanged?: boolean;
          inputAfter?: unknown;
        };
        const unchanged = Object.hasOwn(result, "inputAfter")
          ? equalJson(input, result.inputAfter)
          : result.inputUnchanged === true;
        return unchanged && equalJson(expected, result.result);
      }
      return equalJson(expected, actual);
    },
  };
}
