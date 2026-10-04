// Tombstone: historical cron calls must never deliver private feedback by email.
export function retiredFeedbackMailHandler(): Response {
  return Response.json({ error: "feedback_mail_retired" }, { status: 410 });
}
