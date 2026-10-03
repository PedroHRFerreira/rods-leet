import {
  HttpError,
  SESSION_COOKIE,
  OAUTH_COOKIE,
  allowedApi,
  checkOrigin,
  cookie,
  digest,
  json,
  randomToken,
  readBounded,
  readCookie,
  seal,
  securityHeaders,
  sign,
  unseal,
} from "./security";

interface Stored {
  payload: string;
  version: number;
  expiresAt: string;
  owner?: string;
}
interface Tokens {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
  user: { id: string };
  csrf: string;
}
type Environment = Pick<
  BffEnv,
  | "APP_ORIGIN"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "BFF_SHARED_SECRET"
  | "BFF_ENCRYPTION_KEY"
> & { EMAIL_REGISTRATION_ENABLED?: string };

function validateEnv(env: Environment, request: Request) {
  if (
    new URL(request.url).origin !== env.APP_ORIGIN ||
    !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL) ||
    !env.SUPABASE_ANON_KEY ||
    typeof env.BFF_SHARED_SECRET !== "string" ||
    env.BFF_SHARED_SECRET.length < 32 ||
    !/^[a-f0-9]{64}$/.test(env.BFF_ENCRYPTION_KEY)
  )
    throw new HttpError(503, "service_unconfigured");
}
async function fetchWithoutRedirect(url: URL | string, init: RequestInit) {
  // workerd only supports manual/follow; never forward credentials to a redirect.
  const response = await fetch(url, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new HttpError(502, "upstream_redirect_rejected");
  }
  return response;
}
async function upstream(
  env: Environment,
  path: string,
  method: string,
  body = "",
  authorization = "",
  idempotency = "",
) {
  const url = new URL(env.SUPABASE_URL + path);
  return fetchWithoutRedirect(url, {
    method,
    signal: AbortSignal.timeout(20_000),
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_ANON_KEY,
      ...(authorization ? { Authorization: authorization } : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
      ...(await sign(
        url,
        method,
        body,
        env.BFF_SHARED_SECRET,
        authorization,
        idempotency,
      )),
    },
    ...(body ? { body } : {}),
  });
}
async function service<T>(
  env: Environment,
  input: Record<string, unknown>,
): Promise<T> {
  const response = await upstream(
    env,
    "/functions/v1/session",
    "POST",
    JSON.stringify(input),
  );
  const body = await readBounded(response.body, 64 * 1024);
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 503,
      response.status === 429 ? "rate_limited" : "session_unavailable",
    );
  return JSON.parse(body) as T;
}
async function authToken(
  env: Environment,
  grant: "password" | "refresh_token",
  input: Record<string, string>,
): Promise<Omit<Tokens, "csrf">> {
  const response = await fetchWithoutRedirect(
    `${env.SUPABASE_URL}/auth/v1/token?grant_type=${grant}`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const data = JSON.parse(await readBounded(response.body, 64 * 1024));
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 401,
      response.status === 429 ? "rate_limited" : "authentication_failed",
    );
  return parseAuthTokens(data);
}
function parseAuthTokens(data: Record<string, unknown>): Omit<Tokens, "csrf"> {
  const user = data.user as
    { id?: unknown; is_anonymous?: boolean } | undefined;
  if (
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof user?.id !== "string" ||
    typeof data.expires_in !== "number"
  )
    throw new HttpError(401, "authentication_failed");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    user: { id: user.id },
  };
}
async function authRequest(
  env: Environment,
  path: string,
  method: string,
  input?: Record<string, unknown>,
  accessToken?: string,
): Promise<Record<string, unknown>> {
  const response = await fetchWithoutRedirect(
    env.SUPABASE_URL + "/auth/v1" + path,
    {
      method,
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const body = await readBounded(response.body, 64 * 1024);
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 400,
      response.status === 429 ? "rate_limited" : "authentication_failed",
    );
  return body ? JSON.parse(body) : {};
}
async function establishSession(
  env: Environment,
  tokens: Omit<Tokens, "csrf">,
  previous: string | null,
): Promise<Response> {
  const admission = await upstream(
    env,
    "/functions/v1/api/dashboard",
    "GET",
    "",
    `Bearer ${tokens.access_token}`,
  );
  await readBounded(admission.body, 2 * 1024 * 1024);
  if (!admission.ok) throw new HttpError(403, "authentication_failed");
  const next = randomToken();
  const id = await digest(next);
  const csrf = randomToken();
  await service(env, {
    op: "create",
    id,
    payload: await seal({ ...tokens, csrf }, env.BFF_ENCRYPTION_KEY, id),
  });
  if (previous)
    await service(env, { op: "delete", id: await digest(previous) });
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, next, 86400));
  return response;
}

async function anonymousTokens(
  env: Environment,
): Promise<Omit<Tokens, "csrf">> {
  const response = await fetchWithoutRedirect(
    `${env.SUPABASE_URL}/auth/v1/signup`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    },
  );
  const data = JSON.parse(await readBounded(response.body, 64 * 1024));
  if (
    !response.ok ||
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.user?.id !== "string" ||
    data.user.is_anonymous !== true ||
    typeof data.expires_in !== "number"
  )
    throw new HttpError(
      response.status === 429 ? 429 : 503,
      response.status === 429 ? "rate_limited" : "anonymous_access_unavailable",
    );
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    user: { id: data.user.id },
  };
}
async function getSession(
  env: Environment,
  token: string,
  refresh: boolean,
): Promise<Tokens | null> {
  const id = await digest(token);
  const stored = await service<Stored | null>(env, { op: "get", id });
  if (!stored) return null;
  const current = await unseal<Tokens>(
    stored.payload,
    env.BFF_ENCRYPTION_KEY,
    id,
  );
  if (!refresh || current.expiresAt > Date.now() + 60_000) return current;
  const lease = await service<Stored | null>(env, { op: "claim", id });
  // Another request is refreshing. Retry the application request later; do not reuse refresh tokens.
  if (!lease?.owner) throw new HttpError(503, "session_refreshing");
  try {
    const latest = await unseal<Tokens>(
      lease.payload,
      env.BFF_ENCRYPTION_KEY,
      id,
    );
    if (latest.expiresAt > Date.now() + 60_000) return latest;
    const next: Tokens = {
      ...(await authToken(env, "refresh_token", {
        refresh_token: latest.refresh_token,
      })),
      csrf: latest.csrf,
    };
    const updated = await service<Stored | null>(env, {
      op: "update",
      id,
      owner: lease.owner,
      version: lease.version,
      payload: await seal(next, env.BFF_ENCRYPTION_KEY, id),
    });
    if (!updated) throw new HttpError(401, "session_expired");
    return next;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401)
      await service(env, { op: "delete", id });
    throw error;
  } finally {
    await service(env, { op: "release", id, owner: lease.owner });
  }
}
function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ ...securityHeaders, Location: location });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 303, headers });
}
export async function handleBff(
  request: Request,
  env: Environment,
): Promise<Response> {
  try {
    validateEnv(env, request);
    const url = new URL(request.url);
    const token = readCookie(request, SESSION_COOKIE);
    if (url.pathname === "/auth/start") {
      checkOrigin(request, env.APP_ORIGIN);
      throw new HttpError(410, "provider_unavailable");
    }
    if (url.pathname === "/auth/callback") {
      return redirect("/perfil?authError=1", [cookie(OAUTH_COOKIE, "", 0)]);
    }
    if (
      [
        "/auth/login",
        "/auth/signup",
        "/auth/recover",
        "/auth/confirm",
        "/auth/password",
      ].includes(url.pathname)
    ) {
      if (request.method !== "POST" || url.search)
        throw new HttpError(404, "route_not_found");
      checkOrigin(request, env.APP_ORIGIN);
      if (
        env.EMAIL_REGISTRATION_ENABLED === "false" &&
        ["/auth/signup", "/auth/recover"].includes(url.pathname)
      )
        throw new HttpError(503, "email_registration_unavailable");
      if (
        request.headers.get("content-type")?.split(";")[0] !==
        "application/json"
      )
        throw new HttpError(415, "json_required");
      await service(env, {
        op: "rate",
        bucket: `email-auth:${await digest(request.headers.get("cf-connecting-ip") ?? "unknown")}`,
      });
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(await readBounded(request.body, 4096));
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(400, "invalid_credentials");
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new HttpError(400, "invalid_credentials");
      const email = () => {
        if (
          typeof input.email !== "string" ||
          input.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
        )
          throw new HttpError(400, "invalid_email");
        return input.email.trim().toLowerCase();
      };
      const password = () => {
        if (
          typeof input.password !== "string" ||
          input.password.length < 10 ||
          input.password.length > 128
        )
          throw new HttpError(400, "invalid_password");
        return input.password;
      };
      if (url.pathname === "/auth/login") {
        const tokens = await authToken(env, "password", {
          email: email(),
          password: password(),
        });
        return await establishSession(env, tokens, token);
      }
      if (url.pathname === "/auth/recover") {
        await authRequest(
          env,
          `/recover?redirect_to=${encodeURIComponent(env.APP_ORIGIN + "/conta/confirmar")}`,
          "POST",
          { email: email() },
        );
        return json({ ok: true });
      }
      if (url.pathname === "/auth/confirm") {
        if (
          typeof input.tokenHash !== "string" ||
          !/^[a-f0-9]{32,128}$/i.test(input.tokenHash) ||
          !["signup", "email_change", "recovery"].includes(String(input.type))
        )
          throw new HttpError(400, "invalid_confirmation");
        const data = await authRequest(env, "/verify", "POST", {
          token_hash: input.tokenHash,
          type: input.type,
        });
        const tokens = parseAuthTokens(data);
        return await establishSession(env, tokens, token);
      }
      const current = token ? await getSession(env, token, true) : null;
      if (!current) throw new HttpError(401, "authentication_required");
      checkOrigin(request, env.APP_ORIGIN, current.csrf);
      const user = await authRequest(
        env,
        "/user",
        "GET",
        undefined,
        current.access_token,
      );
      if (url.pathname === "/auth/signup") {
        if (user.is_anonymous !== true)
          throw new HttpError(409, "account_already_registered");
        if (
          typeof input.displayName !== "string" ||
          input.displayName.trim().length < 2 ||
          input.displayName.trim().length > 40
        )
          throw new HttpError(400, "invalid_display_name");
        // Preserve the anonymous identity. Password is set only after email verification.
        await authRequest(
          env,
          `/user?redirect_to=${encodeURIComponent(env.APP_ORIGIN + "/conta/confirmar")}`,
          "PUT",
          {
            email: email(),
            data: {
              display_name: input.displayName.trim(),
              full_name: input.displayName.trim(),
            },
          },
          current.access_token,
        );
        return json({ requiresEmailConfirmation: true });
      }
      if (user.is_anonymous !== false || !user.email_confirmed_at)
        throw new HttpError(403, "email_confirmation_required");
      await authRequest(
        env,
        "/user",
        "PUT",
        { password: password() },
        current.access_token,
      );
      // Rotate the application cookie/CSRF after credential changes too.
      const tokens = await authToken(env, "refresh_token", {
        refresh_token: current.refresh_token,
      });
      return await establishSession(env, tokens, token);
    }
    if (
      url.pathname === "/api/session" &&
      request.method === "GET" &&
      !url.search
    ) {
      if (request.headers.get("sec-fetch-site") === "cross-site")
        throw new HttpError(403, "origin_rejected");
      await service(env, {
        op: "rate",
        bucket: `session-read:${await digest(request.headers.get("cf-connecting-ip") ?? "unknown")}`,
      });
      const current = token ? await getSession(env, token, false) : null;
      if (current) return json({ user: current.user, csrf: current.csrf });
      // Anonymous Auth gives every browser its own server-verified identity.
      // Provider tokens stay encrypted on the server, exactly as for OAuth.
      await service(env, {
        op: "rate",
        bucket: `anonymous-create:${await digest(request.headers.get("cf-connecting-ip") ?? "unknown")}`,
      });
      const next = randomToken();
      const id = await digest(next);
      const created = { ...(await anonymousTokens(env)), csrf: randomToken() };
      await service(env, {
        op: "create-anonymous",
        id,
        payload: await seal(created, env.BFF_ENCRYPTION_KEY, id),
      });
      const response = json({ user: created.user, csrf: created.csrf });
      response.headers.append(
        "Set-Cookie",
        cookie(SESSION_COOKIE, next, 30 * 86400),
      );
      return response;
    }
    if (
      url.pathname === "/auth/logout" &&
      request.method === "POST" &&
      !url.search
    ) {
      checkOrigin(request, env.APP_ORIGIN);
      const current = token ? await getSession(env, token, false) : null;
      if (current) checkOrigin(request, env.APP_ORIGIN, current.csrf);
      if (token) await service(env, { op: "delete", id: await digest(token) });
      // Server-side revocation is durable even if the external logout endpoint is unavailable.
      if (current) {
        try {
          const r = await fetchWithoutRedirect(
            `${env.SUPABASE_URL}/auth/v1/logout?scope=local`,
            {
              method: "POST",
              headers: {
                apikey: env.SUPABASE_ANON_KEY,
                Authorization: `Bearer ${current.access_token}`,
              },
              signal: AbortSignal.timeout(5000),
            },
          );
          await r.body?.cancel();
        } catch {
          /* App session already revoked. */
        }
      }
      const response = json({ ok: true });
      response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      return response;
    }
    if (!url.pathname.startsWith("/api/"))
      throw new HttpError(404, "route_not_found");
    const target = allowedApi(request);
    if (!token) throw new HttpError(401, "authentication_required");
    if (request.method !== "GET") checkOrigin(request, env.APP_ORIGIN);
    const current = await getSession(env, token, true);
    if (!current) throw new HttpError(401, "session_expired");
    if (request.method !== "GET")
      checkOrigin(request, env.APP_ORIGIN, current.csrf);
    if (
      request.method !== "GET" &&
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      throw new HttpError(415, "json_required");
    const body = await readBounded(request.body, 2 * 1024 * 1024);
    const idempotency = request.headers.get("idempotency-key") ?? "";
    if (idempotency && !/^[\x21-\x7e]{1,128}$/.test(idempotency))
      throw new HttpError(400, "invalid_idempotency_key");
    const result = await upstream(
      env,
      `/functions/v1/api${target.pathname.slice(4)}${target.search}`,
      request.method,
      body,
      `Bearer ${current.access_token}`,
      idempotency,
    );
    const output = await readBounded(result.body, 2 * 1024 * 1024);
    return new Response(output, {
      status: result.status,
      headers: {
        ...securityHeaders,
        "Content-Type": "application/json; charset=utf-8",
        ...(result.status === 429 ? { "Retry-After": "60" } : {}),
      },
    });
  } catch (error) {
    if (new URL(request.url).pathname === "/auth/callback")
      return redirect("/perfil?authError=1", [cookie(OAUTH_COOKIE, "", 0)]);
    return json(
      {
        error: {
          code: error instanceof HttpError ? error.code : "service_unavailable",
          message: "Não foi possível concluir esta ação. Tente novamente.",
        },
      },
      error instanceof HttpError ? error.status : 503,
    );
  }
}
