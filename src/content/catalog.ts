import type {
  ContentDifficulty,
  PublicChallenge,
  Topic,
  TopicId,
} from "./types.ts";
import {
  algorithmLanguages,
  algorithmTemplates,
  allProgrammingLanguages,
  findMaxTemplates,
  shortestPathTemplates,
} from "./templates.ts";
import { learningResourcesFor } from "./learning-resources.ts";

export type { PublicChallenge, Topic } from "./types.ts";

export const topics: Topic[] = [
  {
    id: "logic",
    title: "Lógica de programação",
    description: "Transforme regras em soluções claras.",
    icon: "◈",
  },
  {
    id: "algorithms",
    title: "Algoritmos",
    description: "Encontre caminhos eficientes para cada problema.",
    icon: "⌘",
  },
  {
    id: "data-structures",
    title: "Estruturas de dados",
    description: "Escolha como organizar e consultar informação.",
    icon: "▦",
  },
  {
    id: "sql",
    title: "SQL e bancos de dados",
    description: "Responda perguntas com dados e consultas.",
    icon: "▤",
  },
  {
    id: "oop",
    title: "Orientação a objetos",
    description: "Modele responsabilidades e comportamentos.",
    icon: "◇",
  },
  {
    id: "backend",
    title: "Backend",
    description: "Construa serviços e contratos confiáveis.",
    icon: "⇄",
  },
  {
    id: "testing",
    title: "Testes de software",
    description: "Ganhe confiança com verificações úteis.",
    icon: "✓",
  },
  {
    id: "architecture",
    title: "Arquitetura",
    description: "Organize sistemas para evoluir.",
    icon: "⌂",
  },
  {
    id: "system-design",
    title: "System Design",
    description: "Entenda capacidade, consistência e distribuição.",
    icon: "◎",
  },
  {
    id: "devops",
    title: "DevOps",
    description: "Entregue e opere mudanças com segurança.",
    icon: "∞",
  },
];

type Example = { input: unknown; output: unknown; explanation?: string };
export const betaExecutionLimits = {
  maxFiles: 20,
  maxSourceBytes: 256 * 1024,
  compileTimeoutMs: 45000,
  caseCpuMs: 2000,
  caseWallMs: 5000,
  jobWallMs: 90000,
  memoryMiB: 1024,
  caseOutputBytes: 64 * 1024,
  jobOutputBytes: 256 * 1024,
};
function challenge(
  id: string,
  title: string,
  topicId: TopicId,
  difficulty: ContentDifficulty,
  description: string,
  examples: Example[],
  constraints: string[],
  time: string,
  space: string,
): PublicChallenge {
  return {
    id,
    slug: id,
    versionId: `${id}:v1`,
    title,
    topicId,
    difficulty,
    description,
    examples,
    constraints: [
      ...constraints,
      "Limites iniciais sujeitos à homologação: até 35 s para o conjunto de casos após compilação.",
    ],
    complexityGoal: { time, space },
    kind: "function",
    baseXp: difficulty === "easy" ? 100 : difficulty === "medium" ? 200 : 350,
    languageIds: [...algorithmLanguages],
    starterFilesByLanguage: algorithmTemplates(),
    functionName: "solve",
    availableModes: ["normal", "hard"],
    executionAvailable: false,
    limits: { ...betaExecutionLimits },
    learningResources: [],
  };
}
const ex = (
  input: unknown,
  output: unknown,
  explanation?: string,
): Example => ({ input, output, ...(explanation ? { explanation } : {}) });

const logic: PublicChallenge[] = [
  {
    ...challenge(
      "find-max",
      "Maior pontuação da equipe",
      "logic",
      "easy",
      "Uma equipe registrou suas pontuações em uma lista de inteiros. Retorne a maior pontuação, ou null quando a lista estiver vazia. Preserve a lista original. Em cada linguagem, use a assinatura fornecida pelo editor.",
      [ex([3, 7, 2, 9, 1], 9), ex([-8, -3, -12], -3), ex([], null)],
      [
        "0 ≤ n ≤ 100.000",
        "−1.000.000.000 ≤ valores ≤ 1.000.000.000",
        "A entrada deve permanecer inalterada.",
      ],
      "O(n)",
      "O(1)",
    ),
    languageIds: [...allProgrammingLanguages],
    starterFilesByLanguage: findMaxTemplates,
    functionName: "findMax",
  },
  challenge(
    "sum-even",
    "Energia dos pares",
    "logic",
    "easy",
    "Receba uma lista de inteiros e devolva a soma apenas dos valores pares, incluindo negativos e zero. Uma lista vazia produz zero.",
    [ex([2, 3, 4, -6], 0), ex([1, 5, 7], 0)],
    ["0 ≤ n ≤ 100.000", "|valor| ≤ 10.000"],
    "O(n)",
    "O(1)",
  ),
  challenge(
    "count-vowels",
    "Vogais na transmissão",
    "logic",
    "easy",
    "Conte as ocorrências de a, e, i, o, u em uma string ASCII, sem distinguir maiúsculas de minúsculas. Outros caracteres não contam.",
    [ex("CodeGamer", 4), ex("XYZ 123", 0)],
    ["0 ≤ comprimento ≤ 100.000", "Entrada contém apenas caracteres ASCII."],
    "O(n)",
    "O(1)",
  ),
  challenge(
    "is-palindrome",
    "Mensagem espelhada",
    "logic",
    "easy",
    "Receba uma string ASCII. Ignore caracteres que não sejam letras ou dígitos e ignore maiúsculas. Devolva true se a sequência restante for igual ao seu reverso. Uma sequência vazia é palíndroma.",
    [ex("A man, a plan, a canal: Panama!", true), ex("code", false)],
    [
      "0 ≤ comprimento ≤ 100.000",
      "Letras consideradas: A–Z e a–z; dígitos: 0–9.",
    ],
    "O(n)",
    "O(1)",
  ),
  challenge(
    "fizzbuzz",
    "Sinais da arena",
    "logic",
    "easy",
    "Receba n e retorne uma lista de strings para os inteiros de 1 até n. Use Fizz nos múltiplos de 3, Buzz nos de 5, FizzBuzz nos de ambos, e o número em texto nos demais.",
    [ex(5, ["1", "2", "Fizz", "4", "Buzz"]), ex(0, [])],
    ["0 ≤ n ≤ 10.000", "A grafia das três palavras diferencia maiúsculas."],
    "O(n)",
    "O(n) na saída",
  ),
  challenge(
    "leap-year",
    "Calendário da guilda",
    "logic",
    "easy",
    "Receba um ano inteiro positivo e informe se ele é bissexto no calendário gregoriano: divisível por 400, ou divisível por 4 mas não por 100.",
    [ex(2000, true), ex(1900, false), ex(2024, true)],
    ["1 ≤ ano ≤ 1.000.000"],
    "O(1)",
    "O(1)",
  ),
  challenge(
    "digit-sum",
    "Raiz digital",
    "logic",
    "medium",
    "Receba uma string de dígitos decimais não vazia, possivelmente com zeros à esquerda. Some seus dígitos repetidamente até restar um único dígito e retorne esse dígito como número. Evite converter a entrada inteira para um tipo numérico.",
    [ex("9875", 2, "29 → 11 → 2"), ex("00000", 0)],
    ["1 ≤ quantidade de dígitos ≤ 100.000", "Apenas caracteres 0–9."],
    "O(n)",
    "O(1)",
  ),
  challenge(
    "interval-overlap",
    "Turnos em comum",
    "logic",
    "medium",
    "Receba {a: [início, fim], b: [início, fim]} representando intervalos fechados. Retorne sua interseção [início, fim], ou null se não houver interseção. Um ponto em comum forma um intervalo válido de comprimento zero.",
    [ex({ a: [1, 5], b: [5, 8] }, [5, 5]), ex({ a: [1, 2], b: [3, 4] }, null)],
    ["−1.000.000 ≤ início ≤ fim ≤ 1.000.000"],
    "O(1)",
    "O(1)",
  ),
  challenge(
    "roman-numeral",
    "Numerais da biblioteca",
    "logic",
    "medium",
    "Converta um numeral romano canônico para um inteiro. A entrada usa I, V, X, L, C, D, M e já é válida; pares subtrativos possíveis são IV, IX, XL, XC, CD, CM.",
    [ex("MCMXCIV", 1994), ex("III", 3)],
    [
      "Valor representado entre 1 e 3.999",
      "Não é necessário validar formas não canônicas.",
    ],
    "O(n)",
    "O(1)",
  ),
  challenge(
    "expression-eval",
    "Calculadora da masmorra",
    "logic",
    "hard",
    "Avalie uma expressão com inteiros não negativos, +, -, *, parênteses e espaços. Respeite precedência usual e associatividade à esquerda. Não há operadores unários. O objetivo pedagógico é construir um parser, com duas pilhas ou descida recursiva. Retorne um inteiro.",
    [ex("2 * (3 + 4) - 5", 9), ex("10 - 3 - 2", 5)],
    [
      "Expressão válida, de 1 a 10.000 caracteres",
      "Todos os intermediários têm módulo ≤ 1.000.000.000",
      "Profundidade dos parênteses ≤ 1.000",
    ],
    "O(n)",
    "O(n)",
  ),
];

const algorithms: PublicChallenge[] = [
  challenge(
    "binary-search",
    "Busca no arquivo ordenado",
    "algorithms",
    "easy",
    "Receba {values, target}, onde values está em ordem crescente. Retorne o índice da primeira ocorrência de target, ou -1 quando ausente. O objetivo pedagógico é usar busca binária; duplicatas são permitidas.",
    [
      ex({ values: [1, 3, 3, 8], target: 3 }, 1),
      ex({ values: [], target: 2 }, -1),
    ],
    ["0 ≤ n ≤ 100.000", "|valor| e |target| ≤ 1.000.000.000"],
    "O(log n)",
    "O(1)",
  ),
  challenge(
    "two-sum",
    "Dupla de potência",
    "algorithms",
    "easy",
    "Receba {values, target}. Retorne índices distintos [i, j], com i < j, cujos valores somam target. Se houver várias respostas, escolha o menor j e, para esse j, o menor i. Se não houver resposta, retorne [].",
    [
      ex({ values: [2, 7, 11, 15], target: 9 }, [0, 1]),
      ex({ values: [3, 3, 3], target: 6 }, [0, 1]),
    ],
    ["0 ≤ n ≤ 100.000", "|valor| e |target| ≤ 1.000.000.000"],
    "O(n) esperado",
    "O(n)",
  ),
  challenge(
    "merge-sorted",
    "União das caravanas",
    "algorithms",
    "easy",
    "Receba {a, b}, duas listas ordenadas em ordem crescente. Retorne uma nova lista ordenada contendo todos os elementos de ambas, preservando duplicatas.",
    [
      ex({ a: [1, 3, 3], b: [2, 3] }, [1, 2, 3, 3, 3]),
      ex({ a: [], b: [4] }, [4]),
    ],
    ["0 ≤ comprimento de cada lista ≤ 50.000"],
    "O(n + m)",
    "O(n + m) na saída",
  ),
  challenge(
    "rotate-array",
    "Rotação dos escudos",
    "algorithms",
    "easy",
    "Receba {values, k}. Retorne uma lista com os elementos deslocados k posições à direita de forma circular. Para uma lista vazia, retorne [].",
    [
      ex({ values: [1, 2, 3, 4], k: 1 }, [4, 1, 2, 3]),
      ex({ values: [1, 2], k: 4 }, [1, 2]),
    ],
    ["0 ≤ n ≤ 100.000", "0 ≤ k ≤ 1.000.000.000"],
    "O(n)",
    "O(n) na saída",
  ),
  challenge(
    "gcd",
    "Divisor das engrenagens",
    "algorithms",
    "easy",
    "Receba [a, b] e retorne o máximo divisor comum de seus valores absolutos. Por convenção, mdc(0, 0) = 0. A resposta é sempre não negativa.",
    [ex([48, 18], 6), ex([-12, 0], 12)],
    ["|a| e |b| ≤ 1.000.000.000"],
    "O(log(max(|a|, |b|) + 1))",
    "O(1)",
  ),
  challenge(
    "anagram-groups",
    "Palavras da mesma família",
    "algorithms",
    "medium",
    "Agrupe palavras que são anagramas. Preserve a ordem de chegada dentro de cada grupo e ordene os grupos pela primeira palavra que apareceu na entrada. Strings vazias também formam um grupo.",
    [
      ex(
        ["eat", "tea", "tan", "ate", "nat", "bat"],
        [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]],
      ),
    ],
    [
      "0 ≤ quantidade de palavras ≤ 10.000",
      "Apenas letras a–z; até 100 letras por palavra",
    ],
    "O(total de caracteres)",
    "O(total de caracteres)",
  ),
  challenge(
    "sliding-window-max",
    "Radar em movimento",
    "algorithms",
    "hard",
    "Receba {values, k}. Para cada janela contígua de exatamente k valores, retorne seu maior elemento. A saída segue a ordem das janelas, da esquerda para a direita.",
    [ex({ values: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 }, [3, 3, 5, 5, 6, 7])],
    ["1 ≤ k ≤ n ≤ 100.000", "|valor| ≤ 1.000.000.000"],
    "O(n)",
    "O(k) auxiliar",
  ),
  challenge(
    "longest-unique-substring",
    "Sequência sem repetição",
    "algorithms",
    "medium",
    "Receba uma string ASCII e retorne o comprimento da maior substring contígua sem caracteres repetidos. Maiúsculas e minúsculas são diferentes; espaços contam como caracteres.",
    [ex("abcabcbb", 3), ex("bbbbb", 1), ex("", 0)],
    ["0 ≤ comprimento ≤ 100.000"],
    "O(n)",
    "O(1), alfabeto ASCII",
  ),
  challenge(
    "coin-change",
    "Troco do mercador",
    "algorithms",
    "medium",
    "Receba {coins, amount}. Cada moeda tem valor positivo e pode ser usada ilimitadamente. Retorne a menor quantidade de moedas que soma amount, ou -1 se impossível. Amount zero exige zero moedas.",
    [
      ex({ coins: [1, 2, 5], amount: 11 }, 3),
      ex({ coins: [2], amount: 3 }, -1),
    ],
    [
      "1 ≤ quantidade de moedas distintas ≤ 30",
      "0 ≤ amount ≤ 10.000",
      "1 ≤ moeda ≤ 10.000",
    ],
    "O(amount × quantidade de moedas)",
    "O(amount)",
  ),
  challenge(
    "interval-merge",
    "Agenda sem conflitos",
    "algorithms",
    "medium",
    "Receba uma lista de intervalos fechados [início, fim]. Una os intervalos que se sobrepõem ou compartilham uma extremidade. Retorne os intervalos resultantes em ordem crescente de início.",
    [
      ex(
        [
          [1, 3],
          [2, 6],
          [8, 10],
          [10, 12],
        ],
        [
          [1, 6],
          [8, 12],
        ],
      ),
      ex([], []),
    ],
    ["0 ≤ quantidade ≤ 100.000", "−1.000.000 ≤ início ≤ fim ≤ 1.000.000"],
    "O(n log n)",
    "O(n)",
  ),
  challenge(
    "topological-sort",
    "Ordem das missões",
    "algorithms",
    "hard",
    "Receba {n, edges}. Uma aresta [a, b] significa que a missão a precisa terminar antes de b. Retorne a menor ordem topológica lexicográfica, escolhendo sempre a menor missão disponível. Retorne [] se existir ciclo.",
    [
      ex(
        {
          n: 4,
          edges: [
            [0, 2],
            [1, 2],
            [2, 3],
          ],
        },
        [0, 1, 2, 3],
      ),
      ex(
        {
          n: 2,
          edges: [
            [0, 1],
            [1, 0],
          ],
        },
        [],
      ),
    ],
    [
      "0 ≤ n ≤ 10.000",
      "0 ≤ arestas ≤ 100.000",
      "Vértices 0 até n − 1; não há arestas repetidas.",
    ],
    "O((V + E) log(V + 1))",
    "O(V + E)",
  ),
  {
    ...challenge(
      "shortest-path",
      "Rota de menor custo",
      "algorithms",
      "hard",
      "Implemente shortestPath(graph, start, end). O grafo dirigido é uma lista de adjacência de objetos {to, weight}. Retorne os vértices de qualquer caminho mínimo entre origem e destino, ou [] se inalcançável. Origem igual ao destino retorna [origem]. Arestas paralelas, ciclos e peso zero são permitidos. Para um segmento com arestas paralelas, use o menor peso.",
      [
        ex(
          {
            graph: [
              [
                { to: 1, weight: 4 },
                { to: 2, weight: 1 },
              ],
              [{ to: 3, weight: 1 }],
              [
                { to: 1, weight: 2 },
                { to: 3, weight: 5 },
              ],
              [],
            ],
            start: 0,
            end: 3,
          },
          [0, 2, 1, 3],
        ),
        ex({ graph: [[], []], start: 0, end: 1 }, []),
      ],
      [
        "1 ≤ V ≤ 10.000; 0 ≤ E ≤ 100.000",
        "0 ≤ peso ≤ 1.000.000",
        "Origem e destino são válidos.",
      ],
      "O(V + E log(E + 1))",
      "O(V + E)",
    ),
    kind: "project",
    functionName: "shortestPath",
    languageIds: ["typescript"],
    starterFilesByLanguage: shortestPathTemplates,
  },
  challenge(
    "edit-distance",
    "Correção de pergaminhos",
    "algorithms",
    "hard",
    "Receba {a, b}, duas strings de letras minúsculas. Retorne a distância de Levenshtein: quantidade mínima de inserções, remoções e substituições de um caractere para transformar a em b. Cada operação custa um.",
    [ex({ a: "kitten", b: "sitting" }, 3), ex({ a: "", b: "abc" }, 3)],
    ["0 ≤ comprimento de cada string ≤ 1.000"],
    "O(n × m)",
    "O(min(n, m)) auxiliar",
  ),
  challenge(
    "knapsack",
    "Mochila do explorador",
    "algorithms",
    "hard",
    "Receba {weights, values, capacity}. Cada posição representa um item, disponível uma única vez. Retorne o maior valor total de itens cujo peso não ultrapasse a capacidade. É permitido escolher nenhum item.",
    [
      ex({ weights: [2, 3, 4], values: [4, 5, 7], capacity: 5 }, 9),
      ex({ weights: [5], values: [10], capacity: 0 }, 0),
    ],
    [
      "0 ≤ quantidade de itens ≤ 200",
      "1 ≤ peso ≤ 10.000; 0 ≤ valor ≤ 10.000",
      "0 ≤ capacity ≤ 10.000; listas com mesmo tamanho",
    ],
    "O(n × capacity)",
    "O(capacity)",
  ),
  challenge(
    "max-subarray",
    "Melhor sequência de ganhos",
    "algorithms",
    "medium",
    "Receba uma lista não vazia de inteiros e retorne a maior soma possível de uma sublista contígua não vazia. Se todos os valores forem negativos, a resposta será o maior valor individual.",
    [ex([-2, 1, -3, 4, -1, 2, 1, -5, 4], 6), ex([-5, -2], -2)],
    ["1 ≤ n ≤ 100.000", "|valor| ≤ 10.000"],
    "O(n)",
    "O(1)",
  ),
];

const structures: PublicChallenge[] = [
  challenge(
    "stack-ops",
    "Pilha de inventário",
    "data-structures",
    "easy",
    'Receba uma lista de operações ["push", valor], ["pop"] e ["peek"]. Retorne uma lista com um resultado apenas para cada pop e peek. Pop remove o topo, peek apenas consulta. Em pilha vazia, ambos retornam null.',
    [
      ex(
        [["push", 3], ["push", 7], ["peek"], ["pop"], ["pop"], ["pop"]],
        [7, 7, 3, null],
      ),
    ],
    ["Até 100.000 operações; valores inteiros"],
    "O(n) total",
    "O(n)",
  ),
  challenge(
    "queue-ops",
    "Fila do portal",
    "data-structures",
    "easy",
    'Receba operações ["enqueue", valor], ["dequeue"] e ["front"]. Retorne os resultados de dequeue e front na ordem. A fila é FIFO; dequeue remove, front consulta. Fila vazia produz null.',
    [
      ex(
        [
          ["enqueue", 3],
          ["enqueue", 7],
          ["front"],
          ["dequeue"],
          ["dequeue"],
          ["dequeue"],
        ],
        [3, 3, 7, null],
      ),
    ],
    ["Até 100.000 operações; valores inteiros"],
    "O(n) total amortizado",
    "O(n)",
  ),
  challenge(
    "balanced-brackets",
    "Portais balanceados",
    "data-structures",
    "easy",
    "Uma string contém somente (), [] e {}. Retorne true quando cada fechamento corresponder à abertura mais recente ainda pendente e nenhuma abertura sobrar. A string vazia é válida.",
    [ex("{[()]}", true), ex("([)]", false), ex("", true)],
    ["0 ≤ comprimento ≤ 100.000"],
    "O(n)",
    "O(n)",
  ),
  challenge(
    "frequency-map",
    "Contagem do inventário",
    "data-structures",
    "easy",
    "Receba uma lista de strings e retorne pares [palavra, quantidade] na ordem da primeira aparição de cada palavra. Palavras diferenciam maiúsculas e minúsculas.",
    [
      ex(
        ["potion", "key", "potion"],
        [
          ["potion", 2],
          ["key", 1],
        ],
      ),
      ex([], []),
    ],
    ["0 ≤ n ≤ 100.000", "Strings ASCII de até 50 caracteres"],
    "O(total de caracteres)",
    "O(n)",
  ),
  challenge(
    "linked-list-reverse",
    "Inversão da corrente",
    "data-structures",
    "easy",
    "Uma lista encadeada é serializada como {head, nodes}, onde nodes[i] = {value, next} e next é um índice ou null. Retorne a mesma estrutura com os ponteiros invertidos e o novo head. Preserve a ordem e os valores do array nodes; somente next e head mudam.",
    [
      ex(
        {
          head: 0,
          nodes: [
            { value: 7, next: 1 },
            { value: 8, next: null },
          ],
        },
        {
          head: 1,
          nodes: [
            { value: 7, next: null },
            { value: 8, next: 0 },
          ],
        },
      ),
      ex({ head: null, nodes: [] }, { head: null, nodes: [] }),
    ],
    [
      "0 ≤ nós ≤ 100.000",
      "Lista acíclica; todos os nós são alcançáveis a partir de head.",
    ],
    "O(n)",
    "O(1) auxiliar além da estrutura retornada",
  ),
  challenge(
    "remove-duplicates",
    "Itens únicos",
    "data-structures",
    "easy",
    "Receba uma lista de inteiros e devolva cada valor uma única vez, mantendo a ordem de sua primeira aparição.",
    [ex([3, 1, 3, 2, 1], [3, 1, 2]), ex([], [])],
    ["0 ≤ n ≤ 100.000", "|valor| ≤ 1.000.000.000"],
    "O(n) esperado",
    "O(n)",
  ),
  challenge(
    "bst-search",
    "Busca na árvore de itens",
    "data-structures",
    "medium",
    "Receba {root, nodes, target}. Cada nó é {value, left, right}, com filhos como índices ou null. A árvore é de busca estrita, sem valores repetidos. Retorne o índice do nó que contém target ou null se ausente. Root null representa árvore vazia.",
    [
      ex(
        {
          root: 0,
          nodes: [
            { value: 5, left: 1, right: 2 },
            { value: 2, left: null, right: null },
            { value: 8, left: null, right: null },
          ],
          target: 8,
        },
        2,
      ),
    ],
    [
      "0 ≤ nós ≤ 100.000",
      "Todos os nós pertencem à árvore, que pode ser degenerada.",
    ],
    "O(altura)",
    "O(1)",
  ),
  challenge(
    "tree-height",
    "Altura da torre",
    "data-structures",
    "medium",
    "Receba {root, nodes}, uma árvore binária serializada. Cada nó tem {value, left, right} e os filhos são índices ou null. Retorne a quantidade de nós no caminho mais longo da raiz até uma folha. Árvore vazia tem altura zero.",
    [
      ex(
        {
          root: 0,
          nodes: [
            { value: 1, left: 1, right: null },
            { value: 2, left: null, right: null },
          ],
        },
        2,
      ),
      ex({ root: null, nodes: [] }, 0),
    ],
    ["0 ≤ nós ≤ 100.000", "Árvore acíclica; todos os nós são alcançáveis."],
    "O(n)",
    "O(n)",
  ),
  challenge(
    "level-order",
    "Expedição por andares",
    "data-structures",
    "medium",
    "Receba {root, nodes}, uma árvore binária com nós {value, left, right}. Retorne uma lista de níveis; cada nível contém os valores da esquerda para a direita. Filhos e raiz são índices ou null. Árvore vazia retorna [].",
    [
      ex(
        {
          root: 0,
          nodes: [
            { value: 5, left: 1, right: 2 },
            { value: 2, left: null, right: null },
            { value: 8, left: null, right: null },
          ],
        },
        [[5], [2, 8]],
      ),
    ],
    ["0 ≤ nós ≤ 100.000; árvore acíclica conectada"],
    "O(n)",
    "O(n)",
  ),
  challenge(
    "lru-cache",
    "Cache das relíquias",
    "data-structures",
    "hard",
    'Receba {capacity, operations}. Operações são ["put", chave, valor] e ["get", chave]. Retorne apenas os resultados dos gets, usando null para ausentes. Get existente e put tornam a chave a mais recentemente usada. Ao exceder capacity, remova a menos recentemente usada. Capacity zero não armazena nada.',
    [
      ex(
        {
          capacity: 2,
          operations: [
            ["put", "a", 1],
            ["put", "b", 2],
            ["get", "a"],
            ["put", "c", 3],
            ["get", "b"],
            ["get", "c"],
          ],
        },
        [1, null, 3],
      ),
    ],
    [
      "0 ≤ capacity ≤ 10.000",
      "Até 100.000 operações; chaves ASCII, valores inteiros",
    ],
    "O(1) esperado por operação",
    "O(capacity)",
  ),
  challenge(
    "union-find",
    "Alianças da guilda",
    "data-structures",
    "medium",
    'Receba {n, operations}. Inicialmente cada jogador de 0 a n − 1 está separado. ["union", a, b] une os grupos; ["connected", a, b] consulta se estão no mesmo grupo. Retorne somente os booleanos das consultas.',
    [
      ex(
        {
          n: 4,
          operations: [
            ["union", 0, 1],
            ["connected", 0, 2],
            ["union", 1, 2],
            ["connected", 0, 2],
          ],
        },
        [false, true],
      ),
    ],
    ["1 ≤ n ≤ 100.000; até 100.000 operações", "Jogadores sempre válidos."],
    "O((n + q) α(n))",
    "O(n)",
  ),
  challenge(
    "trie-prefix",
    "Dicionário do mago",
    "data-structures",
    "medium",
    "Receba {words, prefixes}. Para cada prefixo, retorne quantas palavras distintas começam com ele. Entradas duplicadas em words contam uma vez. Prefixo vazio corresponde a todas as palavras distintas.",
    [
      ex(
        {
          words: ["car", "cat", "car", "dog"],
          prefixes: ["ca", "car", "", "z"],
        },
        [2, 1, 3, 0],
      ),
    ],
    ["Apenas letras a–z", "Até 100.000 caracteres somados em words e prefixes"],
    "O(total de caracteres)",
    "O(total de caracteres das palavras)",
  ),
  challenge(
    "range-sum",
    "Soma com atualizações",
    "data-structures",
    "hard",
    'Receba {values, operations}. ["set", índice, valor] substitui um elemento; ["sum", esquerda, direita] consulta a soma no intervalo fechado de índices. Retorne apenas os resultados das consultas, na ordem.',
    [
      ex(
        {
          values: [1, 2, 3, 4],
          operations: [
            ["sum", 1, 3],
            ["set", 2, 10],
            ["sum", 1, 3],
          ],
        },
        [9, 16],
      ),
    ],
    [
      "1 ≤ n ≤ 100.000; até 100.000 operações",
      "Índices válidos; esquerda ≤ direita; |valor| ≤ 10.000",
    ],
    "O((n + q) log n)",
    "O(n)",
  ),
  challenge(
    "median-stream",
    "Mediana em tempo real",
    "data-structures",
    "hard",
    "Receba uma sequência de inteiros. Depois de inserir cada elemento, retorne a mediana dos elementos já recebidos. Em quantidade par, use a média dos dois valores centrais. A saída tem o mesmo tamanho da entrada.",
    [ex([5, 2, 8, 1], [5, 3.5, 5, 3.5]), ex([], [])],
    ["0 ≤ n ≤ 100.000", "|valor| ≤ 1.000.000.000"],
    "O(n log n)",
    "O(n)",
  ),
  challenge(
    "heap-top-k",
    "Os maiores tesouros",
    "data-structures",
    "medium",
    "Receba {values, k}. Retorne os k maiores valores em ordem decrescente, preservando repetições. Para k zero, retorne []. Busque usar memória proporcional a k.",
    [
      ex({ values: [5, 1, 5, 3], k: 3 }, [5, 5, 3]),
      ex({ values: [1, 2], k: 0 }, []),
    ],
    ["0 ≤ k ≤ n ≤ 100.000", "|valor| ≤ 1.000.000.000"],
    "O(n log(k + 1))",
    "O(k)",
  ),
];

const shopSchema = `CREATE TABLE customers (id integer PRIMARY KEY, name text NOT NULL, city text);\nCREATE TABLE orders (id integer PRIMARY KEY, customer_id integer REFERENCES customers(id), amount integer NOT NULL, status text NOT NULL, created_at date NOT NULL);`;
const staffSchema = `CREATE TABLE employees (id integer PRIMARY KEY, name text NOT NULL, department text NOT NULL, salary integer NOT NULL, manager_id integer REFERENCES employees(id));`;
const gameSchema = `CREATE TABLE players (id integer PRIMARY KEY, name text NOT NULL);\nCREATE TABLE scores (id integer PRIMARY KEY, player_id integer REFERENCES players(id), points integer NOT NULL, played_on date NOT NULL);`;
function sql(
  id: string,
  title: string,
  difficulty: ContentDifficulty,
  description: string,
  schema: string,
  examples: Example[],
  constraints: string[],
): PublicChallenge {
  return {
    ...challenge(
      id,
      title,
      "sql",
      difficulty,
      description,
      examples,
      [
        ...constraints,
        "Memória combinada: 1 GiB para o cliente e 512 MiB para PostgreSQL.",
      ],
      "Depende do plano da consulta e dos dados",
      "Depende do plano da consulta",
    ),
    kind: "sql",
    functionName: undefined,
    sqlSchema: schema,
    languageIds: ["sql"],
    starterFilesByLanguage: {
      sql: [
        {
          path: "solution.sql",
          content:
            "-- PostgreSQL 18 · escreva uma única consulta de leitura.\nSELECT 1;\n",
        },
      ],
    },
    availableModes: ["normal"],
    limits: { ...betaExecutionLimits, memoryMiB: 1536 },
  };
}
const sqlChallenges: PublicChallenge[] = [
  sql(
    "sql-active-orders",
    "Pedidos confirmados",
    "easy",
    "Selecione id e amount dos pedidos cujo status é paid e amount é pelo menos 100. Ordene por id crescente. Não inclua outros status.",
    shopSchema,
    [
      ex(
        {
          orders: [
            { id: 1, amount: 120, status: "paid" },
            { id: 2, amount: 90, status: "paid" },
          ],
        },
        [{ id: 1, amount: 120 }],
      ),
    ],
    [
      "amount armazena unidades inteiras.",
      "Colunas de saída, nesta ordem: id, amount.",
    ],
  ),
  sql(
    "sql-customer-count",
    "Clientes por cidade",
    "easy",
    "Conte os clientes por cidade, incluindo um grupo para city NULL. Retorne city e total (bigint), em ordem crescente de city com NULL por último.",
    shopSchema,
    [
      ex(
        {
          customers: [
            { id: 1, name: "Ana", city: "Recife" },
            { id: 2, name: "Bia", city: "Recife" },
            { id: 3, name: "Caio", city: null },
          ],
        },
        [
          { city: "Recife", total: 2 },
          { city: null, total: 1 },
        ],
      ),
    ],
    ["Colunas: city (text), total (bigint).", "Use ordenação NULLS LAST."],
  ),
  sql(
    "sql-order-owner",
    "Quem fez o pedido?",
    "easy",
    "Liste cada pedido com id, customer_name e amount, associando o cliente pelo customer_id. Pedidos sem cliente devem aparecer com customer_name NULL. Ordene pelo id do pedido.",
    shopSchema,
    [
      ex(
        {
          customers: [{ id: 1, name: "Ana", city: null }],
          orders: [
            { id: 7, customer_id: 1, amount: 50 },
            { id: 8, customer_id: null, amount: 30 },
          ],
        },
        [
          { id: 7, customer_name: "Ana", amount: 50 },
          { id: 8, customer_name: null, amount: 30 },
        ],
      ),
    ],
    ["Colunas: id (integer), customer_name (text), amount (integer)."],
  ),
  sql(
    "sql-no-orders",
    "Clientes aguardando a primeira compra",
    "easy",
    "Retorne id e name dos clientes que nunca fizeram pedido, independentemente do status dos pedidos existentes. Ordene por id.",
    shopSchema,
    [
      ex(
        {
          customers: [
            { id: 1, name: "Ana" },
            { id: 2, name: "Bia" },
          ],
          orders: [{ customer_id: 1 }],
        },
        [{ id: 2, name: "Bia" }],
      ),
    ],
    [
      "Colunas: id (integer), name (text).",
      "customer_id de um pedido pode ser NULL.",
    ],
  ),
  sql(
    "sql-customer-spend",
    "Total gasto por cliente",
    "medium",
    "Retorne customer_id e total_paid para todos os clientes. Some apenas pedidos com status paid; clientes sem pagamentos devem ter zero. Ordene total_paid decrescente, depois customer_id crescente.",
    shopSchema,
    [
      ex(
        {
          customers: [{ id: 1 }, { id: 2 }],
          orders: [
            { customer_id: 1, amount: 70, status: "paid" },
            { customer_id: 1, amount: 90, status: "pending" },
          ],
        },
        [
          { customer_id: 1, total_paid: 70 },
          { customer_id: 2, total_paid: 0 },
        ],
      ),
    ],
    ["Colunas: customer_id (integer), total_paid (bigint)."],
  ),
  sql(
    "sql-above-average",
    "Salários acima da média",
    "medium",
    "Retorne id, name e department de cada funcionário cujo salário é estritamente maior que a média do seu próprio departamento. Ordene por id. Considere todos os funcionários no cálculo da média.",
    staffSchema,
    [
      ex(
        {
          employees: [
            { id: 1, name: "Ana", department: "Eng", salary: 100 },
            { id: 2, name: "Bia", department: "Eng", salary: 200 },
          ],
        },
        [{ id: 2, name: "Bia", department: "Eng" }],
      ),
    ],
    ["Colunas: id (integer), name (text), department (text)."],
  ),
  sql(
    "sql-second-salary",
    "Segundo salário distinto",
    "medium",
    "Para cada departamento, retorne department e second_salary, o segundo maior salário distinto. Departamentos sem dois salários distintos retornam NULL. Ordene por department crescente.",
    staffSchema,
    [
      ex(
        {
          employees: [
            { department: "Eng", salary: 200 },
            { department: "Eng", salary: 200 },
            { department: "Eng", salary: 100 },
            { department: "Ops", salary: 90 },
          ],
        },
        [
          { department: "Eng", second_salary: 100 },
          { department: "Ops", second_salary: null },
        ],
      ),
    ],
    [
      "Colunas: department (text), second_salary (integer).",
      "Empates ocupam uma única posição distinta.",
    ],
  ),
  sql(
    "sql-running-score",
    "Pontuação acumulada",
    "hard",
    "Para cada partida em scores, retorne id, player_id e running_points. Acumule points para o mesmo jogador em ordem de played_on e depois id. Ordene a saída por player_id, played_on e id. Cada partida gera sua própria linha, inclusive no mesmo dia.",
    gameSchema,
    [
      ex(
        {
          scores: [
            { id: 1, player_id: 2, points: 10, played_on: "2026-01-01" },
            { id: 2, player_id: 2, points: 5, played_on: "2026-01-01" },
          ],
        },
        [
          { id: 1, player_id: 2, running_points: 10 },
          { id: 2, player_id: 2, running_points: 15 },
        ],
      ),
    ],
    [
      "Colunas: id (integer), player_id (integer), running_points (bigint).",
      "Empates de data são resolvidos pelo id.",
    ],
  ),
  sql(
    "sql-top-players",
    "Pódio com empates",
    "hard",
    "Some points por jogador, incluindo jogadores sem partidas com total zero. Retorne player_id, name, total_points e position usando ranking denso por total decrescente. Inclua todas as pessoas nas três primeiras posições distintas. Ordene position, depois player_id.",
    gameSchema,
    [
      ex(
        {
          players: [
            { id: 1, name: "Ana" },
            { id: 2, name: "Bia" },
          ],
          scores: [
            { player_id: 1, points: 10 },
            { player_id: 2, points: 10 },
          ],
        },
        [
          { player_id: 1, name: "Ana", total_points: 10, position: 1 },
          { player_id: 2, name: "Bia", total_points: 10, position: 1 },
        ],
      ),
    ],
    [
      "Colunas: player_id (integer), name (text), total_points (bigint), position (bigint).",
      "Não limite a saída a apenas três jogadores.",
    ],
  ),
  sql(
    "sql-reporting-tree",
    "Hierarquia da equipe",
    "hard",
    "Retorne id, name e depth para todos os funcionários. Raízes têm manager_id NULL e depth zero; cada subordinado direto acrescenta um. A hierarquia é uma floresta sem ciclos. Ordene depth crescente, depois id.",
    staffSchema,
    [
      ex(
        {
          employees: [
            { id: 1, name: "Ana", manager_id: null },
            { id: 2, name: "Bia", manager_id: 1 },
            { id: 3, name: "Caio", manager_id: 2 },
          ],
        },
        [
          { id: 1, name: "Ana", depth: 0 },
          { id: 2, name: "Bia", depth: 1 },
          { id: 3, name: "Caio", depth: 2 },
        ],
      ),
    ],
    [
      "Colunas: id (integer), name (text), depth (integer).",
      "Todo gerente não nulo existe; não há ciclos.",
    ],
  ),
];

export const challenges: PublicChallenge[] = [
  ...logic,
  ...algorithms,
  ...structures,
  ...sqlChallenges,
].map((item) => ({
  ...item,
  learningResources: learningResourcesFor(item.topicId, item.languageIds),
}));
export const challengeById = new Map(challenges.map((item) => [item.id, item]));
export const catalogVersion = "2026-09-beta-1";
