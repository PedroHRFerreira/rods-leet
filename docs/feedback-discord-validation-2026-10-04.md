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

Consulta de produção confirmou `feedback_mail_enabled=false`, `feedback_discord_enabled=false`, dois registros antigos com destino privado e falta de privilégio de escrita/dispatch para anon/authenticated. A fila permanece desativada até o usuário salvar o webhook privado no Supabase. Publicação real no Discord ainda não testada. Não executar fixtures SQL em produção nem reenviar mensagens históricas. Captura da página oficial: `/tmp/rods-feedback-production-no-email.png`.
