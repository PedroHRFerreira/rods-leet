import type { PublicChallenge } from "../lib/contracts";

/** Count only published lessons in the learner's current module or route. */
export function learningProgress(
  challenges: readonly PublicChallenge[],
  current: PublicChallenge,
  completedIds: readonly string[],
): { label: string; completed: number; total: number; remaining: number } {
  const topic = challenges.filter((item) => item.topicId === current.topicId);
  let lessons: readonly PublicChallenge[];
  let label: string;
  if (current.kind === "quiz") {
    lessons = topic.filter((item) => item.kind === "quiz");
    label = "Módulo de conceitos";
  } else if (current.learningPath) {
    lessons = topic.filter((item) => item.learningPath);
    label = "Trilha de aprendizado";
  } else {
    lessons = topic;
    label = "Desafios do tema";
  }
  const publishedIds = new Set(lessons.map((item) => item.id));
  const completed = new Set(completedIds.filter((id) => publishedIds.has(id)))
    .size;
  const total = publishedIds.size;
  return { label, completed, total, remaining: total - completed };
}
