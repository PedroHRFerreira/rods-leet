import { Database, secretsMatch } from "../_shared/db.ts";

export interface DiscordFeedbackNotification {
  protocol: string;
  token: string;
  category: "suggestion" | "criticism" | "praise";
  message: string;
  displayName: string;
  challengeId: string | null;
  createdAt: string;
}
const snowflake = /^[0-9]{17,20}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FEEDBACK_DISCORD_GUILD_ID = "1555947225945870508";

export function discordWebhookUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "discord.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/api(?:\/v10)?\/webhooks\/[0-9]{17,20}\/[A-Za-z0-9_-]{20,200}$/.test(
        url.pathname,
      )
    )
      return null;
    url.searchParams.set("wait", "true");
    return url;
  } catch {
    return null;
  }
}

export function discordFeedbackPayload(item: DiscordFeedbackNotification) {
  const labels = {
    suggestion: "Sugestão",
    criticism: "Crítica",
    praise: "Elogio",
  };
  if (
    !uuid.test(item.protocol) ||
    !uuid.test(item.token) ||
    !Object.hasOwn(labels, item.category) ||
    typeof item.message !== "string" ||
    item.message.length < 10 ||
    item.message.length > 4000 ||
    typeof item.displayName !== "string" ||
    !item.displayName.trim() ||
    item.displayName.length > 80 ||
    typeof item.createdAt !== "string" ||
    Number.isNaN(Date.parse(item.createdAt)) ||
    (item.challengeId !== null &&
      !/^[A-Za-z0-9_-]{1,128}$/.test(item.challengeId))
  )
    throw new Error("invalid_notification");
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `Feedback · ${labels[item.category]}`,
        description: item.message,
        author: { name: item.displayName.trim() },
        ...(item.challengeId
          ? { url: `https://rodsleet.com/desafios/${item.challengeId}` }
          : {}),
        timestamp: new Date(item.createdAt).toISOString(),
        footer: { text: `Protocolo: ${item.protocol}` },
      },
    ],
  };
}

async function confirmation(
  response: Response,
): Promise<{ id?: unknown; channel_id?: unknown; guild_id?: unknown }> {
  if (!response.body) throw new Error("missing_confirmation");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 65_536) throw new Error("oversized_confirmation");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  const body: unknown = JSON.parse(new TextDecoder().decode(data));
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("invalid_confirmation");
  return body;
}

export function createDiscordFeedbackHandler(options: {
  secret: () => string | undefined;
  webhookUrl: () => string | undefined;
  channelId: () => string | undefined;
  db?: Pick<Database, "rpc">;
  fetch?: typeof fetch;
}) {
  return async (request: Request): Promise<Response> => {
    const secret = options.secret();
    if (
      !secret ||
      !(await secretsMatch(
        request.headers.get("x-coordinator-secret") ?? "",
        secret,
      ))
    )
      return Response.json({ error: "unauthorized" }, { status: 401 });
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    const webhook = discordWebhookUrl(options.webhookUrl());
    const channelId = options.channelId();
    if (!webhook || !channelId || !snowflake.test(channelId))
      return Response.json({ error: "discord_unconfigured" }, { status: 503 });
    try {
      const metadataUrl = new URL(webhook);
      metadataUrl.search = "";
      const metadataResponse = await (options.fetch ?? fetch)(
        metadataUrl.toString(),
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!metadataResponse.ok) throw new Error("discord_target_unverified");
      const metadata = await confirmation(metadataResponse);
      if (
        metadata.channel_id !== channelId ||
        metadata.guild_id !== FEEDBACK_DISCORD_GUILD_ID
      )
        return Response.json(
          { error: "discord_target_mismatch" },
          { status: 503 },
        );
      const db = options.db ?? new Database();
      const item = await db.rpc<DiscordFeedbackNotification | null>(
        "claim_discord_feedback_notification",
      );
      if (!item) return Response.json({ status: "idle" });
      try {
        const response = await (options.fetch ?? fetch)(webhook.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordFeedbackPayload(item)),
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("discord_delivery_unconfirmed");
        const message = await confirmation(response);
        if (
          typeof message.id !== "string" ||
          !snowflake.test(message.id) ||
          message.channel_id !== channelId
        )
          throw new Error("discord_delivery_unconfirmed");
      } catch {
        // Fence ambiguous delivery; never automatically resend or log payloads or credentials.
        await db.rpc("finish_feedback_notification", {
          p_protocol: item.protocol,
          p_token: item.token,
          p_sent: false,
        });
        return Response.json({ status: "uncertain" }, { status: 502 });
      }
      const finished = await db.rpc<boolean>("finish_feedback_notification", {
        p_protocol: item.protocol,
        p_token: item.token,
        p_sent: true,
      });
      return finished
        ? Response.json({ status: "sent" })
        : Response.json({ status: "uncertain" }, { status: 502 });
    } catch {
      return Response.json({ error: "notification_failed" }, { status: 503 });
    }
  };
}
