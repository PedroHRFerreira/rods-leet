import { afterEach, expect, it, vi } from "vitest";
import {
  createMailHandler,
  notificationMail,
  type FeedbackNotification,
} from "../supabase/functions/feedback-mail/service";
const item: FeedbackNotification = {
  protocol: "00000000-0000-4000-8000-000000000001",
  token: "00000000-0000-4000-8000-000000000002",
  category: "suggestion",
  message: "Mais exemplos, por favor.",
  contactEmail: "visitor@example.test",
  challengeId: "concept-values",
  createdAt: "2026-10-01T20:00:00Z",
};
afterEach(() => vi.restoreAllMocks());
function setup(configured = true) {
  const rpc = vi
    .fn()
    .mockImplementation(async (name: string) =>
      name === "claim_feedback_notification" ? item : true,
    );
  const send = vi.fn().mockResolvedValue(undefined);
  const handler = createMailHandler({
    secret: () => "server-only-secret",
    configured: () => configured,
    db: { rpc },
    send,
  });
  const request = (secret = "server-only-secret", method = "POST") =>
    new Request("https://example.test/feedback-mail", {
      method,
      headers: { "x-coordinator-secret": secret },
    });
  return { handler, rpc, send, request };
}
it("sends only to the approved mailbox, with no visitor-controlled headers or HTML", () => {
  const mail = notificationMail(item);
  expect(mail).toMatchObject({
    from: "devpedrohr@gmail.com",
    to: "devpedrohr@gmail.com",
  });
  expect(mail.subject).not.toContain(item.contactEmail);
  expect(mail.text).toContain("não verificado");
  expect(mail.text).toContain(item.message);
  expect(mail).not.toHaveProperty("replyTo");
  expect(mail).not.toHaveProperty("html");
  expect(notificationMail(item).messageId).toBe(mail.messageId);
});
it("requires the internal secret before claiming or contacting Gmail", async () => {
  const s = setup();
  expect((await s.handler(s.request("wrong"))).status).toBe(401);
  expect(s.rpc).not.toHaveBeenCalled();
  expect(s.send).not.toHaveBeenCalled();
});
it("leaves feedback pending when the app password is absent", async () => {
  const s = setup(false);
  expect((await s.handler(s.request())).status).toBe(503);
  expect(s.rpc).not.toHaveBeenCalled();
  expect(s.send).not.toHaveBeenCalled();
});
it("marks sent only after Gmail accepts the message and the token still owns the claim", async () => {
  const s = setup();
  await expect((await s.handler(s.request())).json()).resolves.toEqual({
    status: "sent",
  });
  expect(s.send).toHaveBeenCalledWith(notificationMail(item));
  expect(s.rpc).toHaveBeenLastCalledWith("finish_feedback_notification", {
    p_protocol: item.protocol,
    p_token: item.token,
    p_sent: true,
  });
});
it("returns idle without inventing a delivery when the queue is empty", async () => {
  const s = setup();
  s.rpc.mockResolvedValue(null);
  await expect((await s.handler(s.request())).json()).resolves.toEqual({
    status: "idle",
  });
  expect(s.send).not.toHaveBeenCalled();
});
it("fences ambiguous SMTP failures instead of automatically resending", async () => {
  const s = setup();
  s.send.mockRejectedValue(
    new Error("SMTP password and contact must not be logged"),
  );
  const response = await s.handler(s.request());
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ status: "uncertain" });
  expect(s.rpc).toHaveBeenLastCalledWith("finish_feedback_notification", {
    p_protocol: item.protocol,
    p_token: item.token,
    p_sent: false,
  });
});
it("does not claim sent when the final database write is lost or fenced", async () => {
  const s = setup();
  s.rpc.mockImplementation(async (name: string) =>
    name === "claim_feedback_notification" ? item : false,
  );
  expect((await s.handler(s.request())).status).toBe(502);
  s.rpc.mockImplementation(async (name: string) => {
    if (name === "claim_feedback_notification") return item;
    throw new Error("database unavailable");
  });
  expect((await s.handler(s.request())).status).toBe(503);
});
