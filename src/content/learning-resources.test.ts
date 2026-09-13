import { describe, expect, test } from "vitest";
import { challenges } from "./catalog";

describe("materiais públicos de aprendizado", () => {
  test("cada desafio tem uma referência conceitual oficial", () => {
    expect(challenges).toHaveLength(53);

    for (const challenge of challenges) {
      const concepts = challenge.learningResources.filter(
        (resource) => resource.category === "concept",
      );
      expect(concepts.length, challenge.id).toBeGreaterThan(0);
      expect(
        concepts.every((resource) => resource.url.startsWith("https://")),
      ).toBe(true);
      for (const languageId of challenge.languageIds) {
        expect(
          concepts.some((resource) => resource.languageId === languageId),
          `${challenge.id}:concept:${languageId}`,
        ).toBe(true);
      }
    }
  });

  test("cada linguagem habilitada recebe sua própria documentação", () => {
    for (const challenge of challenges) {
      for (const languageId of challenge.languageIds) {
        const resources = challenge.learningResources.filter(
          (resource) =>
            resource.category === "language" &&
            resource.languageId === languageId,
        );
        expect(
          resources.length,
          `${challenge.id}:${languageId}`,
        ).toBeGreaterThan(0);
        expect(
          resources.every((resource) => resource.url.startsWith("https://")),
        ).toBe(true);
      }
    }
  });
});
