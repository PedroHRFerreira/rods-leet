import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  FileCode2,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import {
  DifficultyBadge,
  ErrorState,
  LoadingState,
  TopicIcon,
} from "../components/ui";
import { challengeById, topics } from "../content/catalog";
import { LearningResourceList } from "../components/LearningResourceList";
import { LearningProgress } from "../components/LearningProgress";
import { ResultReaction } from "../components/ResultReaction";
import { useSubmissionConfirmation } from "../lib/useSubmissionConfirmation";
import {
  FunctionGuide,
  firstStepTask,
  modelFunctionName,
} from "../components/FunctionGuide";
import { LANGUAGES, completionReward } from "../domain/rules";
import type {
  Attempt,
  Dashboard,
  DraftInput,
  LanguageId,
  PublicChallenge,
  PublicSubmission,
  SolutionResult,
  SourceFile,
} from "../lib/contracts";
import { GatewayError } from "../lib/contracts";
import type { LocalPracticeResult as PracticeResult } from "../domain/local-practice";
import {
  localPracticeAvailable,
  runLocalPractice,
} from "../lib/local-practice-client";
import LocalPracticeResult from "../components/LocalPracticeResult";
import "../editor.css";

const CodeEditor = lazy(() => import("../components/CodeEditor"));
const ConceptQuizPage = lazy(() => import("./ConceptQuizPage"));
const showJson = (value: unknown) => {
  const compact = JSON.stringify(value);
  return compact && compact.length <= 80
    ? compact
    : JSON.stringify(value, null, 2);
};
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
const verdictLabels = {
  accepted: "Solução aceita",
  wrong_answer: "Resposta incorreta",
  compile_error: "Erro de compilação",
  runtime_error: "Erro de execução",
  time_limit: "Limite de tempo",
  memory_limit: "Limite de memória",
  output_limit: "Limite de saída",
  infrastructure_error: "Avaliação indisponível",
};

export default function ChallengePage() {
  const { slug = "" } = useParams();
  const gateway = useGateway();
  const challenge = useQuery({
    queryKey: ["challenge", slug],
    queryFn: () => gateway.getChallenge(slug),
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
    retry: false,
  });
  if (challenge.isPending || dashboard.isPending)
    return <LoadingState label="Preparando o desafio…" />;
  if (challenge.isError)
    return (
      <ErrorState
        error={challenge.error}
        retry={() => void challenge.refetch()}
      />
    );
  if (dashboard.isError) {
    return (
      <ErrorState
        error={dashboard.error}
        retry={() => void dashboard.refetch()}
      />
    );
  }
  if (challenge.data.kind === "quiz") {
    return (
      <Suspense fallback={<LoadingState label="Preparando a pergunta…" />}>
        <ConceptQuizPage
          key={`${challenge.data.id}:${dashboard.data.profile.id}`}
          challenge={challenge.data}
          dashboard={dashboard.data}
        />
      </Suspense>
    );
  }
  return (
    <ChallengeWorkspace
      key={`${challenge.data.id}:${dashboard.data.profile.id}`}
      challenge={challenge.data}
      dashboard={dashboard.data}
    />
  );
}

function ChallengeWorkspace({
  challenge,
  dashboard,
}: {
  challenge: PublicChallenge;
  dashboard: Dashboard;
}) {
  const [params, setParams] = useSearchParams();
  const requestedLanguage = params.get("language") as LanguageId | null;
  const languageStorageKey = `codegamer:language:v1:${dashboard.profile.id}:${challenge.id}`;
  let savedLanguage: LanguageId | null = null;
  try {
    savedLanguage = localStorage.getItem(
      languageStorageKey,
    ) as LanguageId | null;
    if (!savedLanguage || !challenge.languageIds.includes(savedLanguage)) {
      // Preserve a previously edited language when an older URL has no selection.
      savedLanguage =
        challenge.languageIds.find((id) => {
          try {
            const draft = JSON.parse(
              localStorage.getItem(
                `codegamer:editor:v1:${dashboard.profile.id}:${challenge.id}:${id}`,
              ) ?? "null",
            ) as EditorDraft | null;
            return (
              draft?.challengeId === challenge.id &&
              draft.languageId === id &&
              Array.isArray(draft.files) &&
              draft.files.length > 0 &&
              draft.files.every(
                (file) =>
                  typeof file.path === "string" &&
                  typeof file.content === "string",
              )
            );
          } catch {
            return false;
          }
        }) ?? null;
    }
  } catch {
    /* Storage is optional; the starter remains usable. */
  }
  const language =
    requestedLanguage && challenge.languageIds.includes(requestedLanguage)
      ? requestedLanguage
      : savedLanguage && challenge.languageIds.includes(savedLanguage)
        ? savedLanguage
        : challenge.topicId === "logic" &&
            challenge.languageIds.includes("javascript")
          ? "javascript"
          : challenge.languageIds.includes("typescript")
            ? "typescript"
            : challenge.languageIds[0];
  const setLanguage = (value: LanguageId) => {
    try {
      localStorage.setItem(languageStorageKey, value);
    } catch {
      /* Optional preference. */
    }
    const next = new URLSearchParams(params);
    next.set("language", value);
    setParams(next, { replace: true });
  };
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const lastSubmissionKey = `codegamer:last-submission:v1:${dashboard.profile.id}:${challenge.id}`;
  const [submissionId, setSubmissionId] = useState<string | null>(() => {
    if (!dashboard.profile.authenticated) return null;
    try {
      return localStorage.getItem(lastSubmissionKey);
    } catch {
      return null;
    }
  });
  const [submissionKind, setSubmissionKind] = useState<"run" | "submit">(() => {
    try {
      return localStorage.getItem(`${lastSubmissionKey}:kind`) === "run"
        ? "run"
        : "submit";
    } catch {
      return "submit";
    }
  });
  const [submission, setSubmission] = useState<PublicSubmission | null>(null);
  const freshSubmissionIds = useRef(new Set<string>());
  const [busy, setBusy] = useState<string | null>(null);
  const executing = useRef(false);
  const localController = useRef<AbortController | null>(null);
  const executionGeneration = useRef(0);
  const [localResult, setLocalResult] = useState<PracticeResult | null>(null);
  const [localPhase, setLocalPhase] = useState<"loading" | "running" | null>(
    null,
  );
  const [localFallback, setLocalFallback] = useState("");
  const [error, setError] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [solution, setSolution] = useState<SolutionResult | null>(null);
  const [activePanel, setActivePanel] = useState<
    "description" | "learning" | "hints" | "solution"
  >("description");
  const gateway = useGateway();
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({
    queryKey: ["challenges"],
    queryFn: () => gateway.listChallenges(),
    retry: false,
  });
  const catalog = catalogQuery.data ?? [...challengeById.values()];
  const execution = useQuery({
    queryKey: ["execution-status"],
    queryFn: () => gateway.getExecutionStatus(),
    enabled: dashboard.profile.authenticated,
    refetchInterval: 30_000,
    retry: false,
  });
  const executionStatus = dashboard.profile.authenticated
    ? (execution.data?.status ?? "offline")
    : "offline";
  const executionMessage =
    executionStatus === "ready"
      ? "Execute quantas vezes quiser. Cada envio incorreto reduz a recompensa em 15% do XP inicial do desafio."
      : executionStatus === "busy"
        ? "O serviço está ocupado. Tente novamente em instantes. Seu código está salvo."
        : "A execução remota está indisponível agora. Seu rascunho continua salvo e nenhuma tentativa será consumida.";
  const actionKeys = useRef(new Map<string, string>());
  const studyAvailable =
    localPracticeAvailable(language) && challenge.examples.length > 0;
  const studyMessage = studyAvailable
    ? "Executar testa o primeiro exemplo público neste navegador, sem aprovação nem XP. Submeter envia a solução para a avaliação oficial."
    : executionMessage;
  const topic = topics.find((item) => item.id === challenge.topicId);
  const prerequisite = challenge.prerequisites?.[0]
    ? challengeById.get(challenge.prerequisites[0])
    : undefined;
  const guidedNextChallenge = challenge.learningPath?.nextChallengeId
    ? catalog.find(
        (item) => item.id === challenge.learningPath?.nextChallengeId,
      )
    : undefined;
  const remainingChallenges = catalog.filter(
    (item) =>
      item.id !== challenge.id &&
      !dashboard.completedChallengeIds.includes(item.id),
  );
  const nextChallenge =
    guidedNextChallenge ??
    remainingChallenges.find((item) => item.topicId === challenge.topicId) ??
    remainingChallenges[0];
  const completed = dashboard.completedChallengeIds.includes(challenge.id);
  const approved =
    completed ||
    attempt?.status === "accepted" ||
    (submissionKind === "submit" &&
      submission?.status === "completed" &&
      submission.verdict === "accepted");
  const completedIds =
    approved && !completed
      ? [...dashboard.completedChallengeIds, challenge.id]
      : dashboard.completedChallengeIds;
  const potentialXp =
    completed || attempt?.practiceOnly
      ? 0
      : completionReward(
          challenge.baseXp,
          attempt?.mode === "hard",
          attempt?.hintsUsed ?? 0,
          attempt?.rejectedCount ?? 0,
        );
  const [approval, setApproval] = useState<PublicSubmission | null>(null);
  const pendingApproval = useRef<string | null>(null);
  useEffect(() => {
    setLocalResult(null);
    setLocalPhase(null);
    setLocalFallback("");
    setBusy(null);
    return () => {
      executionGeneration.current += 1;
      localController.current?.abort();
      localController.current = null;
      executing.current = false;
    };
  }, [language, challenge.id]);
  const official = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => gateway.getSubmission(submissionId!),
    enabled:
      Boolean(submissionId) &&
      !(submission?.id === submissionId && submission.status === "completed"),
    refetchInterval: (query) =>
      query.state.data?.status === "completed" ? false : 1500,
    retry: 2,
  });
  useEffect(() => {
    if (!dashboard.profile.authenticated) return;
    try {
      if (submissionId) {
        localStorage.setItem(lastSubmissionKey, submissionId);
        localStorage.setItem(`${lastSubmissionKey}:kind`, submissionKind);
      } else {
        localStorage.removeItem(lastSubmissionKey);
        localStorage.removeItem(`${lastSubmissionKey}:kind`);
      }
    } catch {
      /* Polling still works without local persistence. */
    }
  }, [
    dashboard.profile.authenticated,
    lastSubmissionKey,
    submissionId,
    submissionKind,
  ]);
  useEffect(() => {
    if (
      official.error instanceof GatewayError &&
      [403, 404].includes(official.error.status)
    ) {
      setSubmissionId(null);
      setSubmission(null);
    }
  }, [official.error]);
  useEffect(() => {
    if (!official.data) return;
    setSubmission(official.data);
    if (official.data.status === "completed") {
      if (submissionKind === "submit" && official.data.verdict === "accepted") {
        queryClient.setQueryData<Dashboard>(["dashboard"], (current) => {
          if (!current || current.profile.id !== dashboard.profile.id)
            return current;
          const completedChallengeIds = [
            ...new Set([...current.completedChallengeIds, challenge.id]),
          ];
          return {
            ...current,
            completedChallengeIds,
            completedCount: completedChallengeIds.length,
          };
        });
      }
      if (
        official.data.verdict === "accepted" &&
        pendingApproval.current === official.data.id
      ) {
        pendingApproval.current = null;
        setApproval(official.data);
      }
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void gateway
        .getAttempt(official.data.attemptId)
        .then(setAttempt)
        .catch(() => {});
    }
  }, [
    official.data,
    gateway,
    queryClient,
    submissionKind,
    dashboard.profile.id,
    challenge.id,
  ]);
  const inFlight =
    submission?.status === "queued" ||
    submission?.status === "running" ||
    (Boolean(submissionId) && !submission && official.isPending);
  function keyFor(operation: string) {
    const key = actionKeys.current.get(operation) ?? crypto.randomUUID();
    actionKeys.current.set(operation, key);
    return key;
  }
  async function ensureAttempt(generation?: number) {
    if (attempt?.status === "active" || attempt?.status === "accepted")
      return attempt;
    const next = await gateway.startAttempt(
      { challengeVersionId: challenge.versionId, mode: "normal" },
      keyFor("attempt"),
    );
    actionKeys.current.delete("attempt");
    if (generation === undefined || generation === executionGeneration.current)
      setAttempt(next);
    return next;
  }
  async function execute(
    files: SourceFile[],
    kind: "run" | "submit",
    executionMode: "function" | "program",
    stdin: string,
  ) {
    if (executing.current || inFlight) return;
    if (kind === "submit" && approved) return;
    const useLocal =
      kind === "run" && executionMode === "function" && studyAvailable;
    if (!useLocal && executionStatus !== "ready") {
      setError(executionMessage);
      return;
    }
    executing.current = true;
    const generation = ++executionGeneration.current;
    const controller = new AbortController();
    localController.current = controller;
    const currentExecution = () =>
      generation === executionGeneration.current && !controller.signal.aborted;
    const snapshot = files.map((file) => ({ ...file }));
    setBusy(kind);
    setError("");
    setLocalFallback("");
    setLocalResult(null);
    try {
      if (useLocal) {
        setLocalPhase("loading");
        const outcome = await runLocalPractice(
          {
            languageId: language,
            files: snapshot,
            functionName: modelFunctionName(challenge, language),
            input: challenge.examples[0].input,
          },
          {
            signal: controller.signal,
            onPhase: (phase) => {
              if (currentExecution()) setLocalPhase(phase);
            },
          },
        );
        if (!currentExecution()) return;
        setLocalPhase(null);
        if (outcome.kind === "executed") {
          setLocalResult(outcome.result);
          return;
        }
        setLocalFallback(
          `Prática no navegador indisponível: ${outcome.message} ${executionStatus === "ready" ? "O teste será executado pelo servidor." : "Tente executar pelo servidor quando o serviço estiver disponível."}`,
        );
      }
      if (executionStatus !== "ready") {
        setError(executionMessage);
        return;
      }
      const current = await ensureAttempt(generation);
      if (!currentExecution()) return;
      const input = {
        challengeVersionId: challenge.versionId,
        attemptId: current.id,
        languageId: language,
        executionMode,
        ...(kind === "run" ? { stdin } : {}),
        files: snapshot,
      };
      const operation = `${kind}:${JSON.stringify(input)}`;
      const next = await gateway[kind](input, keyFor(operation));
      if (!currentExecution()) return;
      actionKeys.current.delete(operation);
      if (kind === "submit") pendingApproval.current = next.id;
      freshSubmissionIds.current.add(next.id);
      if (next.status === "completed") {
        queryClient.setQueryData(["submission", next.id], next);
      }
      setSubmission(next);
      setSubmissionId(next.id);
      setSubmissionKind(kind);
    } catch (cause) {
      if (currentExecution()) setError(errorText(cause));
    } finally {
      if (currentExecution()) {
        executing.current = false;
        localController.current = null;
        setLocalPhase(null);
        setBusy(null);
      }
    }
  }
  async function hint() {
    setBusy("hint");
    setError("");
    try {
      const current = await ensureAttempt();
      const next = await gateway.requestHint(current.id, keyFor("hint"));
      actionKeys.current.delete("hint");
      setHints((previous) => [...previous, next.text]);
      setAttempt({ ...current, hintsUsed: next.hintsUsed });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  }
  async function openSolution() {
    setBusy("solution");
    setError("");
    try {
      const next = await gateway.getSolution(
        challenge.id,
        language,
        keyFor("solution"),
      );
      actionKeys.current.delete("solution");
      setSolution(next);
      if (attempt) setAttempt({ ...attempt, practiceOnly: next.practiceOnly });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  }
  const solutionUnlocked =
    completed ||
    attempt?.solutionAvailable ||
    (attempt?.rejectedCount ?? 0) >= 3;
  return (
    <div className="arena-page">
      <div className="arena-breadcrumb">
        <Link to="/desafios">
          <ArrowLeft size={15} /> Desafios
        </Link>
        <ChevronRight size={13} />
        <span>{topic?.title}</span>
        <Link
          className="text-link"
          to={`/feedback?challengeId=${encodeURIComponent(challenge.id)}`}
        >
          <MessageSquare size={15} /> Enviar feedback
        </Link>
      </div>
      <div className="arena-heading">
        <div>
          <div className="arena-title-meta">
            <DifficultyBadge difficulty={challenge.difficulty} />
            <span className="arena-topic">
              <TopicIcon topicId={challenge.topicId} size={14} />
              {topic?.title}
            </span>
            {approved && (
              <span className="arena-completed">
                <CheckCircle2 size={14} />
                Concluído
              </span>
            )}
          </div>
          <h1>{challenge.title}</h1>
        </div>
        <div className="arena-xp">
          <Zap size={18} fill="currentColor" />
          <strong>{approved ? "Concluído" : `${potentialXp} XP`}</strong>
          <small>
            {approved
              ? "Desafio aprovado"
              : attempt?.practiceOnly
                ? "Prática sem XP"
                : "na primeira aprovação"}
          </small>
        </div>
      </div>
      <LearningProgress
        challenge={challenge}
        catalog={catalog}
        completedIds={completedIds}
      />
      <div className="arena-mode-row">
        <div className="arena-modes">
          <span
            className={`mode-chip ${attempt?.mode !== "hard" ? "selected" : ""}`}
          >
            <Code2 size={14} />
            {attempt?.mode === "hard" ? "Hard" : "Normal"}
          </span>
          <span className="mode-chip locked">
            <LockKeyhole size={13} />
            Hard <small>Fase 2</small>
          </span>
        </div>
        <span className="arena-contract">
          <ShieldCheck size={14} />
          Todos os testes obrigatórios precisam passar
        </span>
      </div>
      {attempt?.mode === "hard" && <HardClock attempt={attempt} />}
      {error && (
        <div className="arena-alert" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            className="text-link"
            onClick={() => setError("")}
          >
            Fechar
          </button>
        </div>
      )}
      <div className="arena-grid">
        <section
          className="panel problem-panel"
          aria-label="Material do desafio"
        >
          <div
            className="arena-panel-tabs"
            role="tablist"
            aria-label="Conteúdo do desafio"
          >
            {(
              [
                { id: "description", label: "Enunciado", icon: BookOpen },
                {
                  id: "learning",
                  label: "Plano de aprendizado",
                  icon: Sparkles,
                },
                { id: "hints", label: "Dicas", icon: Lightbulb },
                { id: "solution", label: "Gabarito", icon: LockKeyhole },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                role="tab"
                aria-selected={activePanel === id}
                aria-controls={`panel-${id}`}
                onClick={() => setActivePanel(id)}
                className={activePanel === id ? "active" : ""}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <div
            className="problem-body"
            id={`panel-${activePanel}`}
            role="tabpanel"
            aria-labelledby={`tab-${activePanel}`}
          >
            {activePanel === "description" && (
              <>
                <h2>Sua missão</h2>
                {challenge.tags?.includes("primeiros passos") ? (
                  <p className="problem-description">
                    {challenge.description
                      .split(/(?<=\.)\s+/)
                      .slice(0, 2)
                      .join(" ")}
                  </p>
                ) : (
                  <div className="problem-description-paragraphs">
                    {(
                      challenge.descriptionsByLanguage?.[language] ??
                      challenge.description
                    )
                      .split(/\n\s*\n/)
                      .map((paragraph, index) => (
                        <p className="problem-description" key={index}>
                          {paragraph}
                        </p>
                      ))}
                  </div>
                )}
                <FunctionGuide challenge={challenge} language={language} />
                {challenge.tags?.includes("primeiros passos") && (
                  <details className="guided-mission-details">
                    <summary>Leia a explicação completa da missão</summary>
                    {(
                      challenge.descriptionsByLanguage?.[language] ??
                      challenge.description
                    )
                      .split(/\n\s*\n/)
                      .map((paragraph, index) => (
                        <p className="problem-description" key={index}>
                          {paragraph}
                        </p>
                      ))}
                  </details>
                )}
                {challenge.learningPath && (
                  <aside className="learning-path-note">
                    <strong>
                      Lógica · passo {challenge.learningPath.position} de{" "}
                      {challenge.learningPath.total}
                    </strong>
                    {prerequisite && (
                      <span>
                        Antes deste, vale revisar{" "}
                        <Link to={`/desafios/${prerequisite.slug}`}>
                          {prerequisite.title}
                        </Link>
                        .
                      </span>
                    )}
                    {nextChallenge && (
                      <span>
                        Após aprovar, siga para{" "}
                        <Link
                          to={`/desafios/${nextChallenge.slug}?language=${language}`}
                        >
                          {nextChallenge.title}
                        </Link>
                        .
                      </span>
                    )}
                  </aside>
                )}
                {challenge.sqlSchema && (
                  <>
                    <h3>Estrutura dos dados</h3>
                    <pre className="example-code">{challenge.sqlSchema}</pre>
                  </>
                )}
                {attempt?.mode !== "hard" && (
                  <>
                    <h3>Exemplos</h3>
                    {challenge.examples.map((example, index) => (
                      <div className="public-example" key={index}>
                        <strong>Exemplo {index + 1}</strong>
                        {example.input === null &&
                        challenge.tags?.includes("primeiros passos") ? (
                          <span>Sem entrada neste passo</span>
                        ) : (
                          <>
                            <span>Entrada</span>
                            <pre>{showJson(example.input)}</pre>
                          </>
                        )}
                        <span>Saída esperada</span>
                        <pre className="example-output">
                          {showJson(example.output)}
                        </pre>
                        {example.explanation && <p>{example.explanation}</p>}
                      </div>
                    ))}
                  </>
                )}
                <h3>Contrato e limites</h3>
                <ul className="constraint-list">
                  {challenge.constraints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {challenge.limits && (
                  <details
                    className="execution-limits-details"
                    open={!challenge.tags?.includes("primeiros passos")}
                  >
                    <summary>Limites de execução</summary>
                    <div className="published-limits">
                      <p className="published-limits-explanation">
                        Cada caso tem seu próprio limite. A compilação acontece
                        uma vez; o prazo total de segurança inclui compilação e
                        todos os casos executados no trabalho.
                      </p>
                      <dl>
                        <div>
                          <dt>CPU por caso</dt>
                          <dd>{challenge.limits.caseCpuMs / 1000} s</dd>
                        </div>
                        <div>
                          <dt>Duração por caso</dt>
                          <dd>{challenge.limits.caseWallMs / 1000} s</dd>
                        </div>
                        <div>
                          <dt>Duração total</dt>
                          <dd>{challenge.limits.jobWallMs / 1000} s</dd>
                        </div>
                        <div>
                          <dt>Compilação</dt>
                          <dd>{challenge.limits.compileTimeoutMs / 1000} s</dd>
                        </div>
                        <div>
                          <dt>Memória</dt>
                          <dd>{challenge.limits.memoryMiB} MiB</dd>
                        </div>
                        <div>
                          <dt>Saída por caso / total</dt>
                          <dd>
                            {challenge.limits.caseOutputBytes / 1024} /{" "}
                            {challenge.limits.jobOutputBytes / 1024} KiB
                          </dd>
                        </div>
                        <div>
                          <dt>Arquivos / código</dt>
                          <dd>
                            {challenge.limits.maxFiles} /{" "}
                            {challenge.limits.maxSourceBytes / 1024} KiB
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </details>
                )}
                <p className="problem-footnote">
                  Os testes oficiais incluem casos adicionais. Seus dados e
                  respostas esperadas permanecem privados.
                </p>
              </>
            )}
            {activePanel === "learning" && (
              <div className="learning-panel">
                <span className="assistance-icon">
                  <Sparkles size={28} />
                </span>
                <h2>Plano de aprendizado</h2>
                <p>
                  Use estas referências para entender o conceito e escrever sua
                  solução com autonomia.
                </p>
                <p className="learning-free-note">
                  Este material é gratuito e não usa dicas nem altera sua
                  recompensa.
                </p>
                <LearningResourceList
                  heading="Entenda o conceito"
                  resources={challenge.learningResources.filter(
                    (resource) =>
                      resource.category === "concept" &&
                      (!resource.languageId ||
                        resource.languageId === language),
                  )}
                />
                <LearningResourceList
                  heading={`Para resolver em ${LANGUAGES.find((item) => item.id === language)?.label ?? language}`}
                  resources={challenge.learningResources.filter(
                    (resource) =>
                      resource.category === "language" &&
                      resource.languageId === language,
                  )}
                />
              </div>
            )}
            {activePanel === "hints" && (
              <div className="assistance-panel">
                <span className="assistance-icon">
                  <Lightbulb size={28} />
                </span>
                <h2>Uma pista para avançar</h2>
                <p>
                  Você tem{" "}
                  <strong>
                    {dashboard.hintBalance}{" "}
                    {dashboard.hintBalance === 1
                      ? "dica disponível"
                      : "dicas disponíveis"}
                  </strong>
                  . Ganhe mais uma a cada dez desafios distintos concluídos.
                </p>
                <div className="hint-rewards">
                  <span>
                    Sem dicas<strong>100% XP</strong>
                  </span>
                  <span>
                    Uma dica<strong>95% XP</strong>
                  </span>
                  <span>
                    Duas ou mais<strong>85% XP</strong>
                  </span>
                </div>
                {hints.map((text, index) => (
                  <div className="hint-card" key={`${index}:${text}`}>
                    <strong>Dica {index + 1}</strong>
                    <p>{text}</p>
                  </div>
                ))}
                <button
                  type="button"
                  className="button button-primary"
                  disabled={Boolean(busy) || dashboard.hintBalance < 1}
                  onClick={() => void hint()}
                >
                  <Lightbulb size={16} />
                  {busy === "hint" ? "Buscando dica…" : "Usar uma dica"}
                </button>
                <p className="muted">
                  As dicas acompanham este desafio entre sessões e linguagens.
                </p>
                {attempt && (
                  <Link
                    className="text-link"
                    to={`/tutor?attempt=${encodeURIComponent(attempt.id)}&challenge=${encodeURIComponent(challenge.id)}&language=${encodeURIComponent(language)}`}
                  >
                    <Sparkles size={14} />
                    Pedir ajuda ao tutor · conta como dica
                  </Link>
                )}
              </div>
            )}
            {activePanel === "solution" && (
              <div className="assistance-panel">
                <span className="assistance-icon">
                  <BookOpen size={28} />
                </span>
                <h2>
                  {solution
                    ? "Aprenda com o gabarito"
                    : "Entenda o caminho da solução"}
                </h2>
                {solution ? (
                  <>
                    <p className="solution-explanation">
                      {solution.explanation}
                    </p>
                    {solution.practiceOnly && (
                      <p className="arena-alert">
                        Este desafio está em prática sem XP.
                      </p>
                    )}
                    {solution.files.map((file) => (
                      <div className="solution-file" key={file.path}>
                        <strong>
                          <FileCode2 size={14} />
                          {file.path}
                        </strong>
                        <pre>{file.content}</pre>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <p>
                      O gabarito é gratuito depois da aprovação ou de três
                      submissões incorretas.
                    </p>
                    {solutionUnlocked && !completed && (
                      <p className="arena-alert">
                        Ao abrir antes de resolver, este desafio passa a ser
                        prática sem XP, em todas as linguagens e sessões.
                      </p>
                    )}
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={Boolean(busy) || !solutionUnlocked}
                      onClick={() => void openSolution()}
                    >
                      <LockKeyhole size={16} />
                      {busy === "solution"
                        ? "Abrindo…"
                        : !solutionUnlocked
                          ? "Gabarito bloqueado"
                          : completed
                            ? "Abrir gabarito"
                            : "Abrir em modo prática"}
                    </button>
                    {!solutionUnlocked && (
                      <small>
                        {attempt?.rejectedCount ?? 0} de 3 submissões incorretas
                      </small>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>
        <div className="arena-work-column">
          <SourceWorkspace
            key={`${challenge.id}:${language}:${dashboard.profile.id}`}
            challenge={challenge}
            language={language}
            userId={dashboard.profile.id}
            onLanguage={(next) => {
              if (next !== language && localController.current) {
                executionGeneration.current += 1;
                localController.current.abort();
                localController.current = null;
                executing.current = false;
                setBusy(null);
                setLocalPhase(null);
                setLocalResult(null);
                setLocalFallback("");
              }
              setLanguage(next);
              setSolution(null);
            }}
            hard={attempt?.mode === "hard"}
            busy={Boolean(busy) || inFlight}
            executionAction={
              busy === "run" || busy === "submit"
                ? busy
                : inFlight
                  ? submissionKind
                  : null
            }
            executionPhase={
              busy === "run" || busy === "submit"
                ? "sending"
                : submission?.status === "running"
                  ? "running"
                  : submission?.status === "queued"
                    ? "queued"
                    : null
            }
            executionStatus={executionStatus}
            executionMessage={executionMessage}
            studyAvailable={studyAvailable}
            studyMessage={studyMessage}
            localPhase={localPhase}
            onExecute={execute}
            approved={approved}
            potentialXp={potentialXp}
          />
          <section
            className="panel results-panel"
            aria-label="Resultados da avaliação"
          >
            <div className="results-heading">
              <h2>
                <Terminal size={16} />
                Resultados
              </h2>
              <span>Execuções livres · sem limite de tentativas</span>
            </div>
            {official.isError && (
              <div className="arena-alert" role="alert">
                <AlertCircle size={16} />
                Não foi possível atualizar a avaliação.
                <button
                  type="button"
                  className="text-link"
                  onClick={() => void official.refetch()}
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {localFallback && (
              <div className="arena-alert" role="status">
                <AlertCircle size={16} />
                <span>{localFallback}</span>
              </div>
            )}
            {(localResult || localPhase) && (
              <LocalPracticeResult result={localResult} phase={localPhase} />
            )}
            {!localResult && !localPhase && submission ? (
              <>
                <ResultReaction
                  submission={submission}
                  identity={dashboard.profile.id}
                  kind={submissionKind}
                  animate={
                    freshSubmissionIds.current.has(submission.id) &&
                    !approval &&
                    submission.verdict !== "accepted"
                  }
                />
                <SubmissionResult
                  submission={submission}
                  hard={attempt?.mode === "hard"}
                  kind={submissionKind}
                />
              </>
            ) : !localResult && !localPhase ? (
              <div className="results-empty">
                <span>
                  <Terminal size={24} />
                </span>
                <strong>Seu próximo aprendizado começa no código.</strong>
                <p>
                  Execute seu código quantas vezes quiser para aprender. Submeta
                  quando estiver pronta para a avaliação oficial.
                </p>
              </div>
            ) : null}
            <div className="results-note">
              <ShieldCheck size={13} />
              <span>{studyMessage}</span>
            </div>
          </section>
        </div>
      </div>
      <ChallengeDialog
        open={Boolean(approval)}
        onClose={() => setApproval(null)}
        title="Desafio aprovado!"
      >
        {approval && (
          <ResultReaction
            submission={approval}
            identity={dashboard.profile.id}
            kind="submit"
            animate={freshSubmissionIds.current.has(approval.id)}
          />
        )}
        <p>
          Parabéns, seu resultado está correto. Você recebeu{" "}
          {approval?.xpAwarded ?? 0} XP. Pode continuar executando seu código
          para experimentar outras formas de resolver.
        </p>
        <div className="challenge-dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => setApproval(null)}
          >
            Ver meu resultado
          </button>
          {nextChallenge && (
            <Link
              className="button button-primary"
              to={`/desafios/${nextChallenge.slug}?language=${language}`}
            >
              Próximo desafio <ChevronRight size={16} />
            </Link>
          )}
          {!nextChallenge && (
            <Link className="button button-primary" to="/desafios">
              Ver desafios concluídos <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </ChallengeDialog>
    </div>
  );
}

interface EditorDraft extends DraftInput {
  localDirty?: boolean;
  executionMode?: "function" | "program";
}
function SourceWorkspace({
  challenge,
  language,
  userId,
  onLanguage,
  onExecute,
  busy,
  executionAction,
  executionPhase,
  executionStatus,
  executionMessage,
  studyAvailable: languageStudyAvailable,
  studyMessage,
  localPhase,
  hard,
  approved,
  potentialXp,
}: {
  challenge: PublicChallenge;
  language: LanguageId;
  userId: string;
  onLanguage: (value: LanguageId) => void;
  onExecute: (
    files: SourceFile[],
    kind: "run" | "submit",
    executionMode: "function" | "program",
    stdin: string,
  ) => Promise<void>;
  approved: boolean;
  potentialXp: number;
  busy: boolean;
  executionAction: "run" | "submit" | null;
  executionPhase: "sending" | "queued" | "running" | null;
  executionStatus: "ready" | "busy" | "offline";
  executionMessage: string;
  studyAvailable: boolean;
  studyMessage: string;
  localPhase: "loading" | "running" | null;
  hard?: boolean;
}) {
  const gateway = useGateway();
  const storageKey = `codegamer:editor:v1:${userId}:${challenge.id}:${language}`;
  const initialDraft = useRef<EditorDraft | null>(null);
  const [files, setFiles] = useState<SourceFile[]>(() => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      ) as EditorDraft | null;
      if (
        parsed?.challengeId === challenge.id &&
        parsed.languageId === language &&
        Array.isArray(parsed.files) &&
        parsed.files.every(
          (file) =>
            typeof file.path === "string" && typeof file.content === "string",
        ) &&
        parsed.files.length
      ) {
        initialDraft.current = {
          ...parsed,
          localDirty: parsed.localDirty ?? true,
        };
        return parsed.files;
      }
    } catch {
      /* A malformed draft never replaces the starter. */
    }
    return (challenge.starterFilesByLanguage[language] ?? []).map((file) => ({
      ...file,
    }));
  });
  const executionMode = "function" as const;
  const studyAvailable = languageStudyAvailable && executionMode === "function";
  const stdin = "";
  const [confirmSubmission, setConfirmSubmission] = useState(false);
  const [rememberConfirmation, setRememberConfirmation] = useState(false);
  const { skipConfirmation, setSkipConfirmation } = useSubmissionConfirmation(
    userId,
    "code",
  );
  const closeConfirmation = () => {
    setConfirmSubmission(false);
    setRememberConfirmation(false);
  };
  const [confirmStarter, setConfirmStarter] = useState(false);
  const [activeFile, setActiveFile] = useState(files[0]?.path ?? "solution");
  const [saveState, setSaveState] = useState("Salvo neste dispositivo");
  const [otherTab, setOtherTab] = useState(false);
  const [syncPaused, setSyncPaused] = useState(false);
  const [resolving, setResolving] = useState(false);
  const paused = useRef(false);
  const revision = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const confirmSave = useCallback(
    (sent: EditorDraft, confirmed: DraftInput, editRevision: number) => {
      const latest = initialDraft.current;
      if (latest && editRevision === revision.current)
        initialDraft.current = { ...confirmed, localDirty: false };
      else if (latest)
        initialDraft.current = {
          ...latest,
          revision: confirmed.revision,
          localDirty: true,
        };
      try {
        const stored = JSON.parse(
          localStorage.getItem(storageKey) ?? "null",
        ) as EditorDraft | null;
        if (
          stored?.updatedAt === sent.updatedAt &&
          JSON.stringify(stored.files) === JSON.stringify(sent.files)
        ) {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ ...confirmed, localDirty: false }),
          );
        }
      } catch {
        if (isMounted.current)
          setSaveState("Sincronizado · armazenamento local indisponível");
        return;
      }
      if (isMounted.current && editRevision === revision.current)
        setSaveState(
          gateway.mode === "live"
            ? "Rascunho sincronizado"
            : "Salvo neste dispositivo",
        );
    },
    [gateway.mode, storageKey],
  );
  const synchronize = useCallback(
    async (draft: EditorDraft, editRevision: number) => {
      try {
        confirmSave(draft, await gateway.saveDraft(draft), editRevision);
      } catch (cause) {
        if (!isMounted.current) return;
        if (cause instanceof GatewayError && cause.code === "draft_conflict") {
          paused.current = true;
          setSyncPaused(true);
          if (saveTimer.current) clearTimeout(saveTimer.current);
        }
        if (editRevision === revision.current)
          setSaveState(`Código preservado aqui. ${errorText(cause)}`);
      }
    },
    [confirmSave, gateway],
  );
  useEffect(() => {
    isMounted.current = true;
    const startingRevision = revision.current;
    void gateway
      .getDraft(challenge.id, language)
      .then((remote) => {
        if (!isMounted.current || revision.current !== startingRevision) return;
        const local = initialDraft.current;
        if (local?.localDirty) {
          const differs =
            remote &&
            JSON.stringify(remote.files) !== JSON.stringify(local.files);
          if (differs && gateway.mode === "live") {
            paused.current = true;
            setSyncPaused(true);
            setSaveState(
              "Código local preservado · escolha qual versão manter",
            );
            return;
          }
          void synchronize(local, startingRevision);
          return;
        }
        if (!remote) return;
        const loaded = { ...remote, localDirty: false };
        setFiles(remote.files);
        setActiveFile(remote.files[0]?.path ?? "solution");
        initialDraft.current = loaded;
        try {
          localStorage.setItem(storageKey, JSON.stringify(loaded));
          setSaveState("Rascunho sincronizado");
        } catch {
          setSaveState("Sincronizado · armazenamento local indisponível");
        }
      })
      .catch(() => {
        if (isMounted.current)
          setSaveState("Salvo neste dispositivo · sincronização indisponível");
      });
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setOtherTab(true);
        paused.current = true;
        setSyncPaused(true);
        if (saveTimer.current) clearTimeout(saveTimer.current);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      isMounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      window.removeEventListener("storage", onStorage);
    };
  }, [challenge.id, gateway, language, storageKey, synchronize]);
  function updateCode(content: string) {
    saveFiles(
      files.map((file) =>
        file.path === activeFile ? { ...file, content } : file,
      ),
    );
  }
  function saveFiles(next: SourceFile[]) {
    const nextBytes = new TextEncoder().encode(
      next.map((item) => item.content).join(""),
    ).byteLength;
    const sourceLimit = challenge.limits?.maxSourceBytes ?? 256 * 1024;
    if (nextBytes > sourceLimit) {
      setSaveState(
        `Código não salvo: limite de ${(sourceLimit / 1024).toFixed(0)} KiB atingido`,
      );
      return;
    }
    setFiles(next);
    revision.current++;
    const draft: EditorDraft = {
      ...initialDraft.current,
      challengeId: challenge.id,
      languageId: language,
      files: next,
      updatedAt: new Date().toISOString(),
      localDirty: true,
    };
    initialDraft.current = draft;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSaveState("Salvo neste dispositivo");
    } catch {
      setSaveState("Não foi possível salvar neste dispositivo");
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (paused.current) {
      setSaveState(
        "Salvo aqui · sincronização pausada para preservar as duas versões",
      );
      return;
    }
    const currentRevision = revision.current;
    saveTimer.current = setTimeout(() => {
      void synchronize(draft, currentRevision);
    }, 850);
  }
  async function keepThisVersion() {
    setResolving(true);
    try {
      const draft: EditorDraft = {
        ...initialDraft.current,
        challengeId: challenge.id,
        languageId: language,
        files,
        updatedAt: new Date().toISOString(),
        localDirty: true,
      };
      const currentRevision = revision.current;
      if (!gateway.resolveDraftConflict)
        throw new Error(
          "Reabra o desafio para recuperar a sincronização. O código desta aba continua preservado.",
        );
      const confirmed = await gateway.resolveDraftConflict(draft);
      if (!isMounted.current) return;
      confirmSave(draft, confirmed, currentRevision);
      paused.current = false;
      setSyncPaused(false);
      setOtherTab(false);
      if (currentRevision === revision.current) {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ ...confirmed, localDirty: false }),
          );
        } catch {
          /* The confirmed remote copy remains available. */
        }
      } else if (initialDraft.current)
        void synchronize(initialDraft.current, revision.current);
      setSaveState(
        gateway.mode === "live"
          ? "Esta versão foi sincronizada"
          : "Esta versão foi salva no dispositivo",
      );
    } catch (cause) {
      setSaveState(`Código preservado aqui. ${errorText(cause)}`);
    } finally {
      if (isMounted.current) setResolving(false);
    }
  }
  const file = files.find((item) => item.path === activeFile) ?? files[0];
  const bytes = new TextEncoder().encode(
    files.map((item) => item.content).join(""),
  ).byteLength;
  return (
    <section className="panel code-panel" aria-label="Editor da solução">
      <div className="code-toolbar">
        <h2>
          <Code2 size={16} />
          Sua solução
        </h2>
        <label className="language-select">
          <span className="sr-only">Linguagem</span>
          <select
            aria-label="Linguagem"
            value={language}
            onChange={(event) => onLanguage(event.target.value as LanguageId)}
            disabled={busy && !localPhase}
          >
            {challenge.languageIds.map((id) => (
              <option key={id} value={id}>
                {LANGUAGES.find((item) => item.id === id)?.label ?? id}
              </option>
            ))}
          </select>
        </label>
      </div>
      {language !== "sql" && (
        <div className="program-controls">
          <p>
            {firstStepTask(challenge.id) ? (
              <>
                <strong>O que fazer: </strong>
                {firstStepTask(challenge.id)}
              </>
            ) : (
              <>
                Complete <code>{modelFunctionName(challenge, language)}</code> e
                devolva a resposta com <code>return</code>. A aplicação chama a
                função por você.
              </>
            )}
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => setConfirmStarter(true)}
            disabled={busy}
          >
            Recarregar modelo da função
          </button>
        </div>
      )}
      <div
        className="code-file-tabs"
        role="tablist"
        aria-label="Arquivos da solução"
      >
        {files.map((item) => (
          <button
            key={item.path}
            type="button"
            role="tab"
            aria-selected={item.path === file?.path}
            className={item.path === file?.path ? "active" : ""}
            onClick={() => setActiveFile(item.path)}
          >
            <FileCode2 size={14} />
            {item.path}
          </button>
        ))}
      </div>
      {syncPaused && (
        <div className="arena-alert" role="status">
          <AlertCircle size={15} />
          <span>
            {otherTab
              ? "Este rascunho mudou em outra aba."
              : "Existe uma versão mais recente na sua conta."}{" "}
            O código desta aba foi preservado. Manter esta versão substitui o
            rascunho sincronizado.
          </span>
          <button
            type="button"
            className="text-link"
            disabled={resolving}
            onClick={() => void keepThisVersion()}
          >
            {resolving ? "Sincronizando…" : "Manter esta versão"}
          </button>
        </div>
      )}
      <Suspense
        fallback={
          <div className="editor-loading" role="status">
            Preparando seu editor…
          </div>
        }
      >
        {file && (
          <CodeEditor
            path={`${userId}/${challenge.id}/${language}/${file.path}`}
            language={language}
            value={file.content}
            onChange={updateCode}
            onUnsafeInput={() =>
              setSaveState(
                "Caracteres invisíveis ou de controle não são permitidos no código",
              )
            }
            hard={hard}
          />
        )}
      </Suspense>
      <div className="code-status">
        <span>
          <Check size={12} />
          {saveState}
        </span>
        <span>{(bytes / 1024).toFixed(1)} / 256 KiB</span>
      </div>
      <div className="code-actions">
        <span>
          <Clock3 size={13} />
          {studyAvailable ? "Prática no navegador" : "Execução isolada"}
        </span>
        <button
          type="button"
          className="button button-secondary"
          disabled={
            busy || !file || (!studyAvailable && executionStatus !== "ready")
          }
          title={
            studyAvailable
              ? studyMessage
              : executionStatus === "ready"
                ? undefined
                : executionMessage
          }
          onClick={() => void onExecute(files, "run", executionMode, stdin)}
        >
          <Play size={15} />
          {executionAction === "run"
            ? localPhase === "loading"
              ? "Preparando…"
              : localPhase === "running"
                ? "Executando…"
                : executionPhase === "sending"
                  ? "Enviando…"
                  : "Executando…"
            : studyAvailable
              ? "Executar código"
              : executionStatus === "busy"
                ? "Executor ocupado"
                : executionStatus === "offline"
                  ? "Execução indisponível"
                  : "Executar código"}
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={busy || !file || executionStatus !== "ready" || approved}
          title={
            approved
              ? "Este desafio já foi aprovado"
              : executionStatus === "ready"
                ? undefined
                : executionMessage
          }
          onClick={() => {
            if (skipConfirmation)
              void onExecute(files, "submit", executionMode, stdin);
            else {
              setRememberConfirmation(false);
              setConfirmSubmission(true);
            }
          }}
        >
          <Send size={15} />
          {executionAction === "submit"
            ? executionPhase === "sending"
              ? "Enviando…"
              : "Validando solução…"
            : approved
              ? "Desafio aprovado"
              : "Submeter solução"}
        </button>
      </div>
      {!approved && executionStatus !== "ready" && (
        <p className="submission-guidance" role="status">
          <strong>Submissão indisponível. </strong>
          {executionMessage}
        </p>
      )}
      <ChallengeDialog
        open={confirmStarter}
        onClose={() => setConfirmStarter(false)}
        title="Carregar um novo modelo?"
      >
        <p>
          O código atual será substituído pelo modelo escolhido. Copie seu
          código se quiser guardar as duas versões.
        </p>
        <div className="challenge-dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => setConfirmStarter(false)}
          >
            Manter meu código
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              const starter = (
                challenge.starterFilesByLanguage[language] ?? []
              ).map((file) => ({ ...file }));
              saveFiles(starter);
              setActiveFile(starter[0]?.path ?? "solution");
              setConfirmStarter(false);
            }}
          >
            Substituir pelo modelo
          </button>
        </div>
      </ChallengeDialog>
      <ChallengeDialog
        open={confirmSubmission}
        onClose={closeConfirmation}
        title="Submeter esta solução?"
      >
        <p>
          Se acertar, você conclui o desafio e recebe até {potentialXp} XP. Se
          errar, pode tentar novamente. Cada erro reduz a recompensa em 15% do
          XP inicial do desafio, até chegar a zero.
        </p>
        <label className="confirmation-preference">
          <input
            type="checkbox"
            checked={rememberConfirmation}
            onChange={(event) => setRememberConfirmation(event.target.checked)}
          />
          Não pedir confirmação novamente neste navegador
        </label>
        <div className="challenge-dialog-actions">
          <button
            className="button button-secondary"
            onClick={closeConfirmation}
          >
            Continuar editando
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              if (rememberConfirmation) setSkipConfirmation(true);
              closeConfirmation();
              void onExecute(files, "submit", executionMode, stdin);
            }}
          >
            Confirmar submissão
          </button>
        </div>
      </ChallengeDialog>
      <p className="submission-guidance">
        Execute quantas vezes quiser, sem perder XP. Ao submeter, cada erro
        reduz a recompensa em 15% do XP inicial do desafio, até chegar a zero.
        Você pode tentar novamente.
      </p>
    </section>
  );
}

function SubmissionResult({
  submission,
  hard,
  kind,
}: {
  submission: PublicSubmission;
  hard?: boolean;
  kind: "run" | "submit";
}) {
  if (submission.status !== "completed")
    return (
      <div className="results-empty" role="status">
        <span className="evaluation-spinner" />
        <strong>
          {submission.status === "queued"
            ? "Sua solução está na fila"
            : "Avaliando sua solução…"}
        </strong>
        <p>
          Você pode continuar editando. Esta avaliação usa o código enviado.
        </p>
      </div>
    );
  const accepted = submission.verdict === "accepted";
  const infrastructure = submission.verdict === "infrastructure_error";
  return (
    <div
      className={`submission-result ${accepted ? "is-accepted" : ""}`}
      role="status"
    >
      <h3>
        {accepted ? (
          <CheckCircle2 size={21} />
        ) : infrastructure ? (
          <AlertCircle size={21} />
        ) : (
          <XCircle size={21} />
        )}
        {kind === "run" && accepted
          ? "Execução concluída"
          : hard && !accepted && !infrastructure
            ? "Solução rejeitada"
            : submission.verdict
              ? verdictLabels[submission.verdict]
              : "Avaliação concluída"}
      </h3>
      {kind === "run" && (
        <p>Edite e execute quantas vezes quiser. Executar não altera seu XP.</p>
      )}
      {submission.message && <p>{submission.message}</p>}
      {kind === "submit" && !accepted && !infrastructure && (
        <p>
          Confira a saída, ajuste o código e tente novamente. Este erro reduziu
          sua recompensa em 15% do XP inicial do desafio.
        </p>
      )}
      {submission.stdout !== undefined && (
        <div className="program-output">
          <strong>Saída do seu código</strong>
          <pre>{submission.stdout || "(nenhuma saída)"}</pre>
        </div>
      )}
      {submission.stderr && (
        <div className="program-output">
          <strong>Erros e avisos</strong>
          <pre>{submission.stderr}</pre>
        </div>
      )}
      {infrastructure && (
        <p>
          O serviço não conseguiu avaliar seu código. Seu XP não mudou. Tente
          novamente em alguns instantes.
        </p>
      )}
      {Boolean(submission.xpAwarded) && (
        <span className="earned-xp">
          <Trophy size={14} />
          {submission.xpAwarded! > 0 ? "+" : ""}
          {submission.xpAwarded} XP
        </span>
      )}
      {submission.publicCases?.map((item, index) => (
        <div
          className={`case-result ${item.passed ? "passed" : "failed"}`}
          key={`${index}:${item.label}`}
        >
          <span>
            {item.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {item.label}
          </span>
          <strong>{item.passed ? "Passou" : "Não passou"}</strong>
          {!item.passed &&
            item.actual !== null &&
            item.actual !== undefined && <pre>Recebido: {item.actual}</pre>}
        </div>
      ))}
      {submission.metrics && (
        <div className="evaluation-metrics">
          {submission.metrics.cpuMs !== null &&
            submission.metrics.cpuMs !== undefined && (
              <span>CPU: {submission.metrics.cpuMs.toFixed(1)} ms</span>
            )}
          {submission.metrics.peakMemoryKiB !== null &&
            submission.metrics.peakMemoryKiB !== undefined && (
              <span>
                Memória: {(submission.metrics.peakMemoryKiB / 1024).toFixed(1)}{" "}
                MiB
              </span>
            )}
        </div>
      )}
    </div>
  );
}

function HardClock({ attempt }: { attempt: Attempt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.floor(
      ((attempt.deadlineAt ? Date.parse(attempt.deadlineAt) : now) - now) /
        1000,
    ),
  );
  return (
    <div className="hard-clock" role="timer">
      <Clock3 size={17} />
      <strong>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </strong>
      <span>
        {attempt.rejectedCount} de 3 envios rejeitados · prazo confirmado pelo
        servidor
      </span>
    </div>
  );
}

function ChallengeDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="challenge-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
