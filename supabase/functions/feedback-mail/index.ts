import { retiredFeedbackMailHandler } from "./service.ts";
export const handler = retiredFeedbackMailHandler;
if (import.meta.main) Deno.serve(handler);
