import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Flame,
  Lightbulb,
  Terminal,
  Trophy,
  Zap,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import { topics } from "../content/catalog";
import {
  DifficultyBadge,
  ErrorState,
  LoadingState,
  ProgressBar,
  TopicIcon,
  formatNumber,
} from "../components/ui";
import "../dashboard.css";

function formatExample(value: unknown) {
  const compact = JSON.stringify(value);
  if (compact.length <= 80)
    return Array.isArray(value)
      ? `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
      : compact;
  return JSON.stringify(value, null, 2);
}

export default function DashboardPage() {
  const gateway = useGateway();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
  });
  const catalog = useQuery({
    queryKey: ["challenges"],
    queryFn: () => gateway.listChallenges(),
  });
  if (dashboard.isPending || catalog.isPending) return <LoadingState />;
  if (dashboard.isError || catalog.isError)
    return (
      <ErrorState
        error={dashboard.error ?? catalog.error}
        retry={() => {
          void dashboard.refetch();
          void catalog.refetch();
        }}
      />
    );
  const data = dashboard.data;
  const completed = new Set(data.completedChallengeIds);
  const next =
    catalog.data.find(
      (item) => item.id === data.recommendations[0]?.challengeId,
    ) ??
    catalog.data.find((item) => !completed.has(item.id)) ??
    catalog.data[0];
  const reason =
    data.recommendations[0]?.reason ??
    "Um bom ponto de partida para praticar os fundamentos.";
  const name =
    gateway.mode === "demo" ? null : data.profile.displayName.split(" ")[0];
  const acceptedDates = new Set(data.activityDays ?? []);
  const today = new Date();
  const dayKey = (date: Date) => date.toISOString().slice(0, 10);
  const dailyDone = acceptedDates.has(dayKey(today));
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + index);
    return date;
  });
  const stats = [
    {
      label: "Desafios concluídos",
      value: formatNumber(data.completedCount),
      meta: `${catalog.data.length} disponíveis no catálogo`,
      icon: Code2,
    },
    {
      label: "XP acumulado",
      value: formatNumber(data.xp),
      meta: `Nível ${data.level}`,
      icon: Zap,
    },
    {
      label: "Dias de sequência",
      value: formatNumber(data.streakDays),
      meta: "A prática constrói consistência",
      icon: Flame,
    },
    {
      label: "Dicas disponíveis",
      value: formatNumber(data.hintBalance),
      meta: "+1 a cada 10 desafios distintos",
      icon: Lightbulb,
    },
  ];
  return (
    <div className="rl-dashboard">
      <header className="rl-overview-heading">
        <div>
          <span className="rl-eyebrow">SEU ESPAÇO DE PRÁTICA</span>
          <h1>{name ? `Bom te ver, ${name}.` : "Vamos resolver o próximo."}</h1>
          <p>
            Escolha um problema. Escreva sua solução. Aprenda com o resultado.
          </p>
        </div>
        <Link to="/desafios" className="button button-secondary">
          Explorar catálogo <ArrowRight size={16} />
        </Link>
      </header>
      <section className="rl-metrics" aria-label="Seu progresso">
        {stats.map((stat) => (
          <article key={stat.label}>
            <div className="rl-metric-label">
              <stat.icon size={16} />
              <span>{stat.label}</span>
            </div>
            <strong>{stat.value}</strong>
            <small>{stat.meta}</small>
          </article>
        ))}
      </section>
      <div className="rl-dashboard-columns">
        <div className="rl-main-column">
          <section aria-labelledby="rl-practice-title">
            <div className="rl-section-heading">
              <h2 id="rl-practice-title">
                {data.completedCount > 0
                  ? "Continue praticando"
                  : "Comece por aqui"}
              </h2>
              <span>RECOMENDADO</span>
            </div>
            {next ? (
              <article className="rl-practice-card">
                <div className="rl-practice-copy">
                  <div className="rl-challenge-category">
                    <TopicIcon topicId={next.topicId} size={16} />
                    {topics.find((topic) => topic.id === next.topicId)?.title}
                    <DifficultyBadge difficulty={next.difficulty} />
                  </div>
                  <h3>{next.title}</h3>
                  <p>{reason}</p>
                  <div className="rl-challenge-details">
                    <span>
                      <Clock3 size={14} />
                      {next.estimatedMinutes ?? 15} min sugeridos
                    </span>
                    <span>
                      <Zap size={14} />
                      {next.baseXp} XP base
                    </span>
                  </div>
                  <Link
                    to={`/desafios/${next.slug}`}
                    className="button button-primary"
                  >
                    Abrir desafio <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="rl-example">
                  <div className="rl-example-bar">
                    <Terminal size={15} />
                    <span>Exemplo público</span>
                    <span className="rl-example-dot" />
                  </div>
                  {next.examples[0] ? (
                    <div className="rl-example-body">
                      <span className="rl-code-label">ENTRADA</span>
                      <pre>{formatExample(next.examples[0].input)}</pre>
                      <div className="rl-code-divider" />
                      <span className="rl-code-label">SAÍDA ESPERADA</span>
                      <pre className="rl-output">
                        {formatExample(next.examples[0].output)}
                      </pre>
                    </div>
                  ) : (
                    <div className="rl-example-body">
                      <Code2 size={30} />
                      <p>
                        Leia o contrato e prepare sua implementação no editor.
                      </p>
                    </div>
                  )}
                  <div className="rl-example-caption">
                    {next.languageIds.length === 1
                      ? "Ambiente específico do desafio"
                      : `${next.languageIds.length} linguagens disponíveis`}
                  </div>
                </div>
              </article>
            ) : (
              <div className="rl-empty">O catálogo está sendo preparado.</div>
            )}
          </section>
          <section aria-labelledby="rl-topics-title">
            <div className="rl-section-heading">
              <h2 id="rl-topics-title">Pratique por assunto</h2>
              <Link to="/trilhas">
                Ver trilhas <ArrowRight size={14} />
              </Link>
            </div>
            <div className="rl-topic-list">
              {topics.slice(0, 4).map((topic) => {
                const items = catalog.data.filter(
                  (item) => item.topicId === topic.id,
                );
                const count = items.filter((item) =>
                  completed.has(item.id),
                ).length;
                return (
                  <Link
                    to={`/desafios?topic=${topic.id}`}
                    key={topic.id}
                    className="rl-topic-row"
                  >
                    <span className="rl-topic-mark">
                      <TopicIcon topicId={topic.id} size={20} />
                    </span>
                    <div className="rl-topic-name">
                      <h3>{topic.title}</h3>
                      <p>{items.length} desafios · Easy, Medium e Hard</p>
                    </div>
                    <div className="rl-topic-progress">
                      <span>
                        {count} / {items.length}
                      </span>
                      <ProgressBar
                        value={count}
                        max={items.length}
                        label={`Progresso em ${topic.title}`}
                      />
                    </div>
                    <ChevronRight size={17} />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="rl-side-column">
          <section className="rl-activity" aria-labelledby="rl-activity-title">
            <div className="rl-section-heading">
              <h2 id="rl-activity-title">Sua atividade</h2>
              <Flame size={17} />
            </div>
            <div className="rl-streak-number">
              <strong>{data.streakDays}</strong>
              <span>
                {data.streakDays === 1
                  ? "dia de sequência"
                  : "dias de sequência"}
              </span>
            </div>
            <div className="rl-week">
              {week.map((date, index) => {
                const isToday = dayKey(date) === dayKey(today);
                const done = acceptedDates.has(dayKey(date));
                return (
                  <div
                    key={index}
                    className={`rl-week-day ${isToday ? "is-today" : ""} ${done ? "is-done" : ""}`}
                    aria-label={`${date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${done ? ", desafio concluído" : ""}${isToday ? ", hoje" : ""}`}
                  >
                    <span>{["S", "T", "Q", "Q", "S", "S", "D"][index]}</span>
                    <div>{done ? <Check size={14} /> : date.getUTCDate()}</div>
                  </div>
                );
              })}
            </div>
            <div className="rl-today-status">
              <span className={dailyDone ? "is-done" : ""}>
                {dailyDone ? (
                  <Check size={16} />
                ) : (
                  <span className="rl-open-circle" />
                )}
              </span>
              <div>
                <strong>
                  {dailyDone ? "Prática de hoje concluída" : "Um desafio hoje"}
                </strong>
                <p>
                  {dailyDone
                    ? "Sua aprovação foi registrada."
                    : "Sua próxima solução começa no editor."}
                </p>
              </div>
            </div>
          </section>
          <section className="rl-level">
            <div className="rl-section-heading">
              <h2>Próximo nível</h2>
              <Trophy size={17} />
            </div>
            <div className="rl-level-values">
              <strong>Nível {data.level}</strong>
              <span>Nível {data.level + 1}</span>
            </div>
            <ProgressBar
              value={data.xpIntoLevel}
              max={data.xpForNextLevel}
              label="XP até o próximo nível"
            />
            <p>
              <strong>{formatNumber(data.xpIntoLevel)}</strong> /{" "}
              {formatNumber(data.xpForNextLevel)} XP
            </p>
          </section>
          <section className="rl-support">
            <span className="rl-support-icon">
              <Lightbulb size={19} />
            </span>
            <h2>Travou em um problema?</h2>
            <p>
              Use uma dica para encontrar o próximo passo ou organize seus
              estudos com o tutor.
            </p>
            <Link to="/tutor">
              Abrir tutor <ArrowRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
