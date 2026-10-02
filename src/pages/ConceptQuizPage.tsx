import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  Send,
  Zap,
} from "lucide-react";
import { challengeById, challenges } from "../content/catalog";
import { completionReward } from "../domain/rules";
import { useGateway } from "../lib/gateway-context";
import type {
  Attempt,
  Dashboard,
  PublicChallenge,
  PublicSubmission,
  QuizSubmissionInput,
} from "../lib/contracts";
import { GatewayError } from "../lib/contracts";
import { PageHeading } from "../components/ui";
import { LearningProgress } from "../components/LearningProgress";
import { useSubmissionConfirmation } from "../lib/useSubmissionConfirmation";
import {
  QuizConfirmation,
  QuizFeedback,
} from "../components/ConceptQuizFeedback";

const errorText = (error: unknown) =>
  error instanceof GatewayError && error.code === "network_error"
    ? "Não foi possível conectar para conferir sua resposta. Tente novamente."
    : error instanceof Error
      ? error.message
      : "Não conseguimos confirmar seu envio. Tente novamente.";

type PendingAnswer = { input: QuizSubmissionInput; key: string };

export default function ConceptQuizPage({
  challenge,
  dashboard,
}: {
  challenge: PublicChallenge;
  dashboard: Dashboard;
}) {
  const gateway = useGateway();
  const queryClient = useQueryClient();
  const { skipConfirmation, setSkipConfirmation } = useSubmissionConfirmation(
    dashboard.profile.id,
    "quiz",
  );
  const catalog = useQuery({
    queryKey: ["challenges"],
    queryFn: () => gateway.listChallenges(),
  });
  const [params] = useSearchParams();
  const openingKey = useRef(crypto.randomUUID());
  const pendingAnswer = useRef<PendingAnswer | null>(null);
  const sending = useRef(false);
  const questionHeading = useRef<HTMLLegendElement>(null);
  const [selected, setSelected] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [result, setResult] = useState<PublicSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completed = dashboard.completedChallengeIds.includes(challenge.id);
  const attemptKey = [
    "quiz-attempt",
    dashboard.profile.id,
    challenge.versionId,
  ];
  const attempt = useQuery({
    queryKey: attemptKey,
    queryFn: () =>
      gateway.startAttempt(
        { challengeVersionId: challenge.versionId, mode: "normal" },
        openingKey.current,
      ),
    enabled: dashboard.profile.authenticated && !completed,
    retry: false,
  });
  const approved =
    completed ||
    attempt.data?.status === "accepted" ||
    (result?.status === "completed" && result.verdict === "accepted");
  const completedIds = approved
    ? [...new Set([...dashboard.completedChallengeIds, challenge.id])]
    : dashboard.completedChallengeIds;
  const reward =
    approved || attempt.data?.practiceOnly
      ? 0
      : completionReward(
          challenge.baseXp,
          false,
          0,
          attempt.data?.rejectedCount ?? 0,
        );
  const nextChallenge = challenge.learningPath?.nextChallengeId
    ? challengeById.get(challenge.learningPath.nextChallengeId)
    : undefined;
  const language = params.get("language");
  const nextUrl = nextChallenge
    ? `/desafios/${nextChallenge.slug}${language && (nextChallenge.kind === "quiz" || nextChallenge.languageIds.some((id) => id === language)) ? `?language=${encodeURIComponent(language)}` : ""}`
    : "/trilhas";
  const quiz = challenge.quiz;

  async function sendAnswer() {
    if (sending.current || approved) return;
    const current = attempt.data;
    if (!pendingAnswer.current && (!current || !selected)) return;
    if (!pendingAnswer.current) {
      pendingAnswer.current = {
        input: {
          challengeVersionId: challenge.versionId,
          attemptId: current!.id,
          optionId: selected,
        },
        key: crypto.randomUUID(),
      };
    }
    const request = pendingAnswer.current;
    sending.current = true;
    setBusy(true);
    setUnconfirmed(true);
    setConfirmationOpen(false);
    setError(null);
    try {
      const answer = await gateway.submitQuiz(request.input, request.key);
      pendingAnswer.current = null;
      setUnconfirmed(false);
      setResult(answer);
      if (answer.status === "completed" && answer.verdict === "accepted") {
        queryClient.setQueryData<Dashboard>(
          ["dashboard"],
          (currentDashboard) => {
            if (
              !currentDashboard ||
              currentDashboard.profile.id !== dashboard.profile.id
            )
              return currentDashboard;
            const completedChallengeIds = [
              ...new Set([
                ...currentDashboard.completedChallengeIds,
                challenge.id,
              ]),
            ];
            return {
              ...currentDashboard,
              completedChallengeIds,
              completedCount: completedChallengeIds.length,
            };
          },
        );
      }
      const cachedAttempt = queryClient.getQueryData<Attempt>(attemptKey);
      if (cachedAttempt) {
        queryClient.setQueryData<Attempt>(attemptKey, {
          ...cachedAttempt,
          status:
            answer.status === "completed" && answer.verdict === "accepted"
              ? "accepted"
              : cachedAttempt.status,
          rejectedCount:
            cachedAttempt.rejectedCount +
            (answer.status === "completed" && answer.verdict === "wrong_answer"
              ? 1
              : 0),
        });
      }
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["ranking"] }),
        gateway.getAttempt(answer.attemptId).then((updated) => {
          queryClient.setQueryData(attemptKey, updated);
        }),
      ]);
    } catch (cause) {
      if (
        cause instanceof GatewayError &&
        cause.code === "challenge_already_completed"
      ) {
        pendingAnswer.current = null;
        setUnconfirmed(false);
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        return;
      }
      setError(errorText(cause));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function retry() {
    if (pendingAnswer.current) {
      void sendAnswer();
    } else if (attempt.isError) {
      void attempt.refetch();
    } else {
      setResult(null);
      setError(null);
      setSelected("");
      questionHeading.current?.focus();
    }
  }

  if (!quiz) return null;

  return (
    <div className="concept-quiz-page">
      <div className="concept-quiz-links">
        <Link to="/desafios" className="back-link">
          <ArrowLeft size={16} /> Todos os desafios
        </Link>
        <Link
          className="text-link"
          to={`/feedback?challengeId=${encodeURIComponent(challenge.id)}`}
        >
          <MessageSquare size={16} /> Enviar feedback
        </Link>
      </div>
      <PageHeading
        eyebrow="Primeiros conceitos"
        title={challenge.title}
        description="Leia a explicação e escolha uma resposta. Você ainda não precisa escrever código."
      >
        <div className="concept-quiz-reward">
          <Zap size={20} aria-hidden="true" />
          <strong>{approved ? "Concluído" : `${reward} XP`}</strong>
          <span>
            {approved ? "Etapa concluída" : "Ao acertar esta pergunta"}
          </span>
        </div>
      </PageHeading>
      {challenge.learningPath && (
        <p className="concept-quiz-progress">
          Etapa atual da trilha de lógica: {challenge.learningPath.position} de{" "}
          {challenge.learningPath.total}
        </p>
      )}
      <LearningProgress
        challenge={challenge}
        catalog={catalog.data ?? challenges}
        completedIds={completedIds}
      />
      <section
        className="concept-quiz-lesson panel"
        aria-labelledby="quiz-lesson-title"
      >
        <h2 id="quiz-lesson-title">
          <BookOpen size={20} aria-hidden="true" /> Entenda a ideia
        </h2>
        {quiz.lesson.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {quiz.snippet && (
          <pre className="concept-quiz-snippet">
            <code>{quiz.snippet}</code>
          </pre>
        )}
      </section>
      {approved ? (
        <section
          className="concept-quiz-completed panel"
          aria-label="Etapa concluída"
        >
          {!result && (
            <p>
              <CheckCircle2 size={20} aria-hidden="true" /> Você já concluiu
              esta etapa. Pode reler a explicação e seguir quando quiser.
            </p>
          )}
          <QuizFeedback
            result={result}
            identity={dashboard.profile.id}
            error={error}
            retry={retry}
          />
          <Link className="button button-primary" to={nextUrl}>
            {nextChallenge ? "Próximo passo" : "Ver minha trilha"}
            <ArrowRight size={18} />
          </Link>
          {nextChallenge && (
            <p className="concept-quiz-next-title">
              A seguir: {nextChallenge.title}
            </p>
          )}
        </section>
      ) : (
        <form
          className="concept-quiz-question panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected && attempt.data && !busy && !unconfirmed) {
              if (skipConfirmation) void sendAnswer();
              else setConfirmationOpen(true);
            }
          }}
        >
          <fieldset disabled={busy || unconfirmed || !attempt.data}>
            <legend ref={questionHeading} tabIndex={-1}>
              {quiz.question}
            </legend>
            <div className="concept-quiz-options">
              {quiz.options.map((option) => (
                <label
                  className={`concept-quiz-option${selected === option.id ? " is-selected" : ""}`}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name="quiz-answer"
                    value={option.id}
                    checked={selected === option.id}
                    onChange={() => {
                      setSelected(option.id);
                      setResult(null);
                      setError(null);
                    }}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {attempt.isPending && <p role="status">Preparando sua pergunta…</p>}
          <QuizFeedback
            result={result}
            identity={dashboard.profile.id}
            error={error ?? (attempt.isError ? errorText(attempt.error) : null)}
            retry={retry}
          />
          <div className="concept-quiz-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={!selected || !attempt.data || busy || unconfirmed}
            >
              <Send size={17} aria-hidden="true" />
              {busy ? "Conferindo resposta…" : "Confirmar resposta"}
            </button>
            <p>
              Escolha com calma. Cada resposta incorreta reduz a recompensa em
              15% do XP inicial desta etapa.
            </p>
          </div>
        </form>
      )}
      <QuizConfirmation
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={(skip) => {
          if (sending.current || approved) return;
          if (skip) setSkipConfirmation(true);
          void sendAnswer();
        }}
        reward={reward}
        busy={busy}
      />
    </div>
  );
}
