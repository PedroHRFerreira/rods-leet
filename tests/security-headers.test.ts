import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

const headers = readFileSync(
  new URL("../public/_headers", import.meta.url),
  "utf8",
);
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const theme = readFileSync(
  new URL("../public/theme-init.js", import.meta.url),
  "utf8",
);
const csp = headers.match(/^\s+Content-Security-Policy: (.+)$/m)![1];
const directives = new Map(
  csp.split(";").map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }),
);

describe("production browser security boundary", () => {
  test("scripts and connections are same-origin without inline script or eval", () => {
    expect(directives.get("default-src")).toEqual(["'none'"]);
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(directives.get("script-src-attr")).toEqual(["'none'"]);
    expect(directives.get("connect-src")).toEqual(["'self'"]);
    expect(directives.get("worker-src")).toEqual(["'self'"]);
    expect(csp).not.toContain("unsafe-eval");
    for (const script of html.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
    )) {
      expect(script[1]).toMatch(/\bsrc="\//);
      expect(script[2].trim()).toBe("");
    }
  });

  test("disallows framing, plugins, external forms and sensitive browser features", () => {
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("form-action")).toEqual(["'self'"]);
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("Referrer-Policy: no-referrer");
    expect(headers).toContain("camera=(), microphone=(), geolocation=()");
    expect(headers).toContain("Strict-Transport-Security: max-age=31536000");
    expect(headers).not.toContain("preload");
  });

  test.each(["light", "dark", null, "anything"])(
    "pre-paint theme safely handles %s",
    (preference) => {
      const document = { documentElement: { dataset: { theme: "" } } };
      runInNewContext(theme, {
        document,
        localStorage: { getItem: () => preference },
      });
      expect(document.documentElement.dataset.theme).toBe(
        preference === "light" ? "light" : "dark",
      );
    },
  );

  test("theme defaults to black dark when storage is blocked", () => {
    const document = { documentElement: { dataset: { theme: "light" } } };
    runInNewContext(theme, {
      document,
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
