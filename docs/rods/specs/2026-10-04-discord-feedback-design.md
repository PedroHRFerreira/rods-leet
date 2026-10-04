# Feedback no canal geral do Discord

Desenho confirmado pelo usuário em 4 de outubro de 2026.

- Retirar contato por e-mail do formulário e do contrato de novos feedbacks.
- Publicar novos feedbacks no canal geral do servidor Rods Leet: tipo, mensagem, nome público do perfil e link do desafio, quando autorizado no formulário.
- Avisar antes do envio que o conteúdo ficará visível à comunidade. Exigir confirmação explícita dessa publicação no contrato para impedir que clientes antigos publiquem mensagens privadas.
- Preservar protocolo, histórico privado anterior, cotas e idempotência; não publicar feedbacks históricos.
- Identidade e destino derivados pelo servidor. Webhook privado apenas no servidor, menções desativadas, chamadas com prazo máximo e sem redirecionamentos.
- Desativar a entrega anterior por Gmail. A nova fila distingue confirmação de registro de confirmação de publicação; falhas ambíguas não geram reenvio automático.
- Integração só fica pronta quando um feedback de teste enviado pelo domínio oficial aparecer no canal geral. Se faltar a credencial do Discord, manter essa limitação visível, sem prometer entrega.

Escopo estimado: formulário, contratos/validação, API, migração e fila de notificações, configuração, testes e documentação. Validação inclui segurança de acesso, privacidade dos registros antigos, duplicações, erros de entrega e tela responsiva.
