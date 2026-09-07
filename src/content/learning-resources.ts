import type { LanguageId, LearningResource, TopicId } from "../lib/contracts";

const languageResources: Record<
  LanguageId,
  Omit<LearningResource, "category">
> = {
  python: {
    title: "Tutorial oficial de Python",
    description:
      "Revise funções, listas, condicionais e laços antes de implementar.",
    url: "https://docs.python.org/3/tutorial/",
    languageId: "python",
  },
  javascript: {
    title: "Guia de JavaScript da MDN",
    description:
      "Consulte a sintaxe e os recursos da linguagem usados na solução.",
    url: "https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Guide",
    languageId: "javascript",
  },
  typescript: {
    title: "Handbook oficial do TypeScript",
    description: "Use o guia para revisar tipos, funções e coleções.",
    url: "https://www.typescriptlang.org/docs/handbook/intro.html",
    languageId: "typescript",
  },
  java: {
    title: "Documentação do Java",
    description:
      "Consulte a referência oficial da plataforma e da biblioteca padrão.",
    url: "https://docs.oracle.com/en/java/javase/",
    languageId: "java",
  },
  csharp: {
    title: "Tour do C#",
    description: "Revise a sintaxe, tipos e coleções da linguagem.",
    url: "https://learn.microsoft.com/pt-br/dotnet/csharp/tour-of-csharp/",
    languageId: "csharp",
  },
  cpp: {
    title: "Referência de C++",
    description: "Consulte a linguagem e a biblioteca padrão de C++.",
    url: "https://en.cppreference.com/w/cpp",
    languageId: "cpp",
  },
  c: {
    title: "Referência de C",
    description: "Consulte a sintaxe e a biblioteca padrão da linguagem C.",
    url: "https://en.cppreference.com/w/c",
    languageId: "c",
  },
  go: {
    title: "Effective Go",
    description: "Revise funções, slices, mapas e convenções da linguagem.",
    url: "https://go.dev/doc/effective_go",
    languageId: "go",
  },
  rust: {
    title: "The Rust Programming Language",
    description: "Consulte ownership, tipos e coleções da biblioteca padrão.",
    url: "https://doc.rust-lang.org/book/",
    languageId: "rust",
  },
  kotlin: {
    title: "Documentação do Kotlin",
    description: "Revise funções, coleções e a sintaxe da linguagem.",
    url: "https://kotlinlang.org/docs/home.html",
    languageId: "kotlin",
  },
  sql: {
    title: "Tutorial oficial do PostgreSQL",
    description:
      "Consulte SELECT, filtros, junções e agregações do PostgreSQL.",
    url: "https://www.postgresql.org/docs/current/tutorial.html",
    languageId: "sql",
  },
};

const conceptResources: Record<TopicId, Omit<LearningResource, "category">> = {
  logic: {
    title: "Fluxo de controle e funções",
    description:
      "Planeje os casos, condições e repetições antes de escrever a solução.",
    url: "https://docs.python.org/3/tutorial/controlflow.html",
  },
  algorithms: {
    title: "Estruturas de dados e algoritmos",
    description:
      "Revise como escolher uma estrutura e percorrer os dados com eficiência.",
    url: "https://docs.python.org/3/tutorial/datastructures.html",
  },
  "data-structures": {
    title: "Estruturas de dados",
    description:
      "Compare listas, pilhas, filas, conjuntos e mapas para organizar a solução.",
    url: "https://docs.python.org/3/tutorial/datastructures.html",
  },
  sql: {
    title: "Consultas no PostgreSQL",
    description:
      "Revise consultas, junções, agregações e ordenação antes de escrever SQL.",
    url: "https://www.postgresql.org/docs/current/queries.html",
  },
  oop: {
    title: "Classes e objetos",
    description:
      "Revise responsabilidades e relações entre objetos antes de modelar a solução.",
    url: "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Object.html",
  },
  backend: {
    title: "Web APIs no Node.js",
    description:
      "Revise contratos HTTP e tratamento de dados de entrada e saída.",
    url: "https://nodejs.org/docs/latest/api/http.html",
  },
  testing: {
    title: "Testes automatizados",
    description:
      "Use casos pequenos e casos de borda para validar o comportamento esperado.",
    url: "https://vitest.dev/guide/",
  },
  architecture: {
    title: "Documentação de arquitetura",
    description:
      "Registre responsabilidades e fronteiras antes de propor uma solução.",
    url: "https://docs.github.com/en/get-started/learning-about-github/about-readmes",
  },
  "system-design": {
    title: "Fundamentos de sistemas distribuídos",
    description:
      "Comece pelas necessidades do usuário, limites e decisões de consistência.",
    url: "https://cloud.google.com/architecture/framework",
  },
  devops: {
    title: "Documentação do GitHub Actions",
    description:
      "Revise automação, execução e entrega contínua antes de montar o fluxo.",
    url: "https://docs.github.com/en/actions",
  },
};

export function learningResourcesFor(
  topicId: TopicId,
  languageIds: readonly LanguageId[],
): LearningResource[] {
  const concept = conceptResources[topicId];
  return [
    { ...concept, category: "concept" },
    ...languageIds.map((languageId) => ({
      ...languageResources[languageId],
      category: "language" as const,
    })),
  ];
}
