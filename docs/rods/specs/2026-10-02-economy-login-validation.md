# Validação local — moedas, loja e conta

Atualização aprovada em 2026-10-02; implementada no checkout atual, sem implantação remota.

## Resultado

- Node 22.22.1: typecheck, typecheck:bff, lint e build do frontend aprovados. Pages Functions compiladas com build:bff; log temporário em `/tmp`.
- `npm test`: 38 arquivos, 490 testes aprovados.
- Todas as migrações e cinco fixtures SQL aprovadas com `scripts/test-economy-sql.mjs` em PostgreSQL PGlite isolado. PGMQ, Cron e pg_net usam os doubles existentes; não é homologação dessas extensões ou de concorrência entre conexões reais.
- Suíte completa de navegador: 77 cenários passaram inicialmente; oito falhas eram expectativas antigas de boas-vindas/navegação e um seletor ambíguo de mensagem. Após correção, os três arquivos afetados passaram com 25 cenários e um skip previsto de tablet no projeto mobile. Resultado consolidado: 85 cenários únicos aprovados e um skip previsto. Nenhuma mudança de interface após a execução completa. A admissão de perfil foi protegida contra criação simultânea e revalidada na suíte SQL.
- Os 12 cenários novos passaram em desktop/mobile: compra com resposta perdida e mesma chave no retry, equipar/restaurar avatar, visitante sem compra, cadastro sem senha antes da verificação, confirmação sobrevivendo à troca de identidade, definição de senha, login inválido, login válido e recuperação genérica. As rotas remotas são interceptadas nos testes de interface; BFF/API têm testes separados.
- Formatação dos arquivos novos e principais alterações aprovada; diff sem erros de whitespace.

## Inspeção visual

- URLs locais: `/loja`, `/conta`, `/conta/confirmar`, `/conta/senha` e `/perfil`, em servidores de teste 5178, 5196 e 5197.
- Catálogo inspecionado em 1440, 1000, 800, 600, 390 e 320 pixels; sem overflow horizontal após carregamento. Inventário, aviso de login, confirmação, erro de resposta perdida e erro de login conferidos em desktop/mobile.
- Tema Oceano comprado e equipado no fluxo de interface; aparência clara/escura conferida. Cores de nome usam variáveis com contraste específico no tema claro. Perfil móvel e seis atalhos de navegação conferidos.
- Capturas temporárias inspecionadas: `rods-shop-catalog-320.png`, `rods-shop-success-dark-desktop.png`, `rods-shop-success-light-mobile.png`, `rods-theme-ocean-light.png`, `rods-auth-signup-mobile.png` e `rods-auth-error-mobile.png`, em `/tmp`. Capturas não são assets versionados.

## Limites e ativação

- Não foram enviados e-mails reais nem alteradas configurações de Auth hospedadas. Confirmação entre dispositivos, SMTP e preservação real do user ID devem ser homologados com o provedor conectado.
- A migração não foi aplicada em produção. Backend e frontend devem ser publicados na ordem documentada em `docs/deployment.md`, após backup.
- Carteira, desbloqueios, preços e inventário pertencem ao servidor; UI consome o gateway. As novas fronteiras são a economia transacional e os fluxos de e-mail no BFF, reutilizando as camadas existentes.

## Publicação por etapas

Migração, API e interface/BFF publicados; deployment final `010dbee9`. O usuário decidiu aguardar domínio e SMTP para ativar cadastro/recuperação. Controles de UI e BFF implementados e testados (duas novas verificações comprovam ausência de chamadas ao Auth enquanto desativados). Resultado atual: 492 testes unitários e 12 cenários locais de loja/login passaram; types, lint e build passaram. No site oficial, loja e dashboard responderam 200, nove itens, visitante identificado; telas verificadas em 1440/800/390/320 px sem overflow e sem erros JS. Aviso e botão bloqueado no cadastro comprovados, e rotas signup/recover responderam 503 sem envio. Texto da loja corrigido para informar moedas por estudo também aos visitantes. Capturas temporárias de loja e conta foram inspecionadas e removidas. Não houve compra real ou envio de e-mail em produção. Detalhes operacionais e limitações do backup estão em `docs/deployment-status.md`.
