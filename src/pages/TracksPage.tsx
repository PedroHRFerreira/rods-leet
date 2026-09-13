import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Flag,
  LockKeyhole,
  Route,
  Zap,
} from "lucide-react";
import { topics } from "../content/catalog";
import {
  learningPathStates,
  type LearningPathNodeState,
} from "../domain/learning-path";
import { useGateway } from "../lib/gateway-context";
import {
  ErrorState,
  LoadingState,
  PageHeading,
  ProgressBar,
  TopicIcon,
} from "../components/ui";
import type { PublicChallenge } from "../lib/contracts";

function LogicLearningMap({
  challenges,
  completed,
}: {
  challenges: PublicChallenge[];
  completed: Set<string>;
}) {
  const states = learningPathStates(challenges, completed);
  const initial = challenges.find(
    (challenge) => states.get(challenge.id) === "current",
  );
  const [selectedId, setSelectedId] = useState(
    initial?.id ?? challenges[0]?.id ?? "",
  );
  const selected =
    challenges.find((challenge) => challenge.id === selectedId) ??
    challenges[0];
  if (!selected) return null;
  const selectedIndex = challenges.findIndex(({ id }) => id === selected.id);
  const selectedState =
    states.get(selected.id) ?? ("locked" as LearningPathNodeState);
  const canOpen = selectedState !== "locked";
  return (
    <section className="logic-map panel" aria-labelledby="logic-map-title">
      <header className="logic-map-heading">
        <div>
          <span className="eyebrow">ROTA GUIADA · LÓGICA</span>
          <h2 id="logic-map-title">Mapa de fundamentos</h2>
          <p>
            Avance de inteiros às expressões. Cada nó prepara o próximo, sem
            tirar sua liberdade de explorar o catálogo.
          </p>
        </div>
        <div className="logic-map-legend" aria-label="Legenda do mapa">
          <span className="completed">
            <Check size={13} /> Concluído
          </span>
          <span className="current">
            <CircleDot size={13} /> Atual
          </span>
          <span className="locked">
            <LockKeyhole size={13} /> Bloqueado
          </span>
        </div>
      </header>
      <div className="logic-map-canvas" aria-label="Nós da trilha de lógica">
        <div className="logic-map-line" aria-hidden="true" />
        {challenges.map((challenge, index) => {
          const state = states.get(challenge.id) ?? "locked";
          return (
            <button
              key={challenge.id}
              type="button"
              className={`logic-map-node ${state} ${selected.id === challenge.id ? "selected" : ""}`}
              aria-pressed={selected.id === challenge.id}
              onClick={() => setSelectedId(challenge.id)}
            >
              <span className="logic-node-number">
                {state === "completed" ? (
                  <Check size={17} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <strong>{challenge.title}</strong>
              <small>
                {challenge.difficulty === "easy"
                  ? "Easy"
                  : challenge.difficulty === "medium"
                    ? "Medium"
                    : "Hard"}
              </small>
            </button>
          );
        })}
      </div>
      <ol className="logic-map-list" aria-label="Lista da trilha de lógica">
        {challenges.map((challenge, index) => {
          const state = states.get(challenge.id) ?? "locked";
          return (
            <li key={challenge.id}>
              <button
                type="button"
                aria-pressed={selected.id === challenge.id}
                className={selected.id === challenge.id ? "selected" : ""}
                onClick={() => setSelectedId(challenge.id)}
              >
                <span className={`logic-list-state ${state}`}>
                  {state === "completed" ? (
                    <Check size={15} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  <strong>{challenge.title}</strong>
                  <small>
                    {state === "current"
                      ? "Seu desafio atual"
                      : state === "locked"
                        ? "Conclua o anterior para seguir a rota"
                        : "Disponível"}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            </li>
          );
        })}
      </ol>
      <article
        className={`logic-map-detail ${selectedState}`}
        aria-live="polite"
      >
        <div className="logic-detail-status">
          {selectedState === "completed" ? (
            <>
              <Check size={14} /> Concluído
            </>
          ) : selectedState === "current" ? (
            <>
              <CircleDot size={14} /> Seu nó atual
            </>
          ) : selectedState === "available" ? (
            <>
              <Zap size={14} /> Disponível
            </>
          ) : (
            <>
              <LockKeyhole size={14} /> Disponível após o nó anterior
            </>
          )}
        </div>
        <span className="logic-detail-index">
          NÓ {String(selectedIndex + 1).padStart(2, "0")} ·{" "}
          {selected.difficulty}
        </span>
        <h3>{selected.title}</h3>
        <p>{selected.description}</p>
        <div className="logic-detail-stats">
          <span>
            <Clock3 size={14} /> {selected.estimatedMinutes ?? 15} min
          </span>
          <span>
            <Zap size={14} /> +{selected.baseXp} XP
          </span>
          <span>
            <Flag size={14} />{" "}
            {selected.difficulty === "easy"
              ? "Fácil"
              : selected.difficulty === "medium"
                ? "Médio"
                : "Difícil"}
          </span>
        </div>
        <div className="logic-detail-tags" aria-label="Conceitos abordados">
          {(selected.tags ?? []).map((tag) => (
            <code key={tag}>{tag}</code>
          ))}
        </div>
        {canOpen ? (
          <Link
            className="button button-primary"
            to={`/desafios/${selected.slug}`}
          >
            {selectedState === "completed"
              ? "Praticar novamente"
              : "Abrir desafio"}{" "}
            <ArrowRight size={16} />
          </Link>
        ) : (
          <p className="logic-detail-locked">
            Conclua “{challenges[selectedIndex - 1]?.title}” nesta rota para
            desbloquear este nó no mapa.
          </p>
        )}
      </article>
    </section>
  );
}

export default function TracksPage() {
  const gateway = useGateway();
  const catalog = useQuery({
    queryKey: ["challenges"],
    queryFn: () => gateway.listChallenges(),
  });
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
  });
  if (catalog.isPending)
    return <LoadingState label="Organizando suas trilhas…" />;
  if (catalog.isError)
    return (
      <ErrorState
        error={catalog.error}
        retry={() => {
          void catalog.refetch();
        }}
      />
    );
  const completed = new Set(dashboard.data?.completedChallengeIds ?? []);
  const available = topics.filter((topic) =>
    catalog.data.some((challenge) => challenge.topicId === topic.id),
  );
  const logicChallenges = catalog.data
    .filter((challenge) => challenge.topicId === "logic")
    .sort(
      (a, b) =>
        (a.learningPath?.position ?? Number.MAX_SAFE_INTEGER) -
        (b.learningPath?.position ?? Number.MAX_SAFE_INTEGER),
    );
  return (
    <div className="tracks-page">
      <PageHeading
        eyebrow="APRENDIZADO COM DIREÇÃO"
        title="Trilhas de aprendizado"
        description="Conecte os fundamentos à prática. Encontre uma sequência de desafios para o que você quer aprender."
      >
        <span className="catalog-total">
          <Route size={18} />
          <strong>{topics.length}</strong> trilhas
        </span>
      </PageHeading>
      <section className="tracks-intro panel">
        <span className="tracks-intro-index">01 →</span>
        <div>
          <span className="eyebrow">POR ONDE COMEÇAR</span>
          <h2>Uma base sólida faz a diferença.</h2>
          <p>
            Comece por lógica, avance para algoritmos e explore estruturas de
            dados. SQL tem sua própria trilha.
          </p>
        </div>
        <Link
          to="/desafios/sum-two-integers"
          className="button button-secondary"
        >
          Começar pelos inteiros <ArrowRight size={17} />
        </Link>
      </section>
      <LogicLearningMap challenges={logicChallenges} completed={completed} />
      <div className="section-heading tracks-section-heading">
        <h2>
          Outras trilhas para explorar{" "}
          <span className="count-pill">
            {available.filter((topic) => topic.id !== "logic").length}
          </span>
        </h2>
        <span className="muted small-text">
          {catalog.data.length} desafios no catálogo
        </span>
      </div>
      <div className="tracks-grid">
        {available
          .filter((topic) => topic.id !== "logic")
          .map((topic, index) => {
            const items = catalog.data.filter(
              (challenge) => challenge.topicId === topic.id,
            );
            const count = items.filter((item) => completed.has(item.id)).length;
            const allComplete = count === items.length && count > 0;
            return (
              <Link
                to={`/desafios?topic=${topic.id}`}
                key={topic.id}
                className={`track-card panel track-${index}`}
              >
                <div className="track-card-top">
                  <span
                    className={`topic-icon tone-${["purple", "cyan", "orange", "pink"][index % 4]}`}
                  >
                    <TopicIcon topicId={topic.id} size={25} />
                  </span>
                  <span className="track-number">
                    TRILHA {String(index + 1).padStart(2, "0")}
                  </span>
                  {allComplete && (
                    <Check
                      className="completed-check"
                      size={20}
                      aria-label="Trilha concluída"
                    />
                  )}
                </div>
                <h2>{topic.title}</h2>
                <p>{topic.description}</p>
                <div className="track-difficulty-breakdown">
                  {(["easy", "medium", "hard"] as const).map((difficulty) => (
                    <span
                      key={difficulty}
                      className={`track-difficulty-${difficulty}`}
                    >
                      <i />
                      <strong>
                        {
                          items.filter((item) => item.difficulty === difficulty)
                            .length
                        }
                      </strong>{" "}
                      {difficulty === "easy"
                        ? "Easy"
                        : difficulty === "medium"
                          ? "Medium"
                          : "Hard"}
                    </span>
                  ))}
                </div>
                <div className="track-progress-heading">
                  <span>
                    {count} de {items.length} desafios concluídos
                  </span>
                  <strong>{Math.round((count / items.length) * 100)}%</strong>
                </div>
                <ProgressBar
                  value={count}
                  max={items.length}
                  label={`Progresso em ${topic.title}`}
                />
                <div className="track-card-footer">
                  <span>
                    <Zap size={14} />
                    Até{" "}
                    {items
                      .reduce((sum, item) => sum + item.baseXp, 0)
                      .toLocaleString("pt-BR")}{" "}
                    XP no Normal
                  </span>
                  <strong>
                    {count ? "Continuar trilha" : "Explorar trilha"}
                    <ArrowRight size={16} />
                  </strong>
                </div>
              </Link>
            );
          })}
      </div>
      <div className="section-heading tracks-section-heading upcoming-heading">
        <h2>Próximas trilhas</h2>
        <span className="badge muted-badge">Em desenvolvimento</span>
      </div>
      <p className="upcoming-description">
        Outras áreas de engenharia de software chegarão nas próximas fases do
        Rods Leet.
      </p>
      <div className="upcoming-tracks-grid">
        {topics
          .filter((topic) => !available.some((item) => item.id === topic.id))
          .map((topic) => (
            <article className="upcoming-track panel" key={topic.id}>
              <span className="topic-icon">
                <TopicIcon topicId={topic.id} size={23} />
              </span>
              <div>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
              </div>
              <span className="upcoming-lock">
                <LockKeyhole size={14} />
                Em breve
              </span>
            </article>
          ))}
      </div>
      <div className="tracks-footer-note">
        <Route size={20} />
        <p>
          Explore por assunto ou encontre um desafio específico no catálogo.
        </p>
        <Link to="/desafios" className="text-link">
          Explorar todos os desafios <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
