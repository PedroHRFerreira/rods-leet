# Economia, loja e login próprio

Desenho confirmado pelo usuário em 2026-10-02. Valores iniciais aprovados; avatares equipáveis adotados como padrão após a continuidade solicitada.

- Cadastro e login por e-mail/senha, confirmação de e-mail e recuperação de senha. Sem Google/GitHub nesta versão. Supabase Auth permanece a infraestrutura; credenciais e sessões passam pelo BFF existente.
- Exploração sem conta continua disponível. Converter a identidade anônima em conta preserva seu identificador e progresso. Entrar em uma conta existente usa o progresso daquela conta, sem mesclar recompensas.
- Moedas apenas por estudo: 10 por primeira conclusão distinta, 25 por nível alcançado, 50 no sétimo dia e 200 no trigésimo dia de cada sequência. Não vender/consumir XP nem alterar ranking por compras.
- Níveis e marcos concedem cosméticos gratuitos e liberam outros na loja. Avatares equipáveis no perfil, barra e ranking; cores de nome e temas adicionais. Temas claro/escuro básicos continuam gratuitos.
- Loja e inventário: dica consumível por 30 moedas; cosméticos permanentes a partir de 100. Manter dicas gratuitas e redução de XP existentes. Ofertas semanais determinísticas com preço e término visíveis.
- Saldo, propriedade, desbloqueio e preços validados no servidor, com transações e idempotência. Não simular compras/recompensas no modo de exploração desconectado.
- Moedas novas não são creditadas retroativamente pelo histórico anterior à migração. Preservar XP, conclusões, dicas e rascunhos já existentes. Recompensas de nível e sequência têm fontes únicas.
- Validar domínio, BFF, SQL, fluxos de loja/login, erros e responsividade. Entrega em seis papéis conforme a skill parallel-delivery; implantação e configuração de e-mails documentadas separadamente.

## Publicação em etapas aprovada

Em 2 de outubro, o usuário escolheu publicar moedas e loja e liberar cadastro somente após configurar domínio e envio de e-mail. Ainda não possui domínio próprio; escolheu serviço transacional gratuito. Brevo foi considerado, mas nenhuma conta, plano pago ou domínio foi contratado. Durante a espera, cadastro e recuperação ficam bloqueados no BFF e sinalizados na interface; visitantes continuam ganhando moedas, e compras exigem conta. O login por e-mail implementado permanece disponível para contas existentes.
