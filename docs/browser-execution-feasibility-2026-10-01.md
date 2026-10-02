# Execução no navegador — avaliação para o Rods Leet

Data: 1 de outubro de 2026. Estado: estudo de viabilidade, sem implementação no produto ou nova publicação.

## Recomendação

Usar execução local para prática tem bom potencial para o Rods Leet, com carregamento por linguagem e alternativa automática pelo servidor. O usuário confirmou todas as linguagens no escopo, nenhuma instalação no computador e uso do servidor quando a execução local não estiver validada ou disponível. Essa decisão mantém a cobertura do catálogo; não comprova que todas as linguagens já executam localmente.

O ganho provável está em repetir testes públicos sem fila nem consulta periódica de resultado. A aprovação oficial, testes privados, recompensas e ranking continuam no servidor. A execução local não resolve a disponibilidade do juiz oficial.

Não recomendo substituir as onze linguagens de uma vez por uma máquina Linux emulada no navegador como estratégia inicial de velocidade. Recomendo começar a homologação pelos runtimes com melhor relação entre carregamento, compatibilidade e uso no catálogo; cada linguagem só muda o caminho de execução depois de passar pela mesma validação de exemplos e limites.

## O que foi medido

Protótipo temporário em Chromium real, separado do aplicativo, executando somente código conhecido em Workers: soma de 3 e 4 em JavaScript e Python, e `SELECT $1::integer + $2::integer` no PostgreSQL do PGlite. Uma primeira chamada por linguagem/perfil, seguida de vinte chamadas no mesmo runtime. As chamadas conferiram resultado 7; o tempo inclui ida e volta da mensagem ao Worker. O valor próximo de zero de JavaScript está abaixo da resolução útil do relógio, não representa execução instantânea.

| Linguagem      | Primeiro uso no desktop | Primeiro uso com CPU 4× mais lenta e rede 1,6 Mbps/150 ms | Mediana com runtime carregado, desktop / perfil limitado | Corpos de respostas transferidos no protótipo |
| -------------- | ----------------------- | --------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| JavaScript     | 8,5 ms                  | 166 ms                                                    | <1 ms / <1 ms                                            | Sem pacote externo de runtime                 |
| Python         | 2,43 s                  | 34,33 s                                                   | 0,4 ms / 0,9 ms                                          | Cerca de 6,40 MB                              |
| PostgreSQL/SQL | 3,02 s                  | 29,54 s                                                   | 0,6 ms / 0,8 ms                                          | Cerca de 5,33 MB                              |

Python: Pyodide 314.0.7, distribuição oficial obtida temporariamente pelo npm e servida com gzip. PostgreSQL: PGlite 0.5.8, módulos e assets pelo jsDelivr. Esses volumes não são tamanhos de um bundle final otimizado. O carregamento inicial de Python por Worker clássico falhou; o formato de Worker módulo exigido pela distribuição atual funcionou. Isso reforça a necessidade de fixar e testar versões, não copiar exemplos antigos.

Evidências numéricas: [resultados do protótipo](benchmarks/browser-execution-2026-10-01.json).

Limites: soma simples não representa compilação, desafios complexos, segurança, consumo de bateria ou memória. Há somente uma amostra fria por perfil, sem intervalo de confiança. O perfil limitado é emulação nesta máquina, não um celular físico. Nenhum runtime recebeu certificação para código arbitrário. Não há comparação válida de velocidade com execução remota saudável; não foi medido um percentual de aceleração. Os números apontam a diferença entre baixar/iniciar o runtime e executar com ele já carregado.

## Benefício e custo para o produto

| Aspecto                    | Efeito esperado                                             | Condição para valer a pena                                                                                      |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Resposta ao repetir testes | Evitar fila, rede e polling para prática local              | Reusar runtime carregado e manter a tela responsiva                                                             |
| Capacidade do servidor     | Menos jobs e consultas de estudo                            | Medir quantas execuções realmente migram; fallback e submissões continuam consumindo recursos                   |
| Custo financeiro           | Pode reduzir capacidade necessária no futuro                | O executor atual está configurado com custo monetário por job zero; não existe economia em reais já demonstrada |
| Disponibilidade            | Prática homologada pode funcionar mesmo sem executor remoto | Runtime disponível/cacheado; aprovação oficial ainda depende do servidor                                        |
| Primeiro uso               | Download e inicialização podem dominar a espera             | Não carregar todas as linguagens ao entrar; carregar somente a escolhida, com cache versionado                  |
| Celulares                  | CPU, memória e dados móveis podem limitar o benefício       | Testar Android/iOS físicos e usar alternativa remota quando a execução local não for adequada                   |
| Manutenção                 | Acrescenta distribuição, adapters e homologação de runtimes | Habilitar por linguagem e preservar um contrato único de resultado                                              |

Consulta conectada em uma nova sessão no domínio oficial retornou HTTP 200 e `status: offline` em `/api/execution-status`. Não foi enviado código nem alterado progresso; por isso, não existe uma medição remota saudável para comparar neste estudo. A correção oficial continuará indisponível enquanto esse executor não estiver operacional, mesmo que a prática local seja habilitada.

O front atual consulta a avaliação a cada 1,5 segundo em `ChallengePage.tsx` e verifica disponibilidade do executor a cada 30 segundos. Uma execução local homologada remove esse caminho de espera para prática. Isso não significa uma redução fixa de 1,5 segundo, porque fila, execução e momento do polling variam.

## Cobertura das onze linguagens

| Linguagem      | Caminho candidato                                               | Estado da validação nesta avaliação                                                                               |
| -------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| JavaScript     | Runtime JS confinado                                            | Código conhecido executado em Worker; sandbox de código do aluno não homologada                                   |
| TypeScript     | Transpilação local e runtime JS confinado                       | Não medido; validar sintaxe, diagnósticos, imports e compatibilidade com os modelos                               |
| Python         | Pyodide/Wasm em Worker módulo                                   | Soma medida; paridade do catálogo pendente. Protótipo usa Python 3.14, manifesto atual usa 3.11                   |
| SQL/PostgreSQL | PGlite em base sintética descartável                            | Consulta simples medida; versão, tipos, extensões e datasets públicos ainda precisam de homologação               |
| C              | Clang/WASI, por exemplo Runno                                   | Candidato documentado; compilação/modelos/bibliotecas do projeto não medidos                                      |
| C++            | Clang++/WASI, por exemplo Runno                                 | Candidato documentado; validar C++20, biblioteca padrão e adapter JSON                                            |
| Java           | JVM no navegador, por exemplo CheerpJ                           | Executar bytecode não basta: compilador de fonte, Java 17 e biblioteca JSON precisam ser distribuídos e validados |
| Kotlin         | Compilador + JVM no navegador, ou alvo Wasm com adapter próprio | Não homologado; Kotlin/Wasm não substitui automaticamente os modelos JVM/kotlinx atuais                           |
| C#             | .NET/Wasm com compilador Roslyn                                 | Não homologado; executar assemblies compilados não comprova compilação do código novo no navegador                |
| Go             | Toolchain compilador local ou ambiente emulado                  | Não homologado; suporte oficial a executar um Wasm já compilado não comprova compilação de fonte no navegador     |
| Rust           | Toolchain Wasm, por exemplo Rubrc, ou ambiente emulado          | Não homologado; Rubrc consultado se declara pré-release e sem dependências externas/procedural macros             |

Runno documenta Python, Ruby, QuickJS, SQLite, Clang, Clang++ e PHP, não uma solução pronta para as onze linguagens. SQLite não deve substituir silenciosamente PostgreSQL. CheerpX permite executar Linux x86 de 32 bits no navegador e oferece um caminho mais geral; exige isolamento entre origens, imagem com toolchains, validação da distribuição e enquadramento da licença. Isso é um candidato para investigação, não prova de melhor velocidade nem de compatibilidade com todas as versões atuais. A documentação descreve download de blocos sob demanda, não necessidade de baixar uma imagem inteira de vários gigabytes antes de usar.

## Critérios antes de habilitar no produto

1. Manter o botão Executar e o contrato de função existente. Resultado local deve ser identificado como prática, sem conclusão, redução de recompensa ou XP.
2. Manter Submeter, testes privados e gabaritos oficiais no servidor; não enviar credenciais, sessão ou base real do produto ao executor local.
3. Isolar código não confiável do domínio autenticado, do armazenamento, do acesso à rede e dos dados do usuário. Worker sozinho não garante essa separação. Interromper loop infinito e excesso de saída, limitar memória onde o runtime permitir e descartar a execução com segurança.
4. Validar o catálogo por linguagem com exemplos públicos, retorno, console, acentos, erro de sintaxe/runtime, tipos, recompilação e paridade. Não apresentar aprovação local como aprovação oficial.
5. Adaptar a política de scripts/Wasm em um contexto restrito próprio. A CSP atual usa `script-src 'self'`, `worker-src 'self'` e `frame-src 'none'`; o protótipo não foi testado sob essa política e não pode ser copiado diretamente para produção.
6. Carregar apenas a linguagem escolhida, fixar versões, usar cache e medir primeira execução, repetições, download, memória e bateria em desktop e aparelhos físicos. Não prometer offline sem testar todos os assets e sua recuperação.
7. Acionar o servidor em falha de disponibilidade, carregamento ou suporte local, com razão visível e sem reenviar automaticamente um job remoto de resultado incerto. Erro do programa deve aparecer ao aluno e não disparar uma segunda execução remota indiscriminadamente.
8. Fazer piloto gradual e comparar p50/p95, taxa de erros e número de jobs remotos. Como critério proposto, buscar resultado aquecido em até 500 ms nos exemplos iniciais e ganho perceptível sobre o caminho remoto saudável; esses valores são metas a confirmar, não resultados do produto.

A prioridade recomendada para homologação é JavaScript/TypeScript, Python e PostgreSQL. C/C++ entram depois de validar compilador e bibliotecas; Java/Kotlin/C#/Go/Rust continuam disponíveis pelo servidor até aprovação de cada runtime local. Isso atende à escolha de alternativa remota sem afirmar que a cobertura local integral já existe.

## Fontes primárias consultadas

- [Pyodide: uso e carregamento no navegador](https://pyodide.org/en/stable/usage/index.html) e [Workers](https://pyodide.org/en/stable/usage/webworker.html).
- [PGlite: documentação](https://pglite.dev/docs/) e [projeto](https://pglite.dev/).
- [Runno: runtimes suportados e requisitos](https://github.com/taybenlor/runno).
- [CheerpJ: bytecode e Java suportado](https://cheerpj.com/docs/overview.html).
- [CheerpX: execução x86](https://cheerpx.io/docs/overview), [download sob demanda e isolamento](https://cheerpx.io/docs/faq) e [licenciamento](https://cheerpx.io/docs/licensing).
- [Kotlin/Wasm](https://kotlinlang.org/docs/wasm-overview.html) e [compiladores JVM](https://kotlinlang.org/docs/compiler-reference.html).
- [Microsoft: .NET no navegador](https://learn.microsoft.com/en-us/aspnet/core/blazor/).
- [Go: compilar para WebAssembly](https://go.dev/wiki/WebAssembly).
- [Rubrc: estado experimental e limitações](https://github.com/oligamiq/rubrc).
- [MDN: CSP e execução WebAssembly](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src) e [capacidades dos Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Esta avaliação não aprova uma arquitetura definitiva, não altera as regras de execução vigentes e não ativa nenhuma linguagem local no site.
