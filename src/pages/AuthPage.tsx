import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  LoaderCircle,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import type { EmailConfirmationType } from "../lib/contracts";
import { GatewayError } from "../lib/contracts";

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
  const params = new URLSearchParams(location.search);
  const requestedReturn = params.get("returnTo");
  const returnTo =
    requestedReturn &&
    requestedReturn.startsWith("/") &&
    !requestedReturn.startsWith("//") &&
    !Array.from(requestedReturn).some(
      (char) => char === "\\" || char.charCodeAt(0) <= 32,
    )
      ? requestedReturn
      : "/perfil";
  const [mode, setMode] = useState<AccessMode>(
    params.get("mode") === "signup"
      ? "signup"
      : params.get("mode") === "recovery" &&
          import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED !== "false"
        ? "recovery"
        : "login",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState(() =>
    new URLSearchParams(location.search).get("authError") === "google"
      ? "Não foi possível entrar com Google. Tente novamente."
      : "",
  );
  const [notice, setNotice] = useState("");
  const demo = gateway.mode === "demo";
  const emailRegistrationEnabled =
    import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED !== "false";
  const googleLoginEnabled =
    !demo && import.meta.env.VITE_GOOGLE_LOGIN_ENABLED !== "false";
  const registrationUnavailable =
    !emailRegistrationEnabled &&
    !confirmRoute &&
    !passwordRoute &&
    mode !== "login";

  useEffect(() => {
    if (confirmRoute)
      window.history.replaceState(
        null,
        "",
        `/conta/confirmar?returnTo=${encodeURIComponent(returnTo)}`,
      );
  }, [confirmRoute, returnTo]);

  async function signInWithGoogle() {
    if (!googleLoginEnabled || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setGooglePending(true);
    setError("");
    setNotice("");
    try {
      await gateway.signIn(
        "google",
        returnTo,
        mode === "signup" ? "upgrade" : "login",
      );
    } catch (failure) {
      // Never display provider messages or callback parameters in the page.
      setError(
        failure instanceof GatewayError
          ? failure.message
          : "Não foi possível entrar com Google. Tente novamente.",
      );
      inFlight.current = false;
      setPending(false);
      setGooglePending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo || registrationUnavailable || inFlight.current) return;
    setError("");
    setNotice("");
    if (
      (passwordRoute || (!confirmRoute && mode === "login")) &&
      (password.length < (passwordRoute ? 10 : 1) || password.length > 128)
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
        window.location.replace(
          `/conta/senha?returnTo=${encodeURIComponent(returnTo)}`,
        );
      } else if (passwordRoute) {
        await gateway.updatePassword(password);
        setPassword("");
        setRepeatedPassword("");
        await queryClient.cancelQueries();
        queryClient.clear();
        window.location.replace(returnTo);
      } else if (mode === "login") {
        await gateway.signInWithPassword(email.trim(), password);
        setPassword("");
        await queryClient.cancelQueries();
        queryClient.clear();
        window.location.replace(returnTo);
      } else if (mode === "signup") {
        await gateway.signUp(email.trim(), name.trim(), returnTo);
        setNotice(
          "Enviamos um link para confirmar seu e-mail. Abra o link e confirme o acesso; depois você definirá sua senha. Ao cadastrar esta sessão, seu progresso de visitante será preservado.",
        );
      } else {
        await gateway.requestPasswordReset(email.trim(), returnTo);
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
      : mode === "signup"
        ? "Guarde cada conquista"
        : mode === "recovery"
          ? "Recupere seu acesso"
          : "Acesse sua conta";
  const buttonLabel = confirmRoute
    ? "Confirmar e continuar"
    : passwordRoute
      ? "Salvar senha"
      : mode === "login"
        ? "Entrar"
        : mode === "signup"
          ? "Enviar confirmação"
          : "Enviar link de recuperação";

  const emailForm = (
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
          Após confirmar seu e-mail, escolha uma senha com 10 a 128 caracteres.
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
          progresso dela; o progresso de visitante desta sessão não é mesclado.
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
        <label className="auth-password-field" htmlFor="account-password">
          {passwordRoute ? "Nova senha" : "Senha"}
          <input
            id="account-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={passwordRoute ? "new-password" : "current-password"}
            minLength={passwordRoute ? 10 : 1}
            maxLength={128}
            required
            value={password}
            disabled={pending || demo}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="auth-password-toggle"
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
          {passwordRoute && <small>Use de 10 a 128 caracteres.</small>}
        </label>
      )}
      {passwordRoute && (
        <label htmlFor="account-repeat-password">
          Repita a nova senha
          <input
            id="account-repeat-password"
            name="repeatPassword"
            type={showPassword ? "text" : "password"}
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
  );

  return (
    <div className="economy-page economy-auth-page">
      <div className="auth-shell">
        <section
          className="panel economy-auth-panel auth-form-panel"
          aria-label="Acesso à conta"
        >
          <Link className="auth-brand" to="/desafios">
            rods<span>leet</span>
          </Link>
          <header className="auth-heading">
            <h1>{title}</h1>
            <p>
              {mode === "signup"
                ? "Seu progresso merece acompanhar você. Crie sua conta e continue de onde parou."
                : mode === "recovery"
                  ? "Volte aos seus desafios com segurança."
                  : "Continue seus desafios e acompanhe sua evolução."}
            </p>
          </header>
          <span className="economy-auth-icon" aria-hidden="true">
            <ShieldCheck size={28} />
          </span>
          {demo && (
            <p className="economy-notice" role="status">
              O acesso por e-mail está indisponível neste ambiente de
              exploração. Você pode conhecer os desafios e a loja; cadastro e
              compras exigem o serviço conectado.
            </p>
          )}
          {!demo && !emailRegistrationEnabled && !googleLoginEnabled && (
            <p className="economy-notice" role="status">
              Cadastro por e-mail e recuperação de senha estarão disponíveis em
              breve. Continue estudando como visitante: suas moedas e conquistas
              ficam guardadas nesta sessão.
            </p>
          )}
          {!confirmRoute &&
            !passwordRoute &&
            (emailRegistrationEnabled || googleLoginEnabled) && (
              <div
                className="economy-auth-tabs"
                aria-label="Escolha como acessar"
              >
                {(
                  [
                    ["login", "Entrar"],
                    ["signup", "Criar conta"],
                    ["recovery", "Recuperar senha"],
                  ] as const
                )
                  .filter(
                    ([value]) =>
                      value !== "recovery" || emailRegistrationEnabled,
                  )
                  .map(([value, label]) => (
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
          {googleLoginEnabled &&
            !confirmRoute &&
            !passwordRoute &&
            mode !== "recovery" && (
              <div className="economy-auth-google">
                <button
                  className="button button-primary"
                  type="button"
                  disabled={pending}
                  onClick={() => void signInWithGoogle()}
                >
                  {googlePending ? (
                    <LoaderCircle
                      className="spin"
                      size={18}
                      aria-hidden="true"
                    />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.36ZM12 22c2.7 0 4.96-.89 6.62-2.41l-3.24-2.51c-.89.6-2.03.96-3.38.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22ZM6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59ZM12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"
                      />
                    </svg>
                  )}
                  {googlePending
                    ? "Redirecionando…"
                    : mode === "signup"
                      ? "Criar conta com Google"
                      : "Continuar com Google"}
                </button>
                <p>
                  {mode === "signup"
                    ? "Ao criar sua conta, o progresso desta sessão acompanha você."
                    : "Entre para acessar as conquistas da sua conta. Para guardar o progresso de visitante, escolha Criar conta."}
                </p>
                {emailRegistrationEnabled && (
                  <span className="economy-auth-divider">
                    ou use seu e-mail
                  </span>
                )}
              </div>
            )}
          {error && (
            <p className="economy-error" role="alert">
              {error}
            </p>
          )}
          {!emailRegistrationEnabled && !confirmRoute && !passwordRoute ? (
            <>
              {mode === "login" && (
                <details className="economy-auth-password-access">
                  <summary>Já tenho uma conta com senha</summary>
                  {emailForm}
                </details>
              )}
              <p className="auth-email-availability">
                Por enquanto, novas contas são criadas com Google. Cadastro por
                e-mail e recuperação de senha estarão disponíveis em breve. Se
                você já tem uma senha, pode usá-la para entrar.
              </p>
            </>
          ) : (
            emailForm
          )}
          {(confirmRoute || passwordRoute) && (
            <Link className="text-link" to="/conta">
              Voltar ao acesso da conta
            </Link>
          )}
          <Link className="text-link" to="/desafios">
            Continuar explorando sem login
          </Link>
        </section>
        <aside
          className="auth-visual-panel"
          aria-label="Benefícios da sua conta"
        >
          <span className="auth-visual-badge">
            <ShieldCheck size={18} aria-hidden="true" /> Seu próximo passo
          </span>
          <div className="auth-visual-orbit" aria-hidden="true">
            <Trophy size={72} />
          </div>
          <h2>
            Uma conquista de cada vez.
            <br />
            Todas com você.
          </h2>
          <p>
            Resolva desafios, acompanhe sua evolução e transforme a prática em
            consistência.
          </p>
          <ul>
            <li>Histórico das suas soluções</li>
            <li>Conquistas e moedas guardadas</li>
            <li>Seu progresso em qualquer dispositivo</li>
          </ul>
          <div className="auth-visual-progress">
            <span>10 desafios para experimentar</span>
            <ArrowRight size={18} aria-hidden="true" />
            <strong>Uma conta para continuar</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
