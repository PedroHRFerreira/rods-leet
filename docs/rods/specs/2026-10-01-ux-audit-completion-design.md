# Continuidade da auditoria de experiência

Escopo confirmado pelo usuário em 1 de outubro de 2026: validar a entrega existente e finalizar o que cabe na estrutura atual, documentando integrações externas pendentes.

## Entrega

Conferir confirmação opcional, reação e progresso com testes e navegador. Validar em runtime resultados de submissão antes de exibir aprovação ou atualizar conclusões. Preservar chaves de idempotência em recuperação de resposta perdida.

Adicionar feedback de texto na navegação e nos desafios: sugestão, crítica ou elogio, mensagem de 10 a 4.000 caracteres, contato opcional e contexto explícito do desafio. Não enviar código ou dados de sessão automaticamente. Protocolo somente após persistência. Limitar no servidor a três mensagens por hora e dez por dia por identidade; deduplicar em transação e proteger os registros com RLS. Contato informado não representa contato verificado nem promessa de atendimento por e-mail. Triagem restrita pelos recursos administrativos existentes.

## Limites e aceite

Continuidade autorizada: publicar em produção e enviar notificações de feedback para `devpedrohr@gmail.com` pelo Gmail. O SMTP de Authentication não disponibiliza sua senha às funções; cadastrar `GMAIL_APP_PASSWORD` em Edge Functions → Secrets. Usar SMTP Gmail com TLS, remetente e destinatário fixos nessa conta, sem envio automático ao contato informado pelo visitante. Gravar antes de notificar; fila administrativa com claim atômico impede envios concorrentes. Envio confirmado pelo SMTP marca a notificação como enviada. Resultado de envio incerto exige conferência manual antes de repetir, evitando duplicação por recuperação automática. A ausência de credencial não deve perder feedback nem confirmar entrega por e-mail.

Decisão posterior do usuário: pular a ativação de e-mail nesta publicação e completar depois. Preservar preparação e destinatário; `feedback_mail_enabled` começa desativado, sem tentativas automáticas de SMTP. Publicar e homologar o recebimento de texto independentemente disso.

Mídia, inspeção de arquivos, envio de e-mail e prática local ficam documentados como pendências; nenhum serviço ou custo novo. Validação local não será descrita como homologação conectada. A nova migração precisa ser aplicada antes de habilitar recebimento no ambiente publicado.

Verificar sucesso, erro e recuperação sem perda de mensagem, submissão duplicada, payload inválido, desktop/mobile e acessibilidade. Executar verificações do projeto pertinentes e registrar no plano o estado de cada etapa e as lacunas operacionais.
