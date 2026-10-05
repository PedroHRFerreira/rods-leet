export const VISITOR_CHALLENGE_LIMIT = 10;

export function visitorMustSignIn(
  anonymous: boolean,
  completedChallengeIds: readonly string[],
  challengeId: string,
): boolean {
  const completed = new Set(completedChallengeIds);
  return (
    anonymous &&
    completed.size >= VISITOR_CHALLENGE_LIMIT &&
    !completed.has(challengeId)
  );
}
