/** PostgreSQL invariant checks without Docker. Queue/cron/net remain test doubles. */
import { readFileSync, readdirSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import ts from "typescript";
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
  // Compile presentation modules in memory to compare real contracts with SQL.
  const compile = (path) =>
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
  const moduleUrl = (source) =>
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const catalogUrl = moduleUrl(compile("../src/domain/shop-catalog.ts"));
  const { SHOP_ITEMS } = await import(catalogUrl);
  const { weeklyOffers } = await import(
    moduleUrl(
      compile("../src/domain/economy.ts").replaceAll(
        '"./shop-catalog"',
        JSON.stringify(catalogUrl),
      ),
    )
  );
  const catalog = await db.query(
    "select id,name,description,kind,price,min_level,value,rarity,acquisition,collection_id,hint_count from private.shop_items order by ordinal",
  );
  deepStrictEqual(
    catalog.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      kind: row.kind,
      price: row.price,
      minLevel: row.min_level,
      value: row.value,
      rarity: row.rarity,
      acquisition: row.acquisition,
      ...(row.collection_id ? { collectionId: row.collection_id } : {}),
      ...(row.hint_count ? { hintCount: row.hint_count } : {}),
    })),
    SHOP_ITEMS,
  );
  for (const date of [
    "2026-10-05T02:59:59.999Z",
    "2026-10-05T03:00:00Z",
    "2026-10-12T03:00:00Z",
    "2026-12-31T23:59:59Z",
    "2027-01-04T03:00:00Z",
  ]) {
    const result = await db.query(
      "select private.shop_offers($1::timestamptz) offers",
      [date],
    );
    deepStrictEqual(
      result.rows[0].offers.map((offer) => ({
        ...offer,
        startsAt: new Date(offer.startsAt).toISOString(),
        endsAt: new Date(offer.endsAt).toISOString(),
      })),
      weeklyOffers(new Date(date)),
    );
  }
  console.log("PASS SQL/domain catalogue and five offer periods");
  const fixtures = new URL("../supabase/tests/", import.meta.url);
  for (const file of readdirSync(fixtures)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(
      readFileSync(new URL(file, fixtures), "utf8").replace(/^\\set.*$/gm, ""),
    );
    console.log(`PASS ${file}`);
  }
  await db.exec(
    readFileSync(
      new URL("../tests/fixtures/shop-rewards-v2.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("PASS shop-rewards-v2.sql");
  console.log(
    "SQL migrations/invariants passed on isolated PostgreSQL. PGMQ/cron/net doubled; production integration remains separate.",
  );
} finally {
  await db.close();
}
