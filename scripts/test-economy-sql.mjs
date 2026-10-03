/** PostgreSQL invariant checks without Docker. Queue/cron/net remain test doubles. */
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const runtime = process.env.ECONOMY_SQL_RUNTIME;
if (!runtime) {
  throw new Error(
    "Set ECONOMY_SQL_RUNTIME to the absolute PGlite dist/index.js path installed in a temporary directory.",
  );
}
const { PGlite } = await import(pathToFileURL(runtime).href);
const db = new PGlite();
try {
  const bootstrap = readFileSync(
    new URL("./test-database.py", import.meta.url),
    "utf8",
  ).match(/bootstrap=r'''([\s\S]*?)'''/)?.[1];
  if (!bootstrap) throw new Error("Database test bootstrap not found");
  await db.exec(bootstrap);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(new URL(file, migrations), "utf8")
      .split("\n")
      .filter((line) => !line.toLowerCase().startsWith("create extension"))
      .join("\n");
    await db.exec(sql);
  }
  const fixtures = new URL("../supabase/tests/", import.meta.url);
  for (const file of readdirSync(fixtures)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(
      readFileSync(new URL(file, fixtures), "utf8").replace(/^\\set.*$/gm, ""),
    );
    console.log(`PASS ${file}`);
  }
  console.log(
    "SQL migrations/invariants passed on isolated PostgreSQL. PGMQ/cron/net doubled; production integration remains separate.",
  );
} finally {
  await db.close();
}
