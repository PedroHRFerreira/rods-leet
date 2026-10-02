import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  localPracticeAvailable,
  runLocalPractice,
} from "./local-practice-client";
import type {
  LocalPracticeInput,
  LocalPracticeOutcome,
} from "../domain/local-practice";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  get id(): string {
    return this.postMessage.mock.calls[0][0].id;
  }
  message(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
const input: LocalPracticeInput = {
  languageId: "javascript",
  files: [
    { path: "main.js", content: "function answer(value) { return value; }" },
  ],
  functionName: "answer",
  input: [1, 2],
};
const executed: LocalPracticeOutcome = {
  kind: "executed",
  result: { status: "ok", stdout: "", stderr: "", wallMs: 1, output: [1, 2] },
};
function latest() {
  return FakeWorker.instances.at(-1)!;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("WebAssembly", {});
  vi.stubEnv("VITE_LOCAL_PRACTICE_ENABLED", "true");
  FakeWorker.instances = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isolated local practice client", () => {
  it("offers only explicit JS/TS profiles and avoids constructing workers for unsupported languages", async () => {
    expect(localPracticeAvailable("javascript")).toBe(true);
    expect(localPracticeAvailable("typescript")).toBe(true);
    for (const languageId of ["python", "java", "cpp"] as const) {
      expect(localPracticeAvailable(languageId)).toBe(false);
      expect(await runLocalPractice({ ...input, languageId })).toMatchObject({
        kind: "unavailable",
        reason: "unsupported_language",
      });
    }
    expect(FakeWorker.instances).toHaveLength(0);
  });
  it("respects disabled configuration and unavailable browser support", async () => {
    vi.stubEnv("VITE_LOCAL_PRACTICE_ENABLED", "false");
    expect(localPracticeAvailable("javascript")).toBe(false);
    expect(await runLocalPractice(input)).toMatchObject({ reason: "disabled" });
    vi.stubEnv("VITE_LOCAL_PRACTICE_ENABLED", "true");
    vi.stubGlobal("WebAssembly", undefined);
    expect(await runLocalPractice(input)).toMatchObject({
      reason: "unsupported_browser",
    });
    expect(FakeWorker.instances).toHaveLength(0);
  });
  it("rejects oversized UTF-8 input and source before constructing a worker", async () => {
    expect(
      await runLocalPractice({ ...input, input: "🙂".repeat(20_000) }),
    ).toMatchObject({ reason: "invalid_input" });
    expect(
      await runLocalPractice({
        ...input,
        files: [{ path: "main.js", content: "🙂".repeat(20_000) }],
      }),
    ).toMatchObject({ reason: "unsupported_workspace" });
    expect(FakeWorker.instances).toHaveLength(0);
  });
  it("ignores stale request IDs, reports phases, returns a valid receipt and cleans up once", async () => {
    const onPhase = vi.fn();
    const pending = runLocalPractice(input, { onPhase });
    const worker = latest();
    worker.message({ id: "old", type: "result", outcome: executed });
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.message({ id: worker.id, type: "started" });
    worker.message({ id: worker.id, type: "result", outcome: executed });
    expect(await pending).toEqual(executed);
    expect(onPhase.mock.calls).toEqual([["loading"], ["running"]]);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses remote fallback only for startup timeout", async () => {
    const pending = runLocalPractice(input);
    await vi.advanceTimersByTimeAsync(11_999);
    expect(latest().terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({
      kind: "unavailable",
      reason: "load_failed",
    });
    expect(latest().terminate).toHaveBeenCalledTimes(1);
  });
  it("enforces the hard execution deadline and never turns a timeout into fallback", async () => {
    const pending = runLocalPractice(input);
    latest().message({ id: latest().id, type: "started" });
    latest().message({ id: latest().id, type: "started" });
    await vi.advanceTimersByTimeAsync(3_099);
    expect(latest().terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({
      kind: "executed",
      result: { status: "time_limit" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([
    "compile_error",
    "runtime_error",
    "memory_limit",
    "output_limit",
  ] as const)("preserves %s as an executed learner result", async (status) => {
    const pending = runLocalPractice(input);
    latest().message({
      id: latest().id,
      type: "result",
      outcome: { kind: "executed", result: { ...executed.result, status } },
    });
    expect(await pending).toMatchObject({
      kind: "executed",
      result: { status },
    });
  });
  it.each([
    { ...executed.result, status: "accepted" },
    { ...executed.result, xpAwarded: 100 },
    { ...executed.result, wallMs: NaN },
    { ...executed.result, wallMs: -1 },
    { ...executed.result, stdout: "🙂".repeat(4097) },
    {
      ...executed.result,
      stdout: "a".repeat(10_000),
      stderr: "b".repeat(10_000),
    },
    { ...executed.result, output: "x".repeat(16_384) },
    { ...executed.result, output: Infinity },
    { ...executed.result, output: new Date() },
  ])("rejects corrupted or unsafe result receipts", async (result) => {
    const pending = runLocalPractice(input);
    latest().message({
      id: latest().id,
      type: "result",
      outcome: { kind: "executed", result },
    });
    expect(await pending).toMatchObject({
      kind: "unavailable",
      reason: "load_failed",
    });
  });
  it("handles worker faults as load failures and releases resources", async () => {
    const pending = runLocalPractice(input);
    latest().onerror?.();
    expect(await pending).toMatchObject({
      kind: "unavailable",
      reason: "load_failed",
    });
    expect(latest().terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels pending practice and ignores queued replies after abort", async () => {
    const controller = new AbortController();
    const pending = runLocalPractice(input, { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    const worker = latest();
    const queuedMessage = worker.onmessage!;
    controller.abort();
    queuedMessage({
      data: { id: worker.id, type: "result", outcome: executed },
    } as MessageEvent);
    await rejected;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects an already aborted signal without constructing a worker", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runLocalPractice(input, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
