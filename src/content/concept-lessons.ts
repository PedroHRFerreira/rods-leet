import type { PublicChallenge } from "./types.ts";

type ConceptLesson = {
  id: string;
  title: string;
  lesson: string[];
  snippet?: string;
  question: string;
  options: [string, string, string];
};

const lessons: ConceptLesson[] = [
  {
    id: "concept-values",
    title: "O que é um valor?",
    lesson: [
      "Um programa trabalha com valores: informações como o número 7, o texto Olá ou a resposta verdadeiro.",
      "Podemos escrever esses valores no código para guardar, mostrar ou transformar informações.",
    ],
    question: "Qual alternativa é um exemplo de valor numérico?",
    options: ['O texto "sete"', "O número 7", "O nome de um arquivo"],
  },
  {
    id: "concept-variables",
    title: "Um nome para guardar um valor",
    lesson: [
      "Uma variável associa um nome a um valor para usá-lo depois.",
      "Em JavaScript, const cria esse nome e = guarda o valor: pontos é o nome e 10 é o valor guardado.",
      "Em Python escrevemos pontos = 10.",
    ],
    snippet: "const pontos = 10;",
    question: "Qual valor está guardado em pontos?",
    options: ["10", 'O texto "pontos"', "0"],
  },
  {
    id: "concept-numbers",
    title: "Contas com números",
    lesson: [
      "Números são escritos sem aspas e podem participar de contas.",
      "O sinal + soma, o sinal - subtrai e o sinal * multiplica; 2 + 3 é uma expressão que resulta em 5.",
    ],
    snippet: "2 + 3",
    question: "Qual é o resultado dessa expressão?",
    options: ["23", "6", "5"],
  },
  {
    id: "concept-text",
    title: "Texto fica entre aspas",
    lesson: [
      "Textos, também chamados de strings, são escritos entre aspas simples ou duplas.",
      'O número 7 permite fazer contas; "7" representa um texto, mesmo parecendo um número.',
    ],
    question: "Qual alternativa representa um texto?",
    options: ["7", '"Olá"', "2 + 3"],
  },
  {
    id: "concept-booleans",
    title: "Verdadeiro ou falso",
    lesson: [
      "Um valor booleano representa apenas verdadeiro ou falso, como a resposta a uma pergunta de sim ou não.",
      "Em JavaScript usamos true e false; em Python usamos True e False, com a primeira letra maiúscula.",
    ],
    question:
      "Para guardar se uma lâmpada está ligada, qual par de valores é adequado?",
    options: [
      "Verdadeiro e falso",
      "Qualquer texto longo",
      "Somente números negativos",
    ],
  },
  {
    id: "concept-functions",
    title: "Uma tarefa chamada função",
    lesson: [
      "Uma função reúne instruções para fazer uma tarefa quando é chamada.",
      "Em JavaScript, function marca o início da função e suas instruções ficam entre { e }.",
      "O nome identifica a tarefa, que pode ser chamada várias vezes sem reescrever todas as instruções.",
    ],
    question: "Para que serve uma função?",
    options: [
      "Para impedir que um código seja usado novamente",
      "Para transformar todo número em texto",
      "Para reunir uma tarefa que pode ser chamada novamente",
    ],
  },
  {
    id: "concept-parameters",
    title: "Como a entrada chega à função",
    lesson: [
      "Um parâmetro é o nome usado pela função para acessar um valor recebido.",
      "Em solve(input), input recebe a entrada; se a aplicação chamar solve com 4, input valerá 4 durante essa chamada.",
    ],
    snippet: "solve(input)",
    question: "Qual é o papel de input nessa função?",
    options: [
      "Sempre guardar o número zero",
      "Dar acesso ao valor recebido pela função",
      "Mostrar uma mensagem automaticamente",
    ],
  },
  {
    id: "concept-return",
    title: "Mostrar é diferente de devolver",
    lesson: [
      "console.log em JavaScript e print em Python mostram mensagens para você acompanhar o código.",
      "return devolve a resposta para quem chamou a função; nesta aplicação, é essa resposta que será avaliada.",
    ],
    question:
      "O que usamos dentro da função para entregar a resposta avaliada?",
    options: ["return", "Apenas console.log ou print", "O nome do arquivo"],
  },
  {
    id: "concept-export",
    title: "Como a aplicação encontra sua função",
    lesson: [
      "No modelo JavaScript e TypeScript, export permite que a aplicação encontre a função solve em seu arquivo.",
      "Mantenha export e o nome solve: a aplicação chama a função com cada entrada; no modelo Python, mantenha def solve(input):, sem usar export.",
    ],
    snippet: "export function solve(input) {\n  return input;\n}",
    question: "Por que devemos manter export no modelo JavaScript?",
    options: [
      "Para imprimir o resultado na tela",
      "Para somar dois números",
      "Para permitir que a aplicação encontre a função",
    ],
  },
  {
    id: "concept-classes",
    title: "Um primeiro contato com classes",
    lesson: [
      "Uma classe descreve um modelo que reúne informações e tarefas relacionadas, como uma Pessoa com nome e uma tarefa de se apresentar.",
      "Algumas linguagens organizam funções dentro de classes; você ainda não precisa escrever uma classe para começar os próximos desafios.",
    ],
    question: "O que uma classe pode reunir?",
    options: [
      "Somente mensagens de erro",
      "Informações e tarefas relacionadas",
      "Somente números sem nome",
    ],
  },
];

/** Public teaching material only: validation and correct options stay server-side. */
export function conceptChallenges(base: PublicChallenge): PublicChallenge[] {
  return lessons.map((item) => ({
    ...base,
    id: item.id,
    slug: item.id,
    versionId: `${item.id}:v1`,
    title: item.title,
    description: item.lesson.join(" "),
    descriptionsByLanguage: undefined,
    kind: "quiz",
    quiz: {
      lesson: item.lesson,
      snippet: item.snippet,
      question: item.question,
      options: item.options.map((text, index) => ({
        id: ["a", "b", "c"][index],
        text,
      })),
    },
    baseXp: 20,
    examples: [],
    constraints: [],
    complexityGoal: undefined,
    languageIds: [],
    starterFilesByLanguage: {},
    functionName: undefined,
    limits: undefined,
    availableModes: ["normal"],
    estimatedMinutes: 2,
    learningResources: [],
    tags: ["primeiros passos", "conceitos"],
    executionAvailable: true,
  }));
}
