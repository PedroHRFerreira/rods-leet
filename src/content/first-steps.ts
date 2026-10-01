import type { PublicChallenge } from "./types.ts";

type Lesson = {
  id: string;
  title: string;
  explanation: string;
  javascript: string;
  python: string;
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
      "Um programa trabalha com valores. Um número escrito diretamente no código, como 7, é um valor literal. A estrutura da função já está pronta: altere somente o 0 da linha return para devolver o número 7. return entrega a resposta da função para a aplicação. Ainda não precisa criar uma função nem chamá-la: nós fazemos isso por você.",
    javascript:
      "Números ficam sem aspas. Mantenha export function solve(input) e as chaves { }. Troque return 0; por return 7;. export permite que a aplicação encontre solve; a palavra input pode ficar sem uso neste passo.",
    python:
      "Números ficam sem aspas. Mantenha def solve(input): e os quatro espaços antes de return. Troque return 0 por return 7. A indentação indica que essa linha pertence à função; input pode ficar sem uso neste passo.",
    jsBody: "  // Troque somente 0 pelo número pedido.\n  return 0;",
    pyBody: "    # Troque somente 0 pelo número pedido.\n    return 0",
    examples: [
      {
        input: null,
        output: 7,
        explanation:
          "Não há valor de entrada neste passo: null indica ausência de entrada. A resposta é o número 7, sem aspas.",
      },
    ],
    tags: ["primeiros passos", "números", "return"],
  },
  {
    id: "literal-text",
    title: "Seu primeiro texto",
    explanation:
      "Você já devolveu um número. Agora devolva exatamente o texto Olá, mundo! Textos são chamados strings e precisam ficar entre aspas no código. Altere somente o texto da linha return do modelo. Preserve a maiúscula, a vírgula, o espaço, o acento e a exclamação. As aspas delimitam o texto; não fazem parte da mensagem devolvida.",
    javascript:
      'Escreva o texto entre aspas simples ou duplas, por exemplo return "Oi";. Mantenha a estrutura export function solve(input) do modelo e substitua apenas o texto vazio.',
    python:
      'Escreva o texto entre aspas simples ou duplas, por exemplo return "Oi". Preserve os quatro espaços antes de return e substitua apenas o texto vazio.',
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
      "Uma variável associa um nome a um valor para podermos usá-lo depois. O modelo guarda um número em pontos e devolve esse valor na linha seguinte. Troque somente o valor inicial de pontos para 10. O sinal = faz uma atribuição: guarda o valor da direita no nome da esquerda. A avaliação considera o valor devolvido, então outras soluções que devolvam 10 também são válidas.",
    javascript:
      "const pontos = 0; cria o nome pontos e guarda 0 nele. return pontos; devolve o valor guardado. Troque somente 0 por 10. const serve quando não vamos atribuir outro valor ao mesmo nome.",
    python:
      "pontos = 0 cria o nome pontos e guarda 0 nele. return pontos devolve o valor guardado. Troque somente 0 por 10. As duas linhas ficam com quatro espaços dentro da função.",
    jsBody: "  // Guarde 10 neste nome.\n  const pontos = 0;\n  return pontos;",
    pyBody: "    # Guarde 10 neste nome.\n    pontos = 0\n    return pontos",
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
      "Mostrar uma mensagem ajuda a acompanhar o código. Essa mensagem aparece na saída de Executar, mas não substitui a resposta da função. O modelo já mostra mensagem e depois a devolve com return. Troque apenas o texto inicial por Estou aprendendo. Execute para observar a mensagem e a resposta. Submeter verifica apenas o retorno, portanto mostrar mensagens é opcional para a aprovação.",
    javascript:
      "console.log(mensagem); mostra o valor na saída. return mensagem; entrega o valor para a avaliação. Preencha a variável mensagem com o texto pedido, mantendo ambas as linhas para observar a diferença.",
    python:
      "print(mensagem) mostra o valor na saída. return mensagem entrega o valor para a avaliação. Preencha a variável mensagem com o texto pedido, mantendo ambas as linhas para observar a diferença.",
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
      "Até aqui sua resposta era sempre a mesma. Agora a aplicação fornece um número cada vez que chama a função. Esse número chega pelo nome input, chamado parâmetro. Devolva exatamente o número recebido: substitua o 0 depois de return pelo nome input. Não escreva um número fixo como 4, porque a mesma função será usada com outras entradas. Não precisa chamar solve nem pedir dados pelo teclado.",
    javascript:
      'Em solve(input), input é o nome do valor recebido. return input; devolve esse valor. Escreva input sem aspas: "input" seria um texto, não o número recebido. Preserve export e o nome solve.',
    python:
      'Em def solve(input):, input é o nome do valor recebido. return input devolve esse valor. Escreva input sem aspas: "input" seria um texto. Preserve o nome solve e os quatro espaços da linha return.',
    jsBody: "  // Devolva o valor recebido, usando o nome input.\n  return 0;",
    pyBody:
      "    # Devolva o valor recebido, usando o nome input.\n    return 0",
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
      "Uma função reúne instruções que transformam uma entrada em uma resposta. Você conhece seu nome solve, o parâmetro input e o comando return. Agora devolva o dobro do número recebido: multiplique input por 2 usando *. Altere apenas a expressão depois de return. A aplicação chama sua função para cada exemplo e para outros números. Depois deste passo você usará dois valores recebidos para fazer a primeira soma.",
    javascript:
      "O operador * multiplica: 3 * 2 vale 6. Use input * 2 depois de return. A função recebe um único número neste passo, então não use input.a. Mantenha export function solve(input); nós chamamos a função por você.",
    python:
      "O operador * multiplica: 3 * 2 vale 6. Use input * 2 depois de return. A função recebe um único número neste passo. Mantenha def solve(input): e a indentação; nós chamamos a função por você.",
    jsBody: "  // Acrescente a multiplicação por 2.\n  return input;",
    pyBody: "    # Acrescente a multiplicação por 2.\n    return input",
    examples: [
      {
        input: 3,
        output: 6,
        explanation: "Recebe 3, calcula 3 * 2 e devolve 6.",
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
      descriptionsByLanguage: {
        javascript: `${lesson.explanation}\n\n${lesson.javascript}`,
        typescript: `${lesson.explanation}\n\n${lesson.javascript} Em TypeScript, a anotação após input descreve seu tipo; mantenha a anotação do modelo.`,
        python: `${lesson.explanation}\n\n${lesson.python}`,
      },
      examples: lesson.examples,
      constraints: lesson.inputType
        ? [
            "A entrada é um único inteiro entre −1.000.000 e 1.000.000.",
            "A resposta deve ser um número, sem aspas.",
          ]
        : [
            "Este passo não usa a entrada: null representa ausência de um valor.",
            "A resposta deve ter exatamente o valor e o tipo pedidos.",
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
