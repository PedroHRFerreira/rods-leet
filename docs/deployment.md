# Operação do beta Rods Leet

## Estado entregue e condições operacionais

O beta publicado abre com uma sessão anônima automática. Seu catálogo contém dez perguntas guiadas e 59 exercícios de código. As perguntas são avaliadas pela API privada; os exercícios usam a fila Supabase e o executor Docker local, conectado por um Quick Tunnel HTTPS autorizado e protegido por token. O tutor está fora da navegação e o modo Hard permanece desativado. Evidências e limites atuais estão em [estado da implantação](deployment-status.md).

Uma instalação nova começa com execução desativada e exige homologação antes da ativação. O adaptador E2B existe no repositório, mas não integra o ambiente ativo; as instruções de E2B abaixo servem para uma futura implantação explicitamente autorizada. Não há cobrança de provedor de execução no beta local.

Os testes locais das funções e das regras de banco não homologam um template E2B. O requisito de cgroup v2 delegado precisa ser comprovado na VM do fornecedor antes de habilitar qualquer runtime. Se ele não estiver disponível, este executor falha fechado; será necessário ajustar a imagem/fornecedor mantendo a interface `CodeExecutionProvider`. Não substitua o supervisor por execução direta no host ou por limites informados pelo programa do aluno.

Modo Normal integra o beta. Hard permanece protegido por `private.settings.hard_enabled=false`; as regras de sessão e o conteúdo multifile estão implementados, mas custom tests, diagnóstico extenso de crescimento, tradução completa dos gabaritos e homologação de projetos são entregas posteriores. O editor recebe erro explícito caso peça testes personalizados antes da ativação.

## Preparação local e Supabase

1. Use Node 22, Deno 2.9.6 e Supabase CLI compatível com PostgreSQL 17/PGMQ. Instale as dependências do aplicativo com `npm ci` e execute `npm run dev` para o catálogo local.
2. Para serviços locais, execute `supabase start` e `supabase db reset`. PostgreSQL 17 armazena o produto; PostgreSQL 18.4 é instalado separadamente dentro do template de SQL.
3. Configure segredos das Edge Functions a partir de `.env.example`, sem copiar chaves privadas para variáveis `VITE_`. `APP_ORIGIN` deve corresponder exatamente ao frontend. Gere `COORDINATOR_SECRET` com ao menos 32 bytes aleatórios.
4. Publique o catálogo com `npx tsx scripts/seed-catalog.ts`, usando `SUPABASE_URL` e a chave de serviço somente nesse processo administrativo. Apenas definições públicas são gravadas. Preserve versões publicadas: mudanças de contrato requerem outro `versionId` e a manutenção do juiz antigo enquanto houver submissões pendentes.
5. Rode `supabase functions serve --env-file <arquivo-privado>`. A API mantém `verify_jwt=true` e valida a identidade no Supabase Auth `/user`; o coordenador e a função de sessão mantêm `verify_jwt=false` e usam seus controles próprios. Preserve as definições de `supabase/config.toml` ao publicar.
6. Para o beta aberto, habilite **Anonymous Sign-Ins** no Supabase Auth e aplique `202609300001_public_beta.sql`. O BFF cria automaticamente uma identidade anônima, mantém tokens cifrados no servidor e um cookie opaco de sessão de 30 dias. A API verifica a identidade real no Auth; dados continuam separados por usuário. O login não aparece na interface. Sessões GitHub existentes continuam válidas, sem exigir um novo login.
7. Para as perguntas guiadas, aplique `202610010001_concept_quizzes.sql`, publique a API correspondente e a interface antes de sincronizar o catálogo ampliado. A avaliação das perguntas não cria jobs de execução. Consulte o histórico de migrações antes de aplicar; a migração já consta no ambiente do beta.

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

Preencha `coordinator_url`, `coordinator_secret` e `execution_enabled=true` somente ao concluir os passos anteriores. Uma nova submissão reserva orçamento e mensagem na mesma transação. São permitidas quatro VMs ativas, uma execução pendente/ativa por pessoa e uma criação por segundo. O beta não limita a quantidade diária de execuções de estudo. Novas tentativas técnicas recebem reserva própria, no máximo duas, sem descontar outra tentativa do aluno. Reservas já potencialmente consumidas não são devolvidas com base em estimativas não verificadas.

## Executor local do beta (custo de nuvem zero)

O executor local mantém o BFF e a fila no Supabase. O navegador nunca acessa o computador executor e nunca recebe os testes ocultos. O coordenador chama um único endereço HTTPS do Cloudflare Tunnel, autenticado por um token exclusivo de no mínimo 32 caracteres.

1. Construa `rods-leet-executor:local` com `executor/Dockerfile` e uma imagem Debian fixada por digest.
2. Gere `LOCAL_EXECUTOR_TOKEN` aleatoriamente e salve o mesmo valor somente no serviço local e nos secrets da função `coordinator`.
3. Inicie `npm run executor:serve`. O gateway escuta apenas em `127.0.0.1:8789`.
4. Publique somente essa porta por um Cloudflare Tunnel. O beta usa um Quick Tunnel temporário, explicitamente autorizado; um túnel nomeado é uma opção futura. Não publique a porta do Docker nem habilite acesso direto por IP. Se reiniciar o Quick Tunnel, confira o novo endereço e atualize o secret do coordenador.
5. Configure os secrets `EXECUTION_PROVIDER=local`, `LOCAL_EXECUTOR_URL=https://<host-do-tunnel>` e `LOCAL_EXECUTOR_TOKEN` no Supabase.
6. Aplique a migração local, homologue cada runtime e só então altere `private.settings.execution_enabled` para `true`.

Cada job usa um contêiner descartável, sem rede, sistema-base somente leitura, usuário do aluno sem privilégios e limites de CPU, memória, processos, duração e saída. O gateway aceita um job por vez, limita o corpo a 2 MiB, o código a 256 KiB e destrói os arquivos temporários ao terminar. Ele não deve rodar como root nem ter uma porta pública própria. O usuário que executa o gateway precisa apenas de permissão para iniciar contêineres Docker; essa permissão equivale a controle administrativo do host e deve ficar restrita à máquina dedicada ao beta.

O custo cobrado por provedor é `0` nessa modalidade. Cloudflare Tunnel não acrescenta cobrança ao fluxo, mas a máquina, energia e conexão locais continuam sob responsabilidade do operador. Se a máquina estiver desligada, executar e submeter permanecem enfileirados ou retornam indisponibilidade sem consumir tentativa nem XP.

A interface do beta usa a função do modelo. Executar chama essa função com a entrada do exemplo e mostra mensagens de console/print e o valor retornado, sem avaliar nem conceder XP. Submeter compara apenas o retorno com os resultados oficiais; as mensagens de estudo não interferem na resposta. O servidor mantém o contrato `program` por compatibilidade, sem oferecê-lo na interface. Atualize a imagem do executor junto do coordenador quando mudar esses contratos.

Submeter pede confirmação inicialmente; o usuário pode dispensá-la para perguntas ou código neste navegador e reativá-la no perfil. Uma rejeição do código reduz o XP disponível em 15% do valor base por erro, até zero; a primeira aprovação concede a recompensa uma única vez e bloqueia novos envios oficiais. Estudo permanece disponível. As regras completas e atuais ficam em [regras do produto](product-rules.md).

## Publicação, tutor e recuperação

### Prática no navegador

Executar em JavaScript/TypeScript usa o primeiro exemplo público em QuickJS/Wasm isolado, sem instalação e sem XP. Submeter continua remoto. Linguagens e workspaces locais incompatíveis mantêm o servidor como alternativa, sujeito à disponibilidade do executor. Runtimes, limites, CSP e rollback estão em [operação da prática local](browser-practice-operations.md). A verificação de navegador agora constrói o pacote de produção antes de testar seus workers.

Publique o frontend e as Pages Functions em Cloudflare Pages: build `npm run build`, saída `dist`. Configure no servidor Pages `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BFF_SHARED_SECRET` e `BFF_ENCRYPTION_KEY`; os nomes estão em `.dev.vars.example`. O navegador usa o BFF no mesmo domínio. Para o site conectado, deixe `VITE_BFF_ENABLED` ausente ou `true`. Publique as funções `api`, `session` e `coordinator` preservando a configuração JWT de cada uma; seus segredos ficam no ambiente Supabase. Consulte [estado do ambiente](deployment-status.md) para a versão ativa.

O tutor permanece fora da navegação, dos atalhos e da rota acessível. O adaptador Workers AI e a orientação editorial existem no servidor, mas não comprovam um tutor pronto. Sua ativação futura exige validação própria de qualidade, custos e limites.

Cron acorda o coordenador a cada minuto e limpa detalhes de logs. O consumo da fila usa lease de 180 segundos; resultado, XP, progresso e archive pertencem à mesma transação. Uma falha externa pode executar o código mais de uma vez, mas somente o dono vigente do lease finaliza. Não existe promessa de execução externa exatamente uma vez.

O backup em `.github/workflows/backup.yml` fica desativado até `BACKUP_ENABLED=true`. Configure um ambiente `beta-backup` com um destino S3 **já existente**, credenciais limitadas a gravação e a chave pública age. A exportação flui diretamente para criptografia, sem dump em texto claro no disco. O estado atual armazena rascunhos, arquivos aceitos e demais dados no PostgreSQL; portanto o dump inclui todos os arquivos usados. **Se Storage passar a armazenar objetos, amplie o backup para exportar os objetos antes dessa mudança entrar em produção.** Não há bucket usado pela implementação atual.

Teste a restauração em uma instância Supabase local vazia com `scripts/restore-test.sh`, uma identidade age offline e `LOCAL_TEST_DATABASE_URL`. O script recusa hosts remotos. O ensaio exige um backup real e ainda não foi realizado. Antes de ampliar a capacidade, obtenha evidência de restauração, OAuth, saldo, rede e homologação. Alertas operacionais devem acompanhar falhas do workflow, fila, créditos e erros da API; não há envio automático de mensagens a terceiros.

## Verificação reproduzível e referências

- `npm test -- --run` e `npm run build`: domínio, catálogo e frontend.
- `deno check --config supabase/functions/deno.json supabase/functions/api/index.ts supabase/functions/coordinator/index.ts executor/build.ts`.
- `deno test --allow-env --config supabase/functions/deno.json supabase/functions/_shared/tests.ts`.
- `python3 -m unittest discover -s executor -p 'test_*.py'`, após instalar `executor/requirements.txt` num ambiente virtual.
- `python3 scripts/test-database.py`: PostgreSQL local real, **doubles de PGMQ/Cron/pg_net**. Valida transações, privilégios e regras; não substitui integração com as extensões.
- `deno run --allow-run=docker --config supabase/functions/deno.json scripts/test-sql-references.ts`: os dez gabaritos SQL são executados nas quarenta bases públicas/privadas em PostgreSQL 16 local descartável e comparados pelo juiz oficial. Esta verificação passou, incluindo nomes/tipos de coluna, valores, `NULL`, duplicatas e ordem; não homologa PostgreSQL 18 nem E2B.
- `psql "$DATABASE_URL_LOCAL" -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql`: execute contra Supabase local com extensões reais após aplicar migrações. Não execute fixtures de teste em produção.

Fontes consultadas: [SDK E2B 2.13.0](https://docs.e2b.dev/sdk-reference/js-sdk/v2.13.0/sandbox), [acesso de rede E2B](https://docs.e2b.dev/network/restrict-public-access), [PGMQ](https://supabase.com/docs/guides/queues/pgmq), [limites Edge Functions](https://supabase.com/docs/guides/functions/limits), [pglast v8 para PostgreSQL 18](https://github.com/lelit/pglast), [modelo Workers AI](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/).

## Ativação de moedas, loja e login por e-mail

A migração e a API foram publicadas em 2 de outubro de 2026. Cadastro e recuperação por e-mail permanecem desativados por decisão do usuário até configurar domínio e SMTP. A confirmação da publicação da interface e suas evidências ficam em `deployment-status.md`.

Durante essa etapa, configurar `EMAIL_REGISTRATION_ENABLED=false` nas Pages Functions e `VITE_EMAIL_REGISTRATION_ENABLED=false` no build. O BFF recusa cadastro e recuperação sem chamar Auth; a interface sinaliza disponibilidade futura. Login em contas existentes e exploração anônima continuam disponíveis. Compras continuam exigindo conta; visitantes podem ganhar moedas, mas não comprar. Para liberar cadastro, concluir configuração e teste de e-mail abaixo, trocar ambas as opções para `true` e publicar novamente. Não habilitar as notificações de feedback junto com o SMTP de Auth.

O backup anterior à migração foi exportado diretamente para arquivos criptografados em `backups/2026-10-03-before-economy/`, ignorados pelo Git e com acesso restrito. A leitura por descriptografia foi verificada; restauração e cópia externa ainda não foram ensaiadas. A chave de recuperação deve ser guardada pelo operador separadamente dos dumps.

1. Aplicar `supabase/migrations/202610020001_economy.sql` depois das migrações existentes. Ela adiciona carteira, ledger, inventário, catálogo e RPCs, preservando o histórico sem moedas retroativas. Fazer backup antes da migração; manter a carteira/ledger em caso de rollback da interface.
2. No Supabase Auth, manter Anonymous Sign-Ins, habilitar Email, confirmação de e-mail e manual linking. Configurar senha mínima de dez caracteres. Desabilitar Google/GitHub para novos acessos nesta versão; sessões existentes podem continuar válidas.
3. Configurar Site URL como o domínio do frontend e incluir `/conta/confirmar` nas URLs permitidas. Para desenvolvimento, o config usa `http://localhost:5178`; o frontend conectado também precisa do BFF, com APP_ORIGIN correspondente.
4. Copiar os três templates de `supabase/templates/` para Confirmation, Change Email Address e Reset Password no projeto publicado. Os links usam TokenHash + tipo para a rota de confirmação, nunca fragmentos com access/refresh tokens. Configurar e homologar o envio SMTP para visitantes reais. Alterar config.toml local não modifica as configurações hospedadas.
5. Publicar a Edge Function `api` atualizada antes do frontend/BFF; preservar a função `session` e suas chaves. O servidor aceita contas com e-mail confirmado sem exigir identidade social. As novas rotas são `/api/shop`, `/api/shop/purchase` e `/api/shop/equip`.
6. Publicar frontend e Pages Functions juntos; testar e-mail real, confirmação em outra aba/dispositivo, primeira senha, logout/login, recuperação e preservação do mesmo user ID. Testar uma conclusão de código e uma pergunta: XP, moedas e dicas devem fechar na mesma transação.
7. Monitorar falhas de Auth, RPCs da loja e integridade carteira/ledger. Saldo insuficiente, nível bloqueado e oferta expirada são recusas esperadas. Nunca corrigir saldo no navegador.

Validação SQL local sem Docker (dependência temporária, fora do projeto):

```sh
npm install --prefix /tmp/rods-economy-sql --ignore-scripts --no-audit --no-fund @electric-sql/pglite
ECONOMY_SQL_RUNTIME=/tmp/rods-economy-sql/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-economy-sql.mjs
```

O runner aplica todas as migrações e fixtures em PostgreSQL isolado, reutilizando os doubles de PGMQ/Cron/pg_net do runner Docker. Não comprova extensões reais, concorrência entre conexões ou SMTP; executar os testes também no Supabase de homologação antes de ativar. Cadastro converte visitante somente após verificar e-mail, conforme [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous); templates e configuração seguem [a documentação de e-mails](https://supabase.com/docs/guides/local-development/customizing-email-templates).

## Loja e recompensas v2

Aplicar `202610030001_shop_rewards_v2.sql` antes de publicar a API e o frontend. A migração preserva moedas, XP e inventário; adiciona molduras, títulos, coleções, pacotes e metas. O ranking semanal conta eventos oficiais da semana atual completa. Metas começam na ativação, sem progresso retroativo; semanas já encerradas antes da publicação não recebem premiação.

O fechamento usa `private.close_due_study_weeks()` tanto no cron de segunda às 03h UTC (00h Brasília) quanto na recuperação horária e na consulta semanal. Conferir os jobs `rods-weekly-prizes` e `rods-weekly-prizes-recovery` em `cron.job`. A mesma semana tem um único resultado persistido; compras e créditos bloqueiam a carteira na transação. RPCs e tabelas de economia não permitem escrita com os papéis do navegador. Não criar endpoint de prêmio manual nem aceitar identidade, saldo ou quantidade de dicas enviados pelo cliente.

Validações locais adicionais: `python3 scripts/test-database.py` cobre permissões e regras; `python3 scripts/test-economy-concurrency.py` usa conexões simultâneas no PostgreSQL descartável para verificar reenvio, gasto concorrente, item permanente e fechamento semanal. Ambos usam doubles de Cron/PGMQ/pg_net; o agendamento real precisa ser conferido no ambiente publicado. Os fixtures nunca devem ser executados em produção.

Compras, equipagem, metas extras e prêmios exigem conta cadastrada. Preservar `EMAIL_REGISTRATION_ENABLED=false` e `VITE_EMAIL_REGISTRATION_ENABLED=false` enquanto o cadastro permanecer desativado. A comunidade Discord é um convite opcional e não participa da autorização da loja.
