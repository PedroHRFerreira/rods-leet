# Fronteiras de confiança e limitações

## Juiz e código do aluno

O cliente envia somente código, linguagem e identificadores. O juiz confiável calcula expectativas fora da VM e compara a saída; nenhuma flag `passed` impressa pelo aluno concede aceite. Testes ocultos, gabaritos e credenciais da aplicação não são transferidos para a VM. Cada caso fornece apenas sua entrada. A solução SQL recebe somente um banco sintético descartável, sem conexão ao banco do produto.

Código, compiladores e processos filhos executam com UID `student`, sem grupos suplementares, com `no_new_privs`, sem binários setuid, rede externa bloqueada e controle E2B autenticado. Diretório de controle é root 0700; supervisor e manifesto são root sem escrita do aluno. Limites de cgroup incluem todos os descendentes, inclusive processos que trocam de sessão. Não execute o supervisor na máquina de desenvolvimento com código de terceiros.

Tempo/CPU/memória são coletados pelo supervisor a partir de cgroups protegidos. Em SQL, o consumo do servidor PostgreSQL também é agregado. O protocolo `find-max` inclui `{result,inputUnchanged}`: o harness compara uma cópia original com a entrada após a chamada. Essa checagem detecta mutação comum e evita emitir 100.000 elementos. Ela **não é uma prova contra código que adultere o próprio processo/harness ou fabrique a saída**. Hash calculado dentro desse mesmo processo não eliminaria a limitação. O contrato é pedagógico; métricas decisórias e expectativas permanecem fora desse processo.

Antes de executar uma linguagem que não seja SQL, o supervisor fecha a travessia do diretório de socket PostgreSQL para outros usuários: proprietário `postgres`, modo 0700. Somente o perfil SQL recebe modo 0711, com CPU/memória do servidor incluídas. PostgreSQL não escuta TCP. Isso impede que JavaScript/Python/etc. desviem trabalho para um processo de banco fora do seu cgroup. Os testes locais cobrem somente as permissões de diretórios temporários e rejeição de symlinks/proprietário incorreto; comprovar a impossibilidade de conexão exige a homologação da VM.

Sandbox, cgroups e toolchains foram implementados, mas não receberam homologação remota. Em particular, disponibilidade de cgroup v2 delegado, isolamento contra o control plane, contabilização do compilador, PostgreSQL e encerramento remoto precisam ser medidos. Esses controles são condições de ativação, não resultados de testes já realizados.

## SQL

`sql_policy.py` usa pglast 8.4, parser de PostgreSQL 18. Exige uma única `SelectStmt`, percorre recursivamente a AST e bloqueia statements de escrita dentro de CTEs, `INTO`, locks, schemas externos, funções, casts e operadores fora das listas permitidas. Não é um filtro baseado apenas em palavras-chave. Um papel sem criação de schema ou temporários executa em transação somente leitura com timeout. O watchdog e o cgroup continuam independentes da consulta.

As relações permitidas são obtidas do schema de fixtures e combinadas com os nomes de CTEs no respectivo escopo. Isso também bloqueia acesso não qualificado a catálogos como `pg_class`, que de outra forma poderia ocorrer pelo `search_path` implícito.

O banco de fixtures é recriado entre casos. Os resultados preservam nomes/tipos de coluna, duplicatas, `NULL` e ordem quando exigida. Tipos fora dos publicados permanecem distinguíveis. Não inferir Big O por custo do planner, uso de índice ou um `Seq Scan`; diagnósticos empíricos futuros são consultivos.

## Pontuação, sessões e dados

Todas as RPCs de mutação são exclusivas do serviço. Identidade vem do token verificado pelo Auth, e a lista de convidados limita o beta a cem perfis. RLS sem políticas de cliente e revogação de privilégios impedem escrita direta em XP, saldo ou resultado. Tokens e código não são incluídos em logs operacionais.

Submissão, orçamento reservado e envio à fila são atômicos. Runtime, linguagem, versão, arquivos e assistência são snapshots. Finalização exige o token e prazo de lease vigentes; eventos de XP e conclusões possuem unicidade. Falha de infraestrutura reembolsa cota ao encerrar e não consome rejeição. Penalidade Hard é limitada ao saldo existente para impedir XP negativo. Normal não tem penalidade de XP.

Gabarito aberto antes de qualquer aprovação torna o desafio prática sem XP persistentemente, inclusive após troca de linguagem/sessão/modo. Dicas persistem por desafio e reduzem o prêmio em 5% ou 15%. O servidor usa UTC para cotas e atividade diária. O cliente não controla início ou expiração das sessões. Rascunhos usam revisão esperada enviada pelo cliente: uma atualização baseada em uma revisão antiga recebe conflito, em vez de sobrescrever silenciosamente outro dispositivo.

O saldo E2B é informado e verificado operacionalmente. A aplicação não tem poder para alterar billing do fornecedor e não verifica se uma pessoa adicionou pagamento no painel externo. Não habilite execução sem revisar saldo real, tarifa, custo reservado e ausência de cobrança automática. Parar execução mantém catálogo, editor e progresso.

## Testes e pendências de segurança

As verificações locais incluem entradas de SQL proibidas, caminhos de arquivo, limites em bytes, privilégios de RPC, idempotência, snapshot de runtime, leases vencidos, descontos de dicas, prêmio único, três rejeições Hard, gabarito antes da aprovação, falha técnica e teto de orçamento. A suíte de banco local usa doubles explícitos das extensões de infraestrutura; execute também com Supabase real antes do beta.

Homologação de dez runtimes, imagens, fork/memory/output bombs, rede/controle da VM, OAuth, execução SQL com servidor 18, restauração, volume e comportamento de IA são pendências operacionais explícitas. Não registrar um runtime como homologado só porque seu template ou adaptador existe.
