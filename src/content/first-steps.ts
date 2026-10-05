import type { PublicChallenge } from "./types.ts";

type Lesson = {
  id: string;
  title: string;
  explanation: string;
  jsBody: string;
  pyBody: string;
  examples: PublicChallenge["examples"];
  tags: string[];
  inputType?: "number";
};

const lessons: Lesson[] = [
  {
    id: "literal-number",
    title: "Seu primeiro número",
    explanation:
      "Crie uma função que devolva o número 7. Este desafio não recebe entrada.",
    jsBody: "  // Escreva sua solução aqui.\n  return 0;",
    pyBody: "    # Escreva sua solução aqui.\n    return 0",
    examples: [
      {
        input: null,
        output: 7,
        explanation:
          "Este passo não recebe uma entrada. Devolva o número 7, sem aspas.",
      },
    ],
    tags: ["primeiros passos", "números", "return"],
  },
  {
    id: "literal-text",
    title: "Seu primeiro texto",
    explanation:
      "Crie uma função que devolva o texto Olá, mundo! Preserve o acento, a vírgula, o espaço e a exclamação. Este desafio não recebe entrada.",
    jsBody: '  // Preencha o texto entre as aspas.\n  return "";',
    pyBody: '    # Preencha o texto entre as aspas.\n    return ""',
    examples: [
      {
        input: null,
        output: "Olá, mundo!",
        explanation:
          "A entrada não é usada. A resposta é um texto, diferente de um número.",
      },
    ],
    tags: ["primeiros passos", "texto", "aspas"],
  },
  {
    id: "named-value",
    title: "Dê um nome ao valor",
    explanation:
      "Uma pontuação inicial vale 10. Guarde essa pontuação na variável pontos e devolva seu valor. Este desafio não recebe entrada.",
    jsBody:
      "  // Escreva sua solução aqui.\n  const pontos = 0;\n  return pontos;",
    pyBody:
      "    # Escreva sua solução aqui.\n    pontos = 0\n    return pontos",
    examples: [
      {
        input: null,
        output: 10,
        explanation:
          "A função devolve o número guardado na variável, não o nome pontos como texto.",
      },
    ],
    tags: ["primeiros passos", "variáveis", "atribuição"],
  },
  {
    id: "console-and-return",
    title: "Veja a mensagem e devolva a resposta",
    explanation:
      "Mostre o texto Estou aprendendo na saída do código e devolva esse mesmo texto como resposta. Este desafio não recebe entrada.",
    jsBody:
      '  // Preencha a mensagem pedida.\n  const mensagem = "";\n  console.log(mensagem); // Mostra para você.\n  return mensagem; // Devolve para a aplicação.',
    pyBody:
      '    # Preencha a mensagem pedida.\n    mensagem = ""\n    print(mensagem)  # Mostra para você.\n    return mensagem  # Devolve para a aplicação.',
    examples: [
      {
        input: null,
        output: "Estou aprendendo",
        explanation:
          "A mensagem exibida pode ser igual à resposta, mas a aprovação usa o valor de return, não a quantidade de mensagens.",
      },
    ],
    tags: ["primeiros passos", "console / print", "retorno"],
  },
  {
    id: "input-echo",
    title: "Conheça o valor de entrada",
    explanation:
      "Receba um número e devolva esse mesmo número, sem modificá-lo.",
    jsBody: "  // Escreva sua solução aqui.\n  return 0;",
    pyBody: "    # Escreva sua solução aqui.\n    return 0",
    examples: [
      {
        input: 4,
        output: 4,
        explanation: "A aplicação chama solve com 4; a função devolve 4.",
      },
      {
        input: -2,
        output: -2,
        explanation:
          "A mesma função também funciona quando recebe outro número.",
      },
    ],
    tags: ["primeiros passos", "entrada", "parâmetro"],
    inputType: "number",
  },
  {
    id: "function-double",
    title: "Transforme a entrada em uma resposta",
    explanation:
      "Receba um número e devolva seu dobro. A função deve funcionar para números positivos, negativos e zero.",
    jsBody: "  // Escreva sua solução aqui.\n  return input;",
    pyBody: "    # Escreva sua solução aqui.\n    return input",
    examples: [
      {
        input: 3,
        output: 6,
        explanation: "O dobro de 3 é 6.",
      },
      {
        input: -4,
        output: -8,
        explanation:
          "O cálculo usa a entrada recebida, inclusive quando ela é negativa.",
      },
    ],
    tags: ["primeiros passos", "função", "expressões"],
    inputType: "number",
  },
];

/** Guided lessons reuse the catalog execution policy, with one editable idea at a time. */
export function firstStepChallenges(base: PublicChallenge): PublicChallenge[] {
  return lessons.map((lesson) => {
    const javascript = `// A aplicação chama solve: não precisa chamá-la aqui.\nexport function solve(input) {\n${lesson.jsBody}\n}\n`;
    const typescript = `// A aplicação chama solve: não precisa chamá-la aqui.\nexport function solve(input: ${lesson.inputType ?? "unknown"}) {\n${lesson.jsBody}\n}\n`;
    const python = `# A aplicação chama solve: não precisa chamá-la aqui.\ndef solve(input):\n${lesson.pyBody}\n`;
    return {
      ...base,
      id: lesson.id,
      slug: lesson.id,
      versionId: `${lesson.id}:v1`,
      title: lesson.title,
      description: lesson.explanation,
      examples: lesson.examples,
      constraints: lesson.inputType
        ? [
            "A entrada é um único inteiro entre −1.000.000 e 1.000.000.",
            "A resposta deve ser um número, sem aspas.",
          ]
        : [
            "Este passo não usa a entrada. Mantenha input no modelo.",
            "Devolva a resposta pedida: números sem aspas e textos entre aspas.",
          ],
      baseXp: 30,
      availableModes: ["normal"],
      languageIds: ["javascript", "python", "typescript"],
      starterFilesByLanguage: {
        javascript: [{ path: "solution.js", content: javascript }],
        python: [{ path: "solution.py", content: python }],
        typescript: [{ path: "solution.ts", content: typescript }],
      },
      estimatedMinutes: 3,
      tags: lesson.tags,
    };
  });
}
