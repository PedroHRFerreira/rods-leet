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
    "/api/challenges/x/solution-access",
  ])("rejects unlisted proxy path/query %s", (path) => {
    expect(() => allowedApi(new Request(url(path)))).toThrow();
  });
  it.each([
    ["GET", "/api/dashboard"],
    ["GET", "/api/ranking"],
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
    expect(response.headers.get("location")).toBe("/perfil?authError=1");
    expect(upstream.mock.calls).toHaveLength(1);
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
