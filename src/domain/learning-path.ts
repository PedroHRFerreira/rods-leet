import type { PublicChallenge } from "../lib/contracts";

export type LearningPathNodeState =
  "completed" | "current" | "available" | "locked";

/** The catalog order is the learning order; completion is the persisted signal. */
export function learningPathStates(
  challenges: readonly PublicChallenge[],
  completed: ReadonlySet<string>,
): Map<string, LearningPathNodeState> {
  const firstIncomplete = challenges.findIndex(
    (challenge) => !completed.has(challenge.id),
  );
  const nextAvailable = challenges.findIndex(
    (challenge, index) =>
      index > firstIncomplete && !completed.has(challenge.id),
  );
  return new Map(
    challenges.map((challenge, index) => [
      challenge.id,
      completed.has(challenge.id)
        ? "completed"
        : index === firstIncomplete
          ? "current"
          : index === nextAvailable
            ? "available"
            : "locked",
    ]),
  );
}
