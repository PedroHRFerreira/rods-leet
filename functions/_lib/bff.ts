import {
  HttpError,
  SESSION_COOKIE,
  OAUTH_COOKIE,
  allowedApi,
  base64url,
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
interface OAuth {
  verifier: string;
}
type Environment = Pick<
  BffEnv,
  | "APP_ORIGIN"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "BFF_SHARED_SECRET"
  | "BFF_ENCRYPTION_KEY"
>;

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
  grant: "pkce" | "refresh_token",
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
  if (
    !response.ok ||
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.user?.id !== "string" ||
    typeof data.expires_in !== "number"
  )
    throw new HttpError(401, "authentication_failed");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    user: { id: data.user.id },
  };
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
    if (url.pathname === "/auth/start" && request.method === "POST") {
      checkOrigin(request, env.APP_ORIGIN);
      await service(env, {
        op: "rate",
        bucket: `login:${await digest(request.headers.get("cf-connecting-ip") ?? "unknown")}`,
      });
      const data = JSON.parse(await readBounded(request.body, 1024));
      if (data.provider !== "github" || url.search)
        throw new HttpError(400, "provider_unavailable");
      const transaction = randomToken();
      const id = await digest(transaction);
      const verifier = randomToken();
      await service(env, {
        op: "oauth-put",
        id,
        payload: await seal(
          { verifier },
          env.BFF_ENCRYPTION_KEY,
          `oauth:${id}`,
        ),
      });
      const authorize = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
      authorize.search = new URLSearchParams({
        provider: "github",
        redirect_to: `${env.APP_ORIGIN}/auth/callback`,
        code_challenge: base64url(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(verifier),
            ),
          ),
        ),
        code_challenge_method: "s256",
      }).toString();
      const response = json({ url: authorize.toString() });
      response.headers.append(
        "Set-Cookie",
        cookie(OAUTH_COOKIE, transaction, 600),
      );
      return response;
    }
    if (url.pathname === "/auth/callback" && request.method === "GET") {
      await service(env, {
        op: "rate",
        bucket: `callback:${await digest(request.headers.get("cf-connecting-ip") ?? "unknown")}`,
      });
      const transaction = readCookie(request, OAUTH_COOKIE);
      const code = url.searchParams.get("code");
      if (
        !transaction ||
        !code ||
        code.length > 1024 ||
        url.searchParams.getAll("code").length !== 1
      )
        throw new HttpError(400, "oauth_invalid");
      const transactionId = await digest(transaction);
      const pending = await service<Stored | null>(env, {
        op: "oauth-take",
        id: transactionId,
      });
      if (!pending) throw new HttpError(400, "oauth_expired");
      const { verifier } = await unseal<OAuth>(
        pending.payload,
        env.BFF_ENCRYPTION_KEY,
        `oauth:${transactionId}`,
      );
      const tokens = await authToken(env, "pkce", {
        auth_code: code,
        code_verifier: verifier,
      });
      // The API confirms the GitHub identity before an application session is created.
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
      await service(env, {
        op: "create",
        id,
        payload: await seal(
          { ...tokens, csrf: randomToken() },
          env.BFF_ENCRYPTION_KEY,
          id,
        ),
      });
      if (token) await service(env, { op: "delete", id: await digest(token) });
      return redirect("/perfil", [
        cookie(SESSION_COOKIE, next, 86400),
        cookie(OAUTH_COOKIE, "", 0),
      ]);
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
