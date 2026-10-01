import { challenges } from "../../../src/content/catalog.ts";
import { getEvaluation, parseProgramOutput } from "../../../judge/index.ts";
import { Database, env, secretsMatch } from "../_shared/db.ts";
import {
  E2BExecutionProvider,
  LocalExecutionProvider,
  type CodeExecutionProvider,
  type ExecutionResult,
} from "../_shared/execution.ts";
import type { Row } from "../_shared/presenters.ts";

export async function executorReady(): Promise<boolean> {
  const providerName = Deno.env.get("EXECUTION_PROVIDER") ?? "disabled";
  if (providerName === "local") {
    return new LocalExecutionProvider(
      env("LOCAL_EXECUTOR_URL"),
      env("LOCAL_EXECUTOR_TOKEN"),
    ).isReady();
  }
  return providerName === "e2b" && Boolean(Deno.env.get("E2B_API_KEY"));
}

export async function executorStatus(): Promise<"ready" | "busy" | "offline"> {
  const providerName = Deno.env.get("EXECUTION_PROVIDER") ?? "disabled";
  if (providerName === "local") {
    return new LocalExecutionProvider(
      env("LOCAL_EXECUTOR_URL"),
      env("LOCAL_EXECUTOR_TOKEN"),
    ).status();
  }
  return providerName === "e2b" && Boolean(Deno.env.get("E2B_API_KEY"))
    ? "ready"
    : "offline";
}

export async function processOne(): Promise<void> {
  const db = new Database();
  const providerName = Deno.env.get("EXECUTION_PROVIDER") ?? "disabled";
  if (providerName === "disabled") return;
  const claimed = await db.rpc<Row | null>("claim_evaluation");
  if (!claimed) return;
  const { submission: s, leaseToken, runtime } = claimed;
  let verdict = "infrastructure_error";
  let result: Row = {
    message: "Falha da infraestrutura. Sua tentativa foi preservada.",
  };
  let executionRef: string | undefined;
  try {
    const challenge = challenges.find(
      (c) => c.versionId === s.challenge_version_id,
    );
    if (!challenge) throw new Error("version_unavailable");
    const executionMode = s.execution_mode ?? "function";
    const evaluation = getEvaluation(
      challenge.id,
      s.language_id,
      s.kind,
      executionMode,
    );
    const freeProgram =
      s.kind === "run" &&
      executionMode === "program" &&
      challenge.kind !== "sql";
    let provider: CodeExecutionProvider;
    if (providerName === "local") {
      provider = new LocalExecutionProvider(
        env("LOCAL_EXECUTOR_URL"),
        env("LOCAL_EXECUTOR_TOKEN"),
      );
    } else if (providerName === "e2b") {
      provider = new E2BExecutionProvider(env("E2B_API_KEY"));
    } else {
      throw new Error("execution_provider_unavailable");
    }
    const execution: ExecutionResult = await provider.execute({
      submissionId: s.id,
      templateId: runtime.template_id,
      manifestSha256: runtime.manifest_sha256,
      languageId: s.language_id,
      runtimeVersion: runtime.runtime_version,
      functionName:
        challenge.kind === "sql" ? "sql" : (challenge.functionName ?? "solve"),
      files: s.files,
      executionMode,
      cases: freeProgram
        ? [{ input: null, stdin: s.stdin ?? "" }]
        : evaluation.cases.map((c) => ({ input: c.input })),
      sqlSchema: challenge.sqlSchema,
    });
    executionRef = execution.executionRef;
    if (execution.termination !== "ok") {
      verdict = [
        "compile_error",
        "time_limit",
        "memory_limit",
        "output_limit",
        "runtime_error",
      ].includes(execution.termination)
        ? execution.termination
        : "infrastructure_error";
    } else if (freeProgram) {
      const actual = execution.cases[0];
      verdict =
        actual?.termination === "ok"
          ? "accepted"
          : (actual?.termination ?? "infrastructure_error");
      result = actual
        ? {
            message:
              actual.termination === "ok"
                ? "Código executado. Confira a saída abaixo."
                : "Seu programa encerrou com erro ou excedeu um limite.",
            stdout: actual.stdout,
            stderr: actual.stderr,
            metrics: actual.metrics,
          }
        : { message: "Falha da infraestrutura. Sua tentativa foi preservada." };
    } else {
      verdict = "accepted";
      let cpuMs = 0,
        wallMs = 0,
        peakMemoryKiB = 0;
      const publicCases: Row[] = [];
      for (let index = 0; index < evaluation.cases.length; index++) {
        const test = evaluation.cases[index],
          actual = execution.cases[index];
        if (!actual) {
          verdict = "infrastructure_error";
          break;
        }
        let passed = false,
          value: unknown;
        if (actual.termination !== "ok") verdict = actual.termination;
        else {
          try {
            value =
              executionMode === "program" && challenge.kind !== "sql"
                ? parseProgramOutput(actual.stdout)
                : JSON.parse(actual.stdout);
            passed = evaluation.compare(test.input, test.expected, value);
          } catch {
            passed = false;
          }
          if (!passed) verdict = "wrong_answer";
        }
        if (test.public) {
          publicCases.push({
            label: `Exemplo ${publicCases.length + 1}`,
            passed,
            input: JSON.stringify(test.input).slice(0, 2000),
            expected: JSON.stringify(test.expected).slice(0, 2000),
            actual: actual.stdout.slice(0, 2000),
          });
        }
        cpuMs += actual.metrics.cpuMs;
        wallMs += actual.metrics.wallMs;
        peakMemoryKiB = Math.max(peakMemoryKiB, actual.metrics.peakMemoryKiB);
        if (!passed) break;
      }
      result = {
        message:
          verdict === "accepted"
            ? "Todos os testes obrigatórios passaram."
            : verdict === "wrong_answer"
              ? "A solução falhou em um caso obrigatório. Revise os casos de borda."
              : verdict === "infrastructure_error"
                ? "Falha da infraestrutura. Sua tentativa foi preservada."
                : "Seu programa excedeu um limite ou encerrou com erro.",
        publicCases,
        metrics: { cpuMs, wallMs, peakMemoryKiB },
      };
    }
    if (execution.termination !== "ok") {
      const messages: Record<string, string> = {
        compile_error:
          "Não foi possível compilar seu código. Confira as assinaturas e a sintaxe.",
        runtime_error: "Seu programa encerrou com erro.",
        time_limit: "Seu programa excedeu o limite de tempo.",
        memory_limit: "Seu programa excedeu o limite de memória.",
        output_limit: "Seu programa excedeu o limite de saída.",
        infrastructure_error:
          "Falha da infraestrutura. Sua tentativa foi preservada.",
      };
      result = { message: messages[verdict] ?? messages.infrastructure_error };
      if (verdict === "compile_error" && execution.compilation?.stderr) {
        const bytes = new TextEncoder()
          .encode(execution.compilation.stderr)
          .slice(0, 4096);
        const diagnostic = new TextDecoder().decode(bytes).replace(
          // eslint-disable-next-line no-control-regex -- Intentionally reject or strip control characters from untrusted input.
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
          "",
        );
        result.message += `\n\n${diagnostic}`;
      }
    }
  } catch {
    console.error(
      JSON.stringify({ event: "evaluation_failed", submissionId: s.id }),
    );
  }
  await db.rpc("finish_evaluation", {
    p_submission: s.id,
    p_lease: leaseToken,
    p_verdict: verdict,
    p_result: result,
    p_execution_ref: executionRef ?? null,
  });
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
export async function handler(request: Request): Promise<Response> {
  const expected = Deno.env.get("COORDINATOR_SECRET");
  if (
    request.method !== "POST" ||
    !expected ||
    !(await secretsMatch(
      request.headers.get("x-coordinator-secret") ?? "",
      expected,
    ))
  )
    return new Response(null, { status: 401 });
  if (new URL(request.url).searchParams.get("check") === "ready") {
    const status = await executorStatus();
    return Response.json(
      { status },
      { status: status === "ready" ? 200 : status === "busy" ? 429 : 503 },
    );
  }
  EdgeRuntime.waitUntil(
    processOne().catch(() => console.error('{"event":"coordinator_failed"}')),
  );
  return Response.json({ scheduled: true }, { status: 202 });
}
if (import.meta.main) Deno.serve(handler);
