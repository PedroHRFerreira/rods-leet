import { afterEach, expect, it, vi } from "vitest";
import { handleBff } from "../functions/_lib/bff";
import {
  digest,
  seal,
  SESSION_COOKIE,
  unseal,
} from "../functions/_lib/security";

const env = {
  APP_ORIGIN: "https://rods-leet.pages.dev",
  SUPABASE_URL: "https://bsjcuygtpiqyomnulpsw.supabase.co",
  SUPABASE_ANON_KEY: "public-key",
  BFF_SHARED_SECRET: "s".repeat(64),
  BFF_ENCRYPTION_KEY: "ab".repeat(32),
};
const token = "aa".repeat(32);
const credentials = {
  access_token: "private-access",
  refresh_token: "private-refresh",
  expires_in: 3600,
  user: { id: "learner", is_anonymous: false },
};
afterEach(() => vi.unstubAllGlobals());
it.each(["/auth/signup", "/auth/recover"])(
  "blocks %s before sending email while registration is awaiting activation",
  async (path) => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    const response = await handleBff(
      request(path, { email: "learner@example.com", displayName: "Learner" }),
      { ...env, EMAIL_REGISTRATION_ENABLED: "false" },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "email_registration_unavailable" },
    });
    expect(send).not.toHaveBeenCalled();
  },
);
function request(path: string, body: unknown, csrf = "csrf") {
  return new Request(env.APP_ORIGIN + path, {
    method: "POST",
    headers: {
      Origin: env.APP_ORIGIN,
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE}=${token}`,
      "X-CSRF-Token": csrf,
    },
    body: JSON.stringify(body),
  });
}
async function mockAuth(anonymous = true) {
  const id = await digest(token);
  const payload = await seal(
    { ...credentials, expiresAt: Date.now() + 3_600_000, csrf: "csrf" },
    env.BFF_ENCRYPTION_KEY,
    id,
  );
  const stored: Array<Record<string, unknown>> = [];
  const send = vi.fn(
    async (target: string | URL | Request, init?: RequestInit) => {
      const url = String(target);
      if (url.endsWith("/functions/v1/session")) {
        const input = JSON.parse(String(init?.body));
        if (input.op === "get") return Response.json({ payload, version: 1 });
        if (input.op === "create") stored.push(input);
        return Response.json(true);
      }
      if (url.endsWith("/functions/v1/api/dashboard"))
        return Response.json({ profile: { id: "learner" } });
      if (url.endsWith("/auth/v1/user") && init?.method === "GET")
        return Response.json({
          id: "learner",
          is_anonymous: anonymous,
          email_confirmed_at: anonymous ? null : "2026-10-02",
        });
      if (url.includes("/token?") || url.endsWith("/verify"))
        return Response.json(credentials);
      return Response.json({ id: "learner" });
    },
  );
  vi.stubGlobal("fetch", send);
  return { send, stored };
}
it("links email to the existing anonymous identity without transferring or storing passwords", async () => {
  const { send } = await mockAuth();
  const response = await handleBff(
    request("/auth/signup", {
      email: "student@example.com",
      displayName: "Student",
    }),
    env,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ requiresEmailConfirmation: true });
  const update = send.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/auth/v1/user?") && init?.method === "PUT",
  )!;
  expect(new Headers(update[1]?.headers).get("Authorization")).toBe(
    "Bearer private-access",
  );
  expect(JSON.parse(String(update[1]?.body))).toEqual({
    email: "student@example.com",
    data: { display_name: "Student", full_name: "Student" },
  });
  expect(send.mock.calls.some(([url]) => String(url).includes("/signup"))).toBe(
    false,
  );
});
it("rejects signup with invalid CSRF before changing identity", async () => {
  const { send } = await mockAuth();
  const response = await handleBff(
    request(
      "/auth/signup",
      { email: "student@example.com", displayName: "Student" },
      "wrong",
    ),
    env,
  );
  expect(response.status).toBe(403);
  expect(send.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
    false,
  );
});
it("password login rotates an encrypted session without exposing provider tokens", async () => {
  const { stored } = await mockAuth(false);
  const response = await handleBff(
    request("/auth/login", {
      email: "student@example.com",
      password: "secure-password",
    }),
    env,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("Set-Cookie")).toContain(
    "HttpOnly; Secure; SameSite=Lax",
  );
  expect(
    await unseal(
      String(stored[0].payload),
      env.BFF_ENCRYPTION_KEY,
      String(stored[0].id),
    ),
  ).toMatchObject({ access_token: "private-access", user: { id: "learner" } });
});
it("does not define an anonymous user's password before verification", async () => {
  const { send } = await mockAuth();
  const response = await handleBff(
    request("/auth/password", { password: "secure-password" }),
    env,
  );
  expect(response.status).toBe(403);
  expect(send.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
    false,
  );
});
it("rejects unsupported verification types and links without contacting verify", async () => {
  const { send } = await mockAuth();
  const response = await handleBff(
    request("/auth/confirm", { tokenHash: "ab".repeat(32), type: "magiclink" }),
    env,
  );
  expect(response.status).toBe(400);
  expect(send.mock.calls.some(([url]) => String(url).endsWith("/verify"))).toBe(
    false,
  );
});
it("requires same-origin requests before any provider call", async () => {
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  const response = await handleBff(
    new Request(env.APP_ORIGIN + "/auth/login", { method: "POST", body: "{}" }),
    env,
  );
  expect(response.status).toBe(403);
  expect(send).not.toHaveBeenCalled();
});
it("disables social login", async () => {
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  expect(
    (await handleBff(request("/auth/start", { provider: "github" }), env))
      .status,
  ).toBe(410);
  expect(send).not.toHaveBeenCalled();
});

it.each(["/auth/signup", "/auth/recover"])(
  "preserves a safe challenge destination in %s emails",
  async (path) => {
    const { send } = await mockAuth();
    const response = await handleBff(
      request(path, {
        email: "student@example.com",
        displayName: "Student",
        returnTo: "/desafios/find-max?language=python",
      }),
      env,
    );
    expect(response.status).toBe(200);
    const call = send.mock.calls.find(([target]) =>
      String(target).includes("redirect_to="),
    )!;
    const redirect = new URL(
      new URL(String(call[0])).searchParams.get("redirect_to")!,
    );
    expect(redirect.origin).toBe(env.APP_ORIGIN);
    expect(redirect.pathname).toBe("/conta/confirmar");
    expect(redirect.searchParams.get("returnTo")).toBe(
      "/desafios/find-max?language=python",
    );
  },
);
it("rejects external email return destinations", async () => {
  const { send } = await mockAuth();
  await handleBff(
    request("/auth/recover", {
      email: "student@example.com",
      returnTo: "//evil.example",
    }),
    env,
  );
  const call = send.mock.calls.find(([target]) =>
    String(target).includes("redirect_to="),
  )!;
  const redirect = new URL(
    new URL(String(call[0])).searchParams.get("redirect_to")!,
  );
  expect(redirect.searchParams.get("returnTo")).toBe("/perfil");
});

it("allows legacy passwords at login while keeping new password policy", async () => {
  const { send } = await mockAuth(false);
  const response = await handleBff(
    request("/auth/login", {
      email: "student@example.com",
      password: "oldpwd",
    }),
    env,
  );
  expect(response.status).toBe(200);
  expect(
    send.mock.calls.some(([target]) =>
      String(target).includes("grant_type=password"),
    ),
  ).toBe(true);
  expect(
    (await handleBff(request("/auth/password", { password: "oldpwd" }), env))
      .status,
  ).toBe(400);
});
