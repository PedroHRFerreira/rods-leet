import { ApiError, Database, env } from "./db.ts";

const encoder = new TextEncoder();
export async function sha256(value: string): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

// Verify before using any identity or body. Nonces are shared across isolates.
export async function verifyBff(request: Request, db: Database): Promise<void> {
  const secret = env("BFF_SHARED_SECRET");
  if (secret.length < 32) throw new ApiError("service_unconfigured", 503);
  const timestamp = request.headers.get("x-bff-time") ?? "";
  const nonce = request.headers.get("x-bff-nonce") ?? "";
  const signature = request.headers.get("x-bff-signature") ?? "";
  if (
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 ||
    !/^[a-f0-9-]{32,128}$/.test(nonce) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    throw new ApiError("bff_required", 403);
  }
  const copy = request.clone();
  const reader = copy.body?.getReader();
  let body = "";
  if (reader) {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) {
        void reader.cancel().catch(() => undefined);
        throw new ApiError("body_too_large", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ApiError("invalid_body");
    }
  }
  const url = new URL(request.url);
  const canonical = `${timestamp}\n${nonce}\n${request.method}\n${url.pathname.replace(/^\/functions\/v1(?=\/)/, "")}${url.search}\n${await sha256(body)}\n${request.headers.get("authorization") ?? ""}\n${request.headers.get("idempotency-key") ?? ""}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.match(/../g)!, (part) =>
    parseInt(part, 16),
  );
  if (
    !(await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(canonical)))
  )
    throw new ApiError("bff_required", 403);
  if (!(await db.rpc<boolean>("bff_nonce", { p_nonce: nonce })))
    throw new ApiError("bff_replay", 403);
}

export async function rateLimit(
  db: Database,
  bucket: string,
  limit: number,
  seconds = 60,
): Promise<void> {
  if (
    !(await db.rpc<boolean>("security_rate", {
      p_bucket: bucket,
      p_limit: limit,
      p_seconds: seconds,
    }))
  )
    throw new ApiError("rate_limited", 429);
}
