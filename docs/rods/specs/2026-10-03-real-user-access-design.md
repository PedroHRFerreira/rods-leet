# Acesso para usuários reais — prioridade confirmada em 3 de outubro de 2026

O usuário confirmou a prioridade de liberar cadastro por e-mail, login Google e submissão oficial validada antes de publicar os novos cosméticos. Prazo desejado: 20h, America/Sao_Paulo, em 3 de outubro.

Atualização explícita do usuário durante a implementação: cancelar Brevo e cadastro por e-mail. O acesso passa a usar Google para criar/entrar na conta, acompanhado do convite opcional ao servidor Discord. O convite não autentica nem vincula perfis. Cadastro e recuperação por e-mail permanecem desativados; a configuração SMTP foi cancelada sem salvar credenciais.

- Preservar exploração e progresso de visitantes no cadastro por e-mail. Login em conta existente ou pelo Google abre a conta autenticada, sem mesclar perfis.
- Reutilizar Supabase Auth e o BFF: tokens permanecem cifrados no servidor, cookie HttpOnly/Secure, CSRF, rate limit, OAuth com PKCE e estado de uso único.
- Configurar Google apenas com os escopos básicos de identidade; credencial privada inserida pelo usuário no provedor, sem passar pelo chat.
- Confirmar cadastro, recebimento de e-mail, definição de senha, login, recuperação e logout no ambiente conectado antes de anunciar funcionamento.
- Submeter deve avaliar no executor isolado e registrar veredito/XP oficialmente. Validar solução correta, incorreta, erros e repetição; não ativar artificialmente o botão quando o serviço estiver indisponível.
- Publicar somente fluxos verificados; registrar bloqueios e dependências reais. As melhorias de estilos/molduras foram guardadas separadamente para concluir depois dessa prioridade.
