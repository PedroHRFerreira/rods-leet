import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Coins,
  ShieldCheck,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import type { RankingEntry, WeeklyRankingEntry } from "../lib/contracts";
import { WEEKLY_PRIZES } from "../domain/shop-catalog";
import {
  EmptyState,
  ErrorState,
  formatNumber,
  LoadingState,
  PageHeading,
} from "../components/ui";
import "../editor.css";
import {
  CosmeticAvatar,
  cosmeticNameColor,
  cosmeticTitle,
} from "../components/CosmeticAvatar";

const localDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
function periodDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? localDate.format(date)
    : "data indisponível";
}
function timeLeft(endsAt: string, now: number): string {
  const remaining = Date.parse(endsAt) - now;
  if (!Number.isFinite(remaining)) return "Horário indisponível";
  if (remaining <= 0) return "Período encerrado; aguardando atualização";
  const minutes = Math.ceil(remaining / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days
    ? `${days}d ${hours}h para encerrar`
    : `${hours}h ${minutes % 60}min para encerrar`;
}
function RankingTable({
  entries,
  weekly = false,
}: {
  entries: readonly (RankingEntry | WeeklyRankingEntry)[];
  weekly?: boolean;
}) {
  return (
    <div className="ranking-table-wrap">
      <table className="ranking-table">
        <thead>
          <tr>
            <th scope="col">Posição</th>
            <th scope="col">Participante</th>
            <th scope="col">Desafios{weekly ? " na semana" : ""}</th>
            <th scope="col">{weekly ? "XP na semana" : "XP total"}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={entry.userId}
              className={entry.isCurrentUser ? "current-player" : ""}
            >
              <td>
                <span
                  className={`rank-position ${index < 3 ? `position-${index + 1}` : ""}`}
                >
                  {index < 3 ? <Trophy size={16} aria-hidden="true" /> : "#"}
                  {index + 1}
                </span>
              </td>
              <td>
                <span className="ranking-player">
                  <CosmeticAvatar
                    avatarId={entry.avatarId}
                    frameId={entry.frameId}
                    displayName={entry.displayName}
                  />
                  <span className="ranking-player-name">
                    <strong
                      style={{ color: cosmeticNameColor(entry.nameColorId) }}
                    >
                      {entry.displayName}
                    </strong>
                    {cosmeticTitle(entry.titleId) && (
                      <small className="cosmetic-profile-title">
                        {cosmeticTitle(entry.titleId)}
                      </small>
                    )}
                  </span>
                  {entry.isCurrentUser && <small>Você</small>}
                </span>
              </td>
              <td>
                {formatNumber(
                  weekly && "weeklyCompletedCount" in entry
                    ? entry.weeklyCompletedCount
                    : entry.completedCount,
                )}
              </td>
              <td>
                <span className="ranking-xp">
                  <Zap size={13} aria-hidden="true" />
                  {formatNumber(
                    weekly && "weeklyXp" in entry ? entry.weeklyXp : entry.xp,
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RankingPage() {
  const gateway = useGateway();
  const registrationDisabled =
    import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED === "false" &&
    import.meta.env.VITE_GOOGLE_LOGIN_ENABLED !== "true";
  const [mode, setMode] = useState<"weekly" | "general">("weekly");
  const [now, setNow] = useState(() => Date.now());
  const general = useQuery({
    queryKey: ["ranking"],
    queryFn: () => gateway.getRanking(),
    retry: false,
    enabled: mode === "general",
  });
  const weekly = useQuery({
    queryKey: ["ranking", "weekly"],
    queryFn: () => {
      if (!gateway.getWeeklyRanking)
        throw new Error("O ranking semanal está indisponível neste ambiente.");
      return gateway.getWeeklyRanking();
    },
    retry: false,
    enabled: mode === "weekly" && Boolean(gateway.getWeeklyRanking),
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const weeklyEndsAt = weekly.data?.endsAt;
  const refreshWeekly = weekly.refetch;
  useEffect(() => {
    if (mode === "weekly" && weeklyEndsAt && now >= Date.parse(weeklyEndsAt))
      void refreshWeekly();
  }, [mode, now, weeklyEndsAt, refreshWeekly]);
  const entries = mode === "weekly" ? weekly.data?.entries : general.data;
  const mine = entries?.findIndex((entry) => entry.isCurrentUser) ?? -1;
  const current = weekly.data?.currentUser;
  const loading = mode === "weekly" ? weekly.isPending : general.isPending;
  const failure = mode === "weekly" ? weekly.error : general.error;
  const unsupported = mode === "weekly" && !gateway.getWeeklyRanking;
  return (
    <div className="ranking-page">
      <PageHeading
        eyebrow="COMUNIDADE"
        title="Ranking"
        description="Progresso conquistado estudando. Regras iguais para todos."
      >
        <span className="ranking-season">
          <span />
          Beta ·{" "}
          {mode === "weekly" ? "classificação semanal" : "classificação geral"}
        </span>
      </PageHeading>
      <div
        className="ranking-tabs economy-auth-tabs"
        role="group"
        aria-label="Período do ranking"
      >
        <button
          type="button"
          className={`economy-filter ${mode === "weekly" ? "active" : ""}`}
          aria-pressed={mode === "weekly"}
          onClick={() => setMode("weekly")}
        >
          Semanal
        </button>
        <button
          type="button"
          className={`economy-filter ${mode === "general" ? "active" : ""}`}
          aria-pressed={mode === "general"}
          onClick={() => setMode("general")}
        >
          Geral
        </button>
      </div>
      {gateway.mode === "demo" && mode === "weekly" && (
        <p className="economy-notice" role="status">
          Ambiente de exploração: a classificação real e a entrega de prêmios
          dependem do serviço conectado.
        </p>
      )}
      {unsupported ? (
        <p className="economy-notice" role="status">
          O ranking semanal está indisponível neste ambiente. Você pode
          consultar a classificação geral.
        </p>
      ) : loading ? (
        <LoadingState label="Carregando o ranking…" />
      ) : failure ? (
        <ErrorState
          error={failure}
          retry={() =>
            void (mode === "weekly" ? weekly.refetch() : general.refetch())
          }
        />
      ) : (
        <>
          <section className="ranking-hero panel">
            <div className="ranking-trophy">
              <Trophy size={42} strokeWidth={1.4} aria-hidden="true" />
            </div>
            <div>
              <span className="eyebrow">
                {mode === "weekly" ? "SUA SEMANA" : "SUA POSIÇÃO"}
              </span>
              <h2>
                {mine >= 0
                  ? `Você está na posição #${mine + 1}`
                  : mode === "weekly"
                    ? "Cada desafio conta nesta semana."
                    : "Seu primeiro desafio é o ponto de partida."}
              </h2>
              <p>
                {mode === "weekly"
                  ? current
                    ? `${formatNumber(current.weeklyXp)} XP · ${formatNumber(current.weeklyCompletedCount)} desafios distintos nesta semana. ${current.eligible ? "Você está disputando a premiação." : "Complete pelo menos 3 desafios distintos e some XP positivo para disputar."}`
                    : `A premiação exige uma conta cadastrada, três desafios distintos na semana e XP positivo.${registrationDisabled ? " O cadastro está desativado nesta versão." : ""}`
                  : "As aprovações somam XP e definem sua posição."}
              </p>
              {mode === "weekly" && weekly.data && (
                <p className="weekly-period">
                  <strong>{timeLeft(weekly.data.endsAt, now)}</strong>
                  <br />
                  De {periodDate(weekly.data.startsAt)} até{" "}
                  {periodDate(weekly.data.endsAt)} · horário de Brasília.
                </p>
              )}
            </div>
            <Link to="/desafios" className="button button-primary">
              Ir para os desafios <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="panel leaderboard">
            <div className="leaderboard-heading">
              <h2>
                <UsersRound size={18} aria-hidden="true" />
                Classificação {mode === "weekly" ? "semanal" : "geral"}
              </h2>
              <span>
                {entries?.length ?? 0}{" "}
                {mode === "weekly"
                  ? "participantes elegíveis"
                  : "participantes com progresso"}
              </span>
            </div>
            {!entries?.length ? (
              <EmptyState
                title={
                  mode === "weekly"
                    ? "Nenhum participante elegível nesta semana"
                    : "Nenhuma pontuação registrada"
                }
                description={
                  mode === "weekly"
                    ? "A classificação aparece após três desafios distintos concluídos e XP positivo por uma conta cadastrada."
                    : "As primeiras soluções aprovadas aparecerão aqui, com XP e desafios concluídos."
                }
                icon="code"
              />
            ) : (
              <RankingTable entries={entries} weekly={mode === "weekly"} />
            )}
          </section>
          {mode === "weekly" && (
            <>
              <section
                className="panel weekly-prizes"
                aria-label="Premiação semanal"
              >
                <h2>Prêmios para os cinco primeiros</h2>
                <p>
                  Ao encerrar a semana, cada posição recebe moedas e uma moldura
                  exclusiva permanente. As molduras não estão à venda.
                </p>
                <div className="weekly-prize-grid">
                  {WEEKLY_PRIZES.map((prize) => (
                    <div className="weekly-prize" key={prize.position}>
                      <CosmeticAvatar size={48} frameId={prize.itemId} />
                      <strong>{prize.position}º lugar</strong>
                      <span>
                        <Coins size={16} aria-hidden="true" />
                        {prize.coins} moedas
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section
                className="panel weekly-winners"
                aria-label="Última semana encerrada"
              >
                <h2>Última semana encerrada</h2>
                {weekly.data?.lastCompleted ? (
                  <>
                    <p>
                      De {periodDate(weekly.data.lastCompleted.startsAt)} até{" "}
                      {periodDate(weekly.data.lastCompleted.endsAt)} · horário
                      de Brasília.
                    </p>
                    {weekly.data.lastCompleted.winners.length ? (
                      <ol className="weekly-winner-list">
                        {weekly.data.lastCompleted.winners.map((winner) => (
                          <li key={winner.userId}>
                            <CosmeticAvatar
                              avatarId={winner.avatarId}
                              frameId={winner.itemId}
                              displayName={winner.displayName}
                            />
                            <span>
                              <strong
                                style={{
                                  color: cosmeticNameColor(winner.nameColorId),
                                }}
                              >
                                {winner.position}º · {winner.displayName}
                              </strong>
                              <small>
                                {formatNumber(winner.weeklyXp)} XP ·{" "}
                                {formatNumber(winner.coinsAwarded)} moedas
                                entregues
                              </small>
                            </span>
                            {winner.isCurrentUser && <small>Você</small>}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>
                        Nenhuma conta elegível nesse período; não houve entrega
                        de prêmios.
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    Ainda não há resultados encerrados disponíveis. Os
                    vencedores aparecerão após o fechamento confirmado pelo
                    servidor.
                  </p>
                )}
              </section>
            </>
          )}
        </>
      )}
      <div className="ranking-rules">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Uma competição justa, por princípio.</strong>
          <p>
            {mode === "weekly"
              ? "A semana vai de segunda-feira às 00h até a segunda seguinte, no horário de Brasília. XP líquido conquistado no período define a posição e não altera seu XP total. Empates consideram mais desafios distintos, o instante em que a pontuação foi alcançada e o identificador da conta. Somente contas cadastradas com pelo menos três desafios distintos e XP positivo disputam os prêmios."
              : "XP líquido acumulado define a posição. Empates consideram desafios concluídos e quando a pontuação foi alcançada. Dicas mantêm você no ranking; dinheiro nunca compra XP ou multiplicadores."}
          </p>
        </div>
      </div>
    </div>
  );
}
