/** Run explicitly after migrations. Upserts public definitions only; no judge import. */
import { challenges } from "../src/content/catalog.ts";
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
const response = await fetch(
  `${url}/rest/v1/challenge_versions?on_conflict=id`,
  {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(
      challenges.map((c) => ({
        id: c.versionId,
        challenge_id: c.id,
        difficulty: c.difficulty,
        base_xp: c.baseXp,
        definition: c,
        published: true,
      })),
    ),
  },
);
if (!response.ok) throw new Error(`Catalog seed failed (${response.status})`);
console.log(
  `Published ${challenges.length} public challenge definitions. Execution remains disabled.`,
);
