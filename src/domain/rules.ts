import type { Difficulty, ExecutionLimits, Language } from "../lib/contracts";

export const LANGUAGES: readonly Language[] = [
  { id: "python", label: "Python", monacoId: "python", extension: "py" },
  {
    id: "javascript",
    label: "JavaScript",
    monacoId: "javascript",
    extension: "js",
  },
  {
    id: "typescript",
    label: "TypeScript",
    monacoId: "typescript",
    extension: "ts",
  },
  { id: "java", label: "Java", monacoId: "java", extension: "java" },
  { id: "csharp", label: "C#", monacoId: "csharp", extension: "cs" },
  { id: "cpp", label: "C++", monacoId: "cpp", extension: "cpp" },
  { id: "c", label: "C", monacoId: "c", extension: "c" },
  { id: "go", label: "Go", monacoId: "go", extension: "go" },
  { id: "rust", label: "Rust", monacoId: "rust", extension: "rs" },
  { id: "kotlin", label: "Kotlin", monacoId: "kotlin", extension: "kt" },
  { id: "sql", label: "PostgreSQL", monacoId: "sql", extension: "sql" },
];

export const DEFAULT_EXECUTION_LIMITS: Readonly<ExecutionLimits> =
  Object.freeze({
    maxFiles: 20,
    maxSourceBytes: 256 * 1024,
    compileTimeoutMs: 45_000,
    caseCpuMs: 2_000,
    caseWallMs: 5_000,
    jobWallMs: 90_000,
    memoryMiB: 2048,
    caseOutputBytes: 64 * 1024,
    jobOutputBytes: 256 * 1024,
  });
export const HARD_MINUTES: Readonly<Record<Difficulty, number>> = {
  easy: 45,
  medium: 60,
  hard: 90,
};
export const BETA_LIMITS = Object.freeze({
  globalConcurrency: 4,
  userConcurrency: 1,
  creationIntervalMs: 1_000,
  runsPerUserPerDay: 0, // Zero disables the per-person execution quota.
  dailyCreditMicros: 1_000_000,
  availableCreditFraction: 0.8,
  queueVisibilitySeconds: 180,
  infrastructureRetries: 2,
  tutorMessagesPerUserPerDay: 2,
  tutorNeuronsPerDay: 8_000,
  tutorInputTokens: 2_048,
  tutorOutputTokens: 1_024,
});
export const rewardPercent = (hintsUsed: number): number =>
  hintsUsed === 0 ? 100 : hintsUsed === 1 ? 95 : 85;

/** Each rejected submission reduces only this challenge's future reward. */
export const rejectionRewardFactor = (rejections: number): number => {
  if (!Number.isSafeInteger(rejections) || rejections < 0)
    throw new Error("Quantidade de erros inválida");
  return Math.max(0, (100 - 15 * rejections) / 100);
};

export function completionReward(
  baseXp: number,
  hard: boolean,
  hintsUsed: number,
  rejections: number,
): number {
  if (!Number.isSafeInteger(baseXp) || baseXp < 0)
    throw new Error("Recompensa inválida");
  if (!Number.isSafeInteger(hintsUsed) || hintsUsed < 0)
    throw new Error("Assistência inválida");
  return Math.floor(
    baseXp *
      (hard ? 3 : 1) *
      (rewardPercent(hintsUsed) / 100) *
      rejectionRewardFactor(rejections),
  );
}
