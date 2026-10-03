import { GatewayError } from "./contracts";
import type { GatewayAuth, GatewaySession } from "./gateway";

interface BffAuthOptions {
  fetch?: typeof fetch;
  navigate?: (url: string) => void;
  onSessionChange?: (userId: string | null) => void;
}

/** The browser receives only a CSRF value and identity, never provider credentials. */
export function createBffAuth(options: BffAuthOptions = {}): GatewayAuth {
  const send = options.fetch ?? globalThis.fetch.bind(globalThis);
  let pending: Promise<GatewaySession | null> | undefined;
  let generation = 0;
  let lastUser: string | null | undefined;
  const notify = (id: string | null) => {
    if (lastUser !== id) {
      lastUser = id;
      options.onSessionChange?.(id);
    }
  };
  async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    try {
      const response = await send(path, {
        ...init,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        let code = "authentication_unavailable";
        try {
          const data = await response.json();
          code = typeof data?.error?.code === "string" ? data.error.code : code;
        } catch {
          /* Use generic error. */
        }
        const messages: Record<string, string> = {
          authentication_failed:
            "Não foi possível validar os dados. Confira o e-mail, a senha ou o link de confirmação.",
          invalid_email: "Informe um e-mail válido.",
          invalid_password: "Use uma senha com 10 a 128 caracteres.",
          invalid_display_name: "Use um nome com 2 a 40 caracteres.",
          invalid_confirmation:
            "Este link não é válido. Solicite um novo e-mail.",
          email_confirmation_required:
            "Confirme seu e-mail antes de definir a senha.",
          email_registration_unavailable:
            "Cadastro e recuperação de senha estarão disponíveis em breve. Continue estudando como visitante.",
          rate_limited:
            "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
          provider_unavailable: "Entre com e-mail e senha.",
          account_already_registered:
            "Você já está em uma conta. Saia antes de cadastrar outra.",
        };
        throw new GatewayError(
          code,
          messages[code] ??
            "Não foi possível concluir seu acesso. Tente novamente.",
          response.status,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw new GatewayError(
        "authentication_unavailable",
        "Não foi possível conferir seu acesso. Tente novamente.",
        503,
      );
    }
  }
  const invalidate = () => {
    generation++;
    pending = undefined;
  };
  async function post(path: string, body: unknown, protectedSession = false) {
    const current = protectedSession ? await getSession() : null;
    if (protectedSession && !current)
      throw new GatewayError(
        "authentication_required",
        "Inicie sua sessão de estudo antes de continuar.",
        401,
      );
    return request(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(current ? { "X-CSRF-Token": current.csrf } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  function getSession(): Promise<GatewaySession | null> {
    if (pending) return pending;
    const startedGeneration = generation;
    const job = request("/api/session").then((value) => {
      if (startedGeneration !== generation) return null;
      if (value === null) {
        notify(null);
        return null;
      }
      const data = value as Partial<GatewaySession>;
      if (
        !data ||
        typeof data.user?.id !== "string" ||
        !data.user.id ||
        typeof data.csrf !== "string" ||
        !data.csrf
      ) {
        throw new GatewayError(
          "invalid_session",
          "Não foi possível iniciar sua sessão de estudo. Recarregue a página para tentar novamente.",
          502,
        );
      }
      // Explicit projection prevents any unexpected server fields becoming app state.
      const session = { user: { id: data.user.id }, csrf: data.csrf };
      notify(session.user.id);
      return session;
    });
    pending = job;
    void job
      .finally(() => {
        if (pending === job) pending = undefined;
      })
      .catch(() => undefined);
    return job;
  }
  return {
    getSession,
    async signIn() {
      throw new GatewayError(
        "provider_unavailable",
        "Entre com e-mail e senha.",
        410,
      );
    },
    async signInWithPassword(email, password) {
      await post("/auth/login", { email, password });
      invalidate();
      await getSession();
    },
    async signUp(email, displayName) {
      const result = (await post(
        "/auth/signup",
        { email, displayName },
        true,
      )) as { requiresEmailConfirmation?: unknown };
      if (result.requiresEmailConfirmation !== true)
        throw new GatewayError(
          "invalid_response",
          "Não foi possível confirmar o envio do e-mail.",
          502,
        );
      return { requiresEmailConfirmation: true };
    },
    async requestPasswordReset(email) {
      await post("/auth/recover", { email });
    },
    async confirmEmail(tokenHash, type) {
      await post("/auth/confirm", { tokenHash, type });
      invalidate();
      await getSession();
    },
    async updatePassword(password) {
      await post("/auth/password", { password }, true);
      invalidate();
      await getSession();
    },
    async signOut() {
      const current = await getSession();
      if (current)
        await request("/auth/logout", {
          method: "POST",
          headers: { "X-CSRF-Token": current.csrf },
        });
      generation++;
      pending = undefined;
      notify(null);
    },
  };
}
