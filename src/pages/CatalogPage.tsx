import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Code2,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import { topics } from "../content/catalog";
import { LANGUAGES } from "../domain/rules";
import {
  DifficultyBadge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  TopicIcon,
} from "../components/ui";

export default function CatalogPage() {
  const gateway = useGateway();
  const [params, setParams] = useSearchParams();
  const catalog = useQuery({
    queryKey: ["challenges"],
    queryFn: () => gateway.listChallenges(),
  });
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
  });
  const topic = params.get("topic") ?? "";
  const difficulty = params.get("difficulty") ?? "";
  const language = params.get("language") ?? "";
  const search = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const completed = useMemo(
    () => new Set(dashboard.data?.completedChallengeIds ?? []),
    [dashboard.data?.completedChallengeIds],
  );
  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  const filtered = useMemo(() => {
    const normalized = search
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    return (catalog.data ?? []).filter(
      (item) =>
        (!topic || item.topicId === topic) &&
        (!difficulty || item.difficulty === difficulty) &&
        (!language ||
          item.kind === "quiz" ||
          item.languageIds.some((id) => id === language)) &&
        (!status ||
          (status === "completed"
            ? completed.has(item.id)
            : !completed.has(item.id))) &&
        (!normalized ||
          `${item.title} ${item.description} ${topics.find((t) => t.id === item.topicId)?.title ?? ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR")
            .includes(normalized)),
    );
  }, [catalog.data, topic, difficulty, language, search, status, completed]);
  const filterCount = [
    topic,
    difficulty,
    language,
    status,
    search.trim(),
  ].filter(Boolean).length;
  const availableTopics = topics.filter((item) =>
    catalog.data?.some((challenge) => challenge.topicId === item.id),
  );
  if (catalog.isPending)
    return <LoadingState label="Preparando seus desafios…" />;
  if (catalog.isError)
    return (
      <ErrorState
        error={catalog.error}
        retry={() => {
          void catalog.refetch();
        }}
      />
    );
  return (
    <div className="catalog-page">
      <PageHeading
        eyebrow="BIBLIOTECA DE PRÁTICA"
        title="Desafios"
        description="Comece com perguntas simples. Depois, pratique escrevendo código."
      >
        <span className="catalog-total">
          <Code2 size={17} />
          <strong>{catalog.data.length}</strong> desafios
        </span>
      </PageHeading>
      <div className="topic-tabs" role="group" aria-label="Filtrar por trilha">
        <button
          type="button"
          className={!topic ? "active" : ""}
          onClick={() => updateFilter("topic", "")}
        >
          <span>Todos os desafios</span>
          <small>{catalog.data.length}</small>
        </button>
        {availableTopics.map((item) => (
          <button
            type="button"
            key={item.id}
            className={topic === item.id ? "active" : ""}
            onClick={() => updateFilter("topic", item.id)}
          >
            <TopicIcon topicId={item.id} size={16} />
            <span>
              {item.id === "logic"
                ? "Lógica"
                : item.id === "sql"
                  ? "SQL"
                  : item.title}
            </span>
            <small>
              {
                catalog.data.filter(
                  (challenge) => challenge.topicId === item.id,
                ).length
              }
            </small>
          </button>
        ))}
      </div>
      <section
        className="catalog-filters panel"
        aria-label="Filtros dos desafios"
      >
        <label className="catalog-search">
          <Search size={18} />
          <input
            aria-label="Buscar no catálogo"
            placeholder="Buscar pelo nome ou assunto…"
            value={search}
            onChange={(event) => updateFilter("q", event.target.value)}
          />
          {search && (
            <button
              type="button"
              className="icon-button"
              aria-label="Limpar busca"
              onClick={() => updateFilter("q", "")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <span className="filter-divider" />
        <div className="filter-selects">
          <SlidersHorizontal className="filter-icon" size={17} />
          <label className="sr-only" htmlFor="difficulty-filter">
            Dificuldade
          </label>
          <select
            id="difficulty-filter"
            value={difficulty}
            onChange={(event) => updateFilter("difficulty", event.target.value)}
          >
            <option value="">Dificuldade</option>
            <option value="easy">Fácil</option>
            <option value="medium">Médio</option>
            <option value="hard">Difícil</option>
          </select>
          <label className="sr-only" htmlFor="language-filter">
            Linguagem
          </label>
          <select
            id="language-filter"
            value={language}
            onChange={(event) => updateFilter("language", event.target.value)}
          >
            <option value="">Linguagem</option>
            {LANGUAGES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="status-filter">
            Progresso
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">Progresso</option>
            <option value="pending">Para resolver</option>
            <option value="completed">Concluídos</option>
          </select>
        </div>
      </section>
      <div className="catalog-results-heading">
        <p aria-live="polite">
          <strong>{filtered.length}</strong>{" "}
          {filtered.length === 1
            ? "desafio encontrado"
            : "desafios encontrados"}
          {topic && (
            <span>
              {" "}
              em {topics.find((item) => item.id === topic)?.title ?? topic}
            </span>
          )}
        </p>
        {filterCount > 0 ? (
          <button
            type="button"
            className="text-link"
            onClick={() => setParams({}, { replace: true })}
          >
            <X size={14} />
            Limpar filtros ({filterCount})
          </button>
        ) : (
          <span>
            <Filter size={13} />
            Organizados por trilha
          </span>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="Ainda não encontramos esse desafio"
          description="Tente outro termo ou ajuste os filtros. Há desafios para diferentes assuntos e níveis."
        >
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setParams({}, { replace: true })}
          >
            Ver todos os desafios <ArrowRight size={16} />
          </button>
        </EmptyState>
      ) : (
        <div className="challenge-list panel">
          <div className="challenge-list-header" aria-hidden="true">
            <span>#</span>
            <span>Desafio</span>
            <span>Dificuldade</span>
            <span>Ambiente</span>
            <span>XP</span>
            <span />
          </div>
          {filtered.map((item, index) => (
            <Link
              to={`/desafios/${item.slug}${language ? `?language=${language}` : ""}`}
              className={`catalog-challenge-card challenge-row ${completed.has(item.id) ? "is-completed" : ""}`}
              key={item.id}
            >
              <span className="challenge-row-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="challenge-row-title">
                <h2>{item.title}</h2>
                <p>
                  <TopicIcon topicId={item.topicId} size={13} />
                  {
                    topics.find((topicItem) => topicItem.id === item.topicId)
                      ?.title
                  }
                  <span>·</span>
                  {item.estimatedMinutes ??
                    (item.difficulty === "easy"
                      ? 15
                      : item.difficulty === "medium"
                        ? 30
                        : 45)}{" "}
                  min
                </p>
              </div>
              <DifficultyBadge difficulty={item.difficulty} />
              <span className="challenge-row-language">
                {item.kind === "quiz"
                  ? "Pergunta • sem código"
                  : item.kind === "sql"
                    ? "PostgreSQL 18"
                    : item.kind === "project"
                      ? "Múltiplos arquivos"
                      : `${item.languageIds.length} linguagens`}
              </span>
              <span className="challenge-row-xp">
                {item.baseXp}
                <span> XP</span>
              </span>
              <span className="challenge-row-status">
                {completed.has(item.id) ? (
                  <CheckCircle2
                    size={18}
                    className="completed-check"
                    aria-label="Concluído"
                  />
                ) : (
                  <Circle size={17} aria-label={`Explorar ${item.title}`} />
                )}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="catalog-bottom-note">
        <LightbulbIcon />
        <span>
          Acerte a pergunta ou resolva o desafio de código para avançar. Você
          pode tentar novamente; cada erro reduz a recompensa em 15% do XP
          inicial.
        </span>
        <Link to="/perfil" className="text-link">
          Regras de progresso <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function LightbulbIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z" />
    </svg>
  );
}
