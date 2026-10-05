import { useId } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import type { Dashboard } from "../lib/contracts";

export const VISITOR_CHALLENGE_LIMIT = 10;

export function VisitorProgressCard({
  dashboard,
  blocked = false,
}: {
  dashboard: Dashboard;
  blocked?: boolean;
}) {
  const titleId = useId();
  const location = useLocation();
  const count = blocked
    ? Math.max(
        VISITOR_CHALLENGE_LIMIT,
        new Set(dashboard.completedChallengeIds).size,
      )
    : new Set(dashboard.completedChallengeIds).size;
  const remaining = Math.max(0, VISITOR_CHALLENGE_LIMIT - count);
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const atLimit = blocked || remaining === 0;
  return (
    <section
      className={`panel visitor-progress-card${atLimit ? " is-limit" : ""}`}
      aria-labelledby={titleId}
      role={blocked ? "alert" : undefined}
    >
      <div className="visitor-progress-heading">
        <span className="visitor-progress-icon">
          <Trophy size={24} aria-hidden="true" />
        </span>
        <div>
          <span className="eyebrow">SEU PROGRESSO MERECE CONTINUAR</span>
          <h2 id={titleId}>
            {atLimit
              ? "10 desafios concluídos. Seu próximo passo é criar uma conta."
              : "Transforme suas conquistas em uma jornada."}
          </h2>
          <p>
            {atLimit
              ? "Entre ou crie sua conta gratuita para avançar para novos desafios. Você ainda pode revisar os que já concluiu."
              : "Experimente 10 desafios sem cadastro. Com uma conta gratuita, você continua sua trilha e guarda o progresso para voltar quando quiser."}
          </p>
        </div>
      </div>
      <div className="visitor-progress-summary">
        <strong>
          {Math.min(count, VISITOR_CHALLENGE_LIMIT)} de 10 desafios concluídos
        </strong>
        <span>
          {atLimit
            ? "Entre para liberar os próximos desafios"
            : `${remaining} ${remaining === 1 ? "desafio disponível" : "desafios disponíveis"} antes do cadastro`}
        </span>
        <progress
          value={Math.min(count, VISITOR_CHALLENGE_LIMIT)}
          max={VISITOR_CHALLENGE_LIMIT}
          aria-label="Desafios concluídos como visitante"
        />
      </div>
      <ul className="visitor-progress-benefits">
        <li>
          <ShieldCheck size={19} aria-hidden="true" />
          <span>Guarde seu XP, suas moedas e suas conquistas na conta.</span>
        </li>
        <li>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>
            Continue a trilha e consulte seu progresso em outros dispositivos.
          </span>
        </li>
        <li>
          <Coins size={19} aria-hidden="true" />
          <span>
            Libere a loja, itens equipáveis e recompensas das metas de estudo.
          </span>
        </li>
      </ul>
      <div className="visitor-progress-actions">
        <Link
          className="button button-primary"
          to={`/conta?mode=signup&returnTo=${returnTo}`}
        >
          Criar conta e guardar progresso{" "}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link
          className="button button-secondary"
          to={`/conta?mode=login&returnTo=${returnTo}`}
        >
          Já tenho uma conta
        </Link>
      </div>
      <p className="visitor-progress-note">
        Gratuito. Seu progresso de visitante acompanha o cadastro feito nesta
        sessão.
      </p>
    </section>
  );
}
