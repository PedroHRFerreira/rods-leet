import type { PublicChallenge } from "../lib/contracts";
import { learningProgress } from "../domain/learning-progress";
import { ProgressBar } from "./ui";

export interface LearningProgressProps {
  challenge: PublicChallenge;
  catalog: readonly PublicChallenge[];
  completedIds: readonly string[];
}

export function LearningProgress({
  challenge,
  catalog,
  completedIds,
}: LearningProgressProps) {
  const progress = learningProgress(catalog, challenge, completedIds);
  if (progress.total === 0) return null;
  const complete = progress.remaining === 0;
  return (
    <section
      className={`learning-progress${complete ? " is-complete" : ""}`}
      aria-label={`Progresso: ${progress.label}`}
    >
      <div className="learning-progress-heading">
        <strong>{progress.label}</strong>
        <span>
          {progress.completed} de {progress.total} concluídos
        </span>
      </div>
      <ProgressBar
        value={progress.completed}
        max={progress.total}
        label={`${progress.label}: ${progress.completed} de ${progress.total} concluídos`}
      />
      <p>
        {complete
          ? "Você concluiu todas as etapas. Parabéns!"
          : `Falta${progress.remaining === 1 ? "" : "m"} ${progress.remaining} etapa${progress.remaining === 1 ? "" : "s"} para completar.`}
      </p>
    </section>
  );
}
