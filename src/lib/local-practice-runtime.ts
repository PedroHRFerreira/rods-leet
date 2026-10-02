import type { QuickJSWASMModule } from "quickjs-emscripten-core";
import {
  LOCAL_PRACTICE_LIMITS,
  type LocalPracticeResult,
} from "../domain/local-practice";
import type { LocalPracticeValidation } from "../domain/local-practice-validation";
import { validateLocalPractice } from "../domain/local-practice-validation";

export type PreparedPractice = Extract<
  LocalPracticeValidation,
  { available: true }
>;
const encoder = new TextEncoder();
function clip(value: string, bytes: number): string {
  return new TextDecoder().decode(
    encoder.encode(value).subarray(0, Math.max(0, bytes)),
    { stream: true },
  );
}

/** Guest code runs only in QuickJS memory. No browser, files, network or host eval bridge. */
export function executeLocalJavaScript(
  module: QuickJSWASMModule,
  prepared: PreparedPractice,
  wallMs = LOCAL_PRACTICE_LIMITS.wallMs,
): LocalPracticeResult {
  const start = performance.now();
  const limit = Math.min(wallMs, LOCAL_PRACTICE_LIMITS.wallMs);
  const runtime = module.newRuntime();
  runtime.setMemoryLimit(LOCAL_PRACTICE_LIMITS.memoryMiB * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
  let exhausted = false;
  let timedOut = false;
  let stdout = "";
  runtime.setInterruptHandler(() => {
    timedOut ||= performance.now() - start >= limit;
    return timedOut || exhausted;
  });
  runtime.setModuleLoader((name) => {
    if (name !== "student")
      throw new Error("Este módulo não está disponível na prática local.");
    return prepared.source;
  });
  const vm = runtime.newContext();
  function result(
    status: LocalPracticeResult["status"],
    stderr = "",
    output?: unknown,
  ): LocalPracticeResult {
    return {
      status,
      stdout,
      stderr: clip(
        stderr,
        LOCAL_PRACTICE_LIMITS.maxOutputBytes - encoder.encode(stdout).length,
      ),
      ...(status === "ok" ? { output } : {}),
      wallMs: Math.max(0, performance.now() - start),
    };
  }
  const consoleObject = vm.newObject();
  const log = vm.newFunction("log", (...args) => {
    const parts = args.map((handle) => {
      if (vm.typeof(handle) === "string") return vm.getString(handle);
      try {
        return JSON.stringify(vm.dump(handle)) ?? String(vm.dump(handle));
      } catch {
        return "[valor não serializável]";
      }
    });
    const text = `${parts.join(" ")}\n`;
    const remaining =
      LOCAL_PRACTICE_LIMITS.maxOutputBytes - encoder.encode(stdout).length;
    if (encoder.encode(text).length > remaining) exhausted = true;
    stdout += clip(text, remaining);
  });
  for (const name of ["log", "info", "warn", "error", "debug"])
    vm.setProp(consoleObject, name, log);
  vm.setProp(vm.global, "console", consoleObject);
  log.dispose();
  consoleObject.dispose();
  const fn = JSON.stringify(prepared.functionName);
  const call =
    prepared.functionName === "shortestPath"
      ? `student[${fn}](input.graph, input.start, input.end)`
      : `student[${fn}](input)`;
  const code = `import * as student from 'student';
const input = JSON.parse(${JSON.stringify(prepared.inputJson)});
const original = JSON.stringify(input);
if (typeof student[${fn}] !== 'function') throw new Error('Mantenha a função exportada ${prepared.functionName} do modelo. A plataforma chama essa função automaticamente.');
const returned = ${call};
if (returned && typeof returned.then === 'function') throw new Error('A prática local aceita funções síncronas. Retorne o resultado diretamente, sem async ou Promise.');
if (returned === undefined) throw new Error('A função não retornou um valor. Use return para devolver o resultado.');
const value = ${prepared.functionName === "findMax" ? "{result: returned, inputUnchanged: JSON.stringify(input) === original}" : "returned"};
globalThis.__practice_output = JSON.stringify(value);`;
  try {
    const evaluated = vm.evalCode(code, "practice.mjs", { type: "module" });
    if (evaluated.error) {
      const error = vm.dump(evaluated.error) as
        { name?: string; message?: string; stack?: string } | string;
      evaluated.error.dispose();
      if (exhausted) return result("output_limit");
      if (timedOut)
        return result(
          "time_limit",
          "O código não terminou dentro do limite do teste.",
        );
      const message =
        typeof error === "string"
          ? error
          : `${error.name ?? "Erro"}: ${error.message ?? "Falha ao executar a função."}`;
      const status =
        typeof error !== "string" && error.name === "SyntaxError"
          ? "compile_error"
          : typeof error !== "string" &&
              error.name === "InternalError" &&
              /out of memory/i.test(error.message ?? "")
            ? "memory_limit"
            : "runtime_error";
      return result(status, message);
    }
    evaluated.value.dispose();
    while (runtime.hasPendingJob()) {
      const jobs = runtime.executePendingJobs(1);
      if (jobs.error) {
        const error = vm.dump(jobs.error);
        jobs.error.dispose();
        return result(
          exhausted
            ? "output_limit"
            : timedOut
              ? "time_limit"
              : /out of memory/i.test(String(error?.message))
                ? "memory_limit"
                : "runtime_error",
          String(error?.message ?? "Falha ao executar a função."),
        );
      }
      if (timedOut || exhausted) break;
    }
    if (exhausted) return result("output_limit");
    if (timedOut)
      return result(
        "time_limit",
        "O código não terminou dentro do limite do teste.",
      );
    const outputHandle = vm.getProp(vm.global, "__practice_output");
    let json: string;
    try {
      if (vm.typeof(outputHandle) !== "string")
        return result(
          "runtime_error",
          "Não foi possível obter o retorno da função.",
        );
      json = vm.getString(outputHandle);
    } finally {
      outputHandle.dispose();
    }
    if (
      encoder.encode(json).length + encoder.encode(stdout).length >
      LOCAL_PRACTICE_LIMITS.maxOutputBytes
    )
      return result(
        "output_limit",
        "O retorno e as mensagens excederam o limite do teste.",
      );
    const output: unknown = JSON.parse(json);
    const checked = validateLocalPractice({
      languageId: "javascript",
      files: [{ path: "solution.js", content: "" }],
      functionName: "solve",
      input: output,
    });
    if (!checked.available)
      return result(
        "output_limit",
        "O retorno excedeu os limites de estrutura do teste.",
      );
    return result("ok", "", output);
  } catch {
    return result(
      exhausted ? "output_limit" : timedOut ? "time_limit" : "runtime_error",
      "Não foi possível concluir este código no ambiente local.",
    );
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
