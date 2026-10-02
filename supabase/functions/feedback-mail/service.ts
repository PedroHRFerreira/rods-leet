import { Database, secretsMatch } from "../_shared/db.ts";

export const FEEDBACK_MAILBOX = "devpedrohr@gmail.com";
export interface FeedbackNotification {
  protocol: string;
  token: string;
  category: "suggestion" | "criticism" | "praise";
  message: string;
  contactEmail: string | null;
  challengeId: string | null;
  createdAt: string;
}
export interface FeedbackMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  messageId: string;
}
export function notificationMail(item: FeedbackNotification): FeedbackMail {
  const labels = {
    suggestion: "Sugestão",
    criticism: "Crítica",
    praise: "Elogio",
  };
  return {
    from: FEEDBACK_MAILBOX,
    to: FEEDBACK_MAILBOX,
    subject: `[Rods Leet] ${labels[item.category]} · ${item.protocol}`,
    messageId: `<rods-feedback-${item.protocol}@gmail.com>`,
    text: [
      `Feedback recebido no Rods Leet`,
      `Protocolo: ${item.protocol}`,
      `Categoria: ${labels[item.category]}`,
      `Recebido em: ${item.createdAt}`,
      `Desafio: ${item.challengeId ?? "não informado"}`,
      `Contato informado pelo visitante (não verificado): ${item.contactEmail ?? "não informado"}`,
      "",
      item.message,
    ].join("\n"),
  };
}
export function createMailHandler(options: {
  secret: () => string | undefined;
  configured: () => boolean;
  db?: Pick<Database, "rpc">;
  send: (mail: FeedbackMail) => Promise<void>;
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
    if (request.method !== "POST") return new Response(null, { status: 405 });
    if (!options.configured())
      return Response.json({ error: "mail_unconfigured" }, { status: 503 });
    const db = options.db ?? new Database();
    try {
      const item = await db.rpc<FeedbackNotification | null>(
        "claim_feedback_notification",
      );
      if (!item) return Response.json({ status: "idle" });
      try {
        await options.send(notificationMail(item));
      } catch {
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
      if (!finished)
        return Response.json({ status: "uncertain" }, { status: 502 });
      return Response.json({ status: "sent" });
    } catch {
      // Do not log message, contact, credentials or SMTP diagnostics.
      return Response.json({ error: "notification_failed" }, { status: 503 });
    }
  };
}
