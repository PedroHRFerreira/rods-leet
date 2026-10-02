import { describe, expect, it } from "vitest";
import type { LanguageId } from "../lib/contracts";
import {
  LOCAL_PRACTICE_LIMITS,
  selectLocalPracticeProfile,
  type LocalPracticeOutcome,
  type LocalPracticeProfile,
} from "./local-practice";

const javascript: LocalPracticeProfile = {
  languageId: "javascript",
  runtimeId: "quickjs-wasm",
  homologated: true,
  isolated: true,
};
const typescript: LocalPracticeProfile = {
  ...javascript,
  languageId: "typescript",
};

describe("local practice policy", () => {
  it("requires an explicitly homologated and isolated profile", () => {
    expect(selectLocalPracticeProfile("javascript")).toBeNull();
    expect(
      selectLocalPracticeProfile("javascript", [
        { ...javascript, homologated: false },
      ]),
    ).toBeNull();
    expect(
      selectLocalPracticeProfile("javascript", [
        { ...javascript, isolated: false },
      ]),
    ).toBeNull();
    expect(
      selectLocalPracticeProfile("javascript", [
        {
          ...javascript,
          runtimeId: "unknown",
        } as unknown as LocalPracticeProfile,
      ]),
    ).toBeNull();
    expect(selectLocalPracticeProfile("javascript", [javascript])).toBe(
      javascript,
    );
    expect(selectLocalPracticeProfile("typescript", [typescript])).toBe(
      typescript,
    );
    expect(selectLocalPracticeProfile("typescript", [javascript])).toBeNull();
  });

  it("keeps Python, PostgreSQL and remaining catalog languages remote", () => {
    const languages: LanguageId[] = [
      "python",
      "sql",
      "c",
      "cpp",
      "java",
      "kotlin",
      "csharp",
      "go",
      "rust",
    ];
    for (const language of languages) {
      const forged = {
        ...javascript,
        languageId: language,
      } as unknown as LocalPracticeProfile;
      expect(selectLocalPracticeProfile(language, [forged])).toBeNull();
    }
  });

  it("defines immutable conservative resource budgets", () => {
    expect(Object.isFrozen(LOCAL_PRACTICE_LIMITS)).toBe(true);
    expect(LOCAL_PRACTICE_LIMITS).toMatchObject({
      maxFiles: 1,
      maxSourceBytes: 65_536,
      maxInputBytes: 65_536,
      maxOutputBytes: 16_384,
      wallMs: 3_000,
      memoryMiB: 32,
    });
    expect(LOCAL_PRACTICE_LIMITS.maxInputDepth).toBeLessThanOrEqual(32);
    expect(LOCAL_PRACTICE_LIMITS.maxInputNodes).toBeLessThanOrEqual(10_000);
  });

  it("distinguishes program failures from unavailability and carries no official award", () => {
    const failure: LocalPracticeOutcome = {
      kind: "executed",
      result: {
        status: "time_limit",
        stdout: "",
        stderr: "Tempo excedido",
        wallMs: 3_000,
      },
    };
    const unavailable: LocalPracticeOutcome = {
      kind: "unavailable",
      reason: "load_failed",
      message: "Não foi possível carregar o runtime local.",
    };
    expect(failure.kind).toBe("executed");
    expect(unavailable.kind).toBe("unavailable");
    expect(failure.result).not.toHaveProperty("xpAwarded");
    expect(failure.result).not.toHaveProperty("verdict");
    expect(failure.result).not.toHaveProperty("attemptId");
  });
});
