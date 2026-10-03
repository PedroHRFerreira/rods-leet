import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CosmeticAvatar,
  cosmeticNameColor,
  cosmeticTheme,
  cosmeticTitle,
} from "./CosmeticAvatar";

describe("cosmetic presentation allowlists", () => {
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "name-url(javascript:alert(1))",
    "<script>alert(1)</script>",
  ])("ignores forged cosmetic identifier %s", (id) => {
    expect(cosmeticNameColor(id)).toBeUndefined();
    expect(cosmeticTheme(id)).toBeUndefined();
    expect(cosmeticTitle(id)).toBeUndefined();
    const markup = renderToStaticMarkup(
      createElement(CosmeticAvatar, {
        avatarId: id,
        frameId: id,
        displayName: "Pessoa",
      }),
    );
    expect(markup).toContain("cosmetic-avatar-default");
    expect(markup).not.toContain("cosmetic-frame");
    expect(markup).not.toContain(id);
  });
  it("renders distinct illustrated characters rather than default initials", () => {
    const characters = [
      "robot",
      "fox",
      "scholar",
      "flame",
      "robot-neon",
      "astronaut",
      "dragon",
      "ninja",
    ];
    const illustrations = characters.map((kind) =>
      renderToStaticMarkup(
        createElement(CosmeticAvatar, { avatarId: `avatar-${kind}` }),
      ),
    );
    expect(new Set(illustrations).size).toBe(characters.length);
    for (const markup of illustrations) {
      expect(markup).toContain("<path");
      expect(markup).not.toContain("<text");
      expect(markup).toContain('role="img"');
      expect(markup).toContain("aria-label=");
    }
  });
  it("shows a fixed owned-frame style and a descriptive avatar label", () => {
    const markup = renderToStaticMarkup(
      createElement(CosmeticAvatar, {
        avatarId: "avatar-astronaut",
        frameId: "frame-champion",
      }),
    );
    expect(markup).toContain("cosmetic-frame-champion");
    expect(markup).toContain("Astronauta, moldura Campeão semanal");
    expect(cosmeticTitle("title-neon")).toBe("Pulso Neon");
    expect(cosmeticNameColor("name-neon-lime")).toBe(
      "var(--cosmetic-name-lime)",
    );
    expect(cosmeticTheme("theme-cosmos")).toBe("cosmos");
  });
});
