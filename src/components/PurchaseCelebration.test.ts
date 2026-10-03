import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHOP_ITEMS } from "../domain/shop-catalog";
import PurchaseCelebration, {
  getCelebrationScene,
} from "./PurchaseCelebration";

describe("purchase celebration presentation", () => {
  it("gives every purchasable item a distinct illustration, including items of the same kind", () => {
    const purchasable = SHOP_ITEMS.filter(
      (item) => item.acquisition === "purchase",
    );
    const illustrations = purchasable.map((item) => {
      expect(getCelebrationScene(item.id)).toBeDefined();
      const markup = renderToStaticMarkup(
        createElement(PurchaseCelebration, {
          item,
          displayName: "Luna",
          onClose: () => {},
        }),
      );
      const illustration = markup.match(
        /<svg class="purchase-celebration-art"[\s\S]*?<\/svg>/,
      )?.[0];
      expect(illustration).toBeTruthy();
      return illustration;
    });
    expect(purchasable).toHaveLength(27);
    expect(new Set(illustrations).size).toBe(purchasable.length);
  });

  it.each([
    "__proto__",
    "constructor",
    "toString",
    "theme-forged",
    "avatar-scholar",
  ])("has no purchase scene for unapproved identifier %s", (id) => {
    expect(getCelebrationScene(id)).toBeUndefined();
  });

  it("uses canonical item presentation and escapes user names", () => {
    const item = SHOP_ITEMS.find((entry) => entry.id === "name-cyan")!;
    const markup = renderToStaticMarkup(
      createElement(PurchaseCelebration, {
        item: {
          ...item,
          name: "Forged name",
          value: "url(javascript:alert(1))",
          kind: "theme",
        },
        displayName: '<img src="x" onerror="alert(1)">',
        onClose: () => {},
      }),
    );
    expect(markup).toContain("Nome ciano");
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("Forged name");
    expect(markup).not.toContain("javascript:");
    expect(markup).not.toContain("shop-theme-url");
  });
});
