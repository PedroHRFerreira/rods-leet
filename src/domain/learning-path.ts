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

/** A serpentine route keeps every lesson distinct as the catalog grows. */
export function learningPathPositions(
  count: number,
): Array<readonly [number, number]> {
  const columns = 6;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column =
      row % 2 === 0 ? index % columns : columns - 1 - (index % columns);
    return [60 + column * 140, 60 + row * 140] as const;
  });
}

export function nextLearningChallenge(
  challenges: readonly PublicChallenge[],
  completed: ReadonlySet<string>,
): PublicChallenge | undefined {
  return challenges
    .filter(
      (challenge) => challenge.topicId === "logic" && challenge.learningPath,
    )
    .sort((a, b) => a.learningPath!.position - b.learningPath!.position)
    .find((challenge) => !completed.has(challenge.id));
}
