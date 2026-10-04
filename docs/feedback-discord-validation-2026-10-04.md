# Validação do feedback público no Discord — 4 de outubro de 2026

## Implementação e verificações locais

- Formulário sem contato por e-mail; aviso e confirmação obrigatória de publicação de mensagem, tipo, nome público e desafio opcional no servidor Rods Leet, canal geral.
- Registro com protocolo significa entrada na fila; não afirma entrega externa concluída.
- Contrato rejeita e-mail legado, ausência de confirmação, identidade ou destino forjados. Identidade pública vem do perfil no servidor.
- Histórico anterior privado, cotas, idempotência e controle por token preservados. Envio antigo por e-mail aposentado.
- Webhook exclusivamente HTTPS Discord, sem redirecionamentos, com prazo máximo. Servidor e canal verificados antes da publicação; menções desativadas; confirmação externa validada antes de marcar enviado.
- 583 testes unitários passaram; typecheck frontend/BFF e lint passaram.
- Todas as invariantes PostgreSQL passaram em banco local isolado. Cron, rede e PGMQ usam doubles; isso não comprova a integração publicada.
- Dez testes Chromium passaram após o ajuste visual, cobrindo desktop e Pixel 7, temas claro/escuro, sucesso, falta de consentimento, mensagem curta, cota, perda de resposta e protocolo inválido. Texto/consentimento/chave ficam preservados nas tentativas incertas.
- Capturas temporárias inspecionadas: `/tmp/rods-feedback-success-dark-mobile.png`, `/tmp/rods-feedback-error-dark-mobile.png`, `/tmp/rods-feedback-success-light-desktop.png`. Aviso público recebeu painel e espaçamento; textos e protocolos quebram linhas sem rolagem horizontal nos cenários testados.

## Publicação e integração real

Migração aplicada e funções `api`, `feedback-discord` e `feedback-mail` publicadas. Frontend/BFF publicados no artefato Cloudflare Pages `00e30101` e verificados em `https://rodsleet.com/feedback`: campo de e-mail ausente, aviso público/convite presentes e falta de concordância impede envio. Typecheck e builds frontend/BFF passaram.

Consulta de produção confirmou `feedback_mail_enabled=false`, dois registros antigos com destino privado e falta de privilégio de escrita/dispatch para anon/authenticated. O usuário salvou o webhook privado no Supabase; a fila foi ativada com `feedback_discord_enabled=true`. O job `rods-feedback-discord` está ativo e roda a cada minuto.

O teste real enviado em `https://rodsleet.com/feedback?challengeId=concept-values` gerou o protocolo `f8ce43f7-d4fc-4cb4-8878-bbc38cbd4844`. Sem disparo manual do worker, o agendamento publicou uma única mensagem no canal geral, servidor `1555947225945870508`, canal `1555947226709237912`. O Discord mostrou o nome público do perfil, tipo Sugestão, texto de teste e link canônico do desafio. O protocolo externo corresponde ao recibo do site; o banco confirmou um registro Discord com estado `sent` e dois registros históricos privados inalterados. Mensagem Discord `1556272179971235871`.

Capturas inspecionadas: `/tmp/rods-feedback-production-no-email.png` e `/tmp/rods-feedback-discord-production-confirmed.png`. Credencial não foi exibida, registrada no Git nem colocada no frontend. Não executar fixtures SQL em produção nem reenviar mensagens históricas. Cenários de erro, abuso e repetição são cobertos pelos testes isolados; a verificação externa publicou somente este feedback de teste.
