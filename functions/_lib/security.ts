export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const encoder = new TextEncoder();
export const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes instanceof Uint8Array ? bytes : bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async (text: string) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
export const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
export const SESSION_COOKIE = "__Host-rods_session";
export const OAUTH_COOKIE = "__Host-rods_oauth";
export function cookie(name: string, token: string, age: number) {
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}
export function readCookie(request: Request, name: string): string | null {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export const securityHeaders = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...securityHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
}
export function checkOrigin(request: Request, origin: string, csrf?: string) {
  if (
    request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "origin_rejected");
  if (
    csrf !== undefined &&
    (!csrf || request.headers.get("x-csrf-token") !== csrf)
  )
    throw new HttpError(403, "csrf_rejected");
}
export async function readBounded(
  body: ReadableStream<Uint8Array> | null,
  max: number,
  timeoutMs = 10_000,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new HttpError(408, "body_timeout"));
      void reader.cancel().catch(() => undefined);
    }, timeoutMs);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        void reader.cancel().catch(() => undefined);
        throw new HttpError(413, "body_too_large");
      }
      chunks.push(value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } finally {
    clearTimeout(timer!);
    reader.releaseLock();
  }
}
export async function sign(
  url: URL,
  method: string,
  body: string,
  secret: string,
  authorization = "",
  idempotency = "",
) {
  const time = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const canonical = [
    time,
    nonce,
    method,
    url.pathname.replace(/^\/functions\/v1(?=\/)/, "") + url.search,
    await digest(body),
    authorization,
    idempotency,
  ].join("\n");
  return {
    "x-bff-time": time,
    "x-bff-nonce": nonce,
    "x-bff-signature": hex(
      await crypto.subtle.sign("HMAC", key, encoder.encode(canonical)),
    ),
  };
}
async function encryptionKey(secret: string) {
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new HttpError(503, "service_unconfigured");
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(secret.match(/../g)!.map((c) => parseInt(c, 16))),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(value: unknown, secret: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    await encryptionKey(secret),
    encoder.encode(JSON.stringify(value)),
  );
  return `v1.${hex(iv)}.${hex(encrypted)}`;
}
export async function unseal<T>(
  payload: string,
  secret: string,
  context: string,
): Promise<T> {
  const parts = payload.split(".");
  if (
    parts.length !== 3 ||
    parts[0] !== "v1" ||
    !/^[a-f0-9]{24}$/.test(parts[1]) ||
    !/^(?:[a-f0-9]{2})+$/.test(parts[2])
  )
    throw new HttpError(401, "session_invalid");
  try {
    const bytes = (s: string) =>
      new Uint8Array(s.match(/../g)!.map((c) => parseInt(c, 16)));
    return JSON.parse(
      new TextDecoder().decode(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: bytes(parts[1]),
            additionalData: encoder.encode(context),
          },
          await encryptionKey(secret),
          bytes(parts[2]),
        ),
      ),
    ) as T;
  } catch {
    throw new HttpError(401, "session_invalid");
  }
}
export function allowedApi(request: Request): URL {
  const url = new URL(request.url);
  if (/%|\\|\/\//.test(url.pathname)) throw new HttpError(400, "invalid_path");
  const path = url.pathname.slice(4);
  const id = "[a-zA-Z0-9_-]{1,128}";
  const routes: Record<string, RegExp[]> = {
    GET: [
      /^\/(dashboard|ranking|challenges|drafts|execution-status|tutor\/conversations)$/,
      new RegExp(`^/(challenges|attempts|submissions)/${id}$`),
    ],
    POST: [
      /^\/(attempts|runs|submissions|quiz-submissions)$/,
      /^\/tutor\/messages$/,
      /^\/tutor\/conversations\/clear$/,
      new RegExp(`^/attempts/${id}/hints$`),
      new RegExp(`^/challenges/${id}/solution-access$`),
    ],
    PUT: [/^\/drafts$/],
  };
  if (!routes[request.method]?.some((re) => re.test(path)))
    throw new HttpError(404, "route_not_found");
  const allowed =
    path === "/challenges"
      ? ["topicId", "difficulty", "languageId", "mode", "search"]
      : path === "/drafts" && request.method === "GET"
        ? ["challengeId", "languageId"]
        : path === "/tutor/conversations" && request.method === "GET"
          ? ["challengeId", "languageId"]
          : [];
  const seen = new Set<string>();
  url.searchParams.forEach((value, key) => {
    if (
      !allowed.includes(key) ||
      seen.has(key) ||
      value.length > 200 ||
      // eslint-disable-next-line no-control-regex -- Intentionally reject control characters from untrusted input.
      /[\u0000-\u001f]/.test(value)
    )
      throw new HttpError(400, "invalid_query");
    seen.add(key);
  });
  return url;
}
