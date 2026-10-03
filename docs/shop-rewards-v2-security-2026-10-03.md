# Segurança da loja e das recompensas v2

Escopo: carteira, compras, inventário, metas e premiação semanal. O navegador solicita operações; identidade, preço, elegibilidade, quantidade de dicas e crédito são verificados no servidor. Alterar a tela ou os dados locais não altera a carteira oficial.

## Evidências locais

- API: identidade e saldo falsificados não são encaminhados aos RPCs; visitantes são recusados; preços negativos, fracionários e em texto são rejeitados; preço desatualizado não anuncia compra concluída; quantidade de dicas é definida pelo catálogo do banco. `tests/shop-api.test.ts`.
- BFF: a consulta semanal aceita somente a rota GET exata, sem identidade, período ou prêmio escolhidos pelo cliente. Cabeçalhos de identidade e autorização falsos não substituem a sessão criptografada. `tests/weekly-ranking-transport.test.ts`. Testes existentes também verificam origem, CSRF, cookies e assinatura com nonce contra reenvio.
- PostgreSQL: os papéis `anon` e `authenticated` não conseguem alterar moedas, XP, inventário, molduras ou resultados, nem executar os RPCs privilegiados. Comprar um prêmio, equipar item não adquirido, repetir uma operação e trocar seu conteúdo são verificados. Catálogo, ofertas, coleções, metas, fuso, elegibilidade, empates, semanas vazias e resultados persistidos têm fixtures isolados. `tests/fixtures/shop-rewards-v2.sql` e `supabase/tests/economy.sql`.
- Concorrência real: oito conexões simultâneas para a mesma compra geram uma cobrança; oito chaves diferentes não permitem gasto além do saldo; um cosmético permanente é cobrado uma vez; fechamento e recuperação concorrentes concedem um único prêmio e cosmético. Carteira e ledger continuam iguais. `scripts/test-economy-concurrency.py`, incluído no CI.
- Apresentação: cores, temas, personagens e molduras usam identificadores conhecidos. Valores falsos, chaves de protótipo e tentativas de inserir CSS ou marcação são recusados pelos helpers; nomes e títulos usam texto React. `src/components/CosmeticAvatar.test.ts`.
- Dependências: o Rods SDK é utilizado exclusivamente por ferramentas locais e foi classificado em `devDependencies`, preservando as versões. A auditoria de produção (`npm audit --omit=dev --audit-level=high`) passou sem vulnerabilidades reportadas. A cadeia de desenvolvimento ainda contém `braces` com [aviso sem versão corrigida](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); ela não recebe padrões enviados pelos usuários do site e não é importada por frontend/BFF/Edge Functions. A classificação não corrige a biblioteca local.

## Limites da evidência

Os testes de banco usam PostgreSQL descartável e doubles de Cron/PGMQ/pg_net. Eles comprovam transações e privilégios, mas não a execução do agendamento real. A publicação exige conferir os jobs no Supabase e o catálogo/API no ambiente conectado. As compras positivas no navegador usam respostas de teste; não criar saldo artificial em contas reais para validar a loja.

Não há promessa de invulnerabilidade. Mudanças futuras em autorização, catálogo ou saldo devem preservar essas verificações. Chaves privilegiadas continuam no servidor e não fazem parte do pacote do navegador.
