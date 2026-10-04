import { createDiscordFeedbackHandler } from "./service.ts";
export const handler = createDiscordFeedbackHandler({
  secret: () => Deno.env.get("COORDINATOR_SECRET"),
  webhookUrl: () => Deno.env.get("DISCORD_FEEDBACK_WEBHOOK_URL"),
  channelId: () => Deno.env.get("DISCORD_FEEDBACK_CHANNEL_ID"),
});
if (import.meta.main) Deno.serve(handler);
