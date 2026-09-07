# Operação do beta Rods Leet

## Estado entregue e condições para abrir os convites

O repositório contém catálogo público, API autenticada, migrações, juiz privado, fila transacional, adaptador E2B, supervisor, adaptadores de dez linguagens, política SQL PostgreSQL 18 e tutor Workers AI. A execução remota nasce **desativada**, com crédito confirmado zero e sem runtimes homologados. Não há credenciais, infraestrutura contratada, cobrança automática ou resultado de execução simulado no caminho de produção.

Os testes locais das funções e das regras de banco não homologam um template E2B. O requisito de cgroup v2 delegado precisa ser comprovado na VM do fornecedor antes de habilitar qualquer runtime. Se ele não estiver disponível, este executor falha fechado; será necessário ajustar a imagem/fornecedor mantendo a interface `CodeExecutionProvider`. Não substitua o supervisor por execução direta no host ou por limites informados pelo programa do aluno.

Modo Normal integra o beta. Hard permanece protegido por `private.settings.hard_enabled=false`; as regras de sessão e o conteúdo multifile estão implementados, mas custom tests, diagnóstico extenso de crescimento, tradução completa dos gabaritos e homologação de projetos são entregas posteriores. O editor recebe erro explícito caso peça testes personalizados antes da ativação.

## Preparação local e Supabase

1. Use Node 22, Deno 2.9.6 e Supabase CLI compatível com PostgreSQL 17/PGMQ. Instale as dependências do aplicativo com `npm ci` e execute `npm run dev` para o catálogo local.
2. Para serviços locais, execute `supabase start` e `supabase db reset`. PostgreSQL 17 armazena o produto; PostgreSQL 18.4 é instalado separadamente dentro do template de SQL.
3. Configure segredos das Edge Functions a partir de `.env.example`, sem copiar chaves privadas para variáveis `VITE_`. `APP_ORIGIN` deve corresponder exatamente ao frontend. Gere `COORDINATOR_SECRET` com ao menos 32 bytes aleatórios.
4. Publique o catálogo com `npx tsx scripts/seed-catalog.ts`, usando `SUPABASE_URL` e a chave de serviço somente nesse processo administrativo. Apenas definições públicas são gravadas. Preserve versões publicadas: mudanças de contrato requerem outro `versionId` e a manutenção do juiz antigo enquanto houver submissões pendentes.
5. Rode `supabase functions serve --env-file <arquivo-privado>`. As funções verificam autenticação diretamente: API valida o Bearer no Supabase Auth `/user`; coordenador usa um segredo separado. `verify_jwt=false` não significa acesso anônimo ao produto.
6. Na configuração de Auth, habilite Google e GitHub e crie os clientes OAuth. No painel de **Google/GitHub**, use o callback mostrado pelo Supabase, normalmente `https://<project-ref>.supabase.co/auth/v1/callback`. Na lista de redirecionamentos permitidos do **Supabase**, cadastre `http://localhost:5173/auth/callback` e, depois, `https://<domínio-do-frontend>/auth/callback`; esse segundo retorno pertence à interface. O usuário só recebe perfil se o email verificado constar em `private.invites`; admissão é serializada e limitada a 100 perfis. A API revalida o convite em cada acesso. Cadastro por email não está habilitado na interface.

As tabelas têm RLS e nenhum acesso direto de `anon`/`authenticated`. O esquema `private` não deve ser adicionado à lista de schemas expostos pelo PostgREST. As RPCs de administração/avaliação são concedidas apenas a `service_role`. O navegador nunca determina `user_id`, XP, prazo, saldo ou aceite.

## Imagem, homologação e habilitação do executor

`executor/Dockerfile` instala as toolchains e dependências durante o build; não instala pacotes durante submissões. O script usa um snapshot Debian e versões fixadas de Node, TypeScript, Go, .NET, Rust, Kotlin, bibliotecas JSON, PostgreSQL e parser. O manifesto ainda é um perfil de partida: confira a versão exata de cada executável instalado e atualize `manifest.json` antes de produzir a imagem final. A lista SHA-256 dos artefatos fica em `/opt/codegamer/artifact-sha256.txt`.

Para um build explicitamente autorizado, forneça `RUNTIME_BASE_IMAGE=debian:bookworm-slim@sha256:<digest-verificado>`, a chave E2B e `ALLOW_E2B_TEMPLATE_BUILD=true`; execute `deno run --allow-env --allow-read --allow-net --allow-sys --config supabase/functions/deno.json executor/build.ts`. O comando cria um template E2B e **consome créditos de build**. Não foi executado nesta implementação. Registre esse consumo antes de disponibilizar créditos ao beta.

A VM tem duas vCPUs e 2 GiB. O supervisor reserva 1 GiB para processos do aluno e 512 MiB para PostgreSQL, deixando espaço para controle. Publicar perfis deve informar esses limites reais. Compilação tem 45 segundos; cada caso tem 2 segundos de CPU, 5 segundos de duração e 64 KiB de saída; a soma da saída fica em 256 KiB. O orçamento de casos tem 35 segundos após compilação; a VM inteira expira em 90 segundos. Runtimes com JIT precisam de calibração antes de publicar exercícios.

Para **cada desafio × linguagem × versão de runtime × imagem**, execute:

- Gabaritos completos, negativos, vazio, limites e entradas adversariais; `find-max` com 100.000 elementos deve produzir um envelope pequeno e passar.
- Soluções sabidamente erradas, respostas apenas dos exemplos, mutação da entrada e SQL contra todas as bases privadas.
- Loop infinito, estouro de memória, criação de processos, nova sessão de processos, saída ilimitada, tentativa de ler `/run/codegamer`, alterar `/opt/codegamer` e acessar rede IPv4/IPv6/control plane.
- Queda do coordenador, expiração de lease, replay de mensagem, envio duplicado e esgotamento do crédito. O TTL deve destruir a VM independentemente do coordenador.
- SQL com CTE de escrita, casts perigosos, funções não permitidas, acesso a outros schemas, `SELECT INTO`, locks e múltiplos comandos.

Guarde evidências, versão dos executáveis, template ID e SHA-256 exato de `/opt/codegamer/manifest.json`. Cadastre-os em `private.runtimes` e só então marque `homologated=true`. A submissão salva um snapshot do template, digest e versão; atualizar o runtime não troca a imagem de trabalhos já enfileirados. Desmarcar a homologação bloqueia trabalhos pendentes e preserva a tentativa.

Em `private.settings`, registre o **saldo efetivamente confirmado**, descontado consumo de homologação/build. A aplicação reserva no máximo 80% desse valor e US$1 por dia UTC. O custo máximo por job começa em US$0,02; compare com o preço vigente de 90 segundos, CPU e memória do template, arredonde para cima e ajuste antes de ativar. Valores de configuração não mudam o plano comercial do fornecedor. Mantenha sem método de pagamento e sem upgrade automático.

Preencha `coordinator_url`, `coordinator_secret` e `execution_enabled=true` somente ao concluir os passos anteriores. Uma nova submissão reserva orçamento, cota e mensagem na mesma transação. São permitidas quatro VMs ativas, uma execução pendente/ativa por pessoa, uma criação por segundo e dez execuções por dia UTC. Novas tentativas técnicas recebem reserva própria, no máximo duas, sem descontar outra tentativa do aluno. Reservas já potencialmente consumidas não são devolvidas com base em estimativas não verificadas.

## Executor local do beta (custo de nuvem zero)

O executor local mantém o BFF e a fila no Supabase. O navegador nunca acessa o computador executor e nunca recebe os testes ocultos. O coordenador chama um único endereço HTTPS do Cloudflare Tunnel, autenticado por um token exclusivo de no mínimo 32 caracteres.

1. Construa `rods-leet-executor:local` com `executor/Dockerfile` e uma imagem Debian fixada por digest.
2. Gere `LOCAL_EXECUTOR_TOKEN` aleatoriamente e salve o mesmo valor somente no serviço local e nos secrets da função `coordinator`.
3. Inicie `npm run executor:serve`. O gateway escuta apenas em `127.0.0.1:8789`.
4. Publique somente essa porta por um Cloudflare Tunnel nomeado. Não publique a porta do Docker nem habilite acesso direto por IP.
5. Configure os secrets `EXECUTION_PROVIDER=local`, `LOCAL_EXECUTOR_URL=https://<host-do-tunnel>` e `LOCAL_EXECUTOR_TOKEN` no Supabase.
6. Aplique a migração local, homologue cada runtime e só então altere `private.settings.execution_enabled` para `true`.

Cada job usa um contêiner descartável, sem rede, sistema-base somente leitura, usuário do aluno sem privilégios e limites de CPU, memória, processos, duração e saída. O gateway aceita um job por vez, limita o corpo a 2 MiB, o código a 256 KiB e destrói os arquivos temporários ao terminar. Ele não deve rodar como root nem ter uma porta pública própria. O usuário que executa o gateway precisa apenas de permissão para iniciar contêineres Docker; essa permissão equivale a controle administrativo do host e deve ficar restrita à máquina dedicada ao beta.

O custo cobrado por provedor é `0` nessa modalidade. Cloudflare Tunnel não acrescenta cobrança ao fluxo, mas a máquina, energia e conexão locais continuam sob responsabilidade do operador. Se a máquina estiver desligada, executar e submeter permanecem enfileirados ou retornam indisponibilidade sem consumir tentativa nem XP.

## Publicação, tutor e recuperação

Publique a aplicação estática em Cloudflare Pages: build `npm run build`, saída `dist`. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` e o retorno OAuth de produção. Publique funções com `supabase functions deploy api` e `supabase functions deploy coordinator`; segredos ficam no ambiente de funções. O primeiro deploy foi realizado em 5 de setembro de 2026; consulte [estado do ambiente](deployment-status.md) para o que está ativo e as verificações pendentes.

O tutor usa REST Workers AI a partir do Supabase, com token restrito a inferência. O modelo é `@cf/qwen/qwen3-30b-a3b-fp8`. Entrada incluindo instruções tem cap conservador inferior a 2.048 tokens; saída, 1.024. Cada inferência reserva 100 neurons, com teto de 8.000 por dia e duas chamadas por usuário. Verifique tarifas do modelo antes da ativação. Falta de configuração/cota produz uma dica editorial. Assistência em desafio ainda não resolvido usa o saldo de dicas e exige uma sessão ativa. Recomendações usam conclusões e os erros recentes por tópico.

Cron acorda o coordenador a cada minuto e limpa detalhes de logs. O consumo da fila usa lease de 180 segundos; resultado, XP, progresso e archive pertencem à mesma transação. Uma falha externa pode executar o código mais de uma vez, mas somente o dono vigente do lease finaliza. Não existe promessa de execução externa exatamente uma vez.

O backup em `.github/workflows/backup.yml` fica desativado até `BACKUP_ENABLED=true`. Configure um ambiente `beta-backup` com um destino S3 **já existente**, credenciais limitadas a gravação e a chave pública age. A exportação flui diretamente para criptografia, sem dump em texto claro no disco. O estado atual armazena rascunhos, arquivos aceitos e demais dados no PostgreSQL; portanto o dump inclui todos os arquivos usados. **Se Storage passar a armazenar objetos, amplie o backup para exportar os objetos antes dessa mudança entrar em produção.** Não há bucket usado pela implementação atual.

Teste a restauração em uma instância Supabase local vazia com `scripts/restore-test.sh`, uma identidade age offline e `LOCAL_TEST_DATABASE_URL`. O script recusa hosts remotos. O ensaio exige um backup real e ainda não foi realizado. Não abra os convites sem evidência de restauração, OAuth, saldo, rede e homologação. Alertas operacionais devem acompanhar falhas do workflow, fila, créditos e erros da API; não há envio automático de mensagens a terceiros.

## Verificação reproduzível e referências

- `npm test -- --run` e `npm run build`: domínio, catálogo e frontend.
- `deno check --config supabase/functions/deno.json supabase/functions/api/index.ts supabase/functions/coordinator/index.ts executor/build.ts`.
- `deno test --allow-env --config supabase/functions/deno.json supabase/functions/_shared/tests.ts`.
- `python3 -m unittest discover -s executor -p 'test_*.py'`, após instalar `executor/requirements.txt` num ambiente virtual.
- `python3 scripts/test-database.py`: PostgreSQL local real, **doubles de PGMQ/Cron/pg_net**. Valida transações, privilégios e regras; não substitui integração com as extensões.
- `deno run --allow-run=docker --config supabase/functions/deno.json scripts/test-sql-references.ts`: os dez gabaritos SQL são executados nas quarenta bases públicas/privadas em PostgreSQL 16 local descartável e comparados pelo juiz oficial. Esta verificação passou, incluindo nomes/tipos de coluna, valores, `NULL`, duplicatas e ordem; não homologa PostgreSQL 18 nem E2B.
- `psql "$DATABASE_URL_LOCAL" -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql`: execute contra Supabase local com extensões reais após aplicar migrações. Não execute fixtures de teste em produção.

Fontes consultadas: [SDK E2B 2.13.0](https://docs.e2b.dev/sdk-reference/js-sdk/v2.13.0/sandbox), [acesso de rede E2B](https://docs.e2b.dev/network/restrict-public-access), [PGMQ](https://supabase.com/docs/guides/queues/pgmq), [limites Edge Functions](https://supabase.com/docs/guides/functions/limits), [pglast v8 para PostgreSQL 18](https://github.com/lelit/pglast), [modelo Workers AI](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/).
