import { useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
  learningPathPositions,
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

type ConstellationCluster =
  "concepts" | "core" | "patterns" | "reasoning" | "mastery";

type ConstellationNodeData = {
  id: string;
  title: string;
  index: number;
  state: LearningPathNodeState;
  cluster: ConstellationCluster;
  difficulty: PublicChallenge["difficulty"];
  interactive: boolean;
  inFocus: boolean;
  onSelect: (id: string) => void;
};

type ConstellationNode = Node<ConstellationNodeData, "skill">;
type NodeSide = "top" | "right" | "bottom" | "left";

const nodeSides: Record<NodeSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

function oppositeSide(side: NodeSide): NodeSide {
  return { top: "bottom", right: "left", bottom: "top", left: "right" }[
    side
  ] as NodeSide;
}

function edgeSide(
  source: readonly [number, number],
  target: readonly [number, number],
): NodeSide {
  const [sourceX, sourceY] = source;
  const [targetX, targetY] = target;
  if (Math.abs(targetX - sourceX) >= Math.abs(targetY - sourceY))
    return targetX >= sourceX ? "right" : "left";
  return targetY >= sourceY ? "bottom" : "top";
}

function SkillNode({ data, selected }: NodeProps<ConstellationNode>) {
  return (
    <div
      className={`skill-node cluster-${data.cluster} ${data.state} ${data.inFocus ? "in-focus" : "out-of-focus"} ${selected ? "selected" : ""}`}
    >
      {(Object.keys(nodeSides) as NodeSide[]).map((side) => (
        <Handle
          key={`target-${side}`}
          id={`target-${side}`}
          type="target"
          position={nodeSides[side]}
          className="skill-handle"
        />
      ))}
      <button
        type="button"
        className="skill-node-button"
        aria-pressed={selected}
        aria-label={`Nó ${data.index}: ${data.title}. ${stateLabel(data.state)}`}
        title={`Desafio ${data.index}: ${data.title}. Clique para ver os detalhes.`}
        tabIndex={data.interactive ? 0 : -1}
        onClick={() => {
          if (data.interactive) data.onSelect(data.id);
        }}
      >
        <span className="skill-node-number">
          {data.state === "completed" ? <Check size={16} /> : data.index}
        </span>
        <span className="skill-node-glyph" aria-hidden="true">
          {[
            "7",
            "=",
            "+",
            "Aa",
            "?",
            "ƒ",
            "→",
            "↩",
            "↗",
            "{}",
            "7",
            "Aa",
            "=",
            "›_",
            "→",
            "ƒ",
            "+",
            "=",
            "%",
            "⌁",
            "Σ",
            "Aa",
            "↔",
            "ƒ",
            "◌",
            "∑",
            "∩",
            "Ⅻ",
            "()",
          ][data.index - 1] ?? "ƒ"}
        </span>
        <span className="skill-node-label">
          <strong>{data.title}</strong>
          <small>Desafio {String(data.index).padStart(2, "0")}</small>
        </span>
      </button>
      {(Object.keys(nodeSides) as NodeSide[]).map((side) => (
        <Handle
          key={`source-${side}`}
          id={`source-${side}`}
          type="source"
          position={nodeSides[side]}
          className="skill-handle"
        />
      ))}
    </div>
  );
}

const constellationNodeTypes = { skill: SkillNode };
function clusterFor(position: number): ConstellationCluster {
  if (position < 10) return "concepts";
  if (position < 16) return "core";
  if (position < 23) return "patterns";
  if (position < 27) return "reasoning";
  return "mastery";
}

function clusterColor(cluster: ConstellationCluster) {
  if (cluster === "concepts") return "#50b8ff";
  if (cluster === "core") return "#12d6a2";
  if (cluster === "patterns") return "#a56aff";
  if (cluster === "reasoning") return "#ffb300";
  return "#ff626b";
}

function stateLabel(state: LearningPathNodeState) {
  if (state === "completed") return "Concluído";
  if (state === "current") return "Seu desafio atual";
  if (state === "available") return "Disponível";
  return "Mais adiante na rota · disponível para explorar";
}

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
  const [showFullMap, setShowFullMap] = useState(false);
  const selected =
    challenges.find((challenge) => challenge.id === selectedId) ??
    challenges[0];
  if (!selected) return null;
  const selectedIndex = challenges.findIndex(({ id }) => id === selected.id);
  const selectedState =
    states.get(selected.id) ?? ("locked" as LearningPathNodeState);
  const constellationPositions = learningPathPositions(challenges.length);
  const completedCount = challenges.filter((challenge) =>
    completed.has(challenge.id),
  ).length;
  const prerequisite = challenges[selectedIndex - 1];
  const nextChallenge = challenges[selectedIndex + 1];
  const nodes: ConstellationNode[] = challenges.map((challenge, index) => ({
    id: challenge.id,
    type: "skill",
    position: {
      x: constellationPositions[index]?.[0] ?? 0,
      y: constellationPositions[index]?.[1] ?? 0,
    },
    data: {
      id: challenge.id,
      title: challenge.title,
      index: index + 1,
      state: states.get(challenge.id) ?? "locked",
      cluster: clusterFor(index),
      difficulty: challenge.difficulty,
      interactive: true,
      inFocus: showFullMap || Math.abs(index - selectedIndex) <= 1,
      onSelect: setSelectedId,
    },
  }));
  const edges: Edge[] = challenges.slice(1).map((challenge, index) => {
    const sourcePosition = constellationPositions[index] ?? [0, 0];
    const targetPosition = constellationPositions[index + 1] ?? [0, 0];
    const sourceSide = edgeSide(sourcePosition, targetPosition);
    const targetCluster = clusterFor(index + 1);
    const crossesCluster = clusterFor(index) !== targetCluster;
    return {
      id: `${challenges[index]?.id}-${challenge.id}`,
      source: challenges[index]?.id ?? "",
      sourceHandle: `source-${sourceSide}`,
      target: challenge.id,
      targetHandle: `target-${oppositeSide(sourceSide)}`,
      type: "bezier",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: clusterColor(targetCluster),
        width: 14,
        height: 14,
      },
      className: `constellation-edge cluster-${targetCluster} ${crossesCluster ? "is-cross-cluster" : ""} ${states.get(challenge.id) ?? "locked"}`,
    };
  });
  const focusEdges = edges.filter((_, index) =>
    showFullMap ? true : Math.abs(index - selectedIndex) <= 1,
  );
  const miniNodes = nodes.slice(0, 6).map((node, index) => ({
    ...node,
    position: {
      x: [18, 94, 157, 224, 281, 338][index] ?? 0,
      y: [100, 40, 125, 48, 118, 62][index] ?? 0,
    },
    data: { ...node.data, interactive: false },
  }));
  const miniEdges = edges.slice(0, 5);
  return (
    <section className="constellation panel" aria-labelledby="logic-map-title">
      <header className="constellation-heading">
        <div>
          <span className="eyebrow">ROTA GUIADA · LÓGICA</span>
          <h2 id="logic-map-title">Do primeiro conceito ao código</h2>
          <p>
            Comece com dez perguntas sobre programação. Depois, faça pequenas
            alterações no código e avance para os problemas de lógica.
          </p>
        </div>
        <div className="constellation-legend" aria-label="Legenda do mapa">
          <span className="completed">
            <Check size={13} /> Concluído
          </span>
          <span className="current">
            <CircleDot size={13} /> Atual
          </span>
          <span className="locked">
            <Route size={13} /> Mais adiante
          </span>
        </div>
        <div className="constellation-route-context">
          <span
            aria-label={`Progresso da rota: ${completedCount} de ${challenges.length} desafios concluídos`}
          >
            <Route size={14} /> Progresso: {completedCount} de{" "}
            {challenges.length}
          </span>
          <button
            type="button"
            className="constellation-map-toggle"
            aria-pressed={showFullMap}
            onClick={() => setShowFullMap((value) => !value)}
          >
            {showFullMap ? "Focar na minha rota" : "Ver mapa completo"}
          </button>
        </div>
      </header>
      <div className="constellation-workspace">
        <div
          className="constellation-flow"
          aria-label="Constelação da trilha de lógica"
        >
          <span className="constellation-click-hint">
            <CircleDot size={13} /> Clique em um desafio para ver os detalhes
          </span>
          <ReactFlow
            nodes={nodes}
            edges={focusEdges}
            nodeTypes={constellationNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.25}
            maxZoom={1.25}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={26} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <article
          className={`constellation-detail ${selectedState}`}
          aria-live="polite"
        >
          <div className="constellation-detail-status">
            {selectedState === "completed" ? (
              <Check size={14} />
            ) : (
              <CircleDot size={14} />
            )}
            {stateLabel(selectedState)}
          </div>
          <span className="logic-detail-index">
            ETAPA {String(selectedIndex + 1).padStart(2, "0")} ·{" "}
            {selected.kind === "quiz" ? "Pergunta guiada" : "Prática no código"}
          </span>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <div className="constellation-detail-path">
            <span>
              {prerequisite ? "Etapa anterior sugerida" : "Ponto de partida"}
              <strong>
                {prerequisite ? prerequisite.title : "Você começa por aqui"}
              </strong>
            </span>
            {nextChallenge && (
              <span>
                Próximo na rota
                <strong>{nextChallenge.title}</strong>
              </span>
            )}
          </div>
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
          <Link
            className="button button-primary"
            to={`/desafios/${selected.slug}`}
          >
            {selectedState === "completed"
              ? selected.kind === "quiz"
                ? "Rever pergunta"
                : "Praticar novamente"
              : selected.kind === "quiz"
                ? "Responder pergunta"
                : "Abrir desafio"}{" "}
            <ArrowRight size={16} />
          </Link>
        </article>
      </div>
      <div
        className="constellation-mobile"
        aria-label="Jornada de lógica no celular"
      >
        <div className="constellation-mini-flow" aria-hidden="true">
          <ReactFlow
            nodes={miniNodes}
            edges={miniEdges}
            nodeTypes={constellationNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} />
          </ReactFlow>
        </div>
        <ol
          className="constellation-stage-list"
          aria-label="Etapas da trilha de lógica"
        >
          {challenges.map((challenge, index) => {
            const state = states.get(challenge.id) ?? "locked";
            return (
              <li key={challenge.id}>
                <button
                  type="button"
                  aria-pressed={selected.id === challenge.id}
                  className={`${state} ${selected.id === challenge.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(challenge.id)}
                >
                  <span className="constellation-stage-number">
                    {state === "completed" ? (
                      <Check size={15} />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span>
                    <strong>{challenge.title}</strong>
                    <small>{stateLabel(state)}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              </li>
            );
          })}
        </ol>
        <article
          className={`constellation-drawer ${selectedState}`}
          aria-live="polite"
        >
          <div>
            <span className="logic-detail-index">
              ETAPA {String(selectedIndex + 1).padStart(2, "0")} ·{" "}
              {selected.kind === "quiz"
                ? "Pergunta guiada"
                : "Prática no código"}
            </span>
            <h3>{selected.title}</h3>
            <p>{selected.description}</p>
            <div className="constellation-detail-path">
              <span>
                {prerequisite ? "Etapa anterior sugerida" : "Ponto de partida"}
                <strong>
                  {prerequisite ? prerequisite.title : "Você começa por aqui"}
                </strong>
              </span>
              {nextChallenge && (
                <span>
                  Próximo na rota
                  <strong>{nextChallenge.title}</strong>
                </span>
              )}
            </div>
          </div>
          <Link
            className="button button-primary"
            to={`/desafios/${selected.slug}`}
          >
            {selectedState === "completed"
              ? selected.kind === "quiz"
                ? "Rever pergunta"
                : "Praticar novamente"
              : selected.kind === "quiz"
                ? "Responder pergunta"
                : "Abrir desafio"}
            <ArrowRight size={16} />
          </Link>
        </article>
      </div>
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
      <LogicLearningMap challenges={logicChallenges} completed={completed} />
      <section className="tracks-intro panel">
        <span className="tracks-intro-index">01 →</span>
        <div>
          <span className="eyebrow">POR ONDE COMEÇAR</span>
          <h2>Aprenda os conceitos antes de escrever código.</h2>
          <p>
            Responda perguntas simples sobre valores, variáveis, tipos, funções
            e classes. Depois, pratique com modelos prontos e avance para
            algoritmos, estruturas de dados e SQL.
          </p>
        </div>
        <Link to="/desafios/concept-values" className="button button-secondary">
          Começar do zero <ArrowRight size={17} />
        </Link>
      </section>
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
                        ? "Fácil"
                        : difficulty === "medium"
                          ? "Médio"
                          : "Difícil"}
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
