# Contratos privados do executor

`judge/index.ts` exporta `getEvaluation(challengeId, languageId, kind)` e `getEditorial(challengeId, languageId)`. Nunca importar `judge/` de `src/`. `kind = run | runs | public` retorna apenas casos públicos; a submissão oficial exige **todos** os casos.

Cada avaliação possui `cases: {input, expected, public}[]` e `compare(input, expected, actual): boolean`. Expectativas e comparadores executam no coordenador confiável, fora do sandbox do aluno. O sandbox recebe somente o input de cada caso. Imagens, dependências e comandos não podem ser fornecidos pelo aluno.

## Execução livre e programas

O pedido ao executor aceita `executionMode: "function" | "program"` (padrão `function` para preservar soluções anteriores). Em `program`, compila e executa o arquivo do aluno com seu ponto de entrada normal, sem injetar chamadas a `solve` ou `findMax`. Java usa `Solution.main`, Kotlin `SolutionKt`, Go pacote `main`, C/C++/Rust `main`, C# aceita instruções de nível superior, JavaScript/TypeScript/Python executam o arquivo diretamente. Todos continuam dentro do mesmo sandbox sem rede, com limites por processo e job.

Cada caso pode conter `stdin` textual explícito (até 64 KiB). Sem `stdin`, o programa recebe o JSON de `input` seguido de uma quebra de linha. Para Executar livre sem entrada, o coordenador envia um único caso `{input: null, stdin: ""}`; retorna stdout, stderr, termination e metrics sem julgar. Executar não consome tentativa de submissão nem XP.

Para Submeter programas, o coordenador envia todos os casos oficiais e compara o stdout real usando `parseProgramOutput`: JSON preserva tipos; texto simples recebe trim; os escalares Python `True`, `False`, `None` normalizam para booleanos/null. O programa deve imprimir somente o resultado final em stdout, podendo usar stderr para diagnóstico. Logs adicionais não são descartados para evitar aprovação ambígua. A avaliação usa `getEvaluation(id, language, kind, "program")`; maior pontuação compara o valor diretamente, pois um processo independente recebe sua própria entrada. O modo função mantém a verificação de imutabilidade. SQL preserva fixtures e papel restrito em ambos os modos.

## Funções JSON — 38 desafios

| Linguagem  | Arquivo       | Assinatura                                     | Dependência instalada na imagem                   |
| ---------- | ------------- | ---------------------------------------------- | ------------------------------------------------- |
| TypeScript | solution.ts   | `export solve(input: any): any`                | TypeScript                                        |
| JavaScript | solution.js   | `export solve(input)`                          | Node.js                                           |
| Python     | solution.py   | `solve(input)`                                 | biblioteca padrão json                            |
| Java       | Solution.java | `Solution.solve(JsonNode): JsonNode`           | Jackson Databind                                  |
| C#         | Solution.cs   | `Solution.Solve(JsonNode?): JsonNode?`         | System.Text.Json.Nodes                            |
| C++        | solution.cpp  | `solve(const nlohmann::json&): nlohmann::json` | nlohmann/json                                     |
| C          | solution.c    | `solve(const cJSON*): cJSON*`                  | cJSON; resultado pertence ao adaptador            |
| Go         | solution.go   | pacote solution, `Solve(any) any`              | encoding/json; números decodificados como float64 |
| Rust       | solution.rs   | `solve(serde_json::Value): serde_json::Value`  | serde_json                                        |
| Kotlin     | Solution.kt   | `solve(JsonElement): JsonElement`              | kotlinx.serialization.json                        |

O adaptador parseia o input JSON, chama a função uma vez e serializa seu retorno como `actual`. Inteiros nos contratos estão no intervalo seguro do IEEE-754. `null`, booleanos, números e strings mantêm tipos; arrays mantêm ordem. Não há acesso à rede nem instalação dinâmica. Versões exatas pertencem ao manifesto de cada runtime e precisam de homologação remota antes da habilitação.

## Maior pontuação — 10 linguagens

| Linguagem  | Assinatura                                                             |
| ---------- | ---------------------------------------------------------------------- |
| TypeScript | `findMax(readonly number[]): number                                    | null` |
| JavaScript | `findMax(values)`                                                      |
| Python     | `find_max(list[int]) -> int                                            | None` |
| Java       | `Solution.findMax(int[]): Integer`                                     |
| C#         | `Solution.FindMax(int[]): int?`                                        |
| C++        | `find_max(const std::vector<int>&): std::optional<int>`                |
| C          | `find_max(const int*, size_t): MaxResult { bool present; int value; }` |
| Go         | pacote solution, `FindMax([]int) (int, bool)`                          |
| Rust       | `find_max(&[i32]): Option<i32>`                                        |
| Kotlin     | `findMax(IntArray): Int?`                                              |

O adaptador normaliza ausência para null. Copia a entrada antes da chamada e produz `{result, inputUnchanged: boolean}` depois de comparar o estado final com a cópia. O comparador exige `inputUnchanged === true`. Em testes locais confiáveis, aceita também `{result, inputAfter}`. O envelope compacto evita transportar 100.000 inteiros como saída adicional, que ultrapassaria a cota por caso.

Esta comparação verifica o estado final visível ao harness; não constitui prova estática de imutabilidade nem detecção garantida de adulteração por código hostil dentro do processo. Métricas decisórias de CPU, memória e saída vêm exclusivamente do supervisor protegido. O aluno não pode substituir o canal autenticado de resultado por texto em stdout. Todos os testes oficiais continuam externos ao workspace.

## Projeto de grafos

Somente TypeScript inicialmente. `solution.ts` exporta `shortestPath(graph, start, end)` e importa `min-heap.ts`. O adaptador desestrutura `{graph,start,end}` e envia à comparação apenas o array retornado. `comparePath` compara custo mínimo e validade das arestas; empates não exigem a mesma sequência. Arquivos de teste do aluno não decidem aprovação.

## SQL

Input de cada caso: `{schema: string, seedSql: string, ordered: true}`. Um supervisor privilegiado provisiona esses dados em banco descartável e depois inicia a consulta de `solution.sql` com papel restrito de leitura. Nunca usar a conexão do banco da aplicação. Seeds e schema são conteúdo editorial privado da plataforma; nunca executar SQL de setup fornecido pelo aluno.

Actual: `{columns: [{name,type}], rows: unknown[][]}`. Tipo usa os nomes PostgreSQL: OID 23 → int4, 20 → int8, 25 → text. Outras modalidades do comparador também admitem date, numeric e bool. Inteiros deste catálogo cabem em número JavaScript e devem ser normalizados como números, inclusive int8. NULL permanece null. Nomes, ordem e tipos de colunas são obrigatórios. Todas as dez consultas iniciais exigem ordem de linhas; `compareSql` também oferece comparação como multiconjunto para futuros enunciados sem ordenação.

Cada desafio SQL possui o exemplo público completo e três bases oficiais: duas variantes com empates/NULL/ausências e uma base vazia. PostgreSQL 18, parser SQL, papel de leitura, watchdog e limitação de funções precisam passar pela homologação do executor; somente comparação de resultados não fornece isolamento.

## Editoriais e diagnóstico

Maior pontuação tem gabaritos em dez linguagens. Demais 38 funções têm referência canônica TypeScript; quando solicitadas em outra linguagem, a resposta explicita que a tradução ainda não foi homologada. SQL tem dez consultas de referência. Grafos tem solução e heap separados.

`node judge/generate-editorials.mjs` regenera o código exibido dos 38 gabaritos a partir das referências revisadas. Gabaritos e dicas são privados; a API verifica desbloqueio antes de retornar qualquer arquivo. Alterações de contrato requerem nova versionId e preservação de versões já submetidas.

`diagnoseGrowth` é apenas consultivo. Exige perfil calibrado, seis tamanhos, três sementes e cinco amostras por combinação; ajusta quatro tamanhos e valida dois maiores. Não aceita medições impressas pelo aluno e não reduz V/E a n. Não influencia o veredito. Os limites de dispersão e erro são defaults conservadores a serem calibrados, não probabilidades de certeza.
