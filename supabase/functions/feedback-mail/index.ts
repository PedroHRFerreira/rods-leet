import nodemailer from "npm:nodemailer@9.0.1";
import { createMailHandler } from "./service.ts";

export const handler = createMailHandler({
  secret: () => Deno.env.get("COORDINATOR_SECRET"),
  configured: () => Boolean(Deno.env.get("GMAIL_APP_PASSWORD")),
  async send(mail) {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: mail.from, pass: Deno.env.get("GMAIL_APP_PASSWORD")! },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail(mail);
      if (!result.accepted?.includes(mail.to))
        throw new Error("recipient_not_accepted");
    } finally {
      transport.close();
    }
  },
});
if (import.meta.main) Deno.serve(handler);
