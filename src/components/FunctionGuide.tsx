import type { LanguageId, PublicChallenge } from "../lib/contracts";

const firstSteps: Record<
  string,
  { task: string; concept: string; js: string; py: string }
> = {
  "literal-number": {
    task: "Troque o 0 por 7 na linha return.",
    concept:
      "Um número não precisa de aspas. return devolve esse valor como resposta.",
    js: "return 7; // Devolve o número 7.",
    py: "return 7  # Devolve o número 7.",
  },
  "literal-text": {
    task: 'Escreva "Olá, mundo!" entre as aspas na linha return.',
    concept: "As aspas indicam onde um texto começa e termina.",
    js: 'return "Olá, mundo!";',
    py: 'return "Olá, mundo!"',
  },
  "named-value": {
    task: "Troque o valor de pontos de 0 para 10. Mantenha return pontos.",
    concept:
      "Uma variável é um nome para um valor. = guarda o valor; return entrega a resposta.",
    js: "const pontos = 10;\nreturn pontos;",
    py: "pontos = 10\nreturn pontos",
  },
  "console-and-return": {
    task: 'Escreva "Estou aprendendo" em mensagem. Clique em Executar código para ver a saída.',
    concept: "Mostrar uma mensagem e devolver a resposta são ações diferentes.",
    js: 'const mensagem = "Estou aprendendo";\nconsole.log(mensagem); // Mostra a mensagem.\nreturn mensagem; // Devolve a resposta.',
    py: 'mensagem = "Estou aprendendo"\nprint(mensagem)  # Mostra a mensagem.\nreturn mensagem  # Devolve a resposta.',
  },
  "input-echo": {
    task: "Troque return 0 por return input para devolver o número recebido.",
    concept:
      "input recebe o valor enviado pela aplicação. A mesma função será chamada com valores diferentes.",
    js: "// Se input recebe 6, esta linha devolve 6.\nreturn input;",
    py: "# Se input recebe 6, esta linha devolve 6.\nreturn input",
  },
  "function-double": {
    task: "Depois de return, escreva input * 2 para devolver o dobro.",
    concept:
      "A função usa a entrada para calcular uma nova resposta. * é o símbolo de multiplicação.",
    js: "return input * 2;",
    py: "return input * 2",
  },
};

export function firstStepTask(challengeId: string) {
  return firstSteps[challengeId]?.task;
}

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
    ? "const soma = (a, b) => a + b;\n\nexport function solve(input) {\n  return soma(input.a, input.b);\n}"
    : 'def soma(a, b):\n    return a + b\n\ndef solve(input):\n    return soma(input["a"], input["b"])';
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
          <small>Use esta orientação para completar o modelo no editor.</small>
        </div>
      )}
      <details className="function-guide-contract" open={!lesson}>
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
        {challenge.id === "sum-two-integers" &&
          (javascript || language === "python") && (
            <>
              <p>
                Você pode criar soma(a, b) e chamá-la dentro de solve. Use os
                valores recebidos em input, como neste exemplo:
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
