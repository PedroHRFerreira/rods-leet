import { AlertCircle, Monitor } from "lucide-react";
import {
  LOCAL_PRACTICE_LIMITS,
  type LocalPracticeResult as PracticeResult,
} from "../domain/local-practice";

export interface LocalPracticeResultProps {
  result?: PracticeResult | null;
  phase?: "loading" | "running" | null;
}

const descriptions: Record<
  PracticeResult["status"],
  { title: string; message: string }
> = {
  ok: {
    title: "Teste concluído",
    message: "Confira o retorno da função para o primeiro exemplo público.",
  },
  compile_error: {
    title: "Confira a escrita do código",
    message:
      "Não foi possível preparar seu código para o teste. Confira os detalhes abaixo, ajuste e tente novamente.",
  },
  runtime_error: {
    title: "O teste encontrou um erro",
    message:
      "Seu código começou a executar e encontrou um problema. Confira os detalhes, ajuste a função e tente novamente.",
  },
  time_limit: {
    title: "O teste demorou demais",
    message:
      "O teste foi interrompido. Confira se há uma repetição que não termina ou tente uma entrada menor.",
  },
  memory_limit: {
    title: "O teste usou memória demais",
    message:
      "O teste foi interrompido. Tente uma entrada menor e confira se o código cria listas ou objetos em excesso.",
  },
  output_limit: {
    title: "O teste produziu texto demais",
    message:
      "Reduza as mensagens que seu código imprime e tente novamente. A saída abaixo pode estar incompleta.",
  },
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
        <strong>
          {phase === "loading"
            ? "Preparando o teste no seu dispositivo…"
            : "Testando no seu dispositivo…"}
        </strong>
        <p className="local-practice-meta">Prática local · sem XP</p>
        <p>Este teste não aprova o desafio.</p>
      </div>
    );
  }
  if (!result) return null;
  const successful = result.status === "ok";
  const description = descriptions[result.status];
  return (
    <div
      className="submission-result local-practice-result"
      role={successful ? "status" : "alert"}
      aria-live="polite"
      aria-busy="false"
    >
      <p className="local-practice-meta">Prática local · sem XP</p>
      <h3>
        {successful ? (
          <Monitor size={21} aria-hidden="true" />
        ) : (
          <AlertCircle size={21} aria-hidden="true" />
        )}
        {description.title}
      </h3>
      <p>{description.message}</p>
      <p>Teste no navegador. Para aprovar o desafio, submeta sua solução.</p>
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
