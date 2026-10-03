import { describe, expect, test, vi } from "vitest";
import { createBffAuth } from "./bff-auth";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const session = { user: { id: "alice" }, csrf: "csrf-value" };

describe("cookie BFF authentication", () => {
  test("deduplicates concurrent reads but refetches identity on the next read", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(
        json({ ...session, access_token: "must-not-escape" }),
      )
      .mockResolvedValueOnce(json(null));
    const changed = vi.fn();
    const auth = createBffAuth({ fetch: send, onSessionChange: changed });
    const [a, b] = await Promise.all([auth.getSession(), auth.getSession()]);
    expect(a).toEqual(session);
    expect(b).toEqual(session);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await auth.getSession()).toBeNull();
    expect(changed.mock.calls).toEqual([["alice"], [null]]);
    for (const [path, init] of send.mock.calls) {
      expect(path).toBe("/api/session");
      expect(init).toMatchObject({
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
      });
      expect(init.headers).toBeUndefined();
    }
  });
  test("logout is a CSRF protected POST and failed logout does not announce success", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({}, 503));
    const changed = vi.fn();
    const auth = createBffAuth({ fetch: send, onSessionChange: changed });
    await expect(auth.signOut()).rejects.toMatchObject({
      code: "authentication_unavailable",
    });
    expect(send.mock.calls[1]).toEqual([
      "/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf },
      }),
    ]);
    expect(changed.mock.calls).toEqual([["alice"]]);
  });
  test("successful logout invalidates identity", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json(null));
    const changed = vi.fn();
    const auth = createBffAuth({ fetch: send, onSessionChange: changed });
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    expect(changed.mock.calls).toEqual([["alice"], [null]]);
  });
  test("social login is disabled and never navigates or sends credentials", async () => {
    const send = vi.fn();
    const navigate = vi.fn();
    await expect(
      createBffAuth({ fetch: send, navigate }).signIn("github"),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(send).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  test("signup preserves the study session and sends email without storing a password", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({ requiresEmailConfirmation: true }));
    const auth = createBffAuth({ fetch: send });
    expect(await auth.signUp!("learner@example.com", "Learner")).toEqual({
      requiresEmailConfirmation: true,
    });
    expect(send.mock.calls[1]).toEqual([
      "/auth/signup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "learner@example.com",
          displayName: "Learner",
        }),
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "csrf-value",
        },
      }),
    ]);
  });
  test("email login invalidates the previous session and projects only identity", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ...session, access_token: "secret" }));
    const auth = createBffAuth({ fetch: send });
    await auth.signInWithPassword!("learner@example.com", "strong-password");
    expect(send.mock.calls[0]).toEqual([
      "/auth/login",
      expect.objectContaining({
        body: JSON.stringify({
          email: "learner@example.com",
          password: "strong-password",
        }),
      }),
    ]);
    expect(send.mock.calls[1][0]).toBe("/api/session");
  });
  test("malformed or failed session responses fail closed with generic errors", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(json({ user: { id: "alice" } }))
      .mockResolvedValueOnce(json({ secret: "private failure" }, 500));
    const auth = createBffAuth({ fetch: send });
    await expect(auth.getSession()).rejects.toMatchObject({
      code: "invalid_session",
    });
    await expect(auth.getSession()).rejects.toMatchObject({
      code: "authentication_unavailable",
    });
  });
});
