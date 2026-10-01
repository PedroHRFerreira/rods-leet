# Proposta de skills gerada pelo rods init

Estado: geração concluída; revisão dos arquivos concluída; aplicação aguardando a escolha final no assistente.

O plano aprovado foi retomado pelo `rods init` global 0.2.2. Para superar respostas incompletas e o prazo fixo de três minutos, foi usada uma cópia temporária do CLI com prazo de quinze minutos e um adaptador temporário que solicita a resposta estruturada do Codex. A instalação original, as dependências do RODS e o código do produto não foram alterados por essa geração.

A proposta contém onze skills: quatro personalizadas, três novas e quatro preservadas. A revisão confirmou os caminhos citados, os scripts existentes e a sintaxe dos comandos do CLI local 0.1.16. As quatro skills preservadas correspondem byte a byte às atuais, incluindo a quebra de linha final.

A aplicação será feita pelo assistente; as projeções `.codex/skills` serão produzidas pelo mecanismo RODS. A configuração poderá receber os metadados de geração e projeção, preservando suas opções atuais. `AGENTS.md`, a referência RTK, constituição, políticas, hooks e adaptadores serão conferidos antes e depois.

| Skill                 | Alteração                |
| --------------------- | ------------------------ |
| context-search-first  | Personalizada            |
| review                | Personalizada            |
| architecture          | Personalizada            |
| quality               | Personalizada            |
| bff-sessions          | Nova                     |
| supabase-transactions | Nova                     |
| executor-judge-beta   | Nova                     |
| design-brainstorm     | Preservada integralmente |
| parallel-delivery     | Preservada integralmente |
| visual-check          | Preservada integralmente |
| rules-capture         | Preservada integralmente |

## Diferenças dos sete arquivos

As projeções terão o mesmo conteúdo revisado abaixo. As quatro skills preservadas não têm diferenças.

### context-search-first

````diff
--- .ai/skills/context-search-first/SKILL.md
+++ .ai/skills/context-search-first/SKILL.md
@@ -1,19 +1,49 @@
 ---
 name: context-search-first
-description: Use when starting a task in this repository before reading files manually or assuming where code lives.
+description: Use no início de tarefas no Rods Leet, antes de localizar código, ler arquivos grandes ou assumir responsabilidades das camadas.
 ---

 # Context Search First

-## When To Use
+## Procedimento

-- At the start of every repository task.
-- Before raw file reads, broad grep scans, or assumptions about implementation.
-- After compaction or session restore when local context is incomplete.
+1. Consultar `context_engine.search` com termos específicos da tarefa, restringindo ao projeto correto pelos parâmetros disponíveis. Não usar resultados de outras cópias como evidência do workspace atual.
+2. Ler somente os chunks pertinentes com `context_engine.read`. Verificar caminho, pertinência e atualidade antes de confiar no resultado.
+3. Usar o mapa abaixo para orientar a busca, sem varrer todas as camadas automaticamente.
+4. Quando o índice estiver ausente, desatualizado ou insuficiente, fazer leitura local mínima. Usar RTK no terminal quando disponível, conforme `/home/pedro/.codex/RTK.md`; usar `rg` para buscas e inventários direcionados.
+5. Registrar a razão do fallback e os arquivos consultados. Ingerir os arquivos pertinentes com `context_engine.ingest` quando permitido; se indisponível, registrar a pendência sem afirmar que a indexação ocorreu.
+6. Operar pelo harness/CLI local, MCP, skills e adaptadores. Não criar chamadas diretas a provedores fora dos adaptadores de decisão explicitamente habilitados.
+7. Se uma tarefa depender de sistemas externos, esclarecer se o usuário quer prosseguir, somente planejar ou outra ação antes da busca, salvo quando essa escolha já estiver expressamente definida na conversa.

-## Steps
+## Comandos locais

-1. Call `context_engine.search` with task-specific terms.
-2. Read only relevant chunks with `context_engine.read`.
-3. Open local files only when the indexed chunks are insufficient.
-4. If local fallback found missing context, call `context_engine.ingest` for that file or directory.
+Preferir MCP. Como alternativa pelo CLI existente, executar a partir do projeto correto:
+
+```bash
+rtk pnpm exec rods search "termo específico da tarefa"
+rtk pnpm exec rods read <chunkId>
+```
+
+Substituir `<chunkId>` por um ID retornado pela busca. Para fallback direcionado, por exemplo:
+
+```bash
+rtk proxy rg -n 'idempotency|nonce|refresh' functions/_lib supabase/functions/_shared
+```
+
+Não instalar o CLI ou executar uma ingestão ampla apenas para suprir uma busca pequena.
+
+## Mapa de contexto
+
+- Domínio e invariantes: `src/domain`.
+- UI, rotas e editor: `src/components`, `src/pages`, `src/App.tsx`.
+- Conteúdo público: `src/content`.
+- Contratos e acesso ao BFF: `src/lib`.
+- Pages Functions e segurança do BFF: `functions`.
+- Persistência, autorização e coordenação: `supabase/migrations`, `supabase/tests`, `supabase/functions`.
+- Casos, comparadores e dados privados: `judge`.
+- Isolamento, adaptadores e homologação: `executor`.
+- Governança e decisões aprovadas: `.ai` e `docs/rods/specs`.
+
+## Fontes
+
+Consultar `docs/product-rules.md` como fonte autoritativa do comportamento vigente; não copiar suas regras para as skills. Usar `docs/deployment.md` para procedimentos e tratar `docs/deployment-status.md` e `docs/beta-readiness-2026-09-30.md` como evidências históricas datadas. Divergências devem ser explicitadas, não resolvidas pela antiguidade de um documento.
````

### review

````diff
--- .ai/skills/review/SKILL.md
+++ .ai/skills/review/SKILL.md
@@ -1,20 +1,35 @@
 ---
 name: review
-description: Use for PR, commit, or manual change review readiness checks.
+description: Use para revisar PRs, commits ou alterações manuais do Rods Leet e avaliar sua prontidão com evidências proporcionais ao risco.
 ---

 # Review

-## Checklist
+## Procedimento

-1. Confirm the request, changed files, and intended behavior.
-2. Compare manual-test paths against hardcoded or automated checks.
-3. Prioritize bugs, regressions, missing validation, and missing tests.
-4. Mark ready only when the smallest relevant validation has passed or the gap is explicit.
-5. When `visual-check` screenshots or flow logs exist, compare them with the requirements, error states, responsive behavior, and known visual regressions before marking the change ready.
+1. Confirmar pedido, escopo aprovado e diff efetivo. Usar `context-search-first` e RTK para recuperar contexto e inspecionar diferenças.
+2. Confrontar o comportamento com `docs/product-rules.md`, fonte autoritativa. Não reproduzir suas regras nesta skill nem tomar evidências históricas como prova do ambiente atual.
+3. Revisar bugs, regressões, autorização por usuário, contratos entre camadas, vazamento de segredos e dados privados e caminhos de erro.
+4. Quando pertinente, revisar concorrência, ordem dos locks, repetição de requests/jobs, idempotência, recompensa única, snapshots e distinção entre falha do programa e falha de infraestrutura. Consultar `bff-sessions`, `supabase-transactions` e `executor-judge-beta` conforme a superfície afetada.
+5. Conferir se mocks, demonstrações e respostas fixas estão corretamente identificados e se alegações de integração ou homologação possuem evidências reais.
+6. Comparar os caminhos manuais com os testes e verificações automatizadas, procurando lacunas relevantes. Não exigir testes que apenas reproduzam o texto de uma skill.
+7. Para UI, confrontar os registros do `visual-check` com requisitos, erros, responsividade e temas afetados.
+8. Marcar prontidão somente com verificações pertinentes aprovadas; se houver lacuna, descrevê-la explicitamente e limitar a conclusão ao que foi validado.

-## Output
+## Inspeção do diff

-- Findings first, ordered by severity.
-- File and line references when available.
-- Keep summaries secondary to actionable issues.
+Para alterações locais:
+
+```bash
+rtk git status --short
+rtk git diff --stat
+rtk git diff
+rtk git diff --cached
+rtk git diff --check
+```
+
+Inspecionar também arquivos não rastreados pertinentes, que não aparecem no diff comum. Para PR ou commit, usar a base e o alvo confirmados no pedido; não assumir que o diff local representa a revisão inteira. Aplicar as verificações selecionadas por `.ai/skills/quality/SKILL.md`.
+
+## Saída
+
+Apresentar achados por severidade, com arquivo e linha quando disponíveis, efeito observável e correção sugerida. Depois, resumir validação executada, limitações e riscos materiais. Na ausência de achados, declarar isso sem confundir ausência de achados com homologação do ambiente.
````

### architecture

````diff
--- .ai/skills/architecture/SKILL.md
+++ .ai/skills/architecture/SKILL.md
@@ -1,16 +1,42 @@
 ---
 name: architecture
-description: Use when changes affect structure, ownership boundaries, dependencies, or the detected stack.
+description: Use quando alterações afetarem estrutura, responsabilidades, contratos, dependências ou fronteiras entre UI, BFF, Supabase, juiz e executor.
 ---

 # Architecture

-Detected stack: React TypeScript
+## Fontes e stack

-## Rules
+Consultar `docs/product-rules.md` para comportamento atual, `package.json` para versões e scripts e `docs/deployment.md` para operação. Preservar React 19, TypeScript, Vite, React Router, Monaco, Pages Functions, Supabase e o executor isolado com Docker. Não introduzir Agents SDK ou mudanças de dependência nesta configuração de skills.

-1. Reuse existing modules, layers, and naming before creating new structure.
-2. Keep transport, adapter, domain, and UI responsibilities separated.
-3. Do not add abstractions unless they remove real duplication or clarify ownership.
-4. Document any boundary change in the final response.
-5. When a feature spans domain, rendered UI, and routing and can be split safely, use the `parallel-delivery` skill.
+## Responsabilidades
+
+1. Reutilizar módulos, nomes e contratos existentes antes de criar estrutura nova.
+2. Manter funções puras de domínio em `src/domain`; elas não substituem autorização, RLS, locks ou transações do servidor.
+3. Manter apresentação e navegação em `src/components`, `src/pages` e `src/App.tsx`; contratos de transporte em `src/lib`.
+4. Reservar `functions` para a fronteira BFF, cookies, sessão e proteção da comunicação. Manter persistência, autorização e coordenação em `supabase`.
+5. Manter casos oficiais, comparadores e gabaritos privados em `judge`, fora do bundle do navegador. Não importar `judge` de `src` nem expor credenciais privilegiadas no cliente.
+6. Executar código arbitrário somente no executor isolado configurado. Manter comparação confiável e finalização de progresso fora do workspace editável do aluno.
+7. Alterações de contrato devem considerar clientes, BFF, funções, banco, juiz e executor, preservando trabalhos já submetidos e os snapshots associados.
+8. Criar abstrações apenas para remover duplicação real ou esclarecer responsabilidade. Registrar mudanças de fronteira e seus impactos.
+
+## Verificação de fronteiras
+
+Depois de recuperar contexto com `context-search-first`, localizar dependências afetadas por buscas direcionadas. Para conferir imports privados no cliente:
+
+```bash
+rtk proxy rg -n 'judge|executor|supabase/functions' src
+```
+
+Inspecionar os resultados: menções textuais não são automaticamente imports ou vazamentos. Quando contratos de frontend e BFF mudarem, executar as verificações pertinentes:
+
+```bash
+rtk npm run typecheck
+rtk npm run typecheck:bff
+```
+
+Examinar `judge/executor-contracts.md` e `supabase/functions/_shared/execution.ts` quando o contrato de avaliação mudar.
+
+## Encaminhamento
+
+Usar `bff-sessions` para identidade e comunicação autenticada; `supabase-transactions` para persistência e concorrência; `executor-judge-beta` para avaliação e isolamento. Para trabalho Alto/Epic, consultar `.ai/skills/design-brainstorm/SKILL.md`. Quando uma implementação atravessar domínio, UI e rotas e admitir divisão segura, consultar `.ai/skills/parallel-delivery/SKILL.md`, preservando suas instruções. Finalizar com `quality` e `review`; UI renderizada também exige `visual-check`.
````

### quality

````diff
--- .ai/skills/quality/SKILL.md
+++ .ai/skills/quality/SKILL.md
@@ -1,22 +1,39 @@
 ---
 name: quality
-description: Use before finishing implementation work or when validating readiness.
+description: Use antes de concluir implementações ou declarar prontidão, escolhendo verificações pelos arquivos alterados e pelo risco real.
 ---

 # Quality

-Detected stack: React TypeScript
+## Preparação

-## Validation Order
+Consultar `docs/product-rules.md` como fonte autoritativa, `package.json` para scripts existentes e `docs/deployment.md` para integração. Usar Node.js >=22 e preservar `package-lock.json`. Executar comandos pelo RTK quando disponível. Não instalar ferramentas, habilitar serviços ou alterar dependências apenas para validar esta configuração.

-1. Run the smallest relevant test, lint, or typecheck first.
-2. Expand validation only when the touched surface or risk requires it.
-3. If validation cannot run, state why and provide the exact command.
-4. Avoid unrelated formatting, renames, and refactors.
+## Validação proporcional

-## Visual Validation (UI Changes Only)
+1. Começar pela menor verificação relevante. Ampliar quando novas mudanças, falhas ou riscos de integração justificarem.
+2. Frontend e domínio: selecionar `rtk npm run typecheck`, `rtk npm run lint`, `rtk npm test` e `rtk npm run build` conforme a superfície afetada.
+3. Pages Functions: executar `rtk npm run typecheck:bff` e `rtk npm run build:bff`, além das verificações dos contratos e fluxos alterados.
+4. Fluxos de navegador: executar `rtk npm run test:e2e` quando pertinente. Para UI renderizada, usar `visual-check` em navegador real e cobrir caminho principal, erro e breakpoints afetados, incluindo os temas pertinentes.
+5. UI local: iniciar com `rtk npm run dev -- --port 5178 --strictPort`. Identificar quando o fluxo usa exploração ou mocks; teste conectado exige BFF e ambiente compatíveis.
+6. Supabase: consultar `supabase-transactions` para migrações, RLS e testes SQL em banco local descartável.
+7. Executor e juiz: consultar `executor-judge-beta` para testes de adaptadores, compilação, isolamento e homologação por linguagem.
+8. Para prontidão ampla da aplicação, executar os checks aplicáveis: tipos de frontend e BFF, lint, testes, builds de frontend e BFF e E2E. Não executar toda a bateria da aplicação para mudanças exclusivamente documentais nas skills.

-1. If the change touches rendered UI, open it in a real browser with the `visual-check` skill before marking it done.
-2. Cover the happy path, at least one error state, and every responsive breakpoint affected.
-3. Log the URLs and flows checked, temporary screenshots inspected, and gaps found.
-4. Visual validation complements, and never replaces, unit tests, lint, and typecheck.
+## Alterações de skills RODS
+
+Para o escopo aprovado em `docs/rods/specs/2026-09-30-skills-plan-review.md`, verificar onze diretórios na fonte, frontmatter e correspondência entre name e diretório. Comparar literalmente as quatro skills preservadas, conferir referências e scripts e revisar o diff antes da aplicação. Após aplicar no projeto original, usar o CLI existente:
+
+```bash
+rtk pnpm exec rods adapter sync --target codex --codex-skills-dir .codex/skills
+rtk pnpm exec rods adapter doctor . --target codex
+rtk git diff --check
+rtk git status --short
+rtk git diff
+```
+
+Verificar onze projeções correspondentes e revisar quaisquer alterações mecânicas derivadas. Preservar `AGENTS.md`, constituição, políticas, configuração, hooks, adaptadores e lockfile. Não executar `rods init` ou upgrade indiscriminadamente, instalar dependências ou alterar confiança de hooks automaticamente. Em uma cópia somente leitura, entregar apenas a proposta e registrar sincronização e diagnóstico como pendentes.
+
+## Evidências
+
+Distinguir teste unitário, mock, integração local e homologação real. Registrar comando, resultado, ambiente e data quando isso sustentar prontidão. Se um check não puder rodar, informar o impedimento e o comando pendente. Tratar auditorias e status antigos como históricos. Evitar formatação, renomes e refatorações sem relação com a tarefa. Encerrar com `review`.
````

### bff-sessions

````diff
--- /dev/null
+++ .ai/skills/bff-sessions/SKILL.md
@@ -0,0 +1,37 @@
+---
+name: bff-sessions
+description: Use para sessões anônimas, cookies, OAuth, renovação de tokens e comunicação autenticada entre navegador, Pages Functions e Supabase.
+---
+
+# BFF Sessions
+
+## Contexto
+
+Consultar `docs/product-rules.md` para identidade e comportamento vigente. Buscar contexto em `functions/_lib/bff.ts`, `functions/_lib/security.ts`, `functions/auth/[[path]].ts`, `functions/api/[[path]].ts`, `src/lib/bff-auth.ts` e `supabase/functions/_shared/bff.ts`. Consultar `supabase/tests/security.sql`, `supabase/functions/_shared/bff_test.ts` e `supabase/functions/_shared/tests.ts`.
+
+## Verificações
+
+1. Preservar isolamento de identidade e dados entre visitantes anônimos e usuários autenticados. Não aceitar identidade ou autorização privilegiada fornecida pelo cliente.
+2. Manter tokens cifrados no servidor, usando os mecanismos existentes e contextos de cifragem adequados. Impedir exposição de tokens, chaves e segredos em respostas, logs, armazenamento do navegador ou bundle público.
+3. Verificar cookie opaco com HttpOnly, Secure, SameSite e duração adequados, além de expiração, logout e invalidação.
+4. Validar origem e CSRF nas operações pertinentes. Revisar OAuth/PKCE, estado e callback contra adulteração e replay.
+5. Preservar autenticação da comunicação BFF/API e a proteção de nonce/replay; revisar serialização, assinatura e propagação da chave de idempotência sem expor segredos.
+6. Revisar renovação concorrente: claim/lease, proprietário, expiração e recuperação de falhas. Não reutilizar refresh token em requests concorrentes.
+7. Verificar que erros e retentativas não troquem identidades nem misturem sessões. Preservar progresso segundo as regras atuais ao alterar fluxos anônimos ou OAuth.
+
+## Validação
+
+Selecionar testes de sessão, CSRF, replay, cookie e concorrência; usar `supabase-transactions` quando houver alteração nas operações de sessão do banco. Para alterações de BFF:
+
+```bash
+rtk npm run typecheck:bff
+rtk npm run build:bff
+```
+
+Para alterações da assinatura compartilhada, com Deno já disponível:
+
+```bash
+rtk proxy deno test --allow-env --config supabase/functions/deno.json supabase/functions/_shared/bff_test.ts
+```
+
+Esse teste não comprova sozinho cookies, OAuth, renovação concorrente ou sessão conectada. Selecionar cenários adicionais pertinentes e validar integração local com BFF quando necessário, conforme `docs/deployment.md`. Registrar checks não executados. Não habilitar provedores ou serviços externos sem autorização específica.
````

### supabase-transactions

````diff
--- /dev/null
+++ .ai/skills/supabase-transactions/SKILL.md
@@ -0,0 +1,37 @@
+---
+name: supabase-transactions
+description: Use para migrações, RLS, filas, submissões, sessões persistidas, orçamento e finalização transacional de progresso ou XP.
+---
+
+# Supabase Transactions
+
+## Contexto
+
+Consultar `docs/product-rules.md` como fonte autoritativa e buscar as migrações e funções pertinentes. A migração do beta revisada é `supabase/migrations/202609300001_public_beta.sql`; considerar também as migrações posteriores relevantes, sem tratá-la como a última por definição. Usar `supabase/functions/coordinator/index.ts`, `supabase/functions/_shared/db.ts`, `supabase/tests/invariants.sql` e `supabase/tests/security.sql` como pontos de entrada.
+
+## Verificações
+
+1. Revisar RLS, grants, funções privilegiadas e autorização por identidade no servidor. Dados privados e credenciais de serviço não podem chegar ao cliente.
+2. Manter reserva de orçamento, admissão, fila e finalização em transações protegidas. Funções puras do domínio não substituem garantias do banco.
+3. Verificar ordem dos locks, concorrência por usuário, leases, fencing e recuperação de jobs interrompidos. Repetição ou conclusão atrasada não pode produzir efeitos duplicados.
+4. Validar chave de idempotência e conflito de payload; replay equivalente deve preservar o resultado sem nova cobrança ou recompensa.
+5. Garantir conclusão e recompensa únicas segundo `docs/product-rules.md`, preservando snapshots e acumuladores necessários. Não duplicar fórmula de XP na skill.
+6. Separar rejeição atribuível ao programa de falha da infraestrutura. Falha da plataforma não deve penalizar o aluno; manter contabilização operacional conforme a fonte autoritativa.
+7. Avaliar compatibilidade de migração, dados existentes, versões de submissão e rollback ou recuperação. Não editar migração já aplicada como substituto de uma nova migração corretiva.
+
+## Validação local
+
+Usar um Supabase local descartável com extensões reais e migrações aplicadas. Conferir que `DATABASE_URL_LOCAL` aponta ao ambiente local antes das fixtures, sem imprimir credenciais. Executar, via RTK quando disponível:
+
+```bash
+rtk proxy psql "$DATABASE_URL_LOCAL" -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
+rtk proxy psql "$DATABASE_URL_LOCAL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
+```
+
+Para mudanças nas regras compartilhadas das Edge Functions, com Deno já disponível:
+
+```bash
+rtk proxy deno test --allow-env --config supabase/functions/deno.json supabase/functions/_shared/tests.ts
+```
+
+Acrescentar cenários relevantes para concorrência, repetição, autorização e falhas quando a implementação mudar. Consultar `docs/deployment.md` para distinguir testes com doubles de integração com extensões reais. Não executar fixtures em produção nem aplicar migrações remotas por efeito desta skill. Registrar checks não executados e limitações da evidência local.
````

### executor-judge-beta

````diff
--- /dev/null
+++ .ai/skills/executor-judge-beta/SKILL.md
@@ -0,0 +1,39 @@
+---
+name: executor-judge-beta
+description: Use para execução isolada de código, juiz privado, adaptadores, comparação de resultados, SQL restrito e homologação do beta por linguagem.
+---
+
+# Executor Judge Beta
+
+## Fontes
+
+Consultar `docs/product-rules.md` como fonte autoritativa. Buscar contratos em `judge/executor-contracts.md` e implementação em `judge`, `executor` e `supabase/functions/_shared/execution.ts`. Consultar `docs/deployment.md` para homologação. Se um contrato histórico divergir das regras atuais, explicitar a divergência e seguir a fonte autoritativa, sem reintroduzir fluxos de UI obsoletos.
+
+## Verificações
+
+1. Garantir execução real somente no executor isolado configurado. Demonstração local e mock não comprovam execução, aprovação ou XP.
+2. Manter casos oficiais, resultados esperados, comparadores e gabaritos privados fora do navegador e do workspace editável do aluno. O supervisor confiável controla entradas e coleta resultados; o aluno não define imagens, comandos ou dependências.
+3. Revisar contrato de função, tipos, compilação e normalização por linguagem. Capturar retorno, stdout, stderr, término e métricas sem confundir mensagens de estudo com resultado submetido.
+4. Verificar comparação dos resultados reais e cobertura de todos os casos obrigatórios conforme `docs/product-rules.md`. Testes do aluno e diagnósticos consultivos não decidem aprovação.
+5. Validar paths e manifesto, ausência de travessia e links indevidos, limites de recursos, rede, processos, saída, compilação, timeout e limpeza. Usar os valores vigentes da fonte autoritativa, sem copiá-los para a skill.
+6. Distinguir falha do programa de falha do executor e preservar o contrato de retentativa e finalização com `supabase-transactions`.
+7. Para SQL, exigir base sintética descartável separada do produto, parser compatível, papel restrito, readonly e watchdog. Nunca executar SQL do aluno no banco da aplicação.
+8. Homologar cada linguagem e versão com evidências reais de sucesso, erro, compilação, limites e isolamento. Preservar template ID, digest e versão vinculados a trabalhos existentes. Não habilitar runtime somente porque testes de comparador passaram.
+
+## Validação
+
+Selecionar os testes pertinentes já presentes em `executor/test_adapters.py`, `executor/test_program_adapters.py`, `executor/test_sql_encoding.py`, `executor/test_sql_policy.py` e `executor/test_supervisor_setup.py`, além dos testes de domínio e contratos afetados. Com os pré-requisitos já disponíveis, a suíte local pode ser executada por:
+
+```bash
+rtk proxy python3 -m unittest discover -s executor -p 'test_*.py'
+```
+
+Consultar `docs/deployment.md` e `executor/requirements.txt` para pré-requisitos; não instalar dependências apenas para validar esta configuração de skills. Identificar skips e não tratá-los como cobertura executada. Testes de adaptadores de programa não autorizam reintroduzir uma opção de execução na UI contrária à fonte autoritativa.
+
+Usar homologação local quando o ambiente isolado estiver disponível e o trabalho autorizado incluir sua execução:
+
+```bash
+rtk npm run executor:homologate
+```
+
+Registrar runtime, versão, template, digest, ambiente e resultado. Homologação local não comprova o provedor implantado; seguir `docs/deployment.md` para evidência do ambiente real, somente dentro de autorização específica. Não implantar, ativar runtimes ou habilitar serviços por efeito desta configuração de skills.
````
