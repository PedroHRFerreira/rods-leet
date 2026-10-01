import type { LanguageId, PublicChallenge } from "../lib/contracts";

const firstSteps: Record<
  string,
  { task: string; concept: string; js: string; py: string }
> = {
  "literal-number": {
    task: "Troque somente o 0 do modelo pelo número pedido.",
    concept:
      "Um número não precisa de aspas. return devolve esse valor como resposta.",
    js: "return 6; // Devolve o número 6.",
    py: "return 6  # Devolve o número 6.",
  },
  "literal-text": {
    task: "Preencha o texto entre as aspas, mantendo a mensagem exata.",
    concept: "As aspas indicam onde um texto começa e termina.",
    js: 'return "Bom dia"; // Devolve um texto.',
    py: 'return "Bom dia"  # Devolve um texto.',
  },
  "named-value": {
    task: "Altere o valor guardado em pontos. Mantenha a linha que o devolve.",
    concept:
      "Uma variável é um nome para um valor. = guarda o valor; return entrega a resposta.",
    js: "const pontos = 6;\nreturn pontos;",
    py: "pontos = 6\nreturn pontos",
  },
  "console-and-return": {
    task: "Preencha mensagem e execute para observar as duas linhas.",
    concept: "Mostrar uma mensagem e devolver a resposta são ações diferentes.",
    js: 'const mensagem = "Bom dia";\nconsole.log(mensagem); // Mostra para você.\nreturn mensagem; // Entrega a resposta.',
    py: 'mensagem = "Bom dia"\nprint(mensagem)  # Mostra para você.\nreturn mensagem  # Entrega a resposta.',
  },
  "input-echo": {
    task: "Depois de return, use o nome input no lugar de um número fixo.",
    concept:
      "input recebe o valor enviado pela aplicação. A mesma função será chamada com valores diferentes.",
    js: "// Se input recebe 6, esta linha devolve 6.\nreturn input;",
    py: "# Se input recebe 6, esta linha devolve 6.\nreturn input",
  },
  "function-double": {
    task: "Multiplique o valor recebido por 2 na expressão depois de return.",
    concept:
      "A função usa a entrada para calcular uma nova resposta. * é o símbolo de multiplicação.",
    js: "// Exemplo de uma expressão com uma entrada:\nreturn input * 3; // Triplo, não o dobro pedido.",
    py: "# Exemplo de uma expressão com uma entrada:\nreturn input * 3  # Triplo, não o dobro pedido.",
  },
};

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
  const lesson = firstSteps[challenge.id];
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
  const helper = javascript
    ? "const triplo = (numero) => numero * 3;\n\nexport function solve(input) {\n  return triplo(input.a);\n}"
    : 'def triplo(numero):\n    return numero * 3\n\ndef solve(input):\n    return triplo(input["a"])';
  return (
    <section
      className="function-guide"
      aria-label="Orientação do modelo da função"
    >
      <h3>Entenda o modelo</h3>
      {lesson && (
        <div className="function-guide-task">
          <strong>Neste passo</strong>
          <p>{lesson.task}</p>
          <p>{lesson.concept}</p>
          <pre className="function-guide-code">
            <code>{language === "python" ? lesson.py : lesson.js}</code>
          </pre>
          <small>
            Exemplo para entender a sintaxe. Use os valores pedidos na missão.
          </small>
        </div>
      )}
      <p>
        Mantenha a função <code>{name}</code> do modelo. A aplicação chama essa
        função por você, uma vez para cada entrada.
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
          pode usar <code>export function {name}(…)</code> ou uma função de seta
          exportada com o mesmo nome.
        </p>
      )}
      {language === "python" && (
        <p>
          Preserve <code>def {name}(…):</code> e os espaços no início das linhas
          dentro da função.
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
        mostra mensagens em Executar. <code>return</code> devolve a resposta que
        Submeter avalia. Você pode executar quantas vezes quiser antes de
        submeter.
      </p>
      <details className="function-guide-contract">
        <summary>Posso criar outras funções?</summary>
        <p>
          Sim. Use funções auxiliares e chame-as dentro de <code>{name}</code>.
          Uma função com outro nome, chamada manualmente, não substitui a função
          que a aplicação procura.
        </p>
        {challenge.id === "sum-two-integers" &&
          (javascript || language === "python") && (
            <>
              <p>
                Este exemplo usa somente o campo a para mostrar como chamar uma
                função auxiliar. Para a missão, use os campos a e b recebidos e
                devolva a soma.
              </p>
              <pre className="function-guide-code">
                <code>{helper}</code>
              </pre>
            </>
          )}
      </details>
    </section>
  );
}
