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
  test.each([
    "https://evil.test/auth/v1/authorize",
    "javascript:alert(1)",
    "https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize/other",
    "https://user@bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize",
  ])("rejects unexpected OAuth navigation %s", async (url) => {
    const navigate = vi.fn();
    const auth = createBffAuth({
      fetch: vi.fn().mockResolvedValue(json({ url })),
      navigate,
    });
    await expect(auth.signIn("github")).rejects.toMatchObject({
      code: "invalid_redirect",
    });
    expect(navigate).not.toHaveBeenCalled();
  });
  test("starts OAuth with same-origin POST and navigates only to the fixed provider endpoint", async () => {
    const url =
      "https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize?provider=github";
    const send = vi.fn().mockResolvedValue(json({ url }));
    const navigate = vi.fn();
    await createBffAuth({ fetch: send, navigate }).signIn("github");
    expect(send.mock.calls[0]).toEqual([
      "/auth/start",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: '{"provider":"github"}',
      }),
    ]);
    expect(navigate).toHaveBeenCalledWith(url);
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
