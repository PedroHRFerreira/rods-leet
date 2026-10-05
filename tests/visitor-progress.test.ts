import { describe, expect, it } from "vitest";
import { visitorMustSignIn } from "../supabase/functions/_shared/visitor-progress";

const completed = Array.from(
  { length: 10 },
  (_, index) => `challenge-${index}`,
);

describe("visitor challenge admission", () => {
  it("allows the tenth distinct completion and requires login for the eleventh", () => {
    expect(visitorMustSignIn(true, completed.slice(0, 9), "next")).toBe(false);
    expect(visitorMustSignIn(true, completed, "next")).toBe(true);
  });

  it("keeps completed challenges available for practice after the limit", () => {
    expect(visitorMustSignIn(true, completed, completed[0])).toBe(false);
  });

  it("counts distinct challenges, including duplicate mode completions", () => {
    expect(visitorMustSignIn(true, Array(20).fill("same"), "next")).toBe(false);
  });

  it("does not limit registered accounts or existing visitors over the limit", () => {
    expect(visitorMustSignIn(false, completed, "next")).toBe(false);
    expect(visitorMustSignIn(true, [...completed, "old-extra"], "next")).toBe(
      true,
    );
  });
});
