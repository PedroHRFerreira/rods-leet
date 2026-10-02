import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { challenges } from "../content/catalog";
import { ErrorState, LoadingState, PageHeading } from "../components/ui";
import { useGateway } from "../lib/gateway-context";
import {
  GatewayError,
  type FeedbackCategory,
  type ProductFeedbackInput,
  type ProductFeedbackReceipt,
} from "../lib/contracts";
import {
  FEEDBACK_MAX_LENGTH,
  validateProductFeedback,
} from "../domain/product-feedback";

export default function FeedbackPage() {
  const gateway = useGateway();
  const [params] = useSearchParams();
  const challenge = challenges.find(
    (item) => item.id === params.get("challengeId"),
  );
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
    retry: false,
  });
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [includeChallenge, setIncludeChallenge] = useState(false);
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ProductFeedbackReceipt | null>(null);
  const delivery = useRef<{
    input: ProductFeedbackInput;
    key: string;
    identity: string;
  } | null>(null);
  const sendingRef = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error || receipt) statusRef.current?.focus();
  }, [error, receipt]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(false), 60_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current || receipt || cooldown) return;
    setError("");
    const identity = dashboard.data?.profile.id;
    if (
      !identity ||
      gateway.mode !== "live" ||
      !dashboard.data?.profile.authenticated
    ) {
      setError(
        "Não foi possível conectar sua sessão. Tente conectar novamente antes de enviar.",
      );
      return;
    }
    if (!delivery.current) {
      const result = validateProductFeedback({
        category,
        message,
        contactEmail,
        ...(includeChallenge && challenge ? { challengeId: challenge.id } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      delivery.current = {
        input: result.input,
        key: crypto.randomUUID(),
        identity,
      };
    }
    const snapshot = delivery.current;
    sendingRef.current = true;
    setSending(true);
    try {
      // Verify the current session again before reusing a delivery after a failure.
      const current = await gateway.getDashboard();
      if (
        current.profile.id !== snapshot.identity ||
        !current.profile.authenticated
      ) {
        throw new GatewayError(
          "session_changed",
          "Sua sessão mudou. Recarregue a página antes de enviar outro feedback.",
          409,
        );
      }
      const saved = await gateway.createFeedback(snapshot.input, snapshot.key);
      setReceipt(saved);
      setUncertain(false);
      delivery.current = null;
    } catch (failure) {
      const recoverable =
        !(failure instanceof GatewayError) ||
        failure.status >= 500 ||
        failure.status === 429 ||
        failure.code === "invalid_response" ||
        failure.code === "network_error";
      setUncertain(recoverable);
      if (!recoverable) delivery.current = null;
      if (failure instanceof GatewayError && failure.status === 429)
        setCooldown(true);
      setError(
        failure instanceof GatewayError && failure.code === "network_error"
          ? "Não foi possível confirmar o recebimento. Sua mensagem permanece nesta tela; tente novamente."
          : failure instanceof GatewayError && failure.status === 429
            ? "O limite de envios foi atingido. Aguarde pelo menos um minuto antes de tentar novamente com a mesma mensagem."
            : failure instanceof Error
              ? failure.message
              : "Não foi possível enviar seu feedback. Tente novamente.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (dashboard.isPending)
    return <LoadingState label="Conectando sua sessão…" />;
  return (
    <div className="feedback-page">
      <PageHeading
        eyebrow="FALE COM A GENTE"
        title="Envie seu feedback"
        description="Conte como podemos melhorar sua experiência ou o que você gostou."
      />
      {dashboard.isError && (
        <ErrorState
          error={dashboard.error}
          retry={() => void dashboard.refetch()}
        />
      )}
      {receipt ? (
        <section className="panel account-panel feedback-receipt">
          <div ref={statusRef} tabIndex={-1} role="status">
            <h2>Feedback recebido</h2>
            <p>Sua mensagem foi registrada.</p>
            <p>
              Protocolo: <strong>{receipt.protocol}</strong>
            </p>
          </div>
          <p>Guarde o protocolo para identificar esta mensagem.</p>
          <Link className="button button-secondary" to="/desafios">
            Voltar aos desafios
          </Link>
        </section>
      ) : (
        <section className="panel account-panel">
          {(gateway.mode !== "live" ||
            !dashboard.data?.profile.authenticated) &&
            !dashboard.isError && (
              <div className="feedback-status" role="status">
                <p>
                  O envio de feedback precisa de uma sessão conectada. Você pode
                  continuar explorando os desafios.
                </p>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => void dashboard.refetch()}
                >
                  Tentar conectar novamente
                </button>
                <Link className="text-link" to="/desafios">
                  Explorar desafios
                </Link>
              </div>
            )}
          <form
            className="feedback-form"
            onSubmit={(event) => void submit(event)}
            noValidate
          >
            <fieldset disabled={sending || uncertain}>
              <legend>Seu feedback</legend>
              <div className="feedback-field">
                <label htmlFor="feedback-category">Tipo de feedback</label>
                <select
                  id="feedback-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as FeedbackCategory)
                  }
                >
                  <option value="suggestion">Sugestão</option>
                  <option value="criticism">Crítica</option>
                  <option value="praise">Elogio</option>
                </select>
              </div>
              <div className="feedback-field">
                <label htmlFor="feedback-message">Mensagem</label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                  maxLength={FEEDBACK_MAX_LENGTH}
                  aria-describedby="feedback-message-help"
                  required
                />
                <p id="feedback-message-help">
                  De 10 a 4.000 caracteres.{" "}
                  {message.trim().length.toLocaleString("pt-BR")} / 4.000
                </p>
              </div>
              <div className="feedback-field">
                <label htmlFor="feedback-email">
                  E-mail para contato (opcional)
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  aria-describedby="feedback-email-help"
                />
                <p id="feedback-email-help">
                  Informe apenas se quiser compartilhar um contato. O registro
                  não garante resposta por e-mail.
                </p>
              </div>
              {challenge && (
                <label className="feedback-context">
                  <input
                    type="checkbox"
                    checked={includeChallenge}
                    onChange={(event) =>
                      setIncludeChallenge(event.target.checked)
                    }
                  />
                  Incluir o desafio “{challenge.title}” nesta mensagem
                </label>
              )}
            </fieldset>
            <p>
              Sua mensagem será vinculada à sessão atual. Evite senhas e outros
              dados sensíveis. Anexos e atendimento por e-mail ainda não estão
              disponíveis.
            </p>
            {error && (
              <div
                className="feedback-status error-state"
                role="alert"
                tabIndex={-1}
                ref={statusRef}
              >
                <p>{error}</p>
                {uncertain && (
                  <p>
                    O recebimento ainda não foi confirmado. Tente novamente com
                    a mesma mensagem; os campos ficam preservados para evitar
                    duplicações.
                  </p>
                )}
              </div>
            )}
            <button
              type="submit"
              className="button button-primary"
              disabled={
                sending ||
                cooldown ||
                dashboard.isError ||
                gateway.mode !== "live" ||
                !dashboard.data?.profile.authenticated
              }
            >
              {sending
                ? "Enviando…"
                : uncertain
                  ? "Tentar novamente"
                  : "Enviar feedback"}
            </button>
            {sending && (
              <p role="status">Aguarde a confirmação do recebimento.</p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
