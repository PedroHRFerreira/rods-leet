import type { ProductFeedbackInput } from "../lib/contracts.ts";

export const FEEDBACK_MIN_LENGTH = 10;
export const FEEDBACK_MAX_LENGTH = 4000;
export type FeedbackValidation =
  { ok: true; input: ProductFeedbackInput } | { ok: false; error: string };

/** Shared by the form and server; identity and attachments are never client input. */
export function validateProductFeedback(value: unknown): FeedbackValidation {
  const fail = (error: string): FeedbackValidation => ({ ok: false, error });
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("Informe uma mensagem de feedback válida.");
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) =>
        !["category", "message", "contactEmail", "challengeId"].includes(key),
    )
  )
    return fail("O feedback contém campos não permitidos.");
  if (
    data.category !== "suggestion" &&
    data.category !== "criticism" &&
    data.category !== "praise"
  )
    return fail("Escolha sugestão, crítica ou elogio.");
  if (typeof data.message !== "string") return fail("Escreva sua mensagem.");
  const message = data.message.trim();
  if (
    Array.from(message).some((character) => {
      const code = character.charCodeAt(0);
      return (
        (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
      );
    })
  )
    return fail("A mensagem contém caracteres não permitidos.");
  if (
    message.length < FEEDBACK_MIN_LENGTH ||
    message.length > FEEDBACK_MAX_LENGTH
  )
    return fail("A mensagem deve ter entre 10 e 4.000 caracteres.");
  const input: ProductFeedbackInput = { category: data.category, message };
  if (data.contactEmail !== undefined) {
    if (typeof data.contactEmail !== "string")
      return fail("Informe um e-mail válido ou deixe o campo vazio.");
    const email = data.contactEmail.trim();
    if (email) {
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return fail("Informe um e-mail válido ou deixe o campo vazio.");
      input.contactEmail = email;
    }
  }
  if (data.challengeId !== undefined) {
    if (
      typeof data.challengeId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(data.challengeId)
    )
      return fail("O desafio informado é inválido.");
    input.challengeId = data.challengeId;
  }
  return { ok: true, input };
}
