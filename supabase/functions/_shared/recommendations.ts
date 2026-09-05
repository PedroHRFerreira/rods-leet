export interface StudyChallenge {
  id: string;
  versionId: string;
  topicId: string;
  difficulty: string;
}
export function recommend(
  catalog: StudyChallenge[],
  completedIds: string[],
  history: Array<{ challenge_version_id: string; verdict: string | null }>,
) {
  const completed = new Set(completedIds);
  const errors = new Map<string, number>();
  for (const item of history) {
    if (
      !item.verdict || item.verdict === "accepted" ||
      item.verdict === "infrastructure_error"
    ) continue;
    const topic = catalog.find((c) => c.versionId === item.challenge_version_id)
      ?.topicId;
    if (topic) errors.set(topic, (errors.get(topic) ?? 0) + 1);
  }
  const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
  return catalog.filter((c) => !completed.has(c.id)).map((c, index) => ({
    c,
    index,
    errors: errors.get(c.topicId) ?? 0,
  })).sort((a, b) =>
    b.errors - a.errors || (order[a.c.difficulty] - order[b.c.difficulty]) ||
    a.index - b.index
  ).slice(0, 3).map(({ c, errors }) => ({
    challengeId: c.id,
    reason: errors
      ? `Revise este tópico: ${errors} tentativa${
        errors > 1 ? "s" : ""
      } recente${errors > 1 ? "s" : ""} indicam dificuldade.`
      : "Pratique o próximo conteúdo, começando pelos fundamentos.",
  }));
}
