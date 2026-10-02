# Recebimento e triagem de feedback de texto

Implementação de 1 de outubro de 2026, dentro da estrutura existente. Publicação autorizada pelo usuário. Migrações `202610010002_product_feedback.sql`, `202610010003_feedback_notifications.sql` e `202610010004_feedback_mail_activation.sql` aplicadas em produção; API atualizada. BFF/frontend publicados no commit `00a0b19`; recebimento homologado no domínio oficial. A função `feedback-mail` já foi publicada na tentativa inicial, porém credencial, homologação e ativação ficam para a retomada do e-mail. A presença do formulário não comprova entrega de e-mail.

## Contrato e proteção

`POST /api/feedback` recebe categoria (`suggestion`, `criticism`, `praise`), mensagem de 10 a 4.000 caracteres, `contactEmail` opcional e `challengeId` opcional. Contexto de desafio exige seleção explícita no formulário; código, logs, tokens e anexos não são enviados. Identidade vem da sessão anônima ou autenticada. O BFF aplica sessão, CSRF e allowlist. A API limita o corpo a 24.000 bytes e valida o conteúdo; o banco valida novamente e grava a mensagem em transação.

O protocolo é o UUID persistido, acompanhado de `createdAt`. A mesma identidade/chave retorna o mesmo protocolo, mesmo depois de atingir a quota. Reutilizar a chave com conteúdo diferente falha. Um bloqueio da identidade serializa envios simultâneos. Limites: três mensagens em uma hora móvel e dez no dia UTC, além do limite geral da API. Trocar/criar identidades anônimas pode contornar a quota por identidade; limites de IP e proteção antiautomação específicos são trabalho operacional pendente.

Sem confirmação de entrega, o formulário conserva a mensagem e reapresenta a mesma solicitação. Durante essa recuperação os campos ficam bloqueados para impedir envio de conteúdo diferente com a mesma chave. Ao receber 429, informa espera mínima de um minuto; novas tentativas ainda podem ser recusadas até a janela de quota liberar. Não há persistência do formulário após fechar/recarregar a página.

## Triagem na estrutura atual

`public.product_feedback` tem RLS habilitada, sem políticas para leitura/escrita pelo navegador. Somente o serviço administrativo pode acessar registros e executar a função de gravação. Não colocar a chave administrativa no frontend nem criar uma política de leitura pública para operar a triagem.

Uma pessoa autorizada pode usar o SQL Editor administrativo existente do Supabase para consultar protocolos pendentes, ler apenas os registros necessários e alterar `triage_status` de `pending` para `reviewed` ou `archived`. Exemplo de consulta sem expor contato ou conteúdo na listagem:

```sql
select protocol, category, challenge_id, created_at, triage_status
from public.product_feedback
where triage_status = 'pending'
order by created_at;
```

O contato é informado pelo visitante e não verificado. Não habilita envio automático nem comprova autorização do destinatário. A confirmação da tela significa mensagem registrada; não promete resposta. A equipe responsável, frequência de triagem e política de retenção ainda precisam ser definidos. Nenhuma limpeza automática ou prazo de resposta foi implantado. Auditoria de ações de atendimento precisa ser definida antes de ampliar a operação.

## Notificação interna pelo Gmail

O usuário adiou a ativação do e-mail nesta publicação. O código e a fila estão preparados; `private.settings.feedback_mail_enabled=false` impede o agendamento de enviar notificações. A função SMTP não é necessária para receber feedback. Completar credencial, publicar a função, testar SMTP e habilitar o flag somente na retomada autorizada.

Destinatário e remetente autorizados: `devpedrohr@gmail.com`. Nenhum campo do visitante altera destinatário, remetente ou cabeçalhos. A notificação contém categoria, texto, protocolo, desafio escolhido e contato opcional identificado como não verificado; não inclui código, tokens, anexos ou identificador da sessão. A biblioteca SMTP é Nodemailer 9.0.1, restrita à função do servidor.

Cadastrar uma senha de app gerada pelo Google em **Edge Functions → Secrets**, como `GMAIL_APP_PASSWORD`. O SMTP configurado em Authentication não disponibiliza sua credencial para essa função. Não usar a senha normal da conta nem cadastrar credenciais em arquivos versionados ou no chat. O envio usa `smtp.gmail.com:465` com TLS e sem logs SMTP.

Quando explicitamente habilitado, Cron no Supabase verifica a fila a cada minuto. A função interna `feedback-mail` exige o segredo do coordenador; não faz parte da allowlist do navegador e não depende de o executor de código estar ativo. Um claim atômico processa uma mensagem por chamada. Sem senha, não reivindica nenhuma mensagem: os registros continuam `pending`. Após aceitação pelo Gmail e gravação do resultado, marca `sent`. Isso comprova aceitação SMTP, não chegada garantida à caixa de entrada.

Falha de SMTP, perda da confirmação após envio ou claim abandonado tornam a notificação `uncertain`, sem reenvio automático. Conferir pelo protocolo no Gmail e no banco antes de um administrador recolocar o registro em `pending`. O `Message-ID` é estável por protocolo; isso não é uma garantia de deduplicação do Gmail. O recebimento pelo formulário permanece confirmado por persistência, independentemente do resultado do e-mail.

## Integrações pendentes acordadas

- Áudio/vídeo: escolher bucket privado, autorização temporária por dono, inspeção isolada do arquivo real, quotas de bytes/IP/globais e limpeza de uploads abandonados. Validar limites e formatos antes de ativar o campo de anexos.
- Atendimento por e-mail ao visitante: verificar o contato, definir acesso da equipe, registro de respostas e prevenção de duplicação. A implementação preparada permite notificar somente a caixa interna autorizada; permanece desativada nesta entrega. Ativação do Gmail depende do segredo correto e de um teste conectado.
- Retenção: confirmar os períodos propostos na auditoria e implementar limpeza verificável; não tratar 30/90 dias como configuração vigente.
- Prática local: decidir a regra de execução e realizar protótipo isolado de uma linguagem, sem XP oficial, seguido de medições em dispositivos reais.
- Rede: a tela de resultado não cria chamadas de animação. O quiz mantém revalidação de dashboard/ranking/tentativa; código mantém polling. Redução desses pedidos exige snapshot autoritativo ordenado e medições comparáveis, ainda pendentes.

## Homologação conectada após publicação

Enviar uma mensagem de teste com identidade nova, guardar protocolo e conferir o registro administrativo. Repetir a mesma chave sem nova mensagem; testar conteúdo diferente com a chave, quarta mensagem na mesma hora e acesso negado pelos papéis do navegador. Verificar recuperação de resposta perdida e triagem restrita. Não usar mensagens ou progresso de usuários existentes como dados de teste.
