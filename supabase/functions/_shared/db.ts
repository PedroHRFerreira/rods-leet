export class ApiError extends Error {
  constructor(public code: string, public status = 400, message = code) {
    super(message);
  }
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new ApiError("service_unconfigured", 503);
  return value;
}

export class Database {
  private readonly url = env("SUPABASE_URL");
  private readonly key = env("SUPABASE_SERVICE_ROLE_KEY");
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (!response.ok) {
      const code =
        typeof body.message === "string" && /^[a-z_]+$/.test(body.message)
          ? body.message
          : "database_error";
      throw new ApiError(code, code === "database_error" ? 500 : 409);
    }
    return body as T;
  }
  rpc<T>(name: string, args: Record<string, unknown> = {}) {
    return this.request<T>(`rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  }
  rows<T>(table: string, query: string) {
    return this.request<T[]>(`${table}?${query}`);
  }
}

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError("authentication_required", 401);
  }
  const response = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new ApiError("authentication_required", 401);
  const user = await response.json();
  if (
    typeof user.id !== "string" || typeof user.email !== "string" ||
    !user.email_confirmed_at
  ) throw new ApiError("verified_email_required", 403);
  return {
    id: user.id as string,
    email: user.email as string,
    name: String(
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Jogador",
    ).slice(0, 80),
  };
}

export async function readJson(
  request: Request,
  limit = 2 * 1024 * 1024,
): Promise<Record<string, unknown>> {
  if (!request.body) throw new ApiError("body_required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        throw new ApiError("body_too_large", 413);
      }
      chunks.push(value);
    }
    const data = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(data),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("object_required");
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("invalid_json");
  }
}

export function stringValue(value: unknown, name: string, max = 200): string {
  if (
    typeof value !== "string" || !value.length || value.length > max ||
    /[\u0000-\u001f]/.test(value)
  ) throw new ApiError(`invalid_${name}`);
  return value;
}

export function idempotencyKey(request: Request) {
  return stringValue(
    request.headers.get("Idempotency-Key"),
    "idempotency_key",
    128,
  );
}

export async function secretsMatch(a: string, b: string): Promise<boolean> {
  const encode = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encode.encode(b),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encode.encode(b));
  return crypto.subtle.verify("HMAC", key, signature, encode.encode(a));
}
