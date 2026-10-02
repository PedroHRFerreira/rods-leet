import type { LanguageId, SourceFile } from "../lib/contracts";

/** Public practice only: never carry an official attempt, verdict or XP here. */
export interface LocalPracticeInput {
  languageId: LanguageId;
  files: SourceFile[];
  functionName: string;
  input: unknown;
}

export type LocalPracticeStatus =
  | "ok"
  | "compile_error"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "output_limit";

export interface LocalPracticeResult {
  status: LocalPracticeStatus;
  stdout: string;
  stderr: string;
  output?: unknown;
  wallMs: number;
}

export type LocalPracticeUnavailableReason =
  | "unsupported_language"
  | "unsupported_workspace"
  | "invalid_input"
  | "load_failed"
  | "unsupported_browser"
  | "disabled";

/** Program errors count as executed. Only unavailability permits remote fallback. */
export type LocalPracticeOutcome =
  | { kind: "executed"; result: LocalPracticeResult }
  | {
      kind: "unavailable";
      reason: LocalPracticeUnavailableReason;
      message: string;
    };

export const LOCAL_PRACTICE_LIMITS = Object.freeze({
  maxFiles: 1,
  maxSourceBytes: 65_536,
  maxInputBytes: 65_536,
  maxOutputBytes: 16_384,
  wallMs: 3_000,
  memoryMiB: 32,
  maxInputDepth: 32,
  maxInputNodes: 10_000,
});

export type LocalPracticeLanguage = "javascript" | "typescript";
export interface LocalPracticeProfile {
  languageId: LocalPracticeLanguage;
  runtimeId: "quickjs-wasm";
  homologated: boolean;
  isolated: boolean;
}

/** The adapter must explicitly supply validated profiles; a candidate is not approval. */
export function selectLocalPracticeProfile(
  languageId: LanguageId,
  profiles: readonly LocalPracticeProfile[] = [],
): LocalPracticeProfile | null {
  if (languageId !== "javascript" && languageId !== "typescript") return null;
  return (
    profiles.find(
      (profile) =>
        profile.languageId === languageId &&
        profile.homologated &&
        profile.isolated &&
        profile.runtimeId === "quickjs-wasm",
    ) ?? null
  );
}
