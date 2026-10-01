# Rods Leet

Beta gratuito para aprender programação. O catálogo tem 69 etapas: dez perguntas guiadas e 59 exercícios de código. A trilha de lógica começa pelas perguntas, sem editor, e segue para pequenas edições de código. A aplicação oferece progresso, trilhas, rascunhos por linguagem, SQL, ranking e perfil. O tutor fica fora da navegação enquanto não estiver pronto. Localmente, o modo exploração permite ler o conteúdo e editar código; avaliações e XP não são simulados.

## Executar localmente

Requisitos: Node.js 22 ou superior e npm.

```sh
npm ci
npm run dev -- --port 5178 --strictPort
```

Abra [Rods Leet local](http://localhost:5178). O parâmetro `--strictPort` evita abrir outra aplicação por engano quando a porta está ocupada.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de navegador usam a porta 5178. Para usar um Chromium já instalado, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. A suíte verifica catálogo, navegação, Monaco, persistência de rascunhos, SQL, estados indisponíveis, tema e páginas responsivas.

## Qualidade do código

O padrão do editor está em `.vscode/settings.json`, com Prettier e formatação ao salvar. `npm run format` formata os arquivos suportados; `npm run format:check` verifica o padrão sem modificar arquivos. A configuração compartilhada usa dois espaços, aspas duplas, ponto e vírgula e largura de 80 caracteres. Tema, ícones e fonte dependem das respectivas extensões e fontes instaladas no editor.

`npm run lint` verifica JavaScript, TypeScript e regras dos hooks React, incluindo frontend, BFF, funções Supabase, scripts e testes. `npm run lint:fix` aplica correções automáticas seguras; os problemas restantes exigem revisão. O workflow executa o lint com tolerância zero a avisos antes dos testes e do build. Arquivos gerados e dependências não são analisados. As poucas exceções locais têm justificativa junto ao código, como expressões regulares que bloqueiam caracteres de controle.

## Conectar o beta

O beta abre sem pedir login. O BFF, no mesmo domínio do site, cria uma identidade anônima e mantém os dados separados por pessoa. Configure `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BFF_SHARED_SECRET` e `BFF_ENCRYPTION_KEY` como variáveis de servidor no Cloudflare Pages; nunca use prefixo `VITE_` para segredos. `.dev.vars.example` documenta os nomes. A assinatura é compartilhada com as funções Supabase; a chave de criptografia fica somente no BFF. A chave administrativa do Supabase permanece somente nas funções Supabase.

A API valida a identidade no Supabase Auth. Sessões GitHub existentes continuam compatíveis, mas o login não faz parte da entrada do beta. `VITE_BFF_ENABLED=false` ativa uma demonstração local sem acesso remoto; para o site conectado, deixe essa variável ausente ou `true` e configure o BFF. Uma sessão anônima é vinculada ao navegador: não há recuperação do perfil em outro dispositivo nesta versão.

O procedimento de migrations, catálogo, ambientes, segredos, templates, orçamento e publicação está em [docs/deployment.md](docs/deployment.md). Os controles de confiança e os limites que precisam ser homologados estão em [docs/security.md](docs/security.md). As regras do produto estão em [docs/product-rules.md](docs/product-rules.md).

## Organização

| Área                          | Responsabilidade                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/pages`, `src/components` | Interface React e editor Monaco, carregado sob demanda                                             |
| `src/lib/gateway.ts`          | API autenticada, exploração pública e sincronização de rascunhos com revisão                       |
| `src/domain`                  | Regras de XP, dicas, sessões, orçamento, arquivos e diagnóstico consultivo                         |
| `src/content`                 | Catálogo público, enunciados, exemplos e templates                                                 |
| `judge`                       | Referências, testes oficiais, comparadores e editoriais privados; não entra no bundle do navegador |
| `supabase`                    | Banco, RPCs transacionais, API e coordenador de execução                                           |
| `executor`                    | Supervisor separado, adaptadores das linguagens e política SQL                                     |
| `scripts`                     | Catálogo, verificações do banco e backup/restauração                                               |
| `.github/workflows`           | Verificações de entrega e exportação diária criptografada, quando configurada                      |

O frontend nunca decide aprovação nem concede XP. Uma ação recebe uma chave de idempotência. Exercícios de código usam a fila e o executor isolado; perguntas são avaliadas diretamente pela API privada. Resultado, conclusão e XP são registrados no banco. Gabaritos e expectativas ocultas não são enviados no catálogo público.

Rascunhos ficam separados por conta, desafio e linguagem. A versão local é preservada quando a rede falha. Um conflito de revisão pausa a sincronização; substituir a versão remota exige a escolha explícita “Manter esta versão”. Nenhuma solução do aluno é executada no navegador ou no processo da API.

## Estado de entrega

- O catálogo possui 29 etapas de Lógica, 15 de Algoritmos, 15 de Estruturas de Dados e 10 de SQL. As outras seis trilhas indicam conteúdo futuro.
- As dez linguagens têm templates para os desafios algorítmicos compatíveis. O projeto de grafos usa TypeScript e múltiplos arquivos. Os editoriais dos demais exercícios usam a referência TypeScript quando não há tradução homologada; a interface identifica essa escolha.
- O modo Hard tem regras e persistência implementadas, mas sua abertura está desativada para o beta Normal. Projetos ampliados, diagnóstico empírico remoto e formação/monetização posteriores permanecem nas fases seguintes.
- No beta publicado, código é executado em Docker neste computador, por um túnel HTTPS protegido. Foram validadas três soluções por exercício de código. Execuções de estudo não têm limite de tentativas nem alteram XP; envios oficiais exigem confirmação e concedem recompensa uma única vez. Perguntas funcionam sem depender desse executor.
- O site permite os primeiros testes enquanto o computador e os serviços estiverem ativos. Hospedagem permanente do executor, backup externo e ensaio de restauração permanecem pendentes. Consulte as evidências atuais em [estado da implantação](docs/deployment-status.md); E2B e Workers AI não fazem parte do beta ativo.
- Não foram contratados serviços nem consumidos créditos externos nesta implementação. As rotinas de backup exigem configuração de destino externo e ensaio de restauração; a existência do script não significa que os dados já estejam protegidos por backup operacional.

As invariantes do banco podem ser verificadas em PostgreSQL isolado pelo roteiro de implantação. O teste local usa substitutos explícitos das extensões hospedadas. A fila real, as perguntas, a execução e o XP também foram verificados no beta, com perfis de teste separados.
