import { expect, it } from "vitest";
import { retiredFeedbackMailHandler } from "../supabase/functions/feedback-mail/service";
it("retires email dispatch without claiming or sending private feedback", async () => {
  const response = retiredFeedbackMailHandler();
  expect(response.status).toBe(410);
  expect(await response.json()).toEqual({ error: "feedback_mail_retired" });
});
