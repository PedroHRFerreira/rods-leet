import { describe, expect, it } from "vitest";
import { challenges } from "../src/content/catalog";
import { getEvaluation } from "../judge/index";
import { solutionVariants } from "../judge/validation/solutions";

describe("isolated catalog validation fixture coverage", () => {
  it("covers every catalog challenge with three distinct source variants and public plus hidden cases", () => {
    for (const challenge of challenges) {
      const variants = solutionVariants(challenge);
      expect(variants, challenge.id).toHaveLength(3);
      expect(
        new Set(variants.map((item) => JSON.stringify(item.files))).size,
        challenge.id,
      ).toBe(3);
      for (const variant of variants) {
        expect(challenge.languageIds, challenge.id).toContain(
          variant.languageId,
        );
        const evaluation = getEvaluation(challenge.id, variant.languageId);
        expect(
          evaluation.cases.some((item) => item.public),
          challenge.id,
        ).toBe(true);
        expect(
          evaluation.cases.some((item) => !item.public),
          challenge.id,
        ).toBe(true);
      }
    }
  });
});
