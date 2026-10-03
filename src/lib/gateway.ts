import { challenges } from "../content/catalog";
import type {
  AppGateway,
  ChallengeFilters,
  Dashboard,
  DraftInput,
  LanguageId,
  PublicChallenge,
  ExecutionStatusResult,
  TutorConversation,
  UserProfile,
  AuthResult,
  EmailConfirmationType,
  ShopState,
  WeeklyRankingState,
} from "./contracts";
import { GatewayError } from "./contracts";
import { parsePublicSubmission } from "./submission-validation";
import { validateProductFeedback } from "../domain/product-feedback";
import { guestShop, studyPeriods } from "../domain/economy";

export interface GatewaySession {
  user: { id: string };
  csrf: string;
}
export interface GatewayAuth {
  getSession(): Promise<GatewaySession | null>;
  signIn(provider: "github"): Promise<void>;
  signOut(): Promise<void>;
  signInWithPassword?(email: string, password: string): Promise<void>;
  signUp?(email: string, displayName: string): Promise<AuthResult>;
  requestPasswordReset?(email: string): Promise<void>;
  updatePassword?(password: string): Promise<void>;
  confirmEmail?(tokenHash: string, type: EmailConfirmationType): Promise<void>;
}
export interface GatewayOptions {
  auth?: GatewayAuth;
  fetch?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  onSignOut?: () => void;
}
interface LocalDraft {
  draft: DraftInput;
  dirty: boolean;
}
type DashboardResponse = Omit<Dashboard, "profile"> & {
  profile: Omit<UserProfile, "authenticated"> & {
    authenticated?: boolean;
    /** Compatibility with API deployments before open GitHub access. */
    invited?: boolean;
  };
};
const clone = <T>(value: T): T => structuredClone(value);

function normalizeDashboard(value: DashboardResponse): Dashboard {
  const { invited, ...profile } = value.profile;
  return {
    ...value,
    profile: {
      ...profile,
      authenticated: profile.authenticated ?? invited ?? false,
    },
  };
}

export function guestDashboard(): Dashboard {
  return {
    profile: { id: "guest", displayName: "Explorador", authenticated: false },
    xp: 0,
    coins: 0,
    level: 0,
    xpIntoLevel: 0,
    xpForNextLevel: 150,
    completedCount: 0,
    hintBalance: 1,
    streakDays: 0,
    completedChallengeIds: [],
    activityDays: [],
    recentSubmissions: [],
    recommendations: [
      {
        challengeId: "concept-values",
        reason:
          "Comece do zero com perguntas simples para conhecer os conceitos antes de escrever código.",
      },
      {
        challengeId: "balanced-brackets",
        reason: "Experimente uma estrutura de dados em um problema prático.",
      },
      {
        challengeId: "sql-active-orders",
        reason: "Explore consultas com PostgreSQL.",
      },
    ],
    remoteRunsRemaining: null,
    tutorMessagesRemaining: 2,
    executionStatus: "unconfigured",
  };
}
function filterCatalog(filters?: ChallengeFilters): PublicChallenge[] {
  return clone(
    challenges
      .filter(
        (c) =>
          (!filters?.topicId || filters.topicId === c.topicId) &&
          (!filters?.difficulty || filters.difficulty === c.difficulty) &&
          (!filters?.languageId ||
            c.kind === "quiz" ||
            c.languageIds.includes(filters.languageId)) &&
          (!filters?.mode || filters.mode === "normal") &&
          (!filters?.search ||
            `${c.title} ${c.description}`
              .toLocaleLowerCase("pt-BR")
              .includes(filters.search.toLocaleLowerCase("pt-BR"))),
      )
      .map((c) => ({
        ...c,
        availableModes: ["normal"],
        executionAvailable: false,
      })),
  );
}

export function createGateway(options: GatewayOptions = {}): AppGateway {
  const live = Boolean(options.auth);
  const send = options.fetch ?? globalThis.fetch.bind(globalThis);
  const revisions = new Map<string, number>();
  const ownRevisionBases = new Map<string, Set<number>>();
  const pendingSaves = new Map<string, Promise<DraftInput>>();
  const draftKey = (user: string, challenge: string, language: string) =>
    `codegamer:draft:v1:${encodeURIComponent(user)}:${encodeURIComponent(challenge)}:${language}`;
  const session = async () => {
    try {
      return live ? await options.auth!.getSession() : null;
    } catch {
      throw new GatewayError(
        "authentication_unavailable",
        "Não foi possível iniciar sua sessão de estudo. Tente novamente.",
        503,
      );
    }
  };
  async function authAction<T>(
    action: (() => Promise<T>) | undefined,
  ): Promise<T> {
    if (!live || !action)
      throw new GatewayError(
        "authentication_unconfigured",
        "O login por e-mail ainda não está configurado neste ambiente.",
        503,
      );
    try {
      return await action();
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw new GatewayError(
        "authentication_failed",
        "Não foi possível concluir o acesso à conta. Tente novamente.",
        503,
      );
    }
  }
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
    knownSession?: GatewaySession | null,
  ): Promise<T> {
    const current = knownSession === undefined ? await session() : knownSession;
    if (!current)
      throw new GatewayError(
        "authentication_required",
        "Não foi possível iniciar sua sessão de estudo. Recarregue a página para tentar novamente.",
        401,
      );
    if (!live)
      throw new GatewayError(
        "executor_unavailable",
        "A avaliação remota ainda não está disponível. Seu código continua salvo.",
        503,
      );
    let response: Response;
    try {
      response = await send(`/api${path}`, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          ...(method === "GET" ? {} : { "X-CSRF-Token": current.csrf }),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new GatewayError(
        "network_error",
        "Não foi possível conectar. Seu código permanece salvo; tente novamente.",
        503,
      );
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new GatewayError(
        "invalid_response",
        "O serviço respondeu de forma inesperada. Tente novamente.",
        502,
      );
    }
    if (!response.ok) {
      const failure = data as { error?: { code?: string; message?: string } };
      throw new GatewayError(
        failure.error?.code ?? "service_error",
        failure.error?.message ?? "Não foi possível concluir esta ação.",
        response.status,
      );
    }
    return data as T;
  }
  function readLocal(key: string): LocalDraft | null {
    try {
      const raw = options.storage?.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LocalDraft;
      if (
        !parsed.draft ||
        !Array.isArray(parsed.draft.files) ||
        !parsed.draft.files.every(
          (f) => typeof f.path === "string" && typeof f.content === "string",
        )
      )
        return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function writeLocal(key: string, value: LocalDraft) {
    if (!options.storage) return;
    try {
      options.storage.setItem(key, JSON.stringify(value));
    } catch {
      throw new GatewayError(
        "draft_storage_full",
        "Não foi possível salvar neste navegador. Copie seu código antes de sair.",
        507,
      );
    }
  }
  const draftPath = (challengeId: string, languageId: LanguageId) =>
    `/drafts?${new URLSearchParams({ challengeId, languageId })}`;
  async function saveDraft(input: DraftInput, resolveConflict = false) {
    const current = await session();
    const key = draftKey(
      current?.user.id ?? "guest",
      input.challengeId,
      input.languageId,
    );
    const snapshot = clone(input);
    const previous = pendingSaves.get(key) ?? Promise.resolve();
    // Keep every edit locally even when a previous remote save failed.
    const inputRevision = input.revision ?? 0;
    const localRevision = ownRevisionBases.get(key)?.has(inputRevision)
      ? (revisions.get(key) ?? inputRevision)
      : inputRevision;
    writeLocal(key, {
      draft: { ...snapshot, revision: localRevision },
      dirty: Boolean(current),
    });
    const job = previous
      .catch(() => undefined)
      .then(async () => {
        const suppliedRevision = snapshot.revision ?? 0;
        const revision = revisions.get(key) ?? suppliedRevision;
        let draft = { ...snapshot, revision };
        if (!current) {
          writeLocal(key, { draft, dirty: false });
          return draft;
        }
        const latestSession = await session();
        if (latestSession?.user.id !== current.user.id)
          throw new GatewayError(
            "session_changed",
            "Sua conta mudou. Seu rascunho permanece salvo na conta anterior.",
            409,
          );
        if (
          !resolveConflict &&
          suppliedRevision !== revision &&
          !ownRevisionBases.get(key)?.has(suppliedRevision)
        ) {
          throw new GatewayError(
            "draft_conflict",
            "Existe uma versão mais recente. Seu código foi preservado; escolha qual versão manter.",
            409,
          );
        }
        if (resolveConflict) {
          const remote = await request<DraftInput | null>(
            draftPath(input.challengeId, input.languageId),
            "GET",
            undefined,
            undefined,
            latestSession,
          );
          draft = { ...draft, revision: remote?.revision ?? 0 };
        }
        const saved = await request<{
          saved: boolean;
          revision: number;
          updatedAt: string;
        }>("/drafts", "PUT", draft, undefined, latestSession);
        const bases = ownRevisionBases.get(key) ?? new Set<number>();
        bases.add(suppliedRevision);
        bases.add(draft.revision);
        ownRevisionBases.set(key, bases);
        revisions.set(key, saved.revision);
        const local = readLocal(key);
        // Do not replace edits queued while this network request was in progress.
        if (
          local?.draft.updatedAt === snapshot.updatedAt &&
          JSON.stringify(local.draft.files) === JSON.stringify(snapshot.files)
        ) {
          writeLocal(key, {
            draft: {
              ...draft,
              revision: saved.revision,
              updatedAt: saved.updatedAt,
            },
            dirty: false,
          });
        } else if (local) {
          writeLocal(key, {
            draft: { ...local.draft, revision: saved.revision },
            dirty: true,
          });
        }
        return {
          ...draft,
          revision: saved.revision,
          updatedAt: saved.updatedAt,
        };
      });
    pendingSaves.set(key, job);
    try {
      return await job;
    } finally {
      if (pendingSaves.get(key) === job) pendingSaves.delete(key);
    }
  }
  return {
    mode: live ? "live" : "demo",
    async listChallenges(filters) {
      const current = await session();
      if (!current) return filterCatalog(filters);
      const query = new URLSearchParams(
        Object.entries(filters ?? {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      );
      const items = await request<PublicChallenge[]>(
        `/challenges${query.size ? `?${query}` : ""}`,
        "GET",
        undefined,
        undefined,
        current,
      );
      return items.filter(
        (c) =>
          !filters?.mode ||
          (c.availableModes ?? ["normal"]).includes(filters.mode),
      );
    },
    async getChallenge(idOrSlug) {
      const publicChallenge = () => {
        const c = filterCatalog().find(
          (item) => item.id === idOrSlug || item.slug === idOrSlug,
        );
        if (!c)
          throw new GatewayError(
            "challenge_not_found",
            "Este desafio não foi encontrado.",
            404,
          );
        return c;
      };
      const current = await session();
      if (!current) return publicChallenge();
      return await request(
        `/challenges/${encodeURIComponent(idOrSlug)}`,
        "GET",
        undefined,
        undefined,
        current,
      );
    },
    async getDashboard() {
      const current = await session();
      if (!current) return guestDashboard();
      return normalizeDashboard(
        await request<DashboardResponse>(
          "/dashboard",
          "GET",
          undefined,
          undefined,
          current,
        ),
      );
    },
    async getRanking() {
      const current = await session();
      return current
        ? request("/ranking", "GET", undefined, undefined, current)
        : [];
    },
    async getWeeklyRanking() {
      const current = await session();
      return current
        ? request<WeeklyRankingState>(
            "/ranking/weekly",
            "GET",
            undefined,
            undefined,
            current,
          )
        : { ...studyPeriods().weekly, entries: [], currentUser: null };
    },
    async getShop() {
      const current = await session();
      return current
        ? request<ShopState>("/shop", "GET", undefined, undefined, current)
        : guestShop();
    },
    purchaseItem: (itemId, key, expectedPrice) =>
      request<ShopState>(
        "/shop/purchase",
        "POST",
        { itemId, expectedPrice },
        key,
      ),
    equipItem: (itemId, key) =>
      request<ShopState>("/shop/equip", "POST", { itemId }, key),
    startAttempt: (input, key) => request("/attempts", "POST", input, key),
    getAttempt: (id) => request(`/attempts/${encodeURIComponent(id)}`),
    run: async (input, key) =>
      parsePublicSubmission(await request("/runs", "POST", input, key), {
        attemptId: input.attemptId,
      }),
    submit: async (input, key) =>
      parsePublicSubmission(await request("/submissions", "POST", input, key), {
        attemptId: input.attemptId,
      }),
    async submitQuiz(input, key) {
      const result = parsePublicSubmission(
        await request("/quiz-submissions", "POST", input, key),
        { attemptId: input.attemptId },
      );
      if (
        result.status !== "completed" ||
        !["accepted", "wrong_answer", "infrastructure_error"].includes(
          result.verdict ?? "",
        )
      ) {
        throw new GatewayError(
          "invalid_response",
          "Não foi possível confirmar o resultado da resposta. Tente novamente.",
          502,
        );
      }
      return result;
    },
    getSubmission: async (id) =>
      parsePublicSubmission(
        await request(`/submissions/${encodeURIComponent(id)}`),
        { id },
      ),
    async createFeedback(input, key) {
      const validated = validateProductFeedback(input);
      if (!validated.ok)
        throw new GatewayError("invalid_feedback", validated.error);
      const receipt = await request<unknown>(
        "/feedback",
        "POST",
        validated.input,
        key,
      );
      if (
        !receipt ||
        typeof receipt !== "object" ||
        !("protocol" in receipt) ||
        typeof receipt.protocol !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          receipt.protocol,
        ) ||
        !("createdAt" in receipt) ||
        typeof receipt.createdAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.createdAt))
      ) {
        throw new GatewayError(
          "invalid_response",
          "Não foi possível confirmar o recebimento. Tente novamente.",
          502,
        );
      }
      return { protocol: receipt.protocol, createdAt: receipt.createdAt };
    },
    requestHint: (id, key) =>
      request(`/attempts/${encodeURIComponent(id)}/hints`, "POST", {}, key),
    getSolution: (id, languageId, key) =>
      request(
        `/challenges/${encodeURIComponent(id)}/solution-access`,
        "POST",
        { languageId },
        key,
      ),
    askTutor: (input, key) => request("/tutor/messages", "POST", input, key),
    getExecutionStatus: () =>
      request<ExecutionStatusResult>("/execution-status"),
    getTutorConversation: (challengeId, languageId) => {
      const params = new URLSearchParams();
      if (challengeId) params.set("challengeId", challengeId);
      if (languageId) params.set("languageId", languageId);
      return request<TutorConversation>(
        `/tutor/conversations${params.size ? `?${params}` : ""}`,
      );
    },
    async clearTutorConversation(challengeId, languageId, key) {
      await request(
        "/tutor/conversations/clear",
        "POST",
        { challengeId, languageId },
        key,
      );
    },
    async getDraft(challengeId, languageId) {
      const current = await session();
      const key = draftKey(
        current?.user.id ?? "guest",
        challengeId,
        languageId,
      );
      const local = readLocal(key);
      if (!current) return local ? clone(local.draft) : null;
      let remote: DraftInput | null;
      try {
        remote = await request(
          draftPath(challengeId, languageId),
          "GET",
          undefined,
          undefined,
          current,
        );
      } catch (error) {
        if (local) {
          revisions.set(key, local.draft.revision ?? 0);
          return clone(local.draft);
        }
        throw error;
      }
      if (local?.dirty) {
        revisions.set(key, local.draft.revision ?? 0);
        return clone(local.draft);
      }
      const remoteRevision = remote?.revision ?? 0;
      if (revisions.get(key) !== remoteRevision) ownRevisionBases.delete(key);
      revisions.set(key, remoteRevision);
      if (remote) writeLocal(key, { draft: remote, dirty: false });
      return remote ? clone(remote) : null;
    },
    saveDraft,
    resolveDraftConflict: (input) => saveDraft(input, true),
    signInWithPassword: (email, password) =>
      authAction(
        options.auth?.signInWithPassword
          ? () => options.auth!.signInWithPassword!(email, password)
          : undefined,
      ),
    signUp: (email, displayName) =>
      authAction(
        options.auth?.signUp
          ? () => options.auth!.signUp!(email, displayName)
          : undefined,
      ),
    requestPasswordReset: (email) =>
      authAction(
        options.auth?.requestPasswordReset
          ? () => options.auth!.requestPasswordReset!(email)
          : undefined,
      ),
    updatePassword: (password) =>
      authAction(
        options.auth?.updatePassword
          ? () => options.auth!.updatePassword!(password)
          : undefined,
      ),
    confirmEmail: (tokenHash, type) =>
      authAction(
        options.auth?.confirmEmail
          ? () => options.auth!.confirmEmail!(tokenHash, type)
          : undefined,
      ),
    async signIn(provider) {
      if (!live)
        throw new GatewayError(
          "authentication_unconfigured",
          "O login com GitHub ainda não está configurado neste ambiente. Você pode explorar os desafios e salvar código neste navegador.",
          503,
        );
      try {
        await options.auth!.signIn(provider);
      } catch {
        throw new GatewayError(
          "authentication_failed",
          "Não foi possível iniciar o login. Tente novamente.",
          503,
        );
      }
    },
    async signOut() {
      if (live) {
        try {
          await options.auth!.signOut();
        } catch {
          throw new GatewayError(
            "signout_failed",
            "Não foi possível sair da conta. Tente novamente.",
            503,
          );
        }
      }
      revisions.clear();
      ownRevisionBases.clear();
      options.onSignOut?.();
    },
  };
}
