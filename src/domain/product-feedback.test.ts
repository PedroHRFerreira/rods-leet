import { describe, expect, it } from "vitest";
import { validateProductFeedback } from "./product-feedback";

describe("product feedback boundary", () => {
  it("matches server control-character policy while allowing formatted text", () => {
    for (const control of [0, 1, 8, 11, 12, 31, 127])
      expect(
        validateProductFeedback({
          publishToDiscord: true,
          category: "suggestion",
          message: `Melhorar ${String.fromCharCode(control)} a busca`,
        }).ok,
      ).toBe(false);
    expect(
      validateProductFeedback({
        publishToDiscord: true,
        category: "suggestion",
        message: "Melhorar\t a busca\n e os filtros\r\n",
      }).ok,
    ).toBe(true);
  });
  it("normalizes public text without accepting contact or identity", () => {
    expect(
      validateProductFeedback({
        category: "suggestion",
        message: "  Melhorar a busca  ",
        challengeId: "concept-values",
        publishToDiscord: true,
      }),
    ).toEqual({
      ok: true,
      input: {
        category: "suggestion",
        message: "Melhorar a busca",
        challengeId: "concept-values",
        publishToDiscord: true,
      },
    });
  });
  it("requires explicit public consent and rejects legacy private submissions", () => {
    for (const publishToDiscord of [undefined, false, null, "true", 1])
      expect(
        validateProductFeedback({
          category: "praise",
          message: "Gostei muito disso",
          publishToDiscord,
        }).ok,
      ).toBe(false);
    for (const contactEmail of ["learner@example.com", "", undefined])
      expect(
        validateProductFeedback({
          category: "praise",
          message: "Gostei muito disso",
          publishToDiscord: true,
          contactEmail,
        }).ok,
      ).toBe(false);
  });
  it("enforces message bounds after trimming", () => {
    for (const message of ["         ", "short", "x".repeat(4001)])
      expect(
        validateProductFeedback({
          category: "criticism",
          message,
          publishToDiscord: true,
        }).ok,
      ).toBe(false);
    for (const message of ["x".repeat(10), "x".repeat(4000)])
      expect(
        validateProductFeedback({
          category: "criticism",
          message,
          publishToDiscord: true,
        }).ok,
      ).toBe(true);
  });
  it("rejects spoofed identity, media and unknown fields", () => {
    for (const key of [
      "userId",
      "attachments",
      "protocol",
      "createdAt",
      "unexpected",
    ])
      expect(
        validateProductFeedback({
          publishToDiscord: true,
          category: "suggestion",
          message: "Melhorar a busca",
          [key]: "value",
        }).ok,
      ).toBe(false);
  });
  it("rejects malformed payloads and optional fields", () => {
    for (const value of [
      null,
      [],
      "text",
      { category: "bug", message: "Melhorar a busca" },
      { category: "praise", message: 42 },
      {
        publishToDiscord: true,
        category: "praise",
        message: "Gostei muito disso",
        contactEmail: "invalid",
      },
      { category: "praise", message: "Gostei muito disso", contactEmail: null },
      {
        publishToDiscord: true,
        category: "praise",
        message: "Gostei muito disso",
        challengeId: "../private",
      },
    ])
      expect(validateProductFeedback(value).ok).toBe(false);
  });
});
