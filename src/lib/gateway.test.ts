import { describe, expect, test, vi } from "vitest";
import {
  createGateway,
  type GatewayAuth,
  type GatewaySession,
} from "./gateway";
import type { DraftInput } from "./contracts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
const draft = (content = "my code", revision?: number): DraftInput => ({
  challengeId: "find-max",
  languageId: "typescript",
  files: [{ path: "solution.ts", content }],
  updatedAt: new Date().toISOString(),
  revision,
});
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  let current: GatewaySession | null = {
    csrf: "test-csrf",
    user: { id: "alice" },
  };
  const storage = memoryStorage();
  const auth: GatewayAuth = {
    getSession: async () => current,
    signIn: vi.fn(),
    signOut: async () => {
      current = null;
    },
  };
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init)),
  );
  const options = { auth, storage, fetch: fetchMock as typeof fetch };
  return {
    gateway: createGateway(options),
    options,
    storage,
    fetchMock,
    setUser: (id: string | null) => {
      current = id ? { csrf: `${id}-csrf`, user: { id } } : null;
    },
  };
}

describe("public exploration and server authority", () => {
  test("real 50-challenge catalog, empty ranking and zero progress do not require a server", async () => {
    const gateway = createGateway();
    expect(await gateway.listChallenges()).toHaveLength(50);
    expect(await gateway.listChallenges({ topicId: "sql" })).toHaveLength(10);
    expect(await gateway.listChallenges({ mode: "hard" })).toHaveLength(0);
    expect(await gateway.getDashboard()).toMatchObject({
      xp: 0,
      completedCount: 0,
      profile: { invited: false },
    });
    expect(await gateway.getRanking()).toEqual([]);
    await expect(
      gateway.submit(
        {
          attemptId: "a",
          challengeVersionId: "v",
          languageId: "typescript",
          files: [],
        },
        "same-key",
      ),
    ).rejects.toMatchObject({ code: "authentication_required" });
    await expect(gateway.signIn("google")).rejects.toMatchObject({
      code: "authentication_unconfigured",
    });
  });
  test("invitation failures allow catalog exploration without inventing account progress", async () => {
    const { gateway } = setup(() =>
      respond(
        { error: { code: "invite_required", message: "Convite necessário" } },
        403,
      ),
    );
    expect(await gateway.listChallenges()).toHaveLength(50);
    expect((await gateway.getChallenge("find-max")).executionAvailable).toBe(
      false,
    );
    await expect(gateway.getDashboard()).rejects.toMatchObject({
      code: "invite_required",
      status: 403,
    });
  });
  test("official mutations forward auth, snapshot and original idempotency key", async () => {
    const { gateway, fetchMock } = setup(() =>
      respond({ id: "server-submission", status: "queued" }, 202),
    );
    const input = {
      challengeVersionId: "v1",
      attemptId: "a1",
      languageId: "typescript" as const,
      files: draft().files,
    };
    expect(await gateway.submit(input, "stable-action-key")).toMatchObject({
      id: "server-submission",
      status: "queued",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/submissions");
    expect(init?.headers).toMatchObject({
      "X-CSRF-Token": "test-csrf",
      "Idempotency-Key": "stable-action-key",
    });
    expect(JSON.parse(init!.body as string)).toEqual(input);
    expect(init?.credentials).toBe("same-origin");
    expect(init?.cache).toBe("no-store");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(new Headers(init?.headers).has("apikey")).toBe(false);
  });
  test("network failures are explicit and never converted into accepted results", async () => {
    const { gateway } = setup(() => {
      throw new TypeError("network down");
    });
    await expect(gateway.getSubmission("id")).rejects.toMatchObject({
      code: "network_error",
      status: 503,
    });
  });
});

describe("draft persistence and concurrent edits", () => {
  test("guest and account drafts remain separate", async () => {
    const s = setup((_url, init) =>
      init?.method === "PUT"
        ? respond({
            saved: true,
            revision: 1,
            updatedAt: new Date().toISOString(),
          })
        : respond(null),
    );
    s.setUser(null);
    await s.gateway.saveDraft(draft("guest text"));
    s.setUser("alice");
    expect(await s.gateway.getDraft("find-max", "typescript")).toBeNull();
    await s.gateway.saveDraft(draft("alice text"));
    s.setUser(null);
    expect(
      (await s.gateway.getDraft("find-max", "typescript"))?.files[0].content,
    ).toBe("guest text");
    expect(await s.gateway.getDraft("find-max", "python")).toBeNull();
  });
  test("sequential saves use the last confirmed revision without refetching before PUT", async () => {
    let revision = 4;
    const s = setup((_url, init) => {
      if (init?.method !== "PUT") return respond(draft("remote", revision));
      expect(JSON.parse(init.body as string).revision).toBe(revision);
      revision++;
      return respond({
        saved: true,
        revision,
        updatedAt: new Date().toISOString(),
      });
    });
    await s.gateway.getDraft("find-max", "typescript");
    await Promise.all([
      s.gateway.saveDraft(draft("first", 4)),
      s.gateway.saveDraft(draft("second", 4)),
    ]);
    expect(revision).toBe(6);
    expect(s.fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
      "GET",
      "PUT",
      "PUT",
    ]);
  });
  test("a remote conflict preserves local content and its base revision on reload", async () => {
    let serverRevision = 2;
    const s = setup((_url, init) =>
      init?.method === "PUT"
        ? respond(
            {
              error: { code: "draft_conflict", message: "Outra aba atualizou" },
            },
            409,
          )
        : respond(draft("remote", serverRevision)),
    );
    await s.gateway.getDraft("find-max", "typescript");
    serverRevision = 3;
    await expect(
      s.gateway.saveDraft(draft("precious local", 2)),
    ).rejects.toMatchObject({ code: "draft_conflict" });
    const reloaded = createGateway(s.options);
    expect(await reloaded.getDraft("find-max", "typescript")).toMatchObject({
      revision: 2,
      files: [{ content: "precious local" }],
    });
    await expect(
      reloaded.saveDraft(draft("still local", 2)),
    ).rejects.toMatchObject({ code: "draft_conflict" });
  });
  test("a late remote read does not authorize overwriting edits based on an older revision", async () => {
    const s = setup(() => respond(draft("other device", 5)));
    await s.gateway.getDraft("find-max", "typescript");
    await expect(
      s.gateway.saveDraft(draft("edited before read completed", 4)),
    ).rejects.toMatchObject({ code: "draft_conflict" });
    expect(s.fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
      "GET",
    ]);
    const reloaded = createGateway(s.options);
    expect(await reloaded.getDraft("find-max", "typescript")).toMatchObject({
      revision: 4,
      files: [{ content: "edited before read completed" }],
    });
  });
  test("explicit conflict resolution uses the remote revision, then still checks for races", async () => {
    const s = setup((_url, init) => {
      if (init?.method !== "PUT") return respond(draft("other tab", 8));
      expect(JSON.parse(init.body as string).revision).toBe(8);
      return respond({
        saved: true,
        revision: 9,
        updatedAt: new Date().toISOString(),
      });
    });
    await s.gateway.resolveDraftConflict!(draft("chosen local", 2));
    expect(s.fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
      "GET",
      "PUT",
    ]);
  });
  test("a failed connection keeps pending code retrievable", async () => {
    const s = setup(() => {
      throw new TypeError("offline");
    });
    await expect(
      s.gateway.saveDraft(draft("offline edit", 1)),
    ).rejects.toMatchObject({ code: "network_error" });
    expect(await s.gateway.getDraft("find-max", "typescript")).toMatchObject({
      files: [{ content: "offline edit" }],
      revision: 1,
    });
  });
  test("save receipts carry the confirmed revision and offline successors preserve that base", async () => {
    let online = true;
    const s = setup((_url, init) => {
      if (!online) throw new TypeError("offline");
      if (init?.method === "PUT")
        return respond({
          saved: true,
          revision: 3,
          updatedAt: "2026-09-05T00:00:00Z",
        });
      return respond(draft("before", 2));
    });
    await s.gateway.getDraft("find-max", "typescript");
    expect(await s.gateway.saveDraft(draft("confirmed", 2))).toMatchObject({
      revision: 3,
      updatedAt: "2026-09-05T00:00:00Z",
    });
    online = false;
    await expect(
      s.gateway.saveDraft(draft("offline successor", 2)),
    ).rejects.toMatchObject({ code: "network_error" });
    const reloaded = createGateway(s.options);
    expect(await reloaded.getDraft("find-max", "typescript")).toMatchObject({
      revision: 3,
      files: [{ content: "offline successor" }],
    });
  });
});
