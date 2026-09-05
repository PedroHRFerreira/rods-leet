import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ShieldCheck,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import {
  EmptyState,
  ErrorState,
  formatNumber,
  LoadingState,
  PageHeading,
} from "../components/ui";
import "../editor.css";

export default function RankingPage() {
  const gateway = useGateway();
  const ranking = useQuery({
    queryKey: ["ranking"],
    queryFn: () => gateway.getRanking(),
    retry: false,
  });
  if (ranking.isPending) return <LoadingState label="Carregando o ranking…" />;
  if (ranking.isError)
    return (
      <ErrorState error={ranking.error} retry={() => void ranking.refetch()} />
    );
  const mine = ranking.data.findIndex((entry) => entry.isCurrentUser);
  return (
    <div className="ranking-page">
      <PageHeading
        eyebrow="COMUNIDADE"
        title="Ranking"
        description="Progresso conquistado com código. Regras iguais para todos."
      >
        <span className="ranking-season">
          <span />
          Beta · classificação geral
        </span>
      </PageHeading>
      <section className="ranking-hero panel">
        <div className="ranking-trophy">
          <Trophy size={42} strokeWidth={1.4} />
        </div>
        <div>
          <span className="eyebrow">SUA POSIÇÃO</span>
          <h2>
            {mine >= 0
              ? `Você está na posição #${mine + 1}`
              : "Seu primeiro desafio é o ponto de partida."}
          </h2>
          <p>As aprovações somam XP e definem sua posição.</p>
        </div>
        <Link to="/desafios" className="button button-primary">
          Ir para os desafios <ArrowUpRight size={16} />
        </Link>
      </section>
      <section className="panel leaderboard">
        <div className="leaderboard-heading">
          <h2>
            <UsersRound size={18} />
            Classificação geral
          </h2>
          <span>{ranking.data.length} participantes com progresso</span>
        </div>
        {ranking.data.length === 0 ? (
          <EmptyState
            title="Nenhuma pontuação registrada"
            description="As primeiras soluções aprovadas aparecerão aqui, com XP e desafios concluídos."
            icon="code"
          />
        ) : (
          <div className="ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th scope="col">Posição</th>
                  <th scope="col">Participante</th>
                  <th scope="col">Desafios</th>
                  <th scope="col">XP total</th>
                </tr>
              </thead>
              <tbody>
                {ranking.data.map((entry, index) => (
                  <tr
                    key={entry.userId}
                    className={entry.isCurrentUser ? "current-player" : ""}
                  >
                    <td>
                      <span
                        className={`rank-position ${index < 3 ? `position-${index + 1}` : ""}`}
                      >
                        {index < 3 ? <Trophy size={16} /> : "#"}
                        {index + 1}
                      </span>
                    </td>
                    <td>
                      <span className="ranking-player">
                        <span className="avatar">
                          {entry.displayName
                            .charAt(0)
                            .toLocaleUpperCase("pt-BR")}
                        </span>
                        <strong>{entry.displayName}</strong>
                        {entry.isCurrentUser && <small>Você</small>}
                      </span>
                    </td>
                    <td>{formatNumber(entry.completedCount)}</td>
                    <td>
                      <span className="ranking-xp">
                        <Zap size={13} />
                        {formatNumber(entry.xp)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="ranking-rules">
        <ShieldCheck size={20} />
        <div>
          <strong>Uma competição justa, por princípio.</strong>
          <p>
            XP líquido define a posição. Empates consideram desafios concluídos
            e quando a pontuação foi alcançada. Dicas mantêm você no ranking;
            dinheiro nunca compra XP ou multiplicadores.
          </p>
        </div>
      </div>
    </div>
  );
}
