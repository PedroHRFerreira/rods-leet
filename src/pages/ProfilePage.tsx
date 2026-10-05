import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  Coins,
  Lightbulb,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import { useSubmissionConfirmation } from "../lib/useSubmissionConfirmation";
import {
  ErrorState,
  formatNumber,
  LoadingState,
  PageHeading,
  ProgressBar,
} from "../components/ui";
import "../editor.css";
import {
  CosmeticAvatar,
  cosmeticNameColor,
  cosmeticTitle,
} from "../components/CosmeticAvatar";
import { DiscordCommunity } from "../components/DiscordCommunity";
import { VisitorProgressCard } from "../components/VisitorProgressCard";

function SubmissionPreferences({ identity }: { identity: string }) {
  const quiz = useSubmissionConfirmation(identity, "quiz");
  const code = useSubmissionConfirmation(identity, "code");
  return (
    <section className="panel account-panel submission-preferences">
      <h2>Confirmação de respostas</h2>
      <p>
        Escolha quando revisar o envio. A preferência vale para seu perfil neste
        navegador.
      </p>
      <label>
        <input
          type="checkbox"
          checked={!quiz.skipConfirmation}
          onChange={(event) => quiz.setSkipConfirmation(!event.target.checked)}
        />
        Pedir confirmação nas perguntas
      </label>
      <label>
        <input
          type="checkbox"
          checked={!code.skipConfirmation}
          onChange={(event) => code.setSkipConfirmation(!event.target.checked)}
        />
        Pedir confirmação no código
      </label>
    </section>
  );
}

export default function ProfilePage() {
  const gateway = useGateway();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => gateway.signOut(),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/");
    },
  });
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
    retry: false,
  });
  if (dashboard.isPending) return <LoadingState />;
  if (dashboard.isError)
    return (
      <div className="profile-page">
        <ErrorState
          error={dashboard.error}
          retry={() => void dashboard.refetch()}
        />
        <div className="profile-error-actions">
          <p>
            Não foi possível carregar seu progresso. Tente novamente; você pode
            continuar consultando os desafios sem login.
          </p>
          <Link className="text-link" to="/desafios">
            Continuar explorando os desafios
          </Link>
        </div>
      </div>
    );
  const data = dashboard.data;
  const registered = data.profile.authenticated && !data.profile.anonymous;
  return (
    <div className="profile-page">
      <PageHeading
        eyebrow="SEU ESPAÇO"
        title="Perfil e progresso"
        description={
          registered
            ? "Seu progresso, suas conquistas e seus itens."
            : "Suas soluções e seu progresso neste navegador."
        }
      />
      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="profile-cover">
            <span />
            <i />
          </div>
          <div className="profile-identity">
            <span className="profile-large-avatar">
              <CosmeticAvatar
                avatarId={data.profile.avatarId}
                frameId={data.profile.frameId}
                displayName={data.profile.displayName}
                size={72}
              />
            </span>
            <span className="profile-level">
              <Award size={14} />
              Nível {data.level}
            </span>
            <h2 style={{ color: cosmeticNameColor(data.profile.nameColorId) }}>
              {data.profile.displayName}
            </h2>
            {cosmeticTitle(data.profile.titleId) && (
              <p className="cosmetic-profile-title">
                {cosmeticTitle(data.profile.titleId)}
              </p>
            )}
            <p>{registered ? "Conta cadastrada" : "Perfil de visitante"}</p>
            <span className="profile-access">
              <span />
              {registered
                ? "Conta gratuita · progresso salvo"
                : "10 desafios grátis antes do cadastro"}
            </span>
          </div>
          <div className="profile-next-level">
            <div>
              <strong>Próximo nível</strong>
              <span>
                {formatNumber(data.xpIntoLevel)} /{" "}
                {formatNumber(data.xpForNextLevel)} XP
              </span>
            </div>
            <ProgressBar
              value={data.xpIntoLevel}
              max={data.xpForNextLevel}
              label="Progresso até o próximo nível"
            />
            <p>Conclua desafios para alcançar o próximo nível.</p>
          </div>
        </section>
        <div className="profile-main">
          <section className="profile-stats">
            {[
              {
                icon: Coins,
                label: "Moedas disponíveis",
                value: formatNumber(data.coins ?? 0),
                className: "gold",
              },
              {
                icon: Zap,
                label: "XP conquistado",
                value: formatNumber(data.xp),
                className: "purple",
              },
              {
                icon: CheckCircle2,
                label: "Desafios concluídos",
                value: formatNumber(data.completedCount),
                className: "cyan",
              },
              {
                icon: Lightbulb,
                label: "Dicas disponíveis",
                value: formatNumber(data.hintBalance),
                className: "gold",
              },
            ].map(({ icon: Icon, label, value, className }) => (
              <div className="panel profile-stat" key={label}>
                <span className={className}>
                  <Icon size={20} />
                </span>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            ))}
          </section>
          {registered ? (
            <section className="panel account-panel">
              <div className="account-section-heading">
                <span className="aside-icon">
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <h2>Sua conta está conectada</h2>
                  <p>
                    Seu progresso, suas moedas e seus itens estão guardados
                    nesta conta.
                  </p>
                </div>
              </div>
              <>
                <button
                  className="button button-secondary"
                  disabled={signOut.isPending}
                  onClick={() => signOut.mutate()}
                >
                  {signOut.isPending ? "Saindo…" : "Sair da conta"}
                </button>
                {signOut.isError && (
                  <p role="alert" className="account-note">
                    {signOut.error.message}
                  </p>
                )}
              </>
            </section>
          ) : (
            <VisitorProgressCard dashboard={data} />
          )}
          <section className="panel account-panel profile-rewards">
            <h2>Estude, conquiste e personalize</h2>
            <p>
              A primeira conclusão de cada desafio rende 10 moedas. Cada nível
              alcançado dá mais 25 moedas. Aos 7 e 30 dias de sequência, você
              recebe 50 e 200 moedas.
            </p>
            <p>
              O nível 5 presenteia você com a Coruja sábia; 30 dias de sequência
              liberam a Chama constante. Outros cosméticos ficam disponíveis na
              loja conforme seu nível. Comprar itens preserva seu XP e sua
              posição no ranking.
            </p>
            <p>
              Contas cadastradas também recebem 20 moedas por três primeiras
              conclusões distintas no dia e 75 por sete na semana. As metas
              começam na publicação desta atualização e usam o horário de
              Brasília.
            </p>
            <Link className="text-link" to="/loja">
              Ver loja e inventário <ArrowUpRight size={15} />
            </Link>
          </section>
          <DiscordCommunity />
          <SubmissionPreferences identity={data.profile.id} />
          <section className="panel profile-practice">
            <div>
              <span className="eyebrow">PRÓXIMO PASSO</span>
              <h2>Continue de onde você está.</h2>
              <p>Encontre um exercício por tópico, dificuldade ou linguagem.</p>
              <Link className="text-link" to="/desafios">
                Encontrar meu próximo desafio <ArrowUpRight size={15} />
              </Link>
            </div>
            <Target size={76} strokeWidth={1} />
          </section>
        </div>
      </div>
      <div className="profile-fairness">
        <ShieldCheck size={17} />
        <p>
          Beta gratuito, rankings geral e semanal e progresso real. Dicas ajudam
          no caminho; recompensas seguem os mesmos critérios para todos.
        </p>
      </div>
    </div>
  );
}
