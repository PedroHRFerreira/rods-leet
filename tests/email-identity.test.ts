import { afterEach, expect, it, vi } from "vitest";
import { authenticatedUser } from "../supabase/functions/_shared/db";
afterEach(() => vi.unstubAllGlobals());
it("admits a confirmed email identity without a social provider", async () => {
  vi.stubGlobal("Deno", { env: { get: () => "configured" } });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        id: "email-user",
        email: "learner@example.test",
        email_confirmed_at: "2026-10-02",
        is_anonymous: false,
        identities: [{ provider: "email" }],
        user_metadata: { display_name: "Learner" },
      }),
    ),
  );
  expect(
    await authenticatedUser(
      new Request("https://example.test/api/dashboard", {
        headers: { Authorization: "Bearer verified-token" },
      }),
    ),
  ).toMatchObject({
    id: "email-user",
    name: "Learner",
    anonymous: false,
    githubLogin: null,
  });
});
it("requires email confirmation for a permanent identity", async () => {
  vi.stubGlobal("Deno", { env: { get: () => "configured" } });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        id: "email-user",
        email: "learner@example.test",
        is_anonymous: false,
      }),
    ),
  );
  await expect(
    authenticatedUser(
      new Request("https://example.test/api/dashboard", {
        headers: { Authorization: "Bearer token" },
      }),
    ),
  ).rejects.toMatchObject({ code: "verified_email_required" });
});
