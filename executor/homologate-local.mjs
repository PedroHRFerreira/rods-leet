import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const endpoint = process.env.LOCAL_EXECUTOR_URL ?? "http://127.0.0.1:8789";
const token = process.env.LOCAL_EXECUTOR_TOKEN;
if (!token) throw new Error("LOCAL_EXECUTOR_TOKEN is required");

const manifest = await readFile("executor/manifest.example.json");
const manifestSha256 = createHash("sha256").update(manifest).digest("hex");
const cases = [
  { input: [3, 7, 2, 9, 1] },
  { input: [-8, -3, -12] },
  { input: [] },
];
const references = {
  python: [
    "solution.py",
    "def find_max(values):\n    return max(values) if values else None\n",
  ],
  javascript: [
    "solution.js",
    "export function findMax(values) { return values.length ? Math.max(...values) : null; }\n",
  ],
  typescript: [
    "solution.ts",
    "export function findMax(values: readonly number[]): number | null { return values.length ? Math.max(...values) : null; }\n",
  ],
  java: [
    "Solution.java",
    "public final class Solution { public static Integer findMax(int[] values) { if (values.length == 0) return null; int best=values[0]; for (int value:values) if(value>best) best=value; return best; } }\n",
  ],
  csharp: [
    "Solution.cs",
    "public static class Solution { public static int? FindMax(int[] values) { if(values.Length==0)return null; int best=values[0]; foreach(int value in values)if(value>best)best=value; return best; } }\n",
  ],
  cpp: [
    "solution.cpp",
    "#include <optional>\n#include <vector>\nstd::optional<int> find_max(const std::vector<int>& values){if(values.empty())return std::nullopt;int best=values[0];for(int value:values)if(value>best)best=value;return best;}\n",
  ],
  c: [
    "solution.c",
    "#include <stdbool.h>\n#include <stddef.h>\ntypedef struct { bool present; int value; } MaxResult;\nMaxResult find_max(const int *values,size_t length){if(!length)return (MaxResult){false,0};int best=values[0];for(size_t i=1;i<length;i++)if(values[i]>best)best=values[i];return (MaxResult){true,best};}\n",
  ],
  go: [
    "solution.go",
    "package solution\nfunc FindMax(values []int)(int,bool){if len(values)==0{return 0,false};best:=values[0];for _,value:=range values{if value>best{best=value}};return best,true}\n",
  ],
  rust: [
    "solution.rs",
    "pub fn find_max(values:&[i32])->Option<i32>{values.iter().copied().max()}\n",
  ],
  kotlin: [
    "Solution.kt",
    "fun findMax(values:IntArray):Int? = values.maxOrNull()\n",
  ],
};
const selected = new Set(
  (
    process.env.HOMOLOGATE_LANGUAGES ??
    `${Object.keys(references).join(",")},sql`
  ).split(","),
);

async function execute(languageId, path, content, selectedCases = cases) {
  const response = await fetch(`${endpoint}/v1/execute`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      submissionId: `homologation-${languageId}`,
      templateId: "local",
      manifestSha256,
      languageId,
      runtimeVersion: JSON.parse(manifest).versions[languageId],
      functionName: languageId === "sql" ? "sql" : "findMax",
      files: [{ path, content }],
      cases: selectedCases,
    }),
  });
  if (!response.ok) throw new Error(`${languageId}:gateway_${response.status}`);
  const result = await response.json();
  if (
    result.termination !== "ok" ||
    result.cases.length !== selectedCases.length
  )
    throw new Error(
      `${languageId}:execution_failed:${JSON.stringify(result).slice(0, 1000)}`,
    );
  return result;
}

for (const [language, [path, content]] of Object.entries(references)) {
  if (!selected.has(language)) continue;
  const result = await execute(language, path, content);
  const outputs = result.cases.map((item) => {
    if (item.termination !== "ok")
      throw new Error(`${language}:${item.termination}`);
    return JSON.parse(item.stdout);
  });
  if (
    outputs[0].result !== 9 ||
    outputs[1].result !== -3 ||
    outputs[2].result !== null
  )
    throw new Error(`${language}:wrong_result`);
  if (!outputs.every((output) => output.inputUnchanged))
    throw new Error(`${language}:input_mutated`);
  console.log(JSON.stringify({ language, status: "passed" }));
}

if (selected.has("sql")) {
  const sql = await execute(
    "sql",
    "solution.sql",
    "SELECT score FROM scores ORDER BY score DESC;",
    [
      {
        input: {
          schema: "CREATE TABLE scores(score integer NOT NULL);",
          seedSql: "INSERT INTO scores(score) VALUES (3),(9),(-2);",
          ordered: true,
        },
      },
    ],
  );
  if (sql.cases[0]?.termination !== "ok")
    throw new Error(`sql:${sql.cases[0]?.termination}`);
  const sqlOutput = JSON.parse(sql.cases[0].stdout);
  if (JSON.stringify(sqlOutput.rows) !== JSON.stringify([[9], [3], [-2]]))
    throw new Error("sql:wrong_result");
  console.log(
    JSON.stringify({ language: "sql", status: "passed", manifestSha256 }),
  );
}
