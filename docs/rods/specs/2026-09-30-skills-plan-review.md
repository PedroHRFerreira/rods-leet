# Plano do `rods init` — revisão antes da geração

Estado: plano revisado e aprovado pelo usuário, com os ajustes abaixo enviados ao assistente. A geração da proposta terminou com `Planning CLI timed out`; uma nova execução terminou com `Planning CLI did not provide a question or plan`. Nenhuma skill personalizada foi gerada por este plano ainda. Este documento organiza a proposta apresentada pelo próprio assistente para revisão e retomada.

## Arquivos previstos

Personalizar em `.ai/skills`: `context-search-first`, `review`, `architecture` e `quality`.

Criar três skills:

| Skill                   | Quando usar                                               | Verificações principais                                                                                                                    |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `bff-sessions`          | Sessões anônimas, cookies, OAuth, comunicação BFF/API     | Tokens cifrados, cookie HttpOnly, CSRF, replay, renovação concorrente e isolamento entre usuários                                          |
| `supabase-transactions` | Migrações, filas, submissões e XP                         | RLS, locks, finalização idempotente, recompensa única, falhas de infraestrutura sem penalidade e testes SQL locais                         |
| `executor-judge-beta`   | Execução de código, adaptadores e comparação de respostas | Código real isolado, stdin/stdout/stderr, testes oficiais fora do navegador, SQL restrito, compilação, timeout e homologação por linguagem |

Preservar integralmente `design-brainstorm`, `parallel-delivery`, `visual-check` e `rules-capture`: onze skills ao final. A fonte permanece `.ai/skills`; `.codex/skills` recebe as projeções do mecanismo RODS.

## Personalizações

- `context-search-first`: buscar primeiro no Context Engine e ler apenas trechos pertinentes; mapear domínio, UI, BFF, Supabase, juiz e executor; usar RTK no terminal e registrar fallback quando o índice não atende.
- `architecture`: manter React/Vite, Pages Functions, Supabase e Docker; preservar as responsabilidades de cada camada e não levar segredos ou testes privados ao cliente.
- `review`: confrontar o diff com as regras atuais e revisar autorização, contratos, concorrência, XP, idempotência, falhas e evidências reais.
- `quality`: selecionar verificações pelo risco da alteração, usar Node >=22 e os comandos existentes de tipos, lint, testes, builds e navegador; distinguir mocks locais de integração e homologação reais.

Todas referenciam `docs/product-rules.md` como fonte autoritativa do comportamento atual, sem copiar e espalhar as regras do produto pelas skills. Evidências antigas permanecem datadas e não comprovam o ambiente atual.

## Preservação e validação

Preservar o conteúdo personalizado de `AGENTS.md`, incluindo a referência a `/home/pedro/.codex/RTK.md`, constituição, configuração, hooks e adaptadores. Não atualizar dependências nem introduzir Agents SDK nesta configuração. Verificar referências reais, comandos compatíveis, onze skills e projeções sincronizadas; executar o diagnóstico do adaptador.

A geração deve mostrar os diffs antes de aplicar os arquivos. O plano não autoriza implantação, migração remota nem habilitação de serviços.

## Ajustes encontrados na revisão

Antes de aceitar, corrigir a referência histórica do assistente para a migração real `supabase/migrations/202609300001_public_beta.sql`. Remover do plano os trechos que tratam o projeto como uma cópia somente leitura: a geração será no workspace atual, seguida da revisão das diferenças. Manter a preservação dos arquivos personalizados.

O usuário aprovou estes ajustes. A próxima etapa é retomar a geração pelo assistente e revisar os diffs concretos antes de aplicar. A opção de pular continua sendo “ignorar planejamento do rods”.
