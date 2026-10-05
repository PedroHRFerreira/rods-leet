// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy heterogeneous PostgREST rows; presenters expose explicit fields only.
export type Row = Record<string, any>;
export function presentSubmission(
  row: Row,
  xp = 0,
  hideDetails = false,
  reviewProtocol?: string | null,
) {
  const result = row.public_result ?? {};
  return {
    id: row.id,
    attemptId: row.attempt_id,
    status: row.status === "finished" ? "completed" : row.status,
    submittedAt: row.created_at,
    completedAt: row.finished_at ?? undefined,
    verdict:
      hideDetails &&
      row.verdict &&
      row.verdict !== "accepted" &&
      row.verdict !== "infrastructure_error"
        ? "wrong_answer"
        : (row.verdict ?? undefined),
    message:
      hideDetails && row.verdict && row.verdict !== "infrastructure_error"
        ? row.verdict === "accepted"
          ? "Aceito."
          : "Rejeitado."
        : result.message,
    ...(!hideDetails
      ? {
          publicCases: result.publicCases,
          metrics: result.metrics,
          complexity: result.complexity,
          stdout: result.stdout,
          stderr: result.stderr,
        }
      : {}),
    integrityStatus: row.integrity_status ?? "clear",
    reviewProtocol: reviewProtocol ?? undefined,
    xpAwarded:
      row.integrity_status && row.integrity_status !== "clear" ? 0 : xp,
  };
}
export function presentAttempt(
  row: Row,
  assistance: Row = {},
  submissions: Row[] = [],
  solved = false,
  rejects = row.rejected_count,
  reviewProtocol?: string | null,
) {
  const expired =
    row.state === "active" &&
    row.deadline_at &&
    new Date(row.deadline_at).getTime() < Date.now();
  const latest = submissions.find(
    (submission) => submission.kind === "submission",
  );
  return {
    latestSubmissionId: latest?.id,
    integrityStatus: latest?.integrity_status ?? "clear",
    reviewProtocol: reviewProtocol ?? undefined,
    id: row.id,
    challengeId: row.challenge_id,
    challengeVersionId: row.challenge_version_id,
    mode: row.mode,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    status: solved
      ? "accepted"
      : expired
        ? "expired"
        : row.state === "exhausted"
          ? "failed"
          : row.state,
    rejectedCount: rejects,
    pendingCount: submissions.filter(
      (s) => s.kind === "submission" && s.status !== "finished",
    ).length,
    hintsUsed: assistance.hints_used ?? 0,
    practiceOnly: assistance.solution_viewed ?? false,
    solutionAvailable: solved || rejects >= 3,
  };
}
export function levelForXp(xp: number) {
  let level = 0,
    rest = xp;
  while (rest >= 150 * (level + 1)) {
    rest -= 150 * (level + 1);
    level++;
  }
  return { level, xpIntoLevel: rest, xpForNextLevel: 150 * (level + 1) };
}
