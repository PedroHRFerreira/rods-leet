# Rods Leet

Implementação do beta gratuito de desafios de programação. A aplicação contém painel de progresso, catálogo de 50 desafios, dez trilhas, editor com rascunhos por linguagem, SQL, ranking, perfil e tutor. Sem credenciais, abre em modo exploração: conteúdo e edição funcionam; avaliações, XP e respostas do tutor não são simulados.

## Executar localmente

Requisitos: Node.js 20.19 ou superior e npm.

```sh
npm ci
npm run dev -- --port 5178 --strictPort
```

Abra [Rods Leet local](http://localhost:5178). O parâmetro `--strictPort` evita abrir outra aplicação por engano quando a porta está ocupada.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de navegador usam a porta 5178. Para usar um Chromium já instalado, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. A suíte verifica catálogo, navegação, Monaco, persistência de rascunhos, SQL, estados indisponíveis, tema e páginas responsivas.

## Conectar o beta

Copie `.env.example` para `.env.local` e preencha apenas as três variáveis `VITE_` com os valores públicos do projeto Supabase. Nunca coloque a chave de serviço, E2B ou Workers AI em variáveis `VITE_`.

OAuth usa Google/GitHub e callback `/auth/callback`. A API valida o convite no servidor; autenticar sozinho não concede acesso ao beta. Configure a URL de callback no Supabase e `APP_ORIGIN` com a origem exata do navegador, incluindo porta (`localhost` e `127.0.0.1` são origens distintas).

O procedimento de migrations, catálogo, ambientes, segredos, templates, orçamento e publicação está em [docs/deployment.md](docs/deployment.md). Os controles de confiança e os limites que precisam ser homologados estão em [docs/security.md](docs/security.md). As regras do produto estão em [docs/product-rules.md](docs/product-rules.md).

## Organização

| Área | Responsabilidade |
|---|---|
| `src/pages`, `src/components` | Interface React e editor Monaco, carregado sob demanda |
| `src/lib/gateway.ts` | API autenticada, exploração pública e sincronização de rascunhos com revisão |
| `src/domain` | Regras de XP, dicas, sessões, orçamento, arquivos e diagnóstico consultivo |
| `src/content` | Catálogo público, enunciados, exemplos e templates |
| `judge` | Referências, testes oficiais, comparadores e editoriais privados; não entra no bundle do navegador |
| `supabase` | Banco, RPCs transacionais, API e coordenador de execução |
| `executor` | Supervisor separado, adaptadores das linguagens e política SQL |
| `scripts` | Catálogo, verificações do banco e backup/restauração |
| `.github/workflows` | Verificações de entrega e exportação diária criptografada, quando configurada |

O frontend nunca decide aprovação nem concede XP. Uma ação recebe uma chave de idempotência; a API registra o snapshot e coloca o trabalho na fila. O resultado passa pelo comparador confiável e suas consequências são aplicadas no banco. Gabaritos e expectativas ocultas não são enviados no catálogo público.

Rascunhos ficam separados por conta, desafio e linguagem. A versão local é preservada quando a rede falha. Um conflito de revisão pausa a sincronização; substituir a versão remota exige a escolha explícita “Manter esta versão”. Nenhuma solução do aluno é executada no navegador ou no processo da API.

## Estado de entrega

- O catálogo possui 10 desafios de Lógica, 15 de Algoritmos, 15 de Estruturas de Dados e 10 de SQL. As outras seis trilhas indicam conteúdo futuro.
- As dez linguagens têm templates para os desafios algorítmicos compatíveis. O projeto de grafos usa TypeScript e múltiplos arquivos. Os editoriais dos demais exercícios usam a referência TypeScript quando não há tradução homologada; a interface identifica essa escolha.
- O modo Hard tem regras e persistência implementadas, mas sua abertura está desativada para o beta Normal. Projetos ampliados, diagnóstico empírico remoto e formação/monetização posteriores permanecem nas fases seguintes.
- A execução começa desativada. Preencher credenciais não basta: cada perfil precisa de template e homologação registrados. Ao faltar cota ou crédito, o produto preserva catálogo, editor e progresso.
- Os testes locais não equivalem à homologação do provedor. OAuth, Supabase hospedado com PGMQ/Cron, isolamento real E2B, dez toolchains, PostgreSQL 18, Workers AI e restauração externa precisam de credenciais e ensaios no ambiente do beta antes dos convites.
- Não foram contratados serviços nem consumidos créditos externos nesta implementação. As rotinas de backup exigem configuração de destino externo e ensaio de restauração; a existência do script não significa que os dados já estejam protegidos por backup operacional.

As invariantes do banco podem ser verificadas em PostgreSQL isolado pelo roteiro de implantação. O teste local usa substitutos explícitos das extensões hospedadas; fila real, recuperação de falhas e isolamento do executor ainda precisam passar pela fase zero.
