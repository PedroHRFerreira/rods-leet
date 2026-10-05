import type { LanguageId, PublicChallenge } from "../lib/contracts";

/** Names differ across runtimes; the starter is the learner's public contract. */
export function modelFunctionName(
  challenge: PublicChallenge,
  language: LanguageId,
) {
  const canonical = challenge.functionName ?? "solve";
  if (canonical === "findMax") {
    if (["python", "c", "cpp", "rust"].includes(language)) return "find_max";
    if (["csharp", "go"].includes(language)) return "FindMax";
  }
  if (canonical === "solve" && ["csharp", "go"].includes(language))
    return "Solve";
  return canonical;
}

export function FunctionGuide({
  challenge,
  language,
}: {
  challenge: PublicChallenge;
  language: LanguageId;
}) {
  if (challenge.kind === "sql" || language === "sql") return null;
  const name = modelFunctionName(challenge, language);
  const source = challenge.starterFilesByLanguage[language]?.[0]?.content ?? "";
  const signature = source
    .split("\n")
    .find(
      (line) =>
        new RegExp(`\\b${name}\\s*\\(`).test(line) &&
        !line.trim().startsWith("//"),
    )
    ?.trim();
  const javascript = language === "javascript" || language === "typescript";
  const exampleInput = challenge.examples[0]?.input;
  const fields =
    exampleInput !== null &&
    typeof exampleInput === "object" &&
    !Array.isArray(exampleInput)
      ? Object.keys(exampleInput)
      : [];
  const inputDescription =
    name === "shortestPath"
      ? "A aplicação fornece graph, start e end como três parâmetros, conforme o modelo."
      : challenge.functionName === "findMax"
        ? "A aplicação fornece a lista de números no parâmetro values."
        : fields.length
          ? `input recebe um conjunto de valores com os campos ${fields.join(", ")}. ${javascript ? `Leia um campo com input.${fields[0]}.` : language === "python" ? `Leia um campo com input["${fields[0]}"].` : "Use o acesso aos campos mostrado no modelo da sua linguagem."}`
          : exampleInput === null
            ? "Neste passo, a entrada não é usada. Preserve o parâmetro do modelo."
            : "A aplicação fornece o valor de entrada no parâmetro do modelo; não precisa pedir dados pelo teclado.";
  return (
    <section
      className="function-guide"
      aria-label="Orientação do modelo da função"
    >
      <h3>Entenda o modelo</h3>
      <details className="function-guide-contract">
        <summary>Como a função do modelo funciona?</summary>
        <p>
          Mantenha a função <code>{name}</code> do modelo. A aplicação chama
          essa função por você, uma vez para cada entrada.
        </p>
        {signature && (
          <pre className="function-guide-code">
            <code>{signature}</code>
          </pre>
        )}
        <p>{inputDescription}</p>
        {javascript && (
          <p>
            <code>export</code> permite que a aplicação encontre a função. Você
            pode usar <code>export function {name}(…)</code> ou uma função de
            seta exportada com o mesmo nome.
          </p>
        )}
        {language === "python" && (
          <p>
            Preserve <code>def {name}(…):</code> e os espaços no início das
            linhas dentro da função.
          </p>
        )}
        <p>
          <code>
            {language === "python"
              ? "print"
              : javascript
                ? "console.log"
                : "A saída de diagnóstico"}
          </code>{" "}
          mostra mensagens na saída. <code>return</code> devolve a resposta que
          Submeter avalia. Você pode executar quantas vezes quiser.
        </p>
      </details>
      <details className="function-guide-contract">
        <summary>Posso criar outras funções?</summary>
        <p>
          Sim. Use funções auxiliares e chame-as dentro de <code>{name}</code>.
          Uma função com outro nome, chamada manualmente, não substitui a função
          que a aplicação procura.
        </p>
      </details>
    </section>
  );
}
