import { afterEach, describe, expect, test, vi } from "vitest";
import { handleBff } from "../functions/_lib/bff";
import {
  allowedApi,
  digest,
  randomToken,
  seal,
  SESSION_COOKIE,
} from "../functions/_lib/security";

const env = {
  APP_ORIGIN: "https://rods-leet.pages.dev",
  SUPABASE_URL: "https://bsjcuygtpiqyomnulpsw.supabase.co",
  SUPABASE_ANON_KEY: "public-key",
  BFF_SHARED_SECRET: "s".repeat(64),
  BFF_ENCRYPTION_KEY: "ab".repeat(32),
};
afterEach(() => vi.unstubAllGlobals());
describe("weekly ranking routing boundary", () => {
  test("allows only the exact GET weekly endpoint with no client-selected identity or dates", () => {
    expect(
      allowedApi(new Request(env.APP_ORIGIN + "/api/ranking/weekly")).pathname,
    ).toBe("/api/ranking/weekly");
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      expect(() =>
        allowedApi(
          new Request(env.APP_ORIGIN + "/api/ranking/weekly", { method }),
        ),
      ).toThrow("route_not_found");
    }
    for (const query of [
      "userId=attacker",
      "week=2020-01-01",
      "eligible=true",
      "prize=500",
      "userId=a&userId=b",
    ]) {
      expect(() =>
        allowedApi(
          new Request(env.APP_ORIGIN + "/api/ranking/weekly?" + query),
        ),
      ).toThrow("invalid_query");
    }
    for (const path of [
      "/api/ranking/weekly/close",
      "/api/ranking/weekly/claim",
      "/api/ranking%2fweekly",
      "/api/ranking//weekly",
    ]) {
      expect(() => allowedApi(new Request(env.APP_ORIGIN + path))).toThrow();
    }
  });
  test("BFF derives weekly identity from the encrypted session and never forwards spoofed credentials", async () => {
    const token = randomToken();
    const id = await digest(token);
    const payload = await seal(
      {
        access_token: "real-access",
        refresh_token: "private-refresh",
        user: { id: "real-user" },
        csrf: "csrf",
        expiresAt: Date.now() + 3600000,
      },
      env.BFF_ENCRYPTION_KEY,
      id,
    );
    const state = {
      startsAt: "2026-10-05T03:00:00Z",
      endsAt: "2026-10-12T03:00:00Z",
      entries: [],
      currentUser: null,
    };
    const sent: { target: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (target, init) => {
        sent.push({ target: String(target), init });
        return String(target).endsWith("/session")
          ? Response.json({ payload, version: 1 })
          : Response.json(state);
      }),
    );
    const response = await handleBff(
      new Request(env.APP_ORIGIN + "/api/ranking/weekly", {
        headers: {
          cookie: `${SESSION_COOKIE}=${token}`,
          Authorization: "Bearer forged-access",
          "x-user-id": "attacker",
          "x-forwarded-host": "attacker.example",
        },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(state);
    const upstream = sent.at(-1)!;
    expect(upstream.target).toBe(
      env.SUPABASE_URL + "/functions/v1/api/ranking/weekly",
    );
    const headers = new Headers(upstream.init.headers);
    expect(headers.get("authorization")).toBe("Bearer real-access");
    expect(headers.get("x-bff-signature")).toMatch(/^[a-f0-9]{64}$/);
    for (const name of ["cookie", "x-user-id", "x-forwarded-host"])
      expect(headers.has(name)).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
  });
});
