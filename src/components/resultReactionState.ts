import type { PublicSubmission } from "../lib/contracts";

export type ResultReactionKind = "run" | "submit";
export type ResultReactionTone = "success" | "encouragement";

export function resultReactionTone(
  submission: PublicSubmission,
  kind: ResultReactionKind,
): ResultReactionTone | null {
  if (kind !== "submit" || submission.status !== "completed") return null;
  switch (submission.verdict) {
    case "accepted":
      return "success";
    case "wrong_answer":
    case "compile_error":
    case "runtime_error":
    case "time_limit":
    case "memory_limit":
    case "output_limit":
      return "encouragement";
    default:
      return null;
  }
}

type ReactionStorage = Pick<Storage, "getItem" | "setItem">;

/** Browser persistence plus an in-memory fallback when storage is blocked. */
export function createResultReactionLedger() {
  const seen = new Set<string>();
  return {
    claim(
      identity: string,
      submissionId: string,
      storage: ReactionStorage | null,
    ) {
      if (!identity || !submissionId) return false;
      const key = `rods:result-reaction:v1:${encodeURIComponent(identity)}:${encodeURIComponent(submissionId)}`;
      if (seen.has(key)) return false;
      try {
        if (storage?.getItem(key) === "seen") {
          seen.add(key);
          return false;
        }
        storage?.setItem(key, "seen");
      } catch {
        // Keep this page usable in private mode or when the storage quota is full.
      }
      seen.add(key);
      return true;
    },
  };
}

export const resultReactionLedger = createResultReactionLedger();
