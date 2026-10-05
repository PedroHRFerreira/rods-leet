import { AlertCircle } from "lucide-react";
import {
  LOCAL_PRACTICE_LIMITS,
  type LocalPracticeResult as PracticeResult,
} from "../domain/local-practice";

export interface LocalPracticeResultProps {
  result?: PracticeResult | null;
  phase?: "loading" | "running" | null;
}

const errors: Partial<Record<PracticeResult["status"], string>> = {
  compile_error: "Erro de sintaxe ou tipo",
  runtime_error: "Erro de execução",
  time_limit: "Tempo de execução excedido",
  memory_limit: "Memória disponível excedida",
  output_limit: "Saída muito longa. O texto abaixo foi abreviado.",
};

function boundedText(value: string): string {
  const limit = LOCAL_PRACTICE_LIMITS.maxOutputBytes;
  return value.length <= limit
    ? value
    : `${value.slice(0, limit)}\n… (texto abreviado)`;
}

function showReturn(value: unknown): string {
  if (value === undefined) return "A função não retornou um valor.";
  try {
    return boundedText(
      JSON.stringify(value, null, 2) ?? "A função não retornou um valor.",
    );
  } catch {
    return "Não foi possível mostrar o retorno desta função.";
  }
}

export default function LocalPracticeResult({
  result = null,
  phase = null,
}: LocalPracticeResultProps) {
  if (!result && !phase) return null;
  if (phase) {
    return (
      <div
        className="results-empty local-practice-result"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="evaluation-spinner" aria-hidden="true" />
        <strong>{phase === "loading" ? "Preparando…" : "Executando…"}</strong>
      </div>
    );
  }
  if (!result) return null;
  const successful = result.status === "ok";
  const error = errors[result.status];
  return (
    <div
      className="submission-result local-practice-result"
      role={successful ? "status" : "alert"}
      aria-live="polite"
      aria-busy="false"
    >
      {error && (
        <h3>
          <AlertCircle size={21} aria-hidden="true" />
          {error}
        </h3>
      )}
      {successful && (
        <div className="program-output local-practice-output">
          <strong>Retorno da função</strong>
          <pre>{showReturn(result.output)}</pre>
        </div>
      )}
      {result.stdout && (
        <div className="program-output local-practice-output">
          <strong>Saída do seu código</strong>
          <pre>{boundedText(result.stdout)}</pre>
        </div>
      )}
      {result.stderr && (
        <div className="program-output local-practice-output">
          <strong>Erros e avisos</strong>
          <pre>{boundedText(result.stderr)}</pre>
        </div>
      )}
    </div>
  );
}
