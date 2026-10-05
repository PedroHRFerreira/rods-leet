import { describe, expect, test, vi } from "vitest";
import {
  createGateway,
  guestDashboard,
  type GatewayAuth,
  type GatewaySession,
} from "./gateway";
import type { DraftInput, WeeklyRankingState } from "./contracts";

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
  test("weekly ranking is a separate cookie-authenticated read and preserves server eligibility", async () => {
    const weekly: WeeklyRankingState = {
      startsAt: "2026-10-05T03:00:00.000Z",
      endsAt: "2026-10-12T03:00:00.000Z",
      entries: [],
      currentUser: {
        userId: "alice",
        displayName: "Alice",
        xp: 2000,
        completedCount: 30,
        reachedAt: "2026-10-05T12:00:00Z",
        weeklyXp: 50,
        weeklyCompletedCount: 1,
        eligible: false,
      },
      lastCompleted: {
        startsAt: "2026-09-28T03:00:00.000Z",
        endsAt: "2026-10-05T03:00:00.000Z",
        winners: [],
      },
    };
    const s = setup((url) =>
      respond(url === "/api/ranking/weekly" ? weekly : []),
    );
    s.options.auth.getSession = vi.fn(s.options.auth.getSession);
    expect(await s.gateway.getWeeklyRanking!()).toEqual(weekly);
    expect(await s.gateway.getRanking()).toEqual([]);
    expect(s.fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/ranking/weekly",
      "/api/ranking",
    ]);
    const init = s.fetchMock.mock.calls[0][1]!;
    expect(init).toMatchObject({
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    s.setUser("bob");
    await s.gateway.getWeeklyRanking!();
    expect(s.options.auth.getSession).toHaveBeenCalledTimes(3);
    expect(s.fetchMock).toHaveBeenCalledTimes(3);
  });
  test("weekly exploration never sends remote requests or invents winners, eligibility or prizes", async () => {
    const send = vi.fn();
    const weekly = await createGateway({ fetch: send }).getWeeklyRanking!();
    expect(weekly.entries).toEqual([]);
    expect(weekly.currentUser).toBeNull();
    expect(weekly.lastCompleted).toBeUndefined();
    expect(new Date(weekly.endsAt).getTime()).toBeGreaterThan(
      new Date(weekly.startsAt).getTime(),
    );
    expect(send).not.toHaveBeenCalled();
    const s = setup(() =>
      respond(
        {
          error: {
            code: "ranking_unavailable",
            message: "Ranking indisponível",
          },
        },
        503,
      ),
    );
    await expect(s.gateway.getWeeklyRanking!()).rejects.toMatchObject({
      code: "ranking_unavailable",
      status: 503,
    });
    s.setUser(null);
    expect((await s.gateway.getWeeklyRanking!()).entries).toEqual([]);
    expect(s.fetchMock).toHaveBeenCalledTimes(1);
  });
  test("demo shop never grants inventory or buys items without the server", async () => {
    const gateway = createGateway();
    expect(await gateway.getShop()).toMatchObject({
      coins: 0,
      ownedItemIds: [],
    });
    await expect(
      gateway.purchaseItem("hint-extra", "purchase-1"),
    ).rejects.toMatchObject({ code: "authentication_required" });
    await expect(
      gateway.equipItem("avatar-robot", "equip-1"),
    ).rejects.toMatchObject({ code: "authentication_required" });
    await expect(
      gateway.signInWithPassword("alice@example.com", "secret"),
    ).rejects.toMatchObject({ code: "authentication_unconfigured" });
  });
  test("shop mutations forward only item IDs and server idempotency headers", async () => {
    const { gateway, fetchMock } = setup(() =>
      respond({ coins: 40, ownedItemIds: ["avatar-robot"] }),
    );
    await gateway.purchaseItem("avatar-robot", "buy-once");
    await gateway.equipItem("avatar-robot", "equip-once");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/shop/purchase",
      "/api/shop/equip",
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(JSON.parse(init!.body as string)).toEqual({
        itemId: "avatar-robot",
      });
      expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("test-csrf");
    }
    expect(
      fetchMock.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get("Idempotency-Key"),
      ),
    ).toEqual(["buy-once", "equip-once"]);
  });
  test("email auth delegates the two-step registration and preserves actionable errors", async () => {
    const s = setup(() => respond({}));
    const auth = s.options.auth;
    auth.signUp = vi.fn(async () => ({ requiresEmailConfirmation: true }));
    auth.confirmEmail = vi.fn(async () => {});
    auth.updatePassword = vi.fn(async () => {});
    auth.requestPasswordReset = vi.fn(async () => {});
    const gateway = createGateway(s.options);
    expect(
      await gateway.signUp("alice@example.com", "Alice", "/desafios/find-max"),
    ).toEqual({
      requiresEmailConfirmation: true,
    });
    expect(auth.signUp).toHaveBeenCalledWith(
      "alice@example.com",
      "Alice",
      "/desafios/find-max",
    );
    await gateway.requestPasswordReset(
      "alice@example.com",
      "/desafios/find-max",
    );
    expect(auth.requestPasswordReset).toHaveBeenCalledWith(
      "alice@example.com",
      "/desafios/find-max",
    );
    await gateway.confirmEmail("hash", "email_change");
    await gateway.updatePassword("new password");
    expect(auth.confirmEmail).toHaveBeenCalledWith("hash", "email_change");
    expect(auth.updatePassword).toHaveBeenCalledWith("new password");
  });
  test("real 69-challenge catalog, empty ranking and zero progress do not require a server", async () => {
    const gateway = createGateway();
    expect(await gateway.listChallenges()).toHaveLength(69);
    expect(await gateway.listChallenges({ topicId: "sql" })).toHaveLength(10);
    expect(await gateway.listChallenges({ mode: "hard" })).toHaveLength(0);
    expect(await gateway.getDashboard()).toMatchObject({
      xp: 0,
      completedCount: 0,
      profile: { authenticated: false },
    });
    expect((await gateway.getDashboard()).recommendations[0]?.challengeId).toBe(
      "concept-values",
    );
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
    await expect(gateway.signIn("github")).rejects.toMatchObject({
      code: "authentication_unconfigured",
    });
  });
  test("authentication failures do not invent account progress", async () => {
    const { gateway } = setup(() =>
      respond(
        {
          error: {
            code: "github_account_required",
            message: "Entre com sua conta GitHub",
          },
        },
        403,
      ),
    );
    await expect(gateway.getDashboard()).rejects.toMatchObject({
      code: "github_account_required",
      status: 403,
    });
  });
  test("recognizes a valid session during the API field transition", async () => {
    const legacy = guestDashboard();
    const { gateway } = setup(() =>
      respond({
        ...legacy,
        profile: {
          id: "alice",
          displayName: "Alice",
          invited: true,
        },
      }),
    );
    await expect(gateway.getDashboard()).resolves.toMatchObject({
      profile: { id: "alice", authenticated: true },
    });
  });
  test("official mutations forward auth, snapshot and original idempotency key", async () => {
    const { gateway, fetchMock } = setup(() =>
      respond(
        {
          id: "server-submission",
          attemptId: "a1",
          submittedAt: "2026-10-01T20:00:00Z",
          status: "queued",
        },
        202,
      ),
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
  test("reads executor state and synchronizes a scoped tutor conversation", async () => {
    const { gateway, fetchMock } = setup((url, init) => {
      if (url.includes("execution-status"))
        return respond({
          status: "busy",
          checkedAt: "2026-09-09T00:00:00.000Z",
        });
      if (init?.method === "GET")
        return respond({
          challengeId: "find-max",
          languageId: "python",
          messages: [{ role: "tutor", text: "Comece pelos casos pequenos." }],
        });
      return respond({ cleared: true });
    });
    await expect(gateway.getExecutionStatus()).resolves.toMatchObject({
      status: "busy",
    });
    await expect(
      gateway.getTutorConversation("find-max", "python"),
    ).resolves.toMatchObject({
      messages: [{ role: "tutor" }],
    });
    await expect(
      gateway.clearTutorConversation("find-max", "python", "clear-key"),
    ).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/execution-status",
      "/api/tutor/conversations?challengeId=find-max&languageId=python",
      "/api/tutor/conversations/clear",
    ]);
  });
});

describe("validated server receipts", () => {
  test("rejects a success for another attempt without exposing it to the page", async () => {
    const { gateway } = setup(() =>
      respond({
        id: "s1",
        attemptId: "other",
        status: "completed",
        verdict: "accepted",
        xpAwarded: 20,
        submittedAt: "2026-10-01T20:00:00Z",
      }),
    );
    await expect(
      gateway.submitQuiz(
        { attemptId: "a1", challengeVersionId: "v1", optionId: "b" },
        "k1",
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  test("feedback retry forwards the same body and key, and requires a receipt", async () => {
    let calls = 0;
    const { gateway, fetchMock } = setup(() => {
      calls++;
      if (calls === 1) throw new TypeError("response lost");
      return respond({
        protocol: "00000000-0000-4000-8000-000000000001",
        createdAt: "2026-10-01T20:00:00Z",
      });
    });
    const input = {
      category: "suggestion" as const,
      message: "Uma sugestão para o produto.",
      publishToDiscord: true as const,
    };
    await expect(
      gateway.createFeedback(input, "stable-key"),
    ).rejects.toMatchObject({ code: "network_error" });
    await expect(
      gateway.createFeedback(input, "stable-key"),
    ).resolves.toMatchObject({
      protocol: "00000000-0000-4000-8000-000000000001",
    });
    expect(fetchMock.mock.calls.map(([, init]) => init?.body)).toEqual([
      JSON.stringify(input),
      JSON.stringify(input),
    ]);
    expect(
      fetchMock.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get("Idempotency-Key"),
      ),
    ).toEqual(["stable-key", "stable-key"]);
    const invalid = setup(() => respond({ received: true }));
    await expect(
      invalid.gateway.createFeedback(input, "key"),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  test.each([
    { userId: "someone" },
    { displayName: "Forged name" },
    { webhookUrl: "https://discord.com/api/webhooks/forged" },
    { attachments: ["media"] },
    { contactEmail: "private@example.com" },
    { publishToDiscord: undefined },
    { publishToDiscord: false },
  ])(
    "feedback rejects private legacy data or forged fields before transport: %j",
    async (fields) => {
      const { gateway, fetchMock } = setup(() => respond({}));
      await expect(
        gateway.createFeedback(
          {
            category: "praise",
            message: "Gostei das perguntas iniciais.",
            publishToDiscord: true,
            ...fields,
          } as never,
          "key",
        ),
      ).rejects.toMatchObject({ code: "invalid_feedback" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
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
