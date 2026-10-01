# Validação do beta — 30 de setembro de 2026

## Estado atual — 1 de outubro de 2026

A auditoria inicial abaixo é histórica. O beta atual abre sem login, oculta o tutor e apresenta 69 etapas: dez perguntas guiadas antes de 59 exercícios de código. A trilha de lógica tem 29 etapas. A interface usa a função do modelo; execução mostra console/print e retorno, enquanto o envio oficial avalia o retorno. Os textos iniciais e a passagem entre perguntas e código foram revisados.

O teste conectado mais recente aprovou as dez perguntas em um perfil anônimo novo, confirmou 197 XP após um erro, reenvios sem duplicar penalidade ou recompensa, recomendação de `literal-number` e execução real com console e retorno 7. As três variantes dos 59 exercícios já foram homologadas. As evidências e os limites estão em [estado da implantação](deployment-status.md).

A revisão de manutenção corrigiu as dependências indiretas `fast-uri` e `ip-address`, sem mudar a versão do RODS. A auditoria de produção passou com zero vulnerabilidades; os 280 testes e a compilação passaram novamente. A auditoria completa ainda aponta alertas em ferramentas de desenvolvimento, incluindo uma correção do Vitest que exige mudança de versão principal; eles não fazem parte dessa atualização limitada. As instruções de configuração foram alinhadas ao BFF e à sessão anônima atuais.

Executor e túnel foram conferidos ativos nesta revisão. As perguntas não dependem do executor; exercícios de código exigem este computador e os serviços ativos. Hospedagem permanente, backup externo e ensaio de restauração permanecem pendentes. Não há evidência nova de execução do workflow de backup nesta revisão. A personalização das skills RODS está em retomada pelo assistente interativo.

## Atualização após as correções solicitadas

As observações da auditoria inicial abaixo são históricas. As seguintes mudanças estão implementadas, verificadas localmente e publicadas:

- Acesso aberto com identidade anônima automática e sessão de 30 dias, mantendo cookies opacos, tokens cifrados, CSRF e isolamento dos dados.
- Tutor retirado da navegação, dos atalhos e da rota acessível.
- Execução real de programas com console/print, stdin, stdout/stderr e erros. Sem cota diária de estudo; os limites de isolamento por execução permanecem.
- Envio oficial com confirmação visual; rejeições permitem nova tentativa e reduzem a recompensa em 15% do XP base por erro, até zero. Aprovação concede XP uma vez, oferece o próximo desafio e mantém a prática disponível.
- Rascunhos anteriores em formato de função preservados; carregar um modelo novo exige confirmação.
- Modelos iniciais das dez linguagens rodaram no Docker e produziram “Olá, mundo!”. A revisão corrigiu incompatibilidades dos modelos JavaScript/TypeScript e alinhou os enunciados iniciais ao uso de print/console.

Verificações da atualização: 224 testes Vitest; 33 testes Playwright aprovados e um cenário de tablet ignorado na execução móvel; cinco testes Deno de regras/assinaturas; tipos das funções API/sessão/coordenador; builds frontend e BFF; PostgreSQL local com migrações/invariantes. Os testes de banco usam doubles de fila/Cron/rede e não comprovam essas extensões remotamente. Os testes de fluxo conectado no navegador usam respostas de API controladas; execução real foi validada separadamente em Docker.

Inspeção visual: 12 rotas em 320, 390, 768 e 1440 pixels, nos temas claro e escuro (96 combinações), sem erros de JavaScript nem transbordamento horizontal. Capturas em `/tmp/rods-beta-visual`, revisão adicional dos resultados, confirmação e aprovação em `/tmp/rods-free-*.png`. Revisadas imagens de painel, perfil, fundamentos, SQL, ranking, catálogo, trilhas e estados de recuperação. A exploração local apresenta execução indisponível de forma explícita.

Publicação concluída: código `a89487a` na branch `main`, migração aplicada, Anonymous Sign-Ins habilitado, funções publicadas e catálogo com 53 desafios. API preserva JWT obrigatório. Executor e Quick Tunnel autorizado ativos, imagem homologada atualizada. No site, visitante novo recebeu identidade anônima; executou código com saída `5`; errou uma submissão; acertou a seguinte com 85 XP; continuou praticando com saída `7` e zero XP adicional. A confirmação de submissão foi verificada no navegador e cancelada na conta GitHub existente, que preservou seus 100 XP. O Cron remoto processou os trabalhos. Consulte [estado da implantação](deployment-status.md) para evidências e limites operacionais.

O beta pode receber os primeiros testes enquanto este computador e o túnel estiverem ativos. A disponibilidade permanente, backups e restauração continuam pendentes. Reiniciar o túnel pode exigir atualizar seu endereço no coordenador.

RODS: o assistente interativo gerou o plano de personalização, revisado e aprovado pelo usuário. A geração da proposta de arquivos terminou por timeout; uma nova execução não retornou pergunta nem plano válidos. A geração personalizada ainda não está concluída. O scaffolding de oito skills permanece instalado. O plano está em [revisão das skills](rods/specs/2026-09-30-skills-plan-review.md).

## Auditoria inicial do ambiente publicado

**Resultado: a interface pode receber avaliação exploratória, mas o beta de resolução de desafios ainda tem dois bloqueios confirmados no ambiente publicado: executor indisponível e entrada da trilha inicial quebrada.**

Esta auditoria cobre a aplicação local e o site publicado com a sessão GitHub existente. Testes locais aprovados não comprovam disponibilidade do executor remoto nem publicação das migrações.

## RODS

- Executado `rods init /home/pedro/Documentos/code/rods-leet` com o CLI global 0.2.2 já instalado.
- Criados `AGENTS.md`, `.ai/config.json`, constituição, política de complexidade, notas dos adaptadores, `.rods/.gitignore` e hooks do Codex.
- Oito skills montadas em `.ai/skills` e projetadas em `.codex/skills`: context-search-first, review, architecture, quality, design-brainstorm, parallel-delivery, visual-check e rules-capture.
- Integração RTK/Codex verificada: RTK instalado, hooks e capacidades presentes, sem conflito. Claude-mem e caveman permanecem desativados na configuração RODS.
- Projeto registrado e indexado no Context Engine: ingestão sem falhas, busca de `sum-two-integers` confirmada.
- Preservada em `AGENTS.md` a referência a `/home/pedro/.codex/RTK.md`; acrescentado o mapa real de tecnologias, comandos e documentos deste projeto.
- As skills são o scaffolding padrão com detecção React/TypeScript. O primeiro terminal não abriu o planejador; uma tentativa com terminal interativo chegou à escolha de modelo e foi cancelada sem modelo informado. Não houve geração personalizada por IA.
- A dependência do projeto continua em `@pedrohrferreira/rods-sdk` 0.1.16; o CLI global usado para inicializar é 0.2.2. Nenhuma dependência foi atualizada.

## Ambiente e cobertura

- Local: `http://127.0.0.1:5178`, Vite em modo exploração, sem simulação de aprovação, XP ou execução.
- Publicado: `https://rods-leet.pages.dev`, sessão previamente autenticada. Nenhuma senha, cookie ou chave foi exportada.
- Build e servidor executados com Node 24.19.0 já disponível; o projeto exige Node >=22. O Node padrão do terminal é 20.20.2 e deve ser substituído no fluxo habitual.
- Chromium real instalado previamente; não houve instalação de navegador.
- Local: 12 rotas em 1440, 1024, 768, 390 e 360 pixels de largura, altura 900. Não houve erro de JavaScript nem transbordamento horizontal da página nessas 60 combinações.
- Inspeção visual de capturas em todos os cinco tamanhos, com revisão adicional das abas do desafio, boas-vindas, login indisponível, tutor sem sessão e tema claro. Capturas guardadas temporariamente em `/tmp/rods-leet-visual-audit`.
- Publicado: painel, catálogo, trilhas, desafio algorítmico, SQL, perfil, ranking e tutor. Inspeção adicional no celular em 390 × 844; menu abre, fecha com Escape e permite acessar o perfil. Tamanho do navegador restaurado ao final.

## Tela por tela

| Tela / rota                              | Local                                                                    | Ambiente publicado                                                                                   | O que falta                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Boas-vindas                              | Guia abre, avança, fecha, lembra a escolha e reabre                      | Não reiniciado na conta existente                                                                    | Nenhum bloqueio local encontrado                                           |
| Visão geral `/`                          | Próximo desafio, tema e navegação funcionam                              | Mostra 100 XP e uma conclusão reais; informa 50 desafios                                             | Alinhar catálogo conectado com os 53 locais                                |
| Catálogo `/desafios`                     | 53 desafios; filtros, busca e recuperação da busca vazia aprovados       | 50 desafios, sendo 10 de Lógica                                                                      | Publicar e validar os três novos fundamentos                               |
| Trilhas `/trilhas`                       | Rota de Lógica com 13 nós; mapa e lista móvel aprovados                  | Rota usa 10 desafios; botão “Começar pelos inteiros” aponta para desafio ausente                     | Corrigir sincronização entre conteúdo publicado e links                    |
| Fundamentos `/desafios/sum-two-integers` | Enunciado e template adaptam à linguagem; Python e Rust testados         | Retorna “Não conseguimos carregar esta página” e `challenge_not_found`                               | Bloqueio da primeira etapa do onboarding                                   |
| Desafio `/desafios/find-max`             | Monaco, editor simples, troca de linguagem e rascunhos aprovados         | Desafio concluído, solução anterior e rascunho sincronizado carregam; execução/submissão desativadas | Restabelecer executor e validar uma avaliação nova                         |
| Plano, dicas e gabarito                  | Abas abrem; bloqueios honestos no modo exploração                        | Gabarito autorizado do desafio concluído abre e mostra explicação/código                             | Não consumir dicas durante auditoria; testar concessão numa conta de teste |
| SQL `/desafios/sql-active-orders`        | Schema, linguagem e arquivo SQL corretos                                 | Enunciado/schema/editor carregam; execução/submissão também indisponíveis                            | Homologar uma avaliação SQL depois de recuperar o executor                 |
| Perfil `/perfil`                         | Erro de login local aparece com mensagem clara                           | Conta GitHub conectada; 100 XP, uma conclusão e zero dicas                                           | Testar login do zero com outra conta/dispositivo                           |
| Ranking `/ranking`                       | Estado vazio correto                                                     | Uma pessoa, posição 1, 100 XP e uma conclusão, coerentes com o perfil                                | Atualização após nova aprovação ainda não validada                         |
| Tutor `/tutor`                           | Pergunta sugerida preenche campo; sem sessão mostra erro claro           | Histórico carrega; pergunta de estudo recebeu “Orientação editorial”, com cota indicando 2/2         | Decidir apresentação do fallback; IA remota não foi comprovada             |
| Callback `/auth/callback`                | Mensagem genérica e retorno ao perfil; erros não refletem texto atacante | Fluxo OAuth novo não executado para preservar sessão existente                                       | Repetir login novo no ambiente do beta                                     |
| Rota inexistente / desafio inválido      | Estados de recuperação abrem sem travar                                  | Erro técnico de desafio ausente aparece em uma rota válida                                           | Traduzir `challenge_not_found` e oferecer retorno ao catálogo              |

## Pendências em ordem de execução

### P1 — recuperar o ciclo principal de prática

**Evidência:** em `find-max`, mesmo autenticado e com dez execuções disponíveis no dia, “Executor indisponível” e “Submeter solução” estão desativados. A mesma situação ocorre em SQL. A aprovação exibida é histórica e não comprova uma execução atual.

**Ação:** verificar configuração e disponibilidade do executor, coordenador e fila. O registro histórico descreve Docker local e Quick Tunnel, mas a causa atual não foi comprovada nesta auditoria. Não habilitar execução sem verificar o isolamento e os runtimes correspondentes.

**Aceite:** exemplos públicos executam; solução correta passa; solução incorreta reprova; erro de infraestrutura preserva tentativa; resultado chega ao navegador; uma primeira aprovação concede XP uma vez e atualiza perfil/ranking; repetir envio não duplica XP. Incluir SQL e uma linguagem algorítmica antes dos primeiros convites.

### P1 — corrigir a entrada da trilha inicial

**Reprodução:** acessar `/trilhas` conectado → “Começar pelos inteiros” → `/desafios/sum-two-integers` → `challenge_not_found`.

**Evidência:** catálogo conectado tem 50 exercícios; o catálogo local tem 53. `sum-two-integers`, `variable-bonus` e `is-even-integer` existem localmente e não aparecem na listagem conectada. A falha foi reproduzida diretamente para `sum-two-integers`; as outras duas ausências foram constatadas na listagem.

**Ação:** conferir migrações e versão publicada da API/juiz, publicar as definições públicas usando `scripts/seed-catalog.ts` no ambiente autorizado e verificar homologação dos três fundamentos. A ausência no catálogo sugere descompasso do conteúdo conectado, mas não houve inspeção administrativa do banco para confirmar a causa.

**Aceite:** catálogo conectado tem 53 desafios, Lógica tem 13, todos os três fundamentos abrem e podem ser avaliados nas linguagens anunciadas. Frontend, API e juiz usam contratos compatíveis.

### P1 — comprovar a entrada e operação dos primeiros testadores

- Login GitHub novo, callback, sessão persistida após recarga e rascunho preservado entre sessões. Nesta auditoria foi usada uma sessão existente; isso não comprova o fluxo de cadastro.
- Confirmar as migrações realmente aplicadas e `BFF_REQUIRED=true` na API. A implementação e os testes locais estão presentes; não houve inspeção dos secrets de produção.
- Confirmar disponibilidade do executor durante a janela de testes e observar falhas de fila/API. O túnel temporário descrito no histórico não oferece evidência de disponibilidade atual.
- Confirmar backup externo e ensaio de restauração antes de ampliar o grupo. O workflow depende de `BACKUP_ENABLED=true`; sua execução e restauração não foram verificadas.
- A regra vigente em `docs/product-rules.md` e a migração `202609190001_open_github_access.sql` permitem contas GitHub verificadas. Enviar o link a poucas pessoas não constitui uma restrição técnica por convite. Conferir a regra implantada sem reinstalar o limite antigo por acidente.

### P2 — clareza e manutenção

- Transformar `challenge_not_found` em mensagem útil e permitir voltar ao catálogo; repetir a mesma requisição não recupera conteúdo ausente.
- Tornar mais evidente o acesso às abas do desafio em telas estreitas: “Gabarito” pode ficar fora da área inicialmente visível, embora a página não transborde.
- Diferenciar claramente “Orientação editorial” de IA ativa. A resposta nova observada foi editorial; isso pode integrar o beta se a expectativa estiver clara.
- Atualizar `docs/deployment-status.md`, `.env.example` e trechos de `docs/deployment.md`: há instruções históricas de convites, Google/variáveis VITE e fluxo anterior ao BFF que divergem do código e das regras vigentes.
- Build aprovado com aviso de tamanho do Monaco: chunk do editor ~3,35 MB, ~863 KB gzip; worker TypeScript ~6,02 MB sem compressão. Medir abertura do editor em conexão móvel real antes de ampliar o grupo; não foi medido desempenho com rede limitada.
- Auditoria npm encontrou duas dependências com vulnerabilidades moderadas (`fast-uri` e `ip-address`), sem achados altos/críticos no filtro de produção. Avaliar a cadeia de dependências e atualizar com validação; nenhum `audit fix` foi aplicado.

## Verificações executadas

| Verificação                                             | Resultado                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                     | Aprovado                                                                                                               |
| `npm run typecheck:bff`                                 | Aprovado                                                                                                               |
| `npm run lint`                                          | Aprovado                                                                                                               |
| `npm test`                                              | 213 testes aprovados em 13 arquivos                                                                                    |
| `npm run build`                                         | Aprovado, com aviso de chunk grande do editor                                                                          |
| `npm run build:bff`                                     | Aprovado; logs redirecionados para `/tmp` para respeitar o ambiente restrito                                           |
| `npm run test:e2e -- --output=/tmp/rods-leet-e2e-audit` | 27 aprovados, um ignorado: cenário tablet já coberto no projeto desktop                                                |
| Testes Python do executor                               | Oito aprovados usando Python 3.13 e `pglast` já disponíveis no cache; Python padrão não tinha a dependência compatível |
| Sintaxe do gateway e scripts de shell                   | Aprovada                                                                                                               |
| `npm audit --omit=dev --audit-level=high`               | Aprovado no limiar alto; dois achados moderados                                                                        |

Deno não está disponível no terminal: `deno check`, testes das Edge Functions e referências SQL em Docker não foram executados nesta rodada. Também não foram reexecutados os testes de banco, isolamento remoto, backup/restauração ou um novo login OAuth. Nenhuma avaliação nova nem ganho de XP foi comprovado, porque o executor está indisponível.

Os testes de navegador usam modo exploração ou substitutos explícitos nos cenários de corrida de rascunho. Não representam homologação da infraestrutura publicada.

## Evidências e limite da entrega

- Capturas locais e resumo por rota: `/tmp/rods-leet-visual-audit`; relatório estruturado `results.json`.
- Evidência do erro publicado: `/tmp/rods-leet-visual-audit/producao-primeira-soma.jpg`.
- A sessão autenticada foi preservada. Foi enviada uma pergunta genérica de estudo ao tutor para verificar o fallback; sua orientação editorial passou a integrar a conversa dessa conta.
- Não foram feitos deploy, alteração de secrets, migração remota, publicação do catálogo, atualização de dependências, convites, commit ou push. Esta entrega monta o RODS e registra a validação solicitada.

**Critério para convidar um primeiro grupo para testar a prática:** concluir os dois P1 confirmados, verificar o login novo e demonstrar pelo menos um ciclo completo de aprovação/rejeição e persistência. Hard, seis trilhas futuras e IA remota não precisam integrar esse primeiro escopo.
