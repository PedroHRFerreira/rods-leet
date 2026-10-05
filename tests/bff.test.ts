import { afterEach, describe, expect, it, vi } from "vitest";
import { handleBff } from "../functions/_lib/bff";
import {
  allowedApi,
  checkOrigin,
  cookie,
  digest,
  randomToken,
  readBounded,
  readCookie,
  seal,
  SESSION_COOKIE,
  OAUTH_COOKIE,
  base64url,
  sign,
  unseal,
} from "../functions/_lib/security";

const env = {
  APP_ORIGIN: "https://rods-leet.pages.dev",
  SUPABASE_URL: "https://bsjcuygtpiqyomnulpsw.supabase.co",
  SUPABASE_ANON_KEY: "public-key",
  BFF_SHARED_SECRET: "s".repeat(64),
  BFF_ENCRYPTION_KEY: "ab".repeat(32),
} as const;
const url = (path: string) => env.APP_ORIGIN + path;
afterEach(() => vi.unstubAllGlobals());
describe("BFF security boundary", () => {
  it("creates an isolated anonymous session without exposing provider tokens", async () => {
    let stored: { id: string; payload: string } | undefined;
    const fetchMock = vi.fn(async (target, init) => {
      if (String(target).endsWith("/auth/v1/signup")) {
        expect(JSON.parse(init.body)).toEqual({});
        return Response.json({
          access_token: "anonymous-access-secret",
          refresh_token: "anonymous-refresh-secret",
          expires_in: 3600,
          user: { id: "anonymous-a", is_anonymous: true },
        });
      }
      const body = JSON.parse(init.body);
      if (body.op === "create-anonymous") stored = body;
      return Response.json(true);
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleBff(new Request(url("/api/session")), env);
    expect(response.status).toBe(200);
    const output = await response.json();
    expect(output).toEqual({
      user: { id: "anonymous-a" },
      csrf: expect.any(String),
    });
    expect(response.headers.get("set-cookie")).toContain(
      "HttpOnly; Secure; SameSite=Lax",
    );
    expect(JSON.stringify(output)).not.toContain("secret");
    expect(stored).toBeDefined();
    expect(
      await unseal(stored!.payload, env.BFF_ENCRYPTION_KEY, stored!.id),
    ).toMatchObject({
      access_token: "anonymous-access-secret",
      user: { id: "anonymous-a" },
      csrf: output.csrf,
    });
  });
  it("does not mint an anonymous session for a cross-site session request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleBff(
      new Request(url("/api/session"), {
        headers: { "sec-fetch-site": "cross-site" },
      }),
      env,
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports unavailable anonymous access rather than exposing an unusable identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (target) =>
        String(target).endsWith("/auth/v1/signup")
          ? Response.json(
              { msg: "Anonymous sign-ins disabled" },
              { status: 422 },
            )
          : Response.json(true),
      ),
    );
    const response = await handleBff(new Request(url("/api/session")), env);
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({
      error: { code: "anonymous_access_unavailable" },
    });
  });
  it("ends a stalled input stream within its read deadline", async () => {
    const stream = new ReadableStream<Uint8Array>({ start() {} });
    await expect(readBounded(stream, 1024, 10)).rejects.toThrow("body_timeout");
  });
  it("encrypts with random IV, binds ciphertext to record, rejects tampering", async () => {
    const first = await seal(
      { secret: "private" },
      env.BFF_ENCRYPTION_KEY,
      "record-a",
    );
    expect(first).not.toContain("private");
    expect(
      await seal({ secret: "private" }, env.BFF_ENCRYPTION_KEY, "record-a"),
    ).not.toBe(first);
    expect(await unseal(first, env.BFF_ENCRYPTION_KEY, "record-a")).toEqual({
      secret: "private",
    });
    await expect(
      unseal(first, env.BFF_ENCRYPTION_KEY, "record-b"),
    ).rejects.toThrow();
    await expect(
      unseal(first.slice(0, -2) + "ff", env.BFF_ENCRYPTION_KEY, "record-a"),
    ).rejects.toThrow();
  });
  it("uses opaque secure cookies and rejects duplicate/malformed cookies", () => {
    const token = randomToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie(SESSION_COOKIE, token, 86400)).toContain(
      "Path=/; HttpOnly; Secure; SameSite=Lax",
    );
    expect(
      readCookie(
        new Request(url("/"), {
          headers: { cookie: `${SESSION_COOKIE}=${token}` },
        }),
        SESSION_COOKIE,
        OAUTH_COOKIE,
        base64url,
      ),
    ).toBe(token);
    expect(
      readCookie(
        new Request(url("/"), {
          headers: {
            cookie: `${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=${token}`,
          },
        }),
        SESSION_COOKIE,
        OAUTH_COOKIE,
        base64url,
      ),
    ).toBeNull();
  });
  it.each([
    "/api/http://evil.test",
    "/api/challenges/%252e",
    "/api/drafts?url=https://evil.test",
    "/api/challenges?search=a&search=b",
    "/api/dashboard?user=other",
    "/api/private",
    "/api/feedback",
    "/api/challenges/x/solution-access",
  ])("rejects unlisted proxy path/query %s", (path) => {
    expect(() => allowedApi(new Request(url(path)))).toThrow();
  });
  it.each([
    ["GET", "/api/dashboard"],
    ["GET", "/api/ranking"],
    ["GET", "/api/shop"],
    ["POST", "/api/shop/purchase"],
    ["POST", "/api/shop/equip"],
    ["GET", "/api/challenges"],
    ["GET", "/api/challenges/find-max"],
    ["GET", "/api/attempts/00000000-0000-0000-0000-000000000001"],
    ["GET", "/api/submissions/00000000-0000-0000-0000-000000000001"],
    ["GET", "/api/drafts?challengeId=find-max&languageId=typescript"],
    ["GET", "/api/execution-status"],
    [
      "GET",
      "/api/tutor/conversations?challengeId=find-max&languageId=typescript",
    ],
    ["POST", "/api/attempts"],
    ["POST", "/api/runs"],
    ["POST", "/api/submissions"],
    ["POST", "/api/quiz-submissions"],
    ["POST", "/api/feedback"],
    ["POST", "/api/attempts/00000000-0000-0000-0000-000000000001/hints"],
    ["POST", "/api/challenges/find-max/solution-access"],
    ["POST", "/api/tutor/messages"],
    ["POST", "/api/tutor/conversations/clear"],
    ["PUT", "/api/drafts"],
  ])("allows documented BFF route %s %s", (method, path) => {
    expect(allowedApi(new Request(url(path), { method })).pathname).toBe(
      new URL(url(path)).pathname,
    );
  });
  it("rejects methods and cross-origin/tokenless mutations", () => {
    expect(() =>
      allowedApi(new Request(url("/api/drafts"), { method: "DELETE" })),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request(url("/"), { method: "POST" }),
        env.APP_ORIGIN,
        "csrf",
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request(url("/"), {
          headers: { origin: env.APP_ORIGIN, "x-csrf-token": "wrong" },
        }),
        env.APP_ORIGIN,
        "csrf",
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request(url("/"), {
          headers: {
            origin: env.APP_ORIGIN,
            "x-csrf-token": "csrf",
            "sec-fetch-site": "cross-site",
          },
        }),
        env.APP_ORIGIN,
        "csrf",
      ),
    ).toThrow();
  });
  it("limits real stream bytes regardless of content-length", async () => {
    await expect(
      readBounded(new Response("ç".repeat(20)).body, 30),
    ).rejects.toThrow("body_too_large");
  });
  it("fails closed without secrets and does not contact upstream for CSRF", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect(
      (
        await handleBff(new Request(url("/api/session")), {
          ...env,
          BFF_SHARED_SECRET: "",
        })
      ).status,
    ).toBe(503);
    expect(
      (
        await handleBff(
          new Request(url("/auth/start"), { method: "POST", body: "{}" }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("uses workerd-compatible manual redirects and rejects upstream redirects", async () => {
    const upstream = vi.fn(async (_url, init) => {
      expect(init.redirect).toBe("manual");
      return new Response(null, {
        status: 302,
        headers: { Location: "https://untrusted.example" },
      });
    });
    vi.stubGlobal("fetch", upstream);
    const response = await handleBff(new Request(url("/api/session")), env);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "upstream_redirect_rejected" },
    });
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it("returns only user and CSRF; never tokens, ciphertext or upstream headers", async () => {
    const token = randomToken();
    const id = await digest(token);
    const payload = await seal(
      {
        access_token: "access-secret",
        refresh_token: "refresh-secret",
        user: { id: "user-a" },
        csrf: "csrf",
        expiresAt: Date.now() + 3600000,
      },
      env.BFF_ENCRYPTION_KEY,
      id,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u, init) => {
        const body = JSON.parse(init.body);
        return Response.json(
          body.op === "rate" ? true : { payload, version: 1 },
        );
      }),
    );
    const response = await handleBff(
      new Request(url("/api/session"), {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
      env,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      user: { id: "user-a" },
      csrf: "csrf",
    });
  });
  it("proxy replaces identity headers, signs fixed upstream and strips cookies", async () => {
    const token = randomToken();
    const id = await digest(token);
    const payload = await seal(
      {
        access_token: "real-access",
        refresh_token: "private",
        user: { id: "user-a" },
        csrf: "csrf",
        expiresAt: Date.now() + 3600000,
      },
      env.BFF_ENCRYPTION_KEY,
      id,
    );
    const sent: { u: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u, init) => {
        sent.push({ u: String(u), init });
        return String(u).endsWith("/session")
          ? Response.json({ payload, version: 1 })
          : new Response("{}", {
              headers: {
                "Set-Cookie": "attacker=x",
                "Access-Control-Allow-Origin": "*",
              },
            });
      }),
    );
    const response = await handleBff(
      new Request(url("/api/drafts"), {
        method: "PUT",
        body: "{}",
        headers: {
          origin: env.APP_ORIGIN,
          cookie: `${SESSION_COOKIE}=${token}`,
          Authorization: "Bearer attacker",
          "x-csrf-token": "csrf",
          "content-type": "application/json",
          "x-forwarded-host": "evil.test",
        },
      }),
      env,
    );
    expect(response.status).toBe(200);
    const last = sent.at(-1)!;
    const headers = new Headers(last.init.headers);
    expect(last.u).toBe(env.SUPABASE_URL + "/functions/v1/api/drafts");
    expect(headers.get("authorization")).toBe("Bearer real-access");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-forwarded-host")).toBe(false);
    expect(headers.get("x-bff-signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });
  it("OAuth callback without a browser transaction never exchanges a code", async () => {
    const upstream = vi.fn(async () => Response.json(true));
    vi.stubGlobal("fetch", upstream);
    const response = await handleBff(
      new Request(url("/auth/callback?code=stolen")),
      env,
    );
    expect(response.headers.get("location")).toBe("/conta?authError=google");
    expect(upstream.mock.calls).toHaveLength(0);
  });
  it("signs identity and idempotency along with request content", async () => {
    const result = await sign(
      new URL(env.SUPABASE_URL + "/functions/v1/api/runs"),
      "POST",
      "{}",
      env.BFF_SHARED_SECRET,
      "Bearer user",
      "key",
    );
    const message = [
      result["x-bff-time"],
      result["x-bff-nonce"],
      "POST",
      "/api/runs",
      await digest("{}"),
      "Bearer user",
      "key",
    ].join("\n");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.BFF_SHARED_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signature = new Uint8Array(
      result["x-bff-signature"].match(/../g)!.map((p) => parseInt(p, 16)),
    );
    expect(
      await crypto.subtle.verify(
        "HMAC",
        key,
        signature,
        new TextEncoder().encode(message),
      ),
    ).toBe(true);
    expect(
      await crypto.subtle.verify(
        "HMAC",
        key,
        signature,
        new TextEncoder().encode(
          message.replace("Bearer user", "Bearer attacker"),
        ),
      ),
    ).toBe(false);
  });
});

describe("Google server PKCE", () => {
  async function oauthFixture(anonymous = false) {
    const original = randomToken();
    const originalId = await digest(original);
    const encrypted = await seal(
      {
        user: { id: "visitor" },
        csrf: "csrf-google",
        access_token: "visitor-secret",
        refresh_token: "visitor-refresh",
        expiresAt: Date.now() + 3600_000,
      },
      env.BFF_ENCRYPTION_KEY,
      originalId,
    );
    const rows = new Map<
      string,
      { payload: string; version: number; expiresAt: string }
    >();
    rows.set(originalId, {
      payload: encrypted,
      version: 1,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    const send = vi.fn(async (target, init) => {
      if (String(target).endsWith("/auth/v1/user"))
        return Response.json({ id: "visitor", is_anonymous: anonymous });
      if (String(target).includes("/user/identities/authorize"))
        return Response.json({
          url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
        });
      if (String(target).includes("/auth/v1/token?grant_type=pkce")) {
        return Response.json({
          access_token: "google-access-secret",
          refresh_token: "google-refresh-secret",
          expires_in: 3600,
          user: { id: anonymous ? "visitor" : "google-account" },
        });
      }
      if (String(target).endsWith("/functions/v1/api/dashboard"))
        return Response.json({});
      const data = JSON.parse(init.body);
      if (data.op === "rate") return Response.json(true);
      if (data.op === "get") return Response.json(rows.get(data.id) ?? null);
      if (data.op === "oauth-take") {
        const found = rows.get(data.id) ?? null;
        rows.delete(data.id);
        return Response.json(found);
      }
      if (data.op === "delete") {
        rows.delete(data.id);
        return Response.json(null);
      }
      rows.set(data.id, {
        payload: data.payload,
        version: 1,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
      return Response.json(true);
    });
    vi.stubGlobal("fetch", send);
    const start = async (
      csrf = "csrf-google",
      returnTo?: string,
      intent?: "login" | "upgrade",
    ) =>
      handleBff(
        new Request(url("/auth/start"), {
          method: "POST",
          headers: {
            origin: env.APP_ORIGIN,
            "content-type": "application/json",
            "x-csrf-token": csrf,
            cookie: `${SESSION_COOKIE}=${original}`,
          },
          body: JSON.stringify({
            provider: "google",
            ...(returnTo ? { returnTo } : {}),
            ...(intent ? { intent } : {}),
          }),
        }),
        { ...env, GOOGLE_LOGIN_ENABLED: "true" },
      );
    return { original, originalId, rows, send, start };
  }
  it("encrypts the verifier, binds S256 to it, rotates identity and rejects replay", async () => {
    const fixture = await oauthFixture();
    const started = await fixture.start();
    expect(started.status).toBe(200);
    const result = await started.json();
    const authorization = new URL(result.url);
    const opaque = started.headers
      .get("set-cookie")!
      .match(/=([a-f0-9]{64});/)![1];
    const id = await digest(opaque);
    const pending = await unseal<{
      verifier: string;
      state: string;
      sessionId: string;
    }>(fixture.rows.get(id)!.payload, env.BFF_ENCRYPTION_KEY, id);
    expect(JSON.stringify(result)).not.toContain(pending.verifier);
    expect(fixture.rows.get(id)!.payload).not.toContain(pending.verifier);
    expect(pending.sessionId).toBe(fixture.originalId);
    expect(authorization.searchParams.get("code_challenge")).toBe(
      base64url(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(pending.verifier),
          ),
        ),
      ),
    );
    const callback = new Request(
      url(`/auth/callback?state=${pending.state}&code=single-use-code`),
      {
        headers: {
          cookie: `${SESSION_COOKIE}=${fixture.original}; ${OAUTH_COOKIE}=${opaque}`,
        },
      },
    );
    const finished = await handleBff(callback, {
      ...env,
      GOOGLE_LOGIN_ENABLED: "true",
    });
    expect(finished.status).toBe(303);
    expect(finished.headers.get("location")).toBe("/perfil");
    expect(finished.headers.get("set-cookie")).toContain(
      "HttpOnly; Secure; SameSite=Lax",
    );
    expect(finished.headers.get("set-cookie")).not.toContain("secret");
    expect(fixture.rows.has(fixture.originalId)).toBe(false);
    const exchanged = fixture.send.mock.calls.filter(([target]) =>
      String(target).includes("grant_type=pkce"),
    );
    expect(exchanged).toHaveLength(1);
    expect(JSON.parse(exchanged[0][1].body)).toEqual({
      auth_code: "single-use-code",
      code_verifier: pending.verifier,
    });
    const replay = await handleBff(callback, {
      ...env,
      GOOGLE_LOGIN_ENABLED: "true",
    });
    expect(replay.headers.get("location")).toBe("/conta?authError=google");
    expect(
      fixture.send.mock.calls.filter(([target]) =>
        String(target).includes("grant_type=pkce"),
      ),
    ).toHaveLength(1);
  });
  it("links Google to the anonymous identity without exposing its token", async () => {
    const fixture = await oauthFixture(true);
    const started = await fixture.start("csrf-google", undefined, "upgrade");
    expect(started.status).toBe(200);
    const result = await started.json();
    expect(result.url).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
    );
    const call = fixture.send.mock.calls.find(([target]) =>
      String(target).includes("/user/identities/authorize"),
    )!;
    expect(call[1].headers.Authorization).toBe("Bearer visitor-secret");
    expect(
      new URL(String(call[0])).searchParams.get("code_challenge_method"),
    ).toBe("s256");
    expect(JSON.stringify(result)).not.toContain("visitor-secret");
  });
  it.each([
    [
      "/desafios/two-sum?language=typescript",
      "/desafios/two-sum?language=typescript",
    ],
    ["https://evil.example", "/perfil"],
    ["//evil.example", "/perfil"],
    ["/\\evil.example", "/perfil"],
    ["/auth/callback", "/perfil"],
    ["/conta", "/perfil"],
  ])(
    "returns after Google only to a safe application path: %s",
    async (returnTo, expected) => {
      const fixture = await oauthFixture();
      const started = await fixture.start("csrf-google", returnTo);
      const opaque = started.headers
        .get("set-cookie")!
        .match(/=([a-f0-9]{64});/)![1];
      const id = await digest(opaque);
      const pending = await unseal<{ state: string }>(
        fixture.rows.get(id)!.payload,
        env.BFF_ENCRYPTION_KEY,
        id,
      );
      const finished = await handleBff(
        new Request(url(`/auth/callback?state=${pending.state}&code=code`), {
          headers: {
            cookie: `${SESSION_COOKIE}=${fixture.original}; ${OAUTH_COOKIE}=${opaque}`,
          },
        }),
        { ...env, GOOGLE_LOGIN_ENABLED: "true" },
      );
      expect(finished.headers.get("location")).toBe(expected);
    },
  );
  it("keeps the visitor identity and challenge destination through Google registration", async () => {
    const fixture = await oauthFixture(true);
    const started = await fixture.start(
      "csrf-google",
      "/desafios/find-max",
      "upgrade",
    );
    const opaque = started.headers
      .get("set-cookie")!
      .match(/=([a-f0-9]{64});/)![1];
    const id = await digest(opaque);
    const pending = await unseal<{ state: string; upgradeUserId: string }>(
      fixture.rows.get(id)!.payload,
      env.BFF_ENCRYPTION_KEY,
      id,
    );
    expect(pending.upgradeUserId).toBe("visitor");
    const finished = await handleBff(
      new Request(
        url(`/auth/callback?state=${pending.state}&code=upgrade-code`),
        {
          headers: {
            cookie: `${SESSION_COOKIE}=${fixture.original}; ${OAUTH_COOKIE}=${opaque}`,
          },
        },
      ),
      { ...env, GOOGLE_LOGIN_ENABLED: "true" },
    );
    expect(finished.headers.get("location")).toBe("/desafios/find-max");
    const next = finished.headers
      .get("set-cookie")!
      .match(/=([a-f0-9]{64});/)![1];
    const nextId = await digest(next);
    const registered = await unseal<{ user: { id: string } }>(
      fixture.rows.get(nextId)!.payload,
      env.BFF_ENCRYPTION_KEY,
      nextId,
    );
    expect(registered.user.id).toBe("visitor");
  });
  it("does not link a Google identity onto an already registered account", async () => {
    const fixture = await oauthFixture(false);
    expect(
      (await fixture.start("csrf-google", undefined, "upgrade")).status,
    ).toBe(409);
    expect(
      fixture.send.mock.calls.some(([target]) =>
        String(target).includes("/user/identities/authorize"),
      ),
    ).toBe(false);
  });
  it("rejects forged CSRF before creating authorization state", async () => {
    const fixture = await oauthFixture();
    expect((await fixture.start("forged")).status).toBe(403);
    expect(fixture.rows.size).toBe(1);
  });
  it.each(["state", "session", "duplicate", "expired", "tampered", "hostname"])(
    "rejects %s callback before exchanging credentials",
    async (variant) => {
      const fixture = await oauthFixture();
      const started = await fixture.start();
      const authorization = new URL((await started.json()).url);
      const redirect = new URL(authorization.searchParams.get("redirect_to")!);
      const opaque = started.headers
        .get("set-cookie")!
        .match(/=([a-f0-9]{64});/)![1];
      const id = await digest(opaque);
      if (variant === "expired") {
        const pending = await unseal<Record<string, unknown>>(
          fixture.rows.get(id)!.payload,
          env.BFF_ENCRYPTION_KEY,
          id,
        );
        pending.expiresAt = Date.now() - 1;
        fixture.rows.get(id)!.payload = await seal(
          pending,
          env.BFF_ENCRYPTION_KEY,
          id,
        );
      }
      if (variant === "tampered")
        fixture.rows.get(id)!.payload = "invalid-ciphertext";
      redirect.searchParams.set("code", "code");
      if (variant === "state")
        redirect.searchParams.set("state", randomToken());
      if (variant === "duplicate")
        redirect.searchParams.append("code", "another");
      if (variant === "hostname") redirect.hostname = "rodsleet.com";
      const response = await handleBff(
        new Request(redirect, {
          headers: {
            cookie: `${SESSION_COOKIE}=${variant === "session" ? randomToken() : fixture.original}; ${OAUTH_COOKIE}=${opaque}`,
          },
        }),
        {
          ...env,
          GOOGLE_LOGIN_ENABLED: "true",
          APP_ORIGIN_ALIASES: "https://rodsleet.com",
        },
      );
      expect(response.headers.get("location")).toBe("/conta?authError=google");
      expect(
        fixture.send.mock.calls.some(([target]) =>
          String(target).includes("grant_type=pkce"),
        ),
      ).toBe(false);
      expect(fixture.rows.has(id)).toBe(false);
    },
  );
});

describe("approved hostname migration boundary", () => {
  const migratedEnv = {
    ...env,
    APP_ORIGIN: "https://rodsleet.com",
    APP_ORIGIN_ALIASES: env.APP_ORIGIN,
    GOOGLE_LOGIN_ENABLED: "true",
  };
  it.each([env.APP_ORIGIN, "https://rodsleet.com"])(
    "keeps OAuth callback and CSRF on the request hostname %s",
    async (origin) => {
      const sessionCookie = randomToken();
      const sessionId = await digest(sessionCookie);
      const payload = await seal(
        {
          user: { id: "preserved-visitor" },
          csrf: "same-host-csrf",
          access_token: "visitor-private",
          refresh_token: "visitor-refresh",
          expiresAt: Date.now() + 3600_000,
        },
        env.BFF_ENCRYPTION_KEY,
        sessionId,
      );
      const send = vi.fn(async (_target, init) => {
        const operation = JSON.parse(init.body);
        if (operation.op === "get") {
          expect(operation.id).toBe(sessionId);
          return Response.json({
            payload,
            version: 1,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          });
        }
        return Response.json(true);
      });
      vi.stubGlobal("fetch", send);
      const response = await handleBff(
        new Request(origin + "/auth/start", {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            "x-csrf-token": "same-host-csrf",
            cookie: `${SESSION_COOKIE}=${sessionCookie}`,
          },
          body: JSON.stringify({ provider: "google" }),
        }),
        migratedEnv,
      );
      expect(response.status).toBe(200);
      const authorization = new URL((await response.json()).url);
      const callback = new URL(authorization.searchParams.get("redirect_to")!);
      expect(callback.origin).toBe(origin);
      expect(callback.pathname).toBe("/auth/callback");
      expect(response.headers.get("set-cookie")).not.toContain("Domain=");
      expect(
        send.mock.calls.some(
          ([_target, init]) => JSON.parse(init.body).op === "create-anonymous",
        ),
      ).toBe(false);
    },
  );
  it.each([
    [env.APP_ORIGIN, "https://rodsleet.com"],
    ["https://rodsleet.com", env.APP_ORIGIN],
  ])(
    "rejects cross-host Origin even between approved hosts (%s -> %s)",
    async (requestOrigin, suppliedOrigin) => {
      const send = vi.fn();
      vi.stubGlobal("fetch", send);
      const response = await handleBff(
        new Request(requestOrigin + "/auth/start", {
          method: "POST",
          headers: {
            origin: suppliedOrigin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ provider: "google" }),
        }),
        migratedEnv,
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: { code: "origin_rejected" },
      });
      expect(send).not.toHaveBeenCalled();
    },
  );
  it.each([
    "https://unlisted.example",
    "https://rodsleet.com.evil.example",
    "https://www.rodsleet.com",
    "http://rodsleet.com",
  ])("rejects an unlisted request origin %s", async (origin) => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    const response = await handleBff(
      new Request(origin + "/api/session"),
      migratedEnv,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "service_unconfigured" },
    });
    expect(send).not.toHaveBeenCalled();
  });
});
