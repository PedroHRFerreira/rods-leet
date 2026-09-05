# Security Hardening Review: Rods Leet

Preparamos estes critérios para evoluir o beta já publicado. São requisitos propostos, não proteções implementadas nem um certificado de segurança. A análise é direcionada à fronteira navegador/API; não constitui auditoria completa.

## Evidence Basis

Inspecionei a inicialização do Supabase no navegador, o gateway HTTP, a autenticação da API, as permissões de banco e o HTML inicial. Hoje o navegador obtém o token e envia `Authorization: Bearer` diretamente à Edge Function. A API verifica a identidade no Supabase Auth e o convite no banco. Esses controles devem permanecer.

O inventário e os hashes dos arquivos estão em [contexto](context.md). A ausência de `public/_headers` é uma lacuna da configuração versionada; não demonstra, sozinha, ausência de cabeçalhos configurados externamente.

## Constraints

- Preservar Cloudflare Pages, Supabase Free e o endereço `rods-leet.pages.dev`.
- Não contratar planos, domínios, bancos ou recursos pagos automaticamente.
- Manter editor e rascunhos acessíveis durante falhas; não conceder XP nem consumir tentativa por falha da plataforma.
- Até 100 convidados; executor e IA continuam sujeitos à homologação e orçamento separado.
- Nenhuma medição de latência, memória ou resistência a ataques foi realizada nesta análise.

## Opportunity Portfolio

| Opportunity                         | Evidence                                                                                                      | Options                                                        | Recommendation                                                | Proposal                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Centralizar sessão e entrada da API | Tokens no navegador; origem validada, mas sem autenticação do proxy; API privilegiada com autorização própria | 1. Fortalecer a SPA atual; 2. BFF com sessão opaca no servidor | Opção 2, após validar renovação concorrente e cotas gratuitas | [Critérios, alternativas e testes](proposals/session-boundary.md) |

## Recommendation Summary

Recomendo um **BFF na Cloudflare, sob a mesma origem do frontend**, com proxy restrito e sessão opaca em cookie HttpOnly. Nós manteríamos a decisão de acesso a desafios, dicas, rascunhos e XP na API e no banco. O BFF não receberia a chave `service_role`.

Essa mudança reduz a exposição de tokens ao JavaScript e concentra limites de entrada. Ela também adiciona um serviço crítico e exige CSRF, renovação de sessão concorrente e controle de acesso ao backend. Um proxy que apenas encaminha requisições não entrega esses benefícios sozinho.

## Next Decisions

Os critérios estão preparados para revisão e posterior implementação. A escolha recomendada depende da viabilidade de Pages Functions e armazenamento transacional de sessões dentro das cotas gratuitas. Se a latência ou a cota inviabilizarem essa camada, a Opção 1 continua uma alternativa válida com limites explícitos de proteção contra roubo de tokens por XSS.

O próximo passo técnico é validar a arquitetura de sessão em ambiente de teste antes de migrar o login de produção. Não alteramos o deploy nesta preparação.
