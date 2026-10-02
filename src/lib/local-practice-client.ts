import type { LanguageId } from "./contracts";
import {
  LOCAL_PRACTICE_LIMITS,
  selectLocalPracticeProfile,
  type LocalPracticeInput,
  type LocalPracticeOutcome,
  type LocalPracticeProfile,
  type LocalPracticeUnavailableReason,
} from "../domain/local-practice";
import { validateLocalPractice } from "../domain/local-practice-validation";

const profiles: readonly LocalPracticeProfile[] = [
  {
    languageId: "javascript",
    runtimeId: "quickjs-wasm",
    homologated: true,
    isolated: true,
  },
  {
    languageId: "typescript",
    runtimeId: "quickjs-wasm",
    homologated: true,
    isolated: true,
  },
];
const statuses = new Set([
  "ok",
  "compile_error",
  "runtime_error",
  "time_limit",
  "memory_limit",
  "output_limit",
]);
const encoder = new TextEncoder();
const unavailable = (
  reason: LocalPracticeUnavailableReason,
): LocalPracticeOutcome => ({
  kind: "unavailable",
  reason,
  message: "A prática local não está disponível. Use a execução no servidor.",
});
function unavailableReason(
  languageId: LanguageId,
): LocalPracticeUnavailableReason | null {
  if (import.meta.env.VITE_LOCAL_PRACTICE_ENABLED === "false")
    return "disabled";
  if (!selectLocalPracticeProfile(languageId, profiles))
    return "unsupported_language";
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined")
    return "unsupported_browser";
  return null;
}
export function localPracticeAvailable(languageId: LanguageId): boolean {
  return unavailableReason(languageId) === null;
}

function receipt(value: unknown): LocalPracticeOutcome | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outcome = value as Record<string, unknown>;
  if (outcome.kind === "unavailable") {
    if (
      Object.keys(outcome).some(
        (key) => !["kind", "reason", "message"].includes(key),
      )
    )
      return null;
    return outcome.reason === "load_failed" &&
      typeof outcome.message === "string" &&
      encoder.encode(outcome.message).length <=
        LOCAL_PRACTICE_LIMITS.maxOutputBytes
      ? unavailable("load_failed")
      : null;
  }
  if (
    outcome.kind !== "executed" ||
    Object.keys(outcome).some((key) => !["kind", "result"].includes(key))
  )
    return null;
  if (
    !outcome.result ||
    typeof outcome.result !== "object" ||
    Array.isArray(outcome.result)
  )
    return null;
  const result = outcome.result as Record<string, unknown>;
  if (
    Object.keys(result).some(
      (key) =>
        !["status", "stdout", "stderr", "output", "wallMs"].includes(key),
    ) ||
    typeof result.status !== "string" ||
    !statuses.has(result.status) ||
    typeof result.stdout !== "string" ||
    typeof result.stderr !== "string" ||
    typeof result.wallMs !== "number" ||
    !Number.isFinite(result.wallMs) ||
    result.wallMs < 0 ||
    encoder.encode(result.stdout).length +
      encoder.encode(result.stderr).length >
      LOCAL_PRACTICE_LIMITS.maxOutputBytes
  )
    return null;
  if ("output" in result) {
    const output = validateLocalPractice({
      languageId: "javascript",
      files: [{ path: "output.js", content: "" }],
      functionName: "output",
      input: result.output,
    });
    if (
      !output.available ||
      encoder.encode(output.inputJson).length >
        LOCAL_PRACTICE_LIMITS.maxOutputBytes
    )
      return null;
  }
  return value as LocalPracticeOutcome;
}

export function runLocalPractice(
  input: LocalPracticeInput,
  {
    signal,
    onPhase,
  }: {
    signal?: AbortSignal;
    onPhase?: (phase: "loading" | "running") => void;
  } = {},
): Promise<LocalPracticeOutcome> {
  if (signal?.aborted)
    return Promise.reject(new DOMException("Prática cancelada", "AbortError"));
  const validation = validateLocalPractice(input);
  if (!validation.available)
    return Promise.resolve(unavailable(validation.reason));
  const reason = unavailableReason(input.languageId);
  if (reason) return Promise.resolve(unavailable(reason));
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let started = false;
    const id = crypto.randomUUID();
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
    }
    function finish(outcome: LocalPracticeOutcome) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    }
    function abort() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException("Prática cancelada", "AbortError"));
    }
    try {
      worker = new Worker(
        new URL("../workers/local-practice.worker.ts", import.meta.url),
        { type: "module" },
      );
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (settled) return;
        if (!event.data || typeof event.data !== "object") {
          finish(unavailable("load_failed"));
          return;
        }
        const message = event.data as Record<string, unknown>;
        if (message.id !== id) return;
        if (message.type === "started" && !started) {
          started = true;
          clearTimeout(timer);
          timer = setTimeout(
            () =>
              finish({
                kind: "executed",
                result: {
                  status: "time_limit",
                  stdout: "",
                  stderr: "Tempo limite da prática local atingido.",
                  wallMs: LOCAL_PRACTICE_LIMITS.wallMs,
                },
              }),
            LOCAL_PRACTICE_LIMITS.wallMs + 100,
          );
          onPhase?.("running");
        } else if (message.type === "result") {
          finish(receipt(message.outcome) ?? unavailable("load_failed"));
        } else if (message.type !== "started")
          finish(unavailable("load_failed"));
      };
      worker.onerror = () => finish(unavailable("load_failed"));
      worker.onmessageerror = () => finish(unavailable("load_failed"));
      timer = setTimeout(() => finish(unavailable("load_failed")), 12_000);
      onPhase?.("loading");
      if (signal?.aborted) {
        abort();
        return;
      }
      worker.postMessage({ id, input });
    } catch {
      finish(unavailable("load_failed"));
    }
  });
}
