import { validateFiles } from "./files.ts";
import { levelForXp } from "./presenters.ts";
import { recommend } from "./recommendations.ts";
import { getEditorial } from "./editorial.ts";
import { challenges } from "../../../src/content/catalog.ts";
import { ApiError, databaseResponse } from "./db.ts";
function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}
function rejects(callback: () => unknown) {
  let failed = false;
  try {
    callback();
  } catch {
    failed = true;
  }
  assert(failed);
}
Deno.test(
  "workspace refuses traversal, duplicate files, missing files and byte overflow",
  () => {
    for (const path of [
      "../solution.ts",
      "/solution.ts",
      "x/../solution.ts",
      "solution.ts\0",
      "solution.ts\\x",
    ])
      rejects(() => validateFiles([{ path, content: "x" }], ["solution.ts"]));
    rejects(() =>
      validateFiles(
        [
          { path: "solution.ts", content: "a" },
          {
            path: "solution.ts",
            content: "b",
          },
        ],
        ["solution.ts"],
      ),
    );
    rejects(() =>
      validateFiles(
        [{ path: "solution.ts", content: "á".repeat(131073) }],
        ["solution.ts"],
      ),
    );
    assert(
      validateFiles([{ path: "solution.ts", content: "x" }], ["solution.ts"])
        .length === 1,
    );
  },
);
Deno.test(
  "database responses accept empty success bodies and reject invalid JSON",
  async () => {
    assert(
      (await databaseResponse<undefined>(
        new Response(null, { status: 204 }),
      )) === undefined,
    );
    const parsed = await databaseResponse<{ ok: boolean }>(
      Response.json({ ok: true }),
    );
    assert(parsed.ok);
    let error: unknown;
    try {
      await databaseResponse(new Response("not-json", { status: 200 }));
    } catch (cause) {
      error = cause;
    }
    assert(error instanceof ApiError && error.code === "database_error");
  },
);
Deno.test("level thresholds and personalized recommendations", () => {
  assert(levelForXp(149).level === 0);
  assert(levelForXp(150).level === 1);
  assert(levelForXp(450).level === 2);
  const catalog = [
    {
      id: "a",
      versionId: "a:v1",
      topicId: "logic",
      difficulty: "easy",
    },
    { id: "b", versionId: "b:v1", topicId: "sql", difficulty: "easy" },
  ];
  assert(recommend(catalog, [], [])[0].challengeId === "a");
  assert(
    recommend(
      catalog,
      [],
      [
        {
          challenge_version_id: "b:v1",
          verdict: "wrong_answer",
        },
      ],
    )[0].challengeId === "b",
  );
  assert(
    recommend(
      catalog,
      ["b"],
      [
        {
          challenge_version_id: "b:v1",
          verdict: "wrong_answer",
        },
      ],
    )[0].challengeId === "a",
  );
});
Deno.test(
  "canonical heap references fit the published editable workspace",
  () => {
    for (const id of [
      "topological-sort",
      "median-stream",
      "heap-top-k",
      "shortest-path",
    ]) {
      const c = challenges.find((c) => c.id === id)!;
      const ed = getEditorial(id, "typescript");
      validateFiles(
        ed.files,
        c.starterFilesByLanguage.typescript!.map((f) => f.path),
      );
      if (id !== "shortest-path") {
        assert(
          ed.files.length === 1 &&
            !ed.files[0].content.includes('from "./min-heap"'),
        );
      }
    }
  },
);
