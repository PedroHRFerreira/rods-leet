import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../functions/practice-worker/[[path]]";

async function request(path: string, method = "GET") {
  const fetch = vi.fn(
    async () =>
      new Response("worker source", {
        headers: {
          "Content-Type": "application/javascript",
          "Content-Security-Policy": "script-src 'self'",
        },
      }),
  );
  const response = await onRequest({
    request: new Request(`https://example.com${path}`, { method }),
    env: { ASSETS: { fetch } },
  } as unknown as Parameters<typeof onRequest>[0]);
  return { response, fetch };
}
describe("confined worker asset route", () => {
  it("replaces the page CSP for the trusted Wasm loader without weakening HTML", async () => {
    const { response, fetch } = await request(
      "/practice-worker/local-practice.worker-Abc123.js",
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; object-src 'none'; base-uri 'none'",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("worker source");
  });
  it("accepts HEAD and rejects other assets and write methods", async () => {
    expect(
      (
        await request(
          "/practice-worker/local-practice.worker-Abc123.js",
          "HEAD",
        )
      ).response.status,
    ).toBe(200);
    for (const [path, method] of [
      ["/practice-worker/other.js", "GET"],
      ["/assets/local-practice.worker-Abc123.js", "GET"],
      ["/practice-worker/local-practice.worker-Abc123.js", "POST"],
    ]) {
      const { response, fetch } = await request(path, method);
      expect(response.status).toBe(404);
      expect(fetch).not.toHaveBeenCalled();
    }
  });
});
