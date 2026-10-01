import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  Target,
  UserRound,
  Zap,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import {
  ErrorState,
  formatNumber,
  LoadingState,
  PageHeading,
  ProgressBar,
} from "../components/ui";
import "../editor.css";

export default function ProfilePage() {
  const gateway = useGateway();
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
  return (
    <div className="profile-page">
      <PageHeading
        eyebrow="SEU ESPAÇO"
        title="Perfil e progresso"
        description="Suas soluções e seu progresso neste navegador."
      />
      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="profile-cover">
            <span />
            <i />
          </div>
          <div className="profile-identity">
            <span className="profile-large-avatar">
              {data.profile.displayName
                .charAt(0)
                .toLocaleUpperCase("pt-BR") || <UserRound size={32} />}
            </span>
            <span className="profile-level">
              <Award size={14} />
              Nível {data.level}
            </span>
            <h2>{data.profile.displayName}</h2>
            <p>
              {data.profile.authenticated && !data.profile.anonymous
                ? "Conta GitHub conectada"
                : "Perfil anônimo"}
            </p>
            <span className="profile-access">
              <span />
              Beta aberto · sem login obrigatório
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
          <section className="panel account-panel">
            <div className="account-section-heading">
              <span className="aside-icon">
                <ShieldCheck size={21} />
              </span>
              <div>
                <h2>Progresso neste navegador</h2>
                <p>
                  Você pode praticar sem criar uma conta. Sua sessão identifica
                  seu progresso neste navegador.
                </p>
              </div>
            </div>
            <p className="account-note">
              Apagar os dados do site ou usar outro navegador pode fazer você
              perder o acesso ao progresso desta sessão. Neste beta, não há
              recuperação de perfil anônimo entre dispositivos.
            </p>
          </section>
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
          Beta gratuito, ranking único e progresso real. Dicas ajudam no
          caminho; recompensas seguem os mesmos critérios para todos.
        </p>
      </div>
    </div>
  );
}
