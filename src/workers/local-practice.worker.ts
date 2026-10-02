import variant from "@jitl/quickjs-singlefile-browser-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import { validateLocalPractice } from "../domain/local-practice-validation";
import { executeLocalJavaScript } from "../lib/local-practice-runtime";
import type {
  LocalPracticeInput,
  LocalPracticeOutcome,
} from "../domain/local-practice";
import { LOCAL_PRACTICE_LIMITS } from "../domain/local-practice";

const scope = self as unknown as {
  onmessage:
    | ((event: MessageEvent<{ id: string; input: LocalPracticeInput }>) => void)
    | null;
  postMessage: (message: unknown) => void;
};
let consumed = false;
scope.onmessage = async ({ data }) => {
  if (consumed || !data || typeof data.id !== "string") return;
  consumed = true;
  const { id, input } = data;
  let started = false;
  const send = (outcome: LocalPracticeOutcome) =>
    scope.postMessage({ id, type: "result", outcome });
  try {
    const prepared = validateLocalPractice(input);
    if (!prepared.available) {
      send({
        kind: "unavailable",
        reason: "load_failed",
        message: "Este código precisa da execução no servidor.",
      });
      return;
    }
    const module = await newQuickJSWASMModuleFromVariant(variant);
    const compiler =
      prepared.languageId === "typescript"
        ? await import("../lib/local-practice-typescript")
        : null;
    scope.postMessage({ id, type: "started" });
    started = true;
    if (compiler) {
      const next = compiler.prepareTypeScript(prepared);
      if ("error" in next) {
        const diagnostic = new TextDecoder().decode(
          new TextEncoder()
            .encode(next.error)
            .subarray(0, LOCAL_PRACTICE_LIMITS.maxOutputBytes),
          { stream: true },
        );
        send({
          kind: "executed",
          result: {
            status: "compile_error",
            stdout: "",
            stderr: diagnostic,
            wallMs: 0,
          },
        });
        return;
      }
      prepared.source = next.source;
    }
    send({
      kind: "executed",
      result: executeLocalJavaScript(module, prepared),
    });
  } catch {
    send(
      started
        ? {
            kind: "executed",
            result: {
              status: "runtime_error",
              stdout: "",
              stderr:
                "Não foi possível concluir este código no ambiente local.",
              wallMs: 0,
            },
          }
        : {
            kind: "unavailable",
            reason: "load_failed",
            message:
              "Não foi possível preparar o teste local. Tentaremos o servidor.",
          },
    );
  }
};
