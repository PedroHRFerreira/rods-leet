import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
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
import { topics } from "../content/catalog";
import { LearningResourceList } from "../components/LearningResourceList";
import { LANGUAGES, rewardPercent } from "../domain/rules";
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
import { guestDashboard } from "../lib/gateway";
import "../editor.css";

const CodeEditor = lazy(() => import("../components/CodeEditor"));
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
    return <LoadingState label="Preparando a arena…" />;
  if (challenge.isError)
    return (
      <ErrorState
        error={challenge.error}
        retry={() => void challenge.refetch()}
      />
    );
  if (dashboard.isError) {
    if (
      dashboard.error instanceof GatewayError &&
      ["invite_required", "beta_full"].includes(dashboard.error.code)
    )
      return (
        <ChallengeWorkspace
          key={`${challenge.data.id}:guest`}
          challenge={challenge.data}
          dashboard={guestDashboard()}
        />
      );
    return (
      <ErrorState
        error={dashboard.error}
        retry={() => void dashboard.refetch()}
      />
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
  const language =
    requestedLanguage && challenge.languageIds.includes(requestedLanguage)
      ? requestedLanguage
      : challenge.languageIds.includes("typescript")
        ? "typescript"
        : challenge.languageIds[0];
  const setLanguage = (value: LanguageId) => {
    const next = new URLSearchParams(params);
    next.set("language", value);
    setParams(next, { replace: true });
  };
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const lastSubmissionKey = `codegamer:last-submission:v1:${dashboard.profile.id}:${challenge.id}`;
  const [submissionId, setSubmissionId] = useState<string | null>(() => {
    if (!dashboard.profile.invited) return null;
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [solution, setSolution] = useState<SolutionResult | null>(null);
  const [activePanel, setActivePanel] = useState<
    "description" | "learning" | "hints" | "solution"
  >("description");
  const gateway = useGateway();
  const queryClient = useQueryClient();
  const actionKeys = useRef(new Map<string, string>());
  const openingKey = useRef(crypto.randomUUID());
  const topic = topics.find((item) => item.id === challenge.topicId);
  const completed = dashboard.completedChallengeIds.includes(challenge.id);
  const currentPercent = rewardPercent(attempt?.hintsUsed ?? 0);
  useEffect(() => {
    if (!dashboard.profile.invited) return;
    let active = true;
    void gateway
      .startAttempt(
        { challengeVersionId: challenge.versionId, mode: "normal" },
        openingKey.current,
      )
      .then((next) => {
        if (active) setAttempt(next);
      })
      .catch((cause) => {
        if (active) setError(errorText(cause));
      });
    return () => {
      active = false;
    };
  }, [challenge.versionId, dashboard.profile.invited, gateway]);
  const official = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => gateway.getSubmission(submissionId!),
    enabled: Boolean(submissionId),
    refetchInterval: (query) =>
      query.state.data?.status === "completed" ? false : 1500,
    retry: 2,
  });
  useEffect(() => {
    if (!dashboard.profile.invited) return;
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
    dashboard.profile.invited,
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
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void gateway
        .getAttempt(official.data.attemptId)
        .then(setAttempt)
        .catch(() => {});
    }
  }, [official.data, gateway, queryClient]);
  const inFlight =
    submission?.status === "queued" ||
    submission?.status === "running" ||
    (Boolean(submissionId) && !submission && official.isPending);
  function keyFor(operation: string) {
    const key = actionKeys.current.get(operation) ?? crypto.randomUUID();
    actionKeys.current.set(operation, key);
    return key;
  }
  async function ensureAttempt() {
    if (attempt?.status === "active") return attempt;
    const next = await gateway.startAttempt(
      { challengeVersionId: challenge.versionId, mode: "normal" },
      keyFor("attempt"),
    );
    actionKeys.current.delete("attempt");
    setAttempt(next);
    return next;
  }
  async function execute(files: SourceFile[], kind: "run" | "submit") {
    setBusy(kind);
    setError("");
    try {
      const current = await ensureAttempt();
      const input = {
        challengeVersionId: challenge.versionId,
        attemptId: current.id,
        languageId: language,
        files: files.map((file) => ({ ...file })),
      };
      const operation = `${kind}:${JSON.stringify(input)}`;
      const next = await gateway[kind](input, keyFor(operation));
      actionKeys.current.delete(operation);
      setSubmission(next);
      setSubmissionId(next.id);
      setSubmissionKind(kind);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
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
      </div>
      <div className="arena-heading">
        <div>
          <div className="arena-title-meta">
            <DifficultyBadge difficulty={challenge.difficulty} />
            <span className="arena-topic">
              <TopicIcon topicId={challenge.topicId} size={14} />
              {topic?.title}
            </span>
            {completed && (
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
          <strong>
            {Math.floor(
              ((attempt?.practiceOnly ? 0 : challenge.baseXp) *
                (attempt?.mode === "hard" ? 3 : 1) *
                currentPercent) /
                100,
            )}{" "}
            XP
          </strong>
          <small>
            {completed
              ? "Primeira recompensa já recebida"
              : attempt?.practiceOnly
                ? "Prática sem XP"
                : "na primeira aprovação"}
          </small>
        </div>
      </div>
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
                <p className="problem-description">{challenge.description}</p>
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
                        <span>Entrada</span>
                        <pre>{showJson(example.input)}</pre>
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
                  <div className="published-limits">
                    <h3>Limites de execução</h3>
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
                )}
                {challenge.complexityGoal && (
                  <div className="complexity-goal">
                    <span>
                      <Sparkles size={15} />
                      Objetivo de aprendizado
                    </span>
                    <div>
                      <code>{challenge.complexityGoal.time}</code>
                      <small>tempo</small>
                    </div>
                    <div>
                      <code>{challenge.complexityGoal.space}</code>
                      <small>memória auxiliar</small>
                    </div>
                    <p>
                      A análise de crescimento é consultiva. A aprovação
                      considera os testes e limites executados.
                    </p>
                  </div>
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
                    (resource) => resource.category === "concept",
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
                    to={`/tutor?attempt=${encodeURIComponent(attempt.id)}&challenge=${encodeURIComponent(challenge.versionId)}`}
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
              setLanguage(next);
              setSolution(null);
            }}
            hard={attempt?.mode === "hard"}
            busy={Boolean(busy) || inFlight}
            onExecute={execute}
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
              <span>
                {dashboard.remoteRunsRemaining} execuções disponíveis hoje
              </span>
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
            {submission ? (
              <SubmissionResult
                submission={submission}
                hard={attempt?.mode === "hard"}
                kind={submissionKind}
              />
            ) : (
              <div className="results-empty">
                <span>
                  <Terminal size={24} />
                </span>
                <strong>Seu próximo aprendizado começa no código.</strong>
                <p>
                  Execute os exemplos públicos para conferir sua solução.
                  Submeta quando estiver pronta para a avaliação oficial.
                </p>
              </div>
            )}
            <div className="results-note">
              <ShieldCheck size={13} />
              <span>
                {dashboard.executionStatus === "available"
                  ? "Executar exemplos e submeter usam a cota diária. Executar exemplos não concede XP nem consome tentativas oficiais."
                  : "A avaliação remota ainda não está disponível. Seu rascunho continua salvo neste dispositivo."}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface EditorDraft extends DraftInput {
  localDirty?: boolean;
}
function SourceWorkspace({
  challenge,
  language,
  userId,
  onLanguage,
  onExecute,
  busy,
  hard,
}: {
  challenge: PublicChallenge;
  language: LanguageId;
  userId: string;
  onLanguage: (value: LanguageId) => void;
  onExecute: (files: SourceFile[], kind: "run" | "submit") => Promise<void>;
  busy: boolean;
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
    const next = files.map((file) =>
      file.path === activeFile ? { ...file, content } : file,
    );
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
            disabled={busy}
          >
            {challenge.languageIds.map((id) => (
              <option key={id} value={id}>
                {LANGUAGES.find((item) => item.id === id)?.label ?? id}
              </option>
            ))}
          </select>
        </label>
      </div>
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
          Execução isolada
        </span>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy || !file}
          onClick={() => void onExecute(files, "run")}
        >
          <Play size={15} />
          {busy ? "Aguarde…" : "Executar exemplos"}
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={busy || !file}
          onClick={() => void onExecute(files, "submit")}
        >
          <Send size={15} />
          Submeter
        </button>
      </div>
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
          ? "Exemplos públicos passaram"
          : hard && !accepted && !infrastructure
            ? "Solução rejeitada"
            : submission.verdict
              ? verdictLabels[submission.verdict]
              : "Avaliação concluída"}
      </h3>
      {kind === "run" && (
        <p>
          Este resultado testa somente os exemplos públicos. Console e print
          ainda não são um programa livre: use Submeter para a avaliação
          oficial. Executar exemplos não concede XP nem consome tentativas.
        </p>
      )}
      {submission.message && <p>{submission.message}</p>}
      {infrastructure && (
        <p>
          Sem penalidade ou consumo de tentativa. Você poderá tentar novamente.
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
      {submission.complexity && (
        <p className="complexity-result">
          {submission.complexity.label}
          {submission.complexity.measuredRange &&
            ` · entradas entre ${submission.complexity.measuredRange[0]} e ${submission.complexity.measuredRange[1]}`}
        </p>
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
