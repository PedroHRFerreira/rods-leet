import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  LockKeyhole,
  Route,
  Zap,
} from "lucide-react";
import { topics } from "../content/catalog";
import { useGateway } from "../lib/gateway-context";
import {
  ErrorState,
  LoadingState,
  PageHeading,
  ProgressBar,
  TopicIcon,
} from "../components/ui";

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
        <Link to="/desafios?topic=logic" className="button button-secondary">
          Começar por lógica <ArrowRight size={17} />
        </Link>
      </section>
      <section
        className="fundamentals-panel panel"
        aria-labelledby="fundamentals-title"
      >
        <div>
          <span className="eyebrow">ANTES DO PRIMEIRO DESAFIO</span>
          <h2 id="fundamentals-title">Fundamentos para consultar na trilha</h2>
          <p>
            Use estes conceitos como referência enquanto pratica. Eles não são
            desafios, não consomem tentativas e não alteram seu XP.
          </p>
        </div>
        <div className="fundamentals-list">
          {[
            ["Variáveis", "Guardar valores para usar depois."],
            ["Tipos", "Entender números, textos e valores lógicos."],
            ["Operadores", "Comparar, calcular e combinar condições."],
            ["Arrays", "Percorrer e organizar uma sequência de valores."],
          ].map(([title, description]) => (
            <article key={title}>
              <Braces size={17} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="section-heading tracks-section-heading">
        <h2>
          Disponíveis para explorar{" "}
          <span className="count-pill">{available.length}</span>
        </h2>
        <span className="muted small-text">
          {catalog.data.length} desafios no catálogo
        </span>
      </div>
      <div className="tracks-grid">
        {available.map((topic, index) => {
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
