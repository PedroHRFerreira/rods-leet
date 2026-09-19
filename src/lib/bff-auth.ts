import { GatewayError } from "./contracts";
import type { GatewayAuth, GatewaySession } from "./gateway";

interface BffAuthOptions {
  fetch?: typeof fetch;
  navigate?: (url: string) => void;
  onSessionChange?: (userId: string | null) => void;
}
const AUTHORIZATION_URL =
  "https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize";

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
      if (!response.ok) throw new Error("Request failed");
      return await response.json();
    } catch {
      throw new GatewayError(
        "authentication_unavailable",
        "Não foi possível conferir seu acesso. Tente novamente.",
        503,
      );
    }
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
          "Não foi possível conferir seu acesso. Entre novamente.",
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
    async signIn(provider) {
      if (provider !== "github")
        throw new GatewayError(
          "invalid_provider",
          "Escolha uma forma de acesso disponível.",
          400,
        );
      const data = (await request("/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })) as { url?: unknown };
      let url: URL;
      try {
        url = new URL(typeof data?.url === "string" ? data.url : "");
      } catch {
        throw new GatewayError(
          "invalid_redirect",
          "Não foi possível iniciar o acesso.",
          502,
        );
      }
      if (
        url.origin + url.pathname !== AUTHORIZATION_URL ||
        url.username ||
        url.password ||
        url.hash
      ) {
        throw new GatewayError(
          "invalid_redirect",
          "Não foi possível iniciar o acesso.",
          502,
        );
      }
      (options.navigate ?? ((target) => window.location.assign(target)))(
        url.href,
      );
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
