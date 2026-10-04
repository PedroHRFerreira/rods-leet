import { afterEach, expect, it, vi } from "vitest";
import {
  createDiscordFeedbackHandler,
  discordFeedbackPayload,
  discordWebhookUrl,
  FEEDBACK_DISCORD_GUILD_ID,
  type DiscordFeedbackNotification,
} from "../supabase/functions/feedback-discord/service";
const channelId = "1555947226709237912";
const webhook =
  "https://discord.com/api/webhooks/1555947225945870508/abcdefghijklmnopqrstuvwxyz0123456789";
const item: DiscordFeedbackNotification = {
  protocol: "00000000-0000-4000-8000-000000000001",
  token: "00000000-0000-4000-8000-000000000002",
  category: "suggestion",
  message: "Mais exemplos, por favor. @everyone <@123456789012345678>",
  displayName: "Jogador público",
  challengeId: "concept-values",
  createdAt: "2026-10-04T02:00:00Z",
};
afterEach(() => vi.restoreAllMocks());
function setup(
  url: string | undefined = webhook,
  channel: string | undefined = channelId,
) {
  const rpc = vi
    .fn()
    .mockImplementation(async (name: string) =>
      name === "claim_discord_feedback_notification" ? item : true,
    );
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_url, options) =>
      Response.json(
        options?.method === "GET"
          ? { channel_id: channelId, guild_id: FEEDBACK_DISCORD_GUILD_ID }
          : { id: "1555947226709237999", channel_id: channelId },
      ),
    );
  const handler = createDiscordFeedbackHandler({
    secret: () => "internal-only-secret",
    webhookUrl: () => url,
    channelId: () => channel,
    db: { rpc },
    fetch: fetcher,
  });
  const request = (secret = "internal-only-secret", method = "POST") =>
    new Request("https://example.test/feedback-discord", {
      method,
      headers: { "x-coordinator-secret": secret },
    });
  return { rpc, fetcher, handler, request };
}
it.each([
  "http://discord.com/api/webhooks/1555947225945870508/abcdefghijklmnopqrstuvwxyz",
  "https://discord.com.evil.test/api/webhooks/1555947225945870508/abcdefghijklmnopqrstuvwxyz",
  "https://evil.test/api/webhooks/1555947225945870508/abcdefghijklmnopqrstuvwxyz",
  "https://discord.com@evil.test/api/webhooks/1555947225945870508/abcdefghijklmnopqrstuvwxyz",
  "https://user:password@discord.com/api/webhooks/1555947225945870508/abcdefghijklmnopqrstuvwxyz",
  webhook + "?thread_id=123",
  webhook + "#secret",
  webhook.replace("/api/", "/other/"),
  webhook.replace("discord.com", "discord.com:444"),
  undefined,
])("rejects an unsafe or user-directed webhook: %s", (value) =>
  expect(discordWebhookUrl(value)).toBeNull(),
);
it("accepts only the canonical Discord route and requires confirmed response", () => {
  expect(discordWebhookUrl(webhook)?.search).toBe("?wait=true");
  expect(
    discordWebhookUrl(webhook.replace("/api/", "/api/v10/"))?.hostname,
  ).toBe("discord.com");
});
it("publishes only consented public fields and disables all mentions", () => {
  const payload = discordFeedbackPayload({
    ...item,
    contactEmail: "private@example.test",
    userId: "private-user-id",
  } as DiscordFeedbackNotification);
  expect(payload.allowed_mentions).toEqual({ parse: [] });
  expect(payload.embeds[0]).toMatchObject({
    description: item.message,
    author: { name: item.displayName },
    url: "https://rodsleet.com/desafios/concept-values",
  });
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain("private@example.test");
  expect(serialized).not.toContain("private-user-id");
  expect(serialized).not.toContain(item.token);
  expect(payload.embeds[0].footer.text).toContain(item.protocol);
});
it.each([
  { ...item, message: "x".repeat(4001) },
  { ...item, challengeId: "../../private?secret=1" },
  { ...item, displayName: "x".repeat(81) },
  { ...item, category: "toString" },
  { ...item, createdAt: "invalid" },
])("rejects malformed notification data before posting", (invalid) => {
  expect(() =>
    discordFeedbackPayload(invalid as DiscordFeedbackNotification),
  ).toThrow("invalid_notification");
});
it("requires internal authentication and POST before touching the outbox or Discord", async () => {
  const s = setup();
  expect((await s.handler(s.request("wrong"))).status).toBe(401);
  expect(
    (await s.handler(s.request("internal-only-secret", "GET"))).status,
  ).toBe(405);
  expect(s.rpc).not.toHaveBeenCalled();
  expect(s.fetcher).not.toHaveBeenCalled();
});
it("leaves the outbox untouched if credentials or channel are absent", async () => {
  for (const s of [setup(""), setup(webhook, "")]) {
    expect((await s.handler(s.request())).status).toBe(503);
    expect(s.rpc).not.toHaveBeenCalled();
    expect(s.fetcher).not.toHaveBeenCalled();
  }
});
it.each([
  { channel_id: "1555947226709237913", guild_id: FEEDBACK_DISCORD_GUILD_ID },
  { channel_id: channelId, guild_id: "1555947225945870509" },
])(
  "verifies the destination before claiming or publicly posting",
  async (metadata) => {
    const s = setup();
    s.fetcher.mockResolvedValueOnce(Response.json(metadata));
    expect((await s.handler(s.request())).status).toBe(503);
    expect(s.rpc).not.toHaveBeenCalled();
    expect(s.fetcher).toHaveBeenCalledTimes(1);
  },
);
it("acknowledges delivery only after Discord confirms the message and claim token is accepted", async () => {
  const s = setup();
  expect(await (await s.handler(s.request())).json()).toEqual({
    status: "sent",
  });
  expect(s.fetcher).toHaveBeenCalledTimes(2);
  expect(s.fetcher.mock.calls[1][0]).toBe(webhook + "?wait=true");
  expect(s.fetcher.mock.calls[1][1]).toMatchObject({
    method: "POST",
    redirect: "error",
    signal: expect.any(AbortSignal),
  });
  expect(s.rpc).toHaveBeenLastCalledWith("finish_feedback_notification", {
    p_protocol: item.protocol,
    p_token: item.token,
    p_sent: true,
  });
});
it.each([
  new Response("failure", { status: 500 }),
  new Response("rate limited", { status: 429 }),
  new Response(null, { status: 204 }),
  new Response("invalid JSON", { status: 200 }),
  Response.json({
    id: "1555947226709237999",
    channel_id: "1555947226709237913",
  }),
  Response.json({ id: "invalid", channel_id: channelId }),
  new Response("x".repeat(65537)),
])(
  "fences an unconfirmed response without claiming successful delivery or retrying",
  async (response) => {
    const s = setup();
    s.fetcher
      .mockResolvedValueOnce(
        Response.json({
          channel_id: channelId,
          guild_id: FEEDBACK_DISCORD_GUILD_ID,
        }),
      )
      .mockResolvedValueOnce(response);
    expect((await s.handler(s.request())).status).toBe(502);
    expect(s.fetcher).toHaveBeenCalledTimes(2);
    expect(s.rpc).toHaveBeenLastCalledWith("finish_feedback_notification", {
      p_protocol: item.protocol,
      p_token: item.token,
      p_sent: false,
    });
  },
);
it("fences a network timeout without leaking its diagnostic or replaying the POST", async () => {
  const s = setup();
  s.fetcher
    .mockResolvedValueOnce(
      Response.json({
        channel_id: channelId,
        guild_id: FEEDBACK_DISCORD_GUILD_ID,
      }),
    )
    .mockRejectedValueOnce(
      new DOMException("secret-url private payload", "TimeoutError"),
    );
  const response = await s.handler(s.request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("secret-url");
  expect(s.fetcher).toHaveBeenCalledTimes(2);
  expect(s.rpc).toHaveBeenLastCalledWith("finish_feedback_notification", {
    p_protocol: item.protocol,
    p_token: item.token,
    p_sent: false,
  });
});
it("does not publish again when the outbox reports the prior item already claimed or sent", async () => {
  const s = setup();
  s.rpc.mockImplementation(async (name) =>
    name === "claim_discord_feedback_notification" ? null : true,
  );
  expect(await (await s.handler(s.request())).json()).toEqual({
    status: "idle",
  });
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});
it("does not report sent if the database claim is fenced or the final acknowledgement fails", async () => {
  const s = setup();
  s.rpc.mockImplementation(async (name) =>
    name === "claim_discord_feedback_notification" ? item : false,
  );
  expect((await s.handler(s.request())).status).toBe(502);
  s.rpc.mockImplementation(async (name) => {
    if (name === "claim_discord_feedback_notification") return item;
    throw new Error("database unavailable");
  });
  expect((await s.handler(s.request())).status).toBe(503);
});
