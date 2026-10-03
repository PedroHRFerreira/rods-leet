import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import type { EmailConfirmationType } from "../lib/contracts";
import { PageHeading } from "../components/ui";

type AccessMode = "login" | "signup" | "recovery";
// Keep the one-time link only in memory across the initial identity remount.
// The address is cleaned immediately; credentials never enter persistent storage.
let pendingConfirmation: {
  tokenHash: string;
  type: EmailConfirmationType;
} | null = null;

export default function AuthPage() {
  const gateway = useGateway();
  const queryClient = useQueryClient();
  const location = useLocation();
  const confirmRoute = location.pathname === "/conta/confirmar";
  const passwordRoute = location.pathname === "/conta/senha";
  const [confirmation] = useState(() => {
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (!confirmRoute) {
      pendingConfirmation = null;
      return null;
    }
    if (
      tokenHash &&
      ["signup", "email_change", "recovery"].includes(type ?? "")
    ) {
      pendingConfirmation = { tokenHash, type: type as EmailConfirmationType };
    }
    return pendingConfirmation;
  });
  const [mode, setMode] = useState<AccessMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const demo = gateway.mode === "demo";
  const emailRegistrationEnabled =
    import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED !== "false";
  const registrationUnavailable =
    !emailRegistrationEnabled &&
    !confirmRoute &&
    !passwordRoute &&
    mode !== "login";

  useEffect(() => {
    if (confirmRoute) window.history.replaceState(null, "", "/conta/confirmar");
  }, [confirmRoute]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo || registrationUnavailable || inFlight.current) return;
    setError("");
    setNotice("");
    if (
      (passwordRoute || (!confirmRoute && mode === "login")) &&
      (password.length < 10 || password.length > 128)
    ) {
      setError("Use uma senha com 10 a 128 caracteres.");
      return;
    }
    if (passwordRoute && password !== repeatedPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    if (
      !confirmRoute &&
      !passwordRoute &&
      mode === "signup" &&
      name.trim().length < 2
    ) {
      setError("Informe um nome com 2 a 40 caracteres.");
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      if (confirmRoute) {
        if (!confirmation)
          throw new Error(
            "Este link está incompleto. Solicite um novo e-mail.",
          );
        await gateway.confirmEmail(confirmation.tokenHash, confirmation.type);
        pendingConfirmation = null;
        window.location.replace("/conta/senha");
      } else if (passwordRoute) {
        await gateway.updatePassword(password);
        setPassword("");
        setRepeatedPassword("");
        await queryClient.cancelQueries();
        queryClient.clear();
        window.location.replace("/perfil");
      } else if (mode === "login") {
        await gateway.signInWithPassword(email.trim(), password);
        setPassword("");
        await queryClient.cancelQueries();
        queryClient.clear();
        window.location.replace("/perfil");
      } else if (mode === "signup") {
        await gateway.signUp(email.trim(), name.trim());
        setNotice(
          "Enviamos um link para confirmar seu e-mail. Abra o link e confirme o acesso; depois você definirá sua senha. Ao cadastrar esta sessão, seu progresso de visitante será preservado.",
        );
      } else {
        await gateway.requestPasswordReset(email.trim());
        setNotice(
          "Se este e-mail tiver uma conta, você receberá um link para recuperar o acesso. Confira também a pasta de spam.",
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const title = confirmRoute
    ? "Confirme seu e-mail"
    : passwordRoute
      ? "Defina sua senha"
      : "Sua conta de estudo";
  const buttonLabel = confirmRoute
    ? "Confirmar e continuar"
    : passwordRoute
      ? "Salvar senha"
      : mode === "login"
        ? "Entrar"
        : mode === "signup"
          ? "Enviar confirmação"
          : "Enviar link de recuperação";

  return (
    <div className="economy-page economy-auth-page">
      <PageHeading
        eyebrow="SEU ACESSO"
        title={title}
        description="Guarde suas conquistas e personalize seu espaço com moedas ganhas estudando."
      />
      <section className="panel economy-auth-panel" aria-label="Acesso à conta">
        <span className="economy-auth-icon" aria-hidden="true">
          <ShieldCheck size={28} />
        </span>
        {demo && (
          <p className="economy-notice" role="status">
            O acesso por e-mail está indisponível neste ambiente de exploração.
            Você pode conhecer os desafios e a loja; cadastro e compras exigem o
            serviço conectado.
          </p>
        )}
        {!demo && !emailRegistrationEnabled && (
          <p className="economy-notice" role="status">
            Cadastro e recuperação de senha estarão disponíveis em breve.
            Continue estudando como visitante: suas moedas e conquistas ficam
            guardadas nesta sessão.
          </p>
        )}
        {!confirmRoute && !passwordRoute && (
          <div className="economy-auth-tabs" aria-label="Escolha como acessar">
            {(
              [
                ["login", "Entrar"],
                ["signup", "Criar conta"],
                ["recovery", "Recuperar senha"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={`economy-filter ${mode === value ? "active" : ""}`}
                aria-pressed={mode === value}
                disabled={pending}
                onClick={() => {
                  setMode(value);
                  setError("");
                  setNotice("");
                  setPassword("");
                  setRepeatedPassword("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <form
          className="economy-auth-form"
          onSubmit={(event) => void submit(event)}
          aria-busy={pending}
        >
          {confirmRoute ? (
            <p>
              {confirmation
                ? "Confirme que você abriu este link para continuar. Na próxima etapa, você poderá definir sua senha."
                : "O link de confirmação está incompleto ou já foi aberto nesta página. Abra novamente o link recebido por e-mail ou solicite outro."}
            </p>
          ) : passwordRoute ? (
            <p>
              Após confirmar seu e-mail, escolha uma senha com 10 a 128
              caracteres.
            </p>
          ) : mode === "signup" ? (
            <p>
              Primeiro confirme seu e-mail; depois crie sua senha. O cadastro
              preserva o progresso desta sessão de visitante.
            </p>
          ) : mode === "recovery" ? (
            <p>Informe seu e-mail para receber as instruções de recuperação.</p>
          ) : (
            <p>
              Entre com seu e-mail e senha. Entrar em uma conta existente abre o
              progresso dela; o progresso de visitante desta sessão não é
              mesclado.
            </p>
          )}
          {!confirmRoute && !passwordRoute && mode === "signup" && (
            <label htmlFor="account-name">
              Nome de usuário
              <input
                id="account-name"
                name="displayName"
                autoComplete="nickname"
                minLength={2}
                maxLength={40}
                required
                value={name}
                disabled={pending || demo || registrationUnavailable}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          {!confirmRoute && !passwordRoute && (
            <label htmlFor="account-email">
              E-mail
              <input
                id="account-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                disabled={pending || demo || registrationUnavailable}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {(passwordRoute || (!confirmRoute && mode === "login")) && (
            <label htmlFor="account-password">
              {passwordRoute ? "Nova senha" : "Senha"}
              <input
                id="account-password"
                name="password"
                type="password"
                autoComplete={
                  passwordRoute ? "new-password" : "current-password"
                }
                minLength={10}
                maxLength={128}
                required
                value={password}
                disabled={pending || demo}
                onChange={(event) => setPassword(event.target.value)}
              />
              <small>Use de 10 a 128 caracteres.</small>
            </label>
          )}
          {passwordRoute && (
            <label htmlFor="account-repeat-password">
              Repita a nova senha
              <input
                id="account-repeat-password"
                name="repeatPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={repeatedPassword}
                disabled={pending || demo}
                onChange={(event) => setRepeatedPassword(event.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="economy-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="economy-notice" role="status">
              <Mail size={18} aria-hidden="true" />
              {notice}
            </p>
          )}
          <button
            className="button button-primary"
            type="submit"
            disabled={
              pending ||
              demo ||
              registrationUnavailable ||
              (confirmRoute && !confirmation)
            }
          >
            {pending ? (
              <>
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
                Aguarde…
              </>
            ) : (
              buttonLabel
            )}
          </button>
        </form>
        {(confirmRoute || passwordRoute) && (
          <Link className="text-link" to="/conta">
            Voltar ao acesso da conta
          </Link>
        )}
        <Link className="text-link" to="/desafios">
          Continuar explorando sem login
        </Link>
      </section>
    </div>
  );
}
