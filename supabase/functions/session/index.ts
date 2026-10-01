import { ApiError, Database, readJson, stringValue } from "../_shared/db.ts";
import { rateLimit, verifyBff } from "../_shared/bff.ts";

export async function handler(request: Request): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    if (request.method !== "POST")
      throw new ApiError("method_not_allowed", 405);
    const db = new Database();
    await verifyBff(request, db);
    const body = await readJson(request, 32768);
    const op = stringValue(body.op, "operation", 20);
    if (op === "rate") {
      const bucket = stringValue(body.bucket, "bucket", 160);
      // Callers may tighten but never lift the anonymous admission ceiling.
      if (
        !/^(login|callback|session-read|anonymous-create):[a-f0-9]{64}$/.test(
          bucket,
        )
      )
        throw new ApiError("invalid_bucket");
      await rateLimit(db, bucket, bucket.startsWith("session-read:") ? 60 : 5);
      return new Response("true", { headers });
    }
    if (
      ![
        "create",
        "create-anonymous",
        "get",
        "delete",
        "oauth-put",
        "oauth-take",
        "claim",
        "update",
        "release",
      ].includes(op)
    )
      throw new ApiError("invalid_operation");
    const id = stringValue(body.id, "id", 64);
    if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError("invalid_id");
    if (
      ["create", "create-anonymous", "oauth-put", "update"].includes(op) &&
      (typeof body.payload !== "string" ||
        body.payload.length > 24576 ||
        !body.payload.length)
    )
      throw new ApiError("invalid_payload");
    if (
      body.version !== undefined &&
      (!Number.isSafeInteger(body.version) || Number(body.version) < 1)
    )
      throw new ApiError("invalid_version");
    if (
      body.owner !== undefined &&
      (typeof body.owner !== "string" || !/^[a-f0-9-]{36}$/.test(body.owner))
    )
      throw new ApiError("invalid_owner");
    const result = await db.rpc("bff_session", {
      p_op: op,
      p_id: id,
      p_payload: body.payload ?? null,
      p_version: body.version ?? null,
      p_owner: body.owner ?? null,
    });
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    const e =
      error instanceof ApiError
        ? error
        : new ApiError("service_unavailable", 503);
    return new Response(JSON.stringify({ error: { code: e.code } }), {
      status: e.status,
      headers: {
        ...headers,
        ...(e.status === 429 ? { "Retry-After": "60" } : {}),
      },
    });
  }
}
if (import.meta.main) Deno.serve(handler);
