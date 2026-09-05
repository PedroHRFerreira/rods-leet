/** Executes repository-authored SQL only. PostgreSQL 16 semantics check, not PG18/E2B certification. */
import { challenges } from "../src/content/catalog.ts";
import { getEvaluation } from "../judge/index.ts";
import { sqlReferenceQueries } from "../judge/sql.ts";
import type { SqlColumn, SqlResult } from "../judge/comparators.ts";

const container = `codegamer-sql-reference-${crypto.randomUUID().slice(0, 8)}`;
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
async function docker(args: string[], input?: string) {
  const command = new Deno.Command("docker", {
    args,
    stdin: input === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = command.spawn();
  if (input !== undefined) {
    const writer = child.stdin.getWriter();
    await writer.write(encoder.encode(input));
    await writer.close();
  }
  const result = await child.output();
  if (!result.success) throw new Error(decoder.decode(result.stderr));
  return decoder.decode(result.stdout);
}

let count = 0;
try {
  await docker([
    "run",
    "--rm",
    "-d",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=local-test-only",
    "postgres:16-alpine",
  ]);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await docker([
        "exec",
        container,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw new Error("PostgreSQL TCP startup timeout");
  for (const challenge of challenges.filter((c) => c.kind === "sql")) {
    const evaluation = getEvaluation(challenge.id, "sql", "submission");
    const query = sqlReferenceQueries[challenge.id].replace(/;\s*$/, "");
    for (const [index, test] of evaluation.cases.entries()) {
      const fixture = test.input as { schema: string; seedSql: string };
      const script = `BEGIN;
DROP SCHEMA IF EXISTS challenge CASCADE;
CREATE SCHEMA challenge;
SET search_path=challenge,pg_catalog;
${fixture.schema}
${fixture.seedSql}
CREATE TEMP VIEW cg_result AS ${query};
SELECT json_build_object(
 'columns',(SELECT json_agg(json_build_object('name',a.attname,'type',t.typname) ORDER BY a.attnum)
    FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
    WHERE a.attrelid='cg_result'::regclass AND a.attnum>0 AND NOT a.attisdropped),
 'rows',(SELECT coalesce(json_agg(row_to_json(r)),'[]'::json) FROM (${query}) r)
);
ROLLBACK;
`;
      const output = await docker(
        [
          "exec",
          "-i",
          "-e",
          "PGPASSWORD=local-test-only",
          container,
          "psql",
          "-X",
          "-q",
          "-t",
          "-A",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        script,
      );
      const raw = JSON.parse(output.trim()) as {
        columns: SqlColumn[];
        rows: Record<string, unknown>[];
      };
      const actual: SqlResult = {
        columns: raw.columns,
        rows: raw.rows.map((row) =>
          raw.columns.map((column) => row[column.name]),
        ),
      };
      if (!evaluation.compare(test.input, test.expected, actual)) {
        throw new Error(
          `${challenge.id} case ${
            index + 1
          }: comparator rejected reference\nExpected ${JSON.stringify(
            test.expected,
          )}\nActual ${JSON.stringify(actual)}`,
        );
      }
      count++;
    }
    console.log(`PASS ${challenge.id}: ${evaluation.cases.length} fixtures`);
  }
  console.log(
    `PASS ${count} SQL reference executions on local PostgreSQL 16 (column names/types, values, NULL, duplicates and order). PostgreSQL 18/E2B remains unhomologated.`,
  );
} finally {
  await docker(["rm", "-f", container]).catch(() => {});
}
