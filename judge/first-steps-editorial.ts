/** Private solutions, deliberately separate from browser-facing starter files. */
const lessons: Record<
  string,
  { js: string; py: string; hints: string[]; explanation: string }
> = {
  "literal-number": {
    js: "return 7;",
    py: "return 7",
    hints: [
      "Mantenha a estrutura da função pronta no modelo.",
      "Um número é escrito sem aspas.",
      "Substitua o 0 depois de return pelo número 7.",
    ],
    explanation:
      "7 é um literal numérico. return entrega esse valor a quem chamou a função. A aplicação chama solve; você não precisa escrever solve() no editor.",
  },
  "literal-text": {
    js: 'return "Olá, mundo!";',
    py: 'return "Olá, mundo!"',
    hints: [
      "Textos ficam entre aspas no código.",
      "Acentos, espaços, maiúsculas e pontuação fazem parte do texto.",
      'Escreva "Olá, mundo!" depois de return.',
    ],
    explanation:
      "As aspas delimitam uma string. O retorno inclui o conteúdo dentro delas, preservando acento, espaço e pontuação.",
  },
  "named-value": {
    js: "const pontos = 10;\nreturn pontos;",
    py: "pontos = 10\nreturn pontos",
    hints: [
      "Uma variável dá um nome a um valor.",
      "O sinal = guarda o valor da direita no nome da esquerda.",
      "Guarde 10 em pontos e devolva pontos, sem aspas.",
    ],
    explanation:
      "A atribuição associa pontos ao número 10. Na linha seguinte return lê esse nome e entrega o número guardado.",
  },
  "console-and-return": {
    js: 'const mensagem = "Estou aprendendo";\nconsole.log(mensagem);\nreturn mensagem;',
    py: 'mensagem = "Estou aprendendo"\nprint(mensagem)\nreturn mensagem',
    hints: [
      "A variável mensagem guarda o texto que você deseja acompanhar.",
      "console.log em JavaScript ou print em Python mostra o valor durante Executar.",
      "Depois de mostrar a mensagem, devolva a mesma variável com return: a aprovação usa o retorno.",
    ],
    explanation:
      "Mostrar e devolver são ações diferentes. console.log/print produz uma mensagem para você; return produz a resposta avaliada. Você pode acrescentar mensagens sem mudar a resposta.",
  },
  "input-echo": {
    js: "return input;",
    py: "return input",
    hints: [
      "A aplicação já fornece o número quando chama a função.",
      'O nome input representa o valor recebido, diferente do texto "input".',
      "Use return input para devolver o valor sem transformá-lo.",
    ],
    explanation:
      "input é o parâmetro: recebe um novo valor a cada chamada. Devolver input permite que a mesma função responda corretamente a números positivos, negativos e zero.",
  },
  "function-double": {
    js: "return input * 2;",
    py: "return input * 2",
    hints: [
      "Use o valor recebido em vez de escrever a resposta de apenas um exemplo.",
      "O operador * representa multiplicação.",
      "Multiplique input por 2 e devolva a expressão com return.",
    ],
    explanation:
      "A função transforma a entrada por uma expressão. return input * 2 calcula o dobro para cada número recebido. No próximo desafio você acessará dois valores dentro de uma entrada.",
  },
};

export function firstStepsEditorial(id: string, languageId: string) {
  const lesson = lessons[id];
  if (!lesson) return undefined;
  const python = languageId === "python";
  const body = python ? lesson.py : lesson.js;
  const source = python
    ? `def solve(input):\n${body
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")}\n`
    : `export function solve(input${languageId === "typescript" ? `: ${id === "input-echo" || id === "function-double" ? "number" : "unknown"}` : ""}) {\n${body
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")}\n}\n`;
  return {
    hints: lesson.hints,
    explanation: lesson.explanation,
    files: [
      {
        path: `solution.${python ? "py" : languageId === "typescript" ? "ts" : "js"}`,
        content: source,
      },
    ],
  };
}
