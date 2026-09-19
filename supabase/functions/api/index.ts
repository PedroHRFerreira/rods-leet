import { rateLimit, sha256, verifyBff } from "../_shared/bff.ts";
import { challenges } from "../../../src/content/catalog.ts";
import { getEditorial } from "../_shared/editorial.ts";
import {
  ApiError,
  authenticatedUser,
  Database,
  env,
  idempotencyKey,
  readJson,
  stringValue,
} from "../_shared/db.ts";
import { validateFiles } from "../_shared/files.ts";
import {
  levelForXp,
  presentAttempt,
  presentSubmission,
  type Row,
} from "../_shared/presenters.ts";
import { WorkersAiTutor } from "../_shared/tutor.ts";
import { recommend } from "../_shared/recommendations.ts";
import { executorStatus } from "../coordinator/index.ts";

const errorMessages: Record<string, string> = {
  github_account_required: "Entre com sua conta GitHub para continuar.",
  executor_unavailable: "A execução está pausada. Seu código continua salvo.",
  executor_busy:
    "A execução está ocupada no momento. Aguarde alguns instantes e tente novamente.",
  runtime_unavailable: "Esta linguagem ainda aguarda homologação.",
  budget_exhausted:
    "Os créditos disponíveis para execução chegaram ao limite. Nenhuma tentativa foi consumida.",
  daily_limit: "Você usou as dez execuções de hoje. Seu código continua salvo.",
  execution_active: "Aguarde sua execução atual terminar.",
  attempt_closed: "Esta sessão terminou. Inicie outra sessão para continuar.",
  hint_balance_empty:
    "Você está sem dicas. Conclua dez desafios distintos para ganhar outra.",
  solution_locked:
    "O gabarito abre após aprovação ou três submissões incorretas.",
  authentication_required: "Entre com sua conta para continuar.",
  hard_unavailable: "O modo Hard chega na segunda fase.",
  draft_conflict:
    "Este rascunho foi atualizado em outra aba. Recarregue antes de salvar.",
};

export async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Headers":
          "authorization,apikey,content-type,idempotency-key",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      },
    });
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  try {
    if (origin && origin !== allowedOrigin) {
      throw new ApiError("origin_not_allowed", 403);
    }
    const url = new URL(request.url);
    const path = url.pathname
      .replace(/^\/functions\/v1\/api/, "")
      .replace(/^\/api/, "");
    const db = new Database();
    if (Deno.env.get("BFF_REQUIRED") === "true") await verifyBff(request, db);
    const user = await authenticatedUser(request);
    await rateLimit(
      db,
      `api:${request.method === "GET" ? "read" : "write"}:${user.id}`,
      request.method === "GET" ? 60 : 20,
    );
    if (["POST", "PUT"].includes(request.method) && path !== "/drafts") {
      const copy = request.clone();
      // Bounded parse before hashing, including calls whose contract has an empty body.
      const body = copy.body ? await readJson(copy) : {};
      await db.rpc("bind_request", {
        p_user: user.id,
        p_key: idempotencyKey(request),
        p_operation: `${request.method}:${path}`,
        p_digest: await sha256(JSON.stringify(body)),
      });
    }
    const profile = await db.rpc<Row>("admit_user", {
      p_user: user.id,
      p_email: user.email,
      p_name: user.name,
      p_github_login: user.githubLogin,
    });
    const context = await db.rpc<Row>("user_context", { p_user: user.id });
    if (request.method === "GET" && path === "/execution-status") {
      return json({
        status: await executorStatus(),
        checkedAt: new Date().toISOString(),
      });
    }
    const published = await db.rows<Row>(
      "challenge_versions",
      "select=id,challenge_id&published=eq.true",
    );
    const versions = new Set(published.map((r) => r.id));
    const catalog = challenges.filter((c) => versions.has(c.versionId));
    const challenge = (id: unknown) => {
      const result = catalog.find(
        (c) => c.id === id || c.slug === id || c.versionId === id,
      );
      if (!result) throw new ApiError("challenge_not_found", 404);
      return result;
    };
    const tutorScope = (challengeId?: string, languageId?: string) => ({
      challengeId: challengeId ?? "general",
      languageId: languageId ?? "general",
    });
    if (request.method === "GET" && path === "/tutor/conversations") {
      const selectedChallengeId =
        url.searchParams.get("challengeId") ?? undefined;
      const selectedLanguageId =
        url.searchParams.get("languageId") ?? undefined;
      if (selectedChallengeId) {
        const selected = challenge(selectedChallengeId);
        if (
          selectedLanguageId &&
          !selected.languageIds.includes(selectedLanguageId as never)
        )
          throw new ApiError("language_unavailable");
      } else if (selectedLanguageId) {
        throw new ApiError("invalid_language");
      }
      const scope = tutorScope(selectedChallengeId, selectedLanguageId);
      return json({
        ...scope,
        messages: await db.rpc<unknown[]>("read_tutor_conversation", {
          p_user: user.id,
          p_challenge: scope.challengeId,
          p_language: scope.languageId,
        }),
      });
    }
    if (request.method === "POST" && path === "/tutor/conversations/clear") {
      const body = await readJson(request, 1000);
      const selectedChallengeId =
        typeof body.challengeId === "string" ? body.challengeId : undefined;
      const selectedLanguageId =
        typeof body.languageId === "string" ? body.languageId : undefined;
      if (selectedChallengeId) {
        const selected = challenge(selectedChallengeId);
        if (
          selectedLanguageId &&
          !selected.languageIds.includes(selectedLanguageId as never)
        )
          throw new ApiError("language_unavailable");
      } else if (selectedLanguageId) {
        throw new ApiError("invalid_language");
      }
      const scope = tutorScope(selectedChallengeId, selectedLanguageId);
      await db.rpc("clear_tutor_conversation", {
        p_user: user.id,
        p_challenge: scope.challengeId,
        p_language: scope.languageId,
      });
      return json({ cleared: true });
    }
    const publicChallenge = (c: (typeof challenges)[number]) => ({
      ...c,
      availableModes: context.hardEnabled ? c.availableModes : ["normal"],
      executionAvailable: Boolean(
        context.executionEnabled &&
        context.budgetAvailable &&
        c.languageIds.some((id) => context.availableLanguages.includes(id)),
      ),
    });
    const ownAttempt = async (id: string) => {
      const rows = await db.rows<Row>(
        "attempts",
        `id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`,
      );
      if (!rows[0]) throw new ApiError("attempt_not_found", 404);
      return rows[0];
    };
    const attemptResponse = async (a: Row) => {
      const [subs, completions, attempts] = await Promise.all([
        db.rows<Row>(
          "submissions",
          `attempt_id=eq.${a.id}&user_id=eq.${user.id}&select=kind,status`,
        ),
        db.rows<Row>(
          "completions",
          `user_id=eq.${user.id}&challenge_id=eq.${encodeURIComponent(
            a.challenge_id,
          )}`,
        ),
        db.rows<Row>(
          "attempts",
          `user_id=eq.${user.id}&challenge_id=eq.${encodeURIComponent(
            a.challenge_id,
          )}&select=rejected_count`,
        ),
      ]);
      return presentAttempt(
        a,
        context.assistance.find((h: Row) => h.challenge_id === a.challenge_id),
        subs,
        completions.length > 0,
        attempts.reduce((n, r) => n + r.rejected_count, 0),
      );
    };
    if (request.method === "GET" && path === "/challenges") {
      const filtered = catalog.filter(
        (c) =>
          (!url.searchParams.get("topicId") ||
            c.topicId === url.searchParams.get("topicId")) &&
          (!url.searchParams.get("difficulty") ||
            c.difficulty === url.searchParams.get("difficulty")) &&
          (!url.searchParams.get("languageId") ||
            c.languageIds.includes(
              url.searchParams.get("languageId") as never,
            )) &&
          (!url.searchParams.get("mode") ||
            ((url.searchParams.get("mode") === "normal" ||
              context.hardEnabled) &&
              c.availableModes?.includes(
                url.searchParams.get("mode") as never,
              ))) &&
          (!url.searchParams.get("search") ||
            `${c.title} ${c.description}`
              .toLocaleLowerCase("pt-BR")
              .includes(
                url.searchParams.get("search")!.toLocaleLowerCase("pt-BR"),
              )),
      );
      return json(filtered.map(publicChallenge));
    }
    if (request.method === "GET" && /^\/challenges\/[^/]+$/.test(path)) {
      return json(
        publicChallenge(challenge(decodeURIComponent(path.split("/")[2]))),
      );
    }
    if (request.method === "POST" && path === "/attempts") {
      const body = await readJson(request);
      const c = challenge(body.challengeVersionId);
      const a = await db.rpc<Row>("start_attempt", {
        p_user: user.id,
        p_version: c.versionId,
        p_mode: body.mode,
        p_key: idempotencyKey(request),
      });
      return json(await attemptResponse(a), 201);
    }
    if (request.method === "GET" && /^\/attempts\/[^/]+$/.test(path)) {
      return json(await attemptResponse(await ownAttempt(path.split("/")[2])));
    }
    if (
      request.method === "POST" &&
      (path === "/runs" || path === "/submissions")
    ) {
      const readiness = await fetch(
        `${env("SUPABASE_URL")}/functions/v1/coordinator?check=ready`,
        {
          method: "POST",
          headers: { "x-coordinator-secret": env("COORDINATOR_SECRET") },
          signal: AbortSignal.timeout(3_000),
        },
      ).catch(() => null);
      if (!readiness?.ok) {
        throw new ApiError(
          readiness?.status === 429 ? "executor_busy" : "executor_unavailable",
          409,
        );
      }
      const body = await readJson(request);
      const c = challenge(body.challengeVersionId);
      const language = stringValue(body.languageId, "language");
      const starter =
        c.starterFilesByLanguage[
          language as keyof typeof c.starterFilesByLanguage
        ];
      if (!starter) throw new ApiError("language_unavailable");
      if (
        body.customTests !== undefined &&
        (!Array.isArray(body.customTests) || body.customTests.length)
      ) {
        throw new ApiError(
          "custom_tests_not_available",
          409,
          "Testes personalizados estarão disponíveis com os projetos da fase 2.",
        );
      }
      const files = validateFiles(
        body.files,
        starter.map((f) => f.path),
      );
      const s = await db.rpc<Row>("enqueue_submission", {
        p_user: user.id,
        p_attempt: stringValue(body.attemptId, "attempt"),
        p_version: c.versionId,
        p_language: language,
        p_kind: path === "/runs" ? "run" : "submission",
        p_files: files,
        p_key: idempotencyKey(request),
      });
      // A lost wake-up is recovered by pg_cron. The durable enqueue already committed.
      const wake = fetch(`${env("SUPABASE_URL")}/functions/v1/coordinator`, {
        method: "POST",
        headers: {
          "x-coordinator-secret": env("COORDINATOR_SECRET"),
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => {
          if (!r.ok) {
            console.error(
              JSON.stringify({ event: "wake_failed", status: r.status }),
            );
          }
        })
        .catch(() => console.error('{"event":"wake_failed"}'));
      EdgeRuntime.waitUntil(wake);
      return json(presentSubmission(s), 202);
    }
    if (request.method === "GET" && /^\/submissions\/[^/]+$/.test(path)) {
      const rows = await db.rows<Row>(
        "submissions",
        `id=eq.${encodeURIComponent(path.split("/")[2])}&user_id=eq.${user.id}`,
      );
      if (!rows[0]) throw new ApiError("submission_not_found", 404);
      const s = rows[0],
        a = await ownAttempt(s.attempt_id);
      const xp = await db.rows<Row>(
        "xp_events",
        `submission_id=eq.${s.id}&user_id=eq.${user.id}&select=amount`,
      );
      return json(
        presentSubmission(
          s,
          xp.reduce((n, r) => n + r.amount, 0),
          a.mode === "hard" && a.state !== "accepted" && a.rejected_count < 3,
        ),
      );
    }
    if (request.method === "POST" && /^\/attempts\/[^/]+\/hints$/.test(path)) {
      const a = await ownAttempt(path.split("/")[2]);
      const editorial = getEditorial(a.challenge_id, "typescript");
      const h = await db.rpc<Row>("consume_hint", {
        p_user: user.id,
        p_attempt: a.id,
        p_key: idempotencyKey(request),
        p_max_hints: editorial.hints.length,
      });
      return json({
        text: editorial.hints[h.hintIndex],
        hintsUsed: h.hintsUsed,
        balance: h.hintBalance,
        rewardPercent: h.hintsUsed === 1 ? 95 : 85,
      });
    }
    if (
      request.method === "POST" &&
      /^\/challenges\/[^/]+\/solution-access$/.test(path)
    ) {
      const body = await readJson(request);
      const c = challenge(decodeURIComponent(path.split("/")[2]));
      const language = stringValue(body.languageId, "language");
      if (!c.languageIds.includes(language as never)) {
        throw new ApiError("language_unavailable");
      }
      const editorial = getEditorial(c.id, language);
      const access = await db.rpc<Row>("open_solution", {
        p_user: user.id,
        p_challenge: c.id,
        p_key: idempotencyKey(request),
      });
      return json({
        files: editorial.files,
        explanation: editorial.explanation,
        practiceOnly: access.practiceOnly,
      });
    }
    if (request.method === "POST" && path === "/tutor/messages") {
      const body = await readJson(request, 6000);
      const key = idempotencyKey(request);
      const message = stringValue(body.message, "message", 350);
      const previous = await db.rpc<Row | null>("read_tutor", {
        p_user: user.id,
        p_key: key,
      });
      if (previous?.message) return json(previous);
      if (previous) throw new ApiError("tutor_pending", 409);
      const a = body.attemptId
        ? await ownAttempt(stringValue(body.attemptId, "attempt"))
        : null;
      const c = a
        ? challenge(a.challenge_id)
        : body.challengeVersionId
          ? challenge(body.challengeVersionId)
          : null;
      // Challenge context must be attached to an owned active attempt to avoid free challenge assistance.
      if (c && !a) throw new ApiError("attempt_required");
      const language = body.languageId
        ? stringValue(body.languageId, "language")
        : undefined;
      if (language && c && !c.languageIds.includes(language as never)) {
        throw new ApiError("language_unavailable");
      }
      const scope = tutorScope(c?.id, language);
      const prior = await db.rpc<unknown[]>("read_tutor_conversation", {
        p_user: user.id,
        p_challenge: scope.challengeId,
        p_language: scope.languageId,
      });
      const history = Array.isArray(prior)
        ? prior
            .filter(
              (item): item is { role: "user" | "tutor"; text: string } =>
                Boolean(item) &&
                typeof item === "object" &&
                ((item as { role?: unknown }).role === "user" ||
                  (item as { role?: unknown }).role === "tutor") &&
                typeof (item as { text?: unknown }).text === "string",
            )
            .slice(-10)
        : [];
      const code =
        typeof body.code === "string" && body.code.length <= 6000
          ? body.code
          : undefined;
      const lastRun =
        body.lastRun && typeof body.lastRun === "object"
          ? (body.lastRun as Record<string, unknown>)
          : undefined;
      let hint: string | undefined;
      if (a) {
        const solved = await db.rows<Row>(
          "completions",
          `user_id=eq.${user.id}&challenge_id=eq.${encodeURIComponent(
            a.challenge_id,
          )}&select=challenge_id`,
        );
        if (
          !solved.length &&
          (a.state !== "active" ||
            (a.deadline_at && new Date(a.deadline_at).getTime() < Date.now()))
        )
          throw new ApiError("attempt_closed");
        if (!solved.length) {
          const ed = getEditorial(a.challenge_id, "typescript");
          const h = await db.rpc<Row>("consume_hint", {
            p_user: user.id,
            p_attempt: a.id,
            p_key: `tutor:${key}`,
            p_max_hints: 100000,
          });
          hint = ed.hints[Math.min(h.hintIndex, ed.hints.length - 1)];
        }
      }
      const fallback =
        hint ??
        "Revise os exemplos do enunciado, escreva casos de borda e explique sua estratégia antes de programar. Depois pratique um desafio recomendado no seu painel.";
      const reservation = await db.rpc<Row>("reserve_tutor", {
        p_user: user.id,
        p_challenge: c?.id ?? null,
        p_key: key,
      });
      if (reservation.replayed) throw new ApiError("tutor_pending", 409);
      let response = {
        message: fallback,
        source: "editorial",
        remainingToday: Math.max(0, 2 - (context.usage.tutor_calls ?? 0)),
      };
      const account = Deno.env.get("CLOUDFLARE_ACCOUNT_ID"),
        token = Deno.env.get("CLOUDFLARE_AI_TOKEN");
      if (account && token) {
        try {
          const tutor = new WorkersAiTutor(account, token);
          const submissionHistory = await db.rows<Row>(
            "submissions",
            `user_id=eq.${user.id}&kind=eq.submission&status=eq.finished&select=challenge_version_id,verdict&order=created_at.desc&limit=20`,
          );
          const studySummary = recommend(
            catalog,
            [],
            submissionHistory as never,
          )
            .map((r) => r.reason)
            .join(" ");
          response = {
            message: await tutor.respond({
              message,
              title: c?.title,
              description: c?.description,
              hint,
              studySummary,
              language,
              history,
              code,
              lastRun: lastRun
                ? {
                    status:
                      typeof lastRun.status === "string"
                        ? lastRun.status
                        : "never_run",
                    output:
                      typeof lastRun.output === "string"
                        ? lastRun.output
                        : undefined,
                    diagnostic:
                      typeof lastRun.diagnostic === "string"
                        ? lastRun.diagnostic
                        : undefined,
                  }
                : undefined,
            }),
            source: "ai",
            remainingToday: Math.max(0, response.remainingToday - 1),
          };
        } catch (error) {
          if (error instanceof ApiError && error.code === "tutor_pending") {
            throw error;
          }
          if (!(error instanceof ApiError)) {
            console.error('{"event":"tutor_failed"}');
          }
        }
      }
      await db.rpc("finish_tutor", {
        p_user: user.id,
        p_key: key,
        p_response: response,
      });
      await db.rpc("write_tutor_conversation", {
        p_user: user.id,
        p_challenge: scope.challengeId,
        p_language: scope.languageId,
        p_messages: [
          ...history,
          { role: "user", text: message },
          { role: "tutor", text: response.message },
        ].slice(-12),
      });
      return json(response);
    }
    if (request.method === "GET" && path === "/dashboard") {
      const [completed, recent] = await Promise.all([
        db.rows<Row>(
          "completions",
          `user_id=eq.${user.id}&select=challenge_id,created_at`,
        ),
        db.rows<Row>(
          "submissions",
          `user_id=eq.${user.id}&kind=eq.submission&select=id,attempt_id,status,verdict,created_at,finished_at,challenge_version_id&order=created_at.desc&limit=20`,
        ),
      ]);
      const ids = [...new Set(completed.map((r) => r.challenge_id))];
      const days = new Set(completed.map((r) => r.created_at.slice(0, 10)));
      let streak = 0;
      const cursor = new Date();
      if (!days.has(cursor.toISOString().slice(0, 10))) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      while (days.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      return json({
        profile: {
          id: user.id,
          displayName: profile.display_name,
          authenticated: true,
        },
        xp: profile.xp,
        ...levelForXp(profile.xp),
        completedCount: ids.length,
        hintBalance: profile.hint_balance,
        streakDays: streak,
        completedChallengeIds: ids,
        activityDays: [...days].sort(),
        recentSubmissions: recent
          .slice(0, 8)
          .map((r) => presentSubmission(r, 0, true)),
        recommendations: recommend(catalog, ids, recent as never),
        remoteRunsRemaining: Math.max(0, 10 - context.usage.executions),
        tutorMessagesRemaining: Math.max(0, 2 - context.usage.tutor_calls),
        executionStatus: !context.executionEnabled
          ? "paused"
          : !context.availableLanguages.length
            ? "unconfigured"
            : !context.budgetAvailable || context.usage.executions >= 10
              ? "quota_exhausted"
              : "available",
      });
    }
    if (request.method === "GET" && path === "/ranking") {
      const [players, completed] = await Promise.all([
        db.rows<Row>("profiles", "select=id,display_name,xp,reached_at"),
        db.rows<Row>("completions", "select=user_id,challenge_id"),
      ]);
      const ranked = players
        .map((p) => ({
          userId: p.id,
          displayName: p.display_name,
          xp: p.xp,
          completedCount: new Set(
            completed
              .filter((c) => c.user_id === p.id)
              .map((c) => c.challenge_id),
          ).size,
          reachedAt: p.reached_at,
          isCurrentUser: p.id === user.id,
        }))
        .sort(
          (a, b) =>
            b.xp - a.xp ||
            b.completedCount - a.completedCount ||
            a.reachedAt.localeCompare(b.reachedAt),
        );
      return json(ranked);
    }
    if (path === "/drafts" && request.method === "GET") {
      const c = challenge(url.searchParams.get("challengeId"));
      const language = stringValue(
        url.searchParams.get("languageId"),
        "language",
      );
      const rows = await db.rows<Row>(
        "drafts",
        `user_id=eq.${user.id}&challenge_id=eq.${encodeURIComponent(
          c.id,
        )}&language_id=eq.${encodeURIComponent(language)}`,
      );
      return json(
        rows[0]
          ? {
              challengeId: c.id,
              languageId: language,
              files: rows[0].files,
              updatedAt: rows[0].updated_at,
              revision: rows[0].revision,
            }
          : null,
      );
    }
    if (
      path === "/drafts" &&
      (request.method === "PUT" || request.method === "POST")
    ) {
      const body = await readJson(request);
      const c = challenge(body.challengeId);
      const language = stringValue(body.languageId, "language");
      const starter =
        c.starterFilesByLanguage[
          language as keyof typeof c.starterFilesByLanguage
        ];
      if (!starter) throw new ApiError("language_unavailable");
      const files = validateFiles(
        body.files,
        starter.map((f) => f.path),
      );
      const revision = body.revision ?? 0;
      if (!Number.isSafeInteger(revision) || Number(revision) < 0) {
        throw new ApiError("invalid_revision");
      }
      const saved = await db.rpc<Row>("save_draft", {
        p_user: user.id,
        p_challenge: c.id,
        p_language: language,
        p_files: files,
        p_revision: revision,
      });
      return json({
        saved: true,
        revision: saved.revision,
        updatedAt: saved.updated_at,
      });
    }
    throw new ApiError("not_found", 404);
  } catch (error) {
    const e =
      error instanceof ApiError ? error : new ApiError("internal_error", 500);
    if (e.status >= 500) {
      console.error(
        JSON.stringify({
          event: "api_error",
          code: e.code,
        }),
      );
    }
    if (e.status === 429) headers["Retry-After"] = "60";
    return json(
      {
        error: {
          code: e.code,
          message:
            errorMessages[e.code] ??
            (e.status >= 500
              ? "Serviço temporariamente indisponível. Tente novamente."
              : e.message),
        },
      },
      e.status,
    );
  }
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
if (import.meta.main) Deno.serve(handler);
