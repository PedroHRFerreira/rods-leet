import { verifyBff, sha256 } from "./bff.ts";
import { ApiError, type Database } from "./db.ts";

Deno.test(
  "BFF signature binds body, authorization, key and durable replay nonce",
  async () => {
    const previous = Deno.env.get("BFF_SHARED_SECRET");
    Deno.env.set("BFF_SHARED_SECRET", "test-only-".repeat(8));
    try {
      const seen = new Set<string>();
      const db = {
        rpc: (_name: string, args: Record<string, string>) => {
          const fresh = !seen.has(args.p_nonce);
          seen.add(args.p_nonce);
          return Promise.resolve(fresh);
        },
      } as unknown as Database;
      const url = "https://example.supabase.co/functions/v1/api/attempts";
      const body = '{"mode":"normal"}';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = crypto.randomUUID();
      const authorization = "Bearer test-only",
        idempotency = "same-request";
      const canonical = `${timestamp}\n${nonce}\nPOST\n/api/attempts\n${await sha256(body)}\n${authorization}\n${idempotency}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(Deno.env.get("BFF_SHARED_SECRET")),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = [
        ...new Uint8Array(
          await crypto.subtle.sign("HMAC", key, encoder.encode(canonical)),
        ),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const headers = {
        "x-bff-time": timestamp,
        "x-bff-nonce": nonce,
        "x-bff-signature": signature,
        authorization,
        "idempotency-key": idempotency,
      };
      const reject = async (request: Request) => {
        try {
          await verifyBff(request, db);
        } catch (error) {
          if (error instanceof ApiError && error.status === 403) return;
          throw error;
        }
        throw new Error("Tampered or replayed request accepted");
      };
      await reject(
        new Request(url, { method: "POST", body: '{"mode":"hard"}', headers }),
      );
      await reject(
        new Request(url, {
          method: "POST",
          body,
          headers: { ...headers, authorization: "Bearer other-user" },
        }),
      );
      await reject(
        new Request(url, {
          method: "POST",
          body,
          headers: { ...headers, "idempotency-key": "another" },
        }),
      );
      await reject(
        new Request(url, {
          method: "POST",
          body,
          headers: { ...headers, "x-bff-time": "1000000000" },
        }),
      );
      await verifyBff(new Request(url, { method: "POST", body, headers }), db);
      await reject(new Request(url, { method: "POST", body, headers }));
    } finally {
      if (previous === undefined) Deno.env.delete("BFF_SHARED_SECRET");
      else Deno.env.set("BFF_SHARED_SECRET", previous);
    }
  },
);
