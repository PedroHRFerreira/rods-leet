/** Sends repository-authored fixtures to the isolated gateway. Never evaluates learner code on the host. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { challenges } from "../src/content/catalog.ts";
import {
  getEditorial,
  getEvaluation,
  parseFunctionOutput,
} from "../judge/index.ts";
import {
  missingExportReproduction,
  solutionVariants,
  type SolutionVariant,
} from "../judge/validation/solutions.ts";

const endpoint = process.env.LOCAL_EXECUTOR_URL ?? "http://127.0.0.1:8789";
const token = process.env.LOCAL_EXECUTOR_TOKEN;
if (!token) throw new Error("LOCAL_EXECUTOR_TOKEN is required");
const manifest = await readFile("executor/manifest.example.json");
const manifestSha256 = createHash("sha256").update(manifest).digest("hex");
const versions = JSON.parse(manifest.toString()).versions;
type Execution = {
  termination: string;
  compilation?: { stderr?: string; stdout?: string };
  cases: { termination: string; stdout: string; stderr: string }[];
};
async function execute(
  challengeId: string,
  functionName: string,
  variant: SolutionVariant,
  cases: { input: unknown }[],
): Promise<Execution> {
  for (let attempt = 0; attempt < 120; attempt++) {
    const response = await fetch(`${endpoint}/v1/execute`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        submissionId: `validation-${challengeId}-${variant.name}`,
        manifestSha256,
        languageId: variant.languageId,
        runtimeVersion: versions[variant.languageId],
        functionName,
        executionMode: "function",
        files: variant.files,
        cases,
      }),
    });
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (!response.ok) throw new Error(`Gateway ${response.status}`);
    return (await response.json()) as Execution;
  }
  throw new Error("Gateway stayed busy");
}
const rows: {
  challengeId: string;
  languageId: string;
  variant: string;
  publicCases: number;
  hiddenCases: number;
  passed: boolean;
  failure?: string;
}[] = [];
const selected = process.env.VALIDATE_CHALLENGES?.split(",");
const baselineLanguage = process.env.VALIDATE_BASELINE_LANGUAGE;
if (
  baselineLanguage &&
  !["javascript", "typescript", "python", "sql"].includes(baselineLanguage)
)
  throw new Error("Unsupported baseline language");
for (const challenge of challenges.filter(
  (challenge) =>
    challenge.kind !== "quiz" && (!selected || selected.includes(challenge.id)),
)) {
  const variants: SolutionVariant[] = baselineLanguage
    ? [
        {
          name: "editorial-baseline",
          languageId: baselineLanguage as SolutionVariant["languageId"],
          files: getEditorial(challenge.id, baselineLanguage).files,
          logs: false,
        },
      ]
    : solutionVariants(challenge);
  for (const variant of variants) {
    const evaluation = getEvaluation(challenge.id, variant.languageId);
    const row = {
      challengeId: challenge.id,
      languageId: variant.languageId,
      variant: variant.name,
      publicCases: evaluation.cases.filter((item) => item.public).length,
      hiddenCases: evaluation.cases.filter((item) => !item.public).length,
      passed: false,
      failure: undefined as string | undefined,
    };
    try {
      const execution = await execute(
        challenge.id,
        challenge.kind === "sql" ? "sql" : (challenge.functionName ?? "solve"),
        variant,
        evaluation.cases.map((item) => ({ input: item.input })),
      );
      if (execution.termination !== "ok")
        throw new Error(
          `${execution.termination}: ${String(JSON.stringify(execution)).slice(0, 500)}`,
        );
      if (execution.cases.length !== evaluation.cases.length)
        throw new Error("Case count mismatch");
      for (const [index, test] of evaluation.cases.entries()) {
        const output = execution.cases[index];
        if (output.termination !== "ok")
          throw new Error(
            `Case ${index + 1}: ${output.termination}: ${String(output.stderr ?? output).slice(0, 300)}`,
          );
        const actual =
          variant.languageId === "sql"
            ? JSON.parse(output.stdout)
            : parseFunctionOutput(output.stdout);
        if (!evaluation.compare(test.input, test.expected, actual))
          throw new Error(
            `Case ${index + 1}: comparator rejected result${test.public ? `: expected ${JSON.stringify(test.expected).slice(0, 600)}, actual ${JSON.stringify(actual).slice(0, 600)}` : ""}`,
          );
        if (variant.logs && !output.stdout.includes("diagnostico"))
          throw new Error(`Case ${index + 1}: diagnostic output lost`);
      }
      row.passed = true;
    } catch (error) {
      row.failure = error instanceof Error ? error.message : String(error);
    }
    rows.push(row);
    console.log(JSON.stringify(row));
    await writeFile(
      process.env.VALIDATION_REPORT ?? "/tmp/rods-catalog-validation.json",
      JSON.stringify({ manifestSha256, rows }, null, 2),
    );
  }
}
const reproduction = await execute(
  "sum-two-integers",
  "solve",
  missingExportReproduction,
  [{ input: { a: 2, b: 3 } }],
);
if (reproduction.cases[0]?.termination !== "runtime_error")
  throw new Error("Missing export reproduction no longer fails as expected");
console.log(
  JSON.stringify({
    reproduction: "custom function without exported solve",
    termination: reproduction.cases[0].termination,
  }),
);
const failed = rows.filter((row) => !row.passed);
console.log(
  JSON.stringify({
    variants: rows.length,
    challenges: new Set(rows.map((row) => row.challengeId)).size,
    passed: rows.length - failed.length,
    failed: failed.length,
    caseExecutions: rows.reduce(
      (sum, row) => sum + row.publicCases + row.hiddenCases,
      0,
    ),
  }),
);
if (failed.length) process.exitCode = 1;
