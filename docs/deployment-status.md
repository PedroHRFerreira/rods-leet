# Rods Leet — ambiente de testes

Registro histórico da publicação de 7 de setembro de 2026. Para a auditoria de 30 de setembro e a preparação local do beta aberto, consulte [validação do beta](beta-readiness-2026-09-30.md) e [escopo da atualização](rods/specs/2026-09-30-open-beta-design.md). A configuração histórica abaixo não comprova disponibilidade atual.

## Beta aberto publicado — 30 de setembro de 2026

### Confirmação, reações e progresso — 1 de outubro de 2026

Primeira entrega da auditoria de experiência publicada em `3de1888`, Pages `e5329402-02bf-4469-95b6-52c4c2397511`. A opção de dispensar confirmação é persistida neste navegador por identidade e por tipo (pergunta/código), somente ao confirmar; pode ser reativada no perfil. Resultados oficiais recebem uma reação breve, com movimento reduzido respeitado e sem repetição após reload. O progresso mostra etapas realmente concluídas e restantes do módulo ou trilha, separado da posição editorial. Avaliação, XP e testes privados continuam no servidor; feedback com mídia e prática local permanecem entregas posteriores.

Validação local: 297 testes unitários e 49 cenários de navegador aprovados; um cenário exclusivo de tablet omitido no projeto mobile. Tipos do frontend/BFF, lint, formatação, build e build do BFF passaram. Revisão independente por subagentes e inspeção Chromium em desktop/mobile, temas claro/escuro, teclado, acerto/erro, falha técnica e movimento reduzido. O CI completo da branch passou em [36908686149](https://github.com/PedroHRFerreira/rods-leet/actions/runs/36908686149), incluindo validações do servidor, SQL e banco local. Assets ativos conferidos contra o build local (`index-CfTUC9zo.js`, `index-CrOkvpL9.css`).

Teste conectado em produção com sessão anônima nova: cancelar não salva a preferência; erro oficial seguido de acerto concede 17 XP; aprovação de outra pergunta atualiza o progresso de 0 para 2 de 10; reload preserva conclusão sem repetir reação; preferência de código continua independente; perfil reativa a confirmação. Nenhum erro de JavaScript observado. Capturas temporárias de acerto, erro e mobile inspecionadas. Usuários existentes não foram alterados.

Limites constatados nesta verificação: o preview publica os assets, mas `/api/session` retorna 503, enquanto o domínio oficial retorna 200; a configuração conectada de preview requer homologação própria. O executor e o Quick Tunnel não estão ativos nesta máquina e a imagem `rods-leet-executor:local` não existe no contexto Docker `orbstack`. A tela oficial apresenta execução indisponível sem falsa conclusão; aprovação real de código não pôde ser revalidada em produção. Os testes locais de execução/aprovação passaram com API controlada, sem substituir essa lacuna operacional. Esta entrega não recriou imagem, túnel, credenciais ou homologação do executor.

### Revisão de manutenção — 1 de outubro de 2026

Atualizadas somente as dependências indiretas de produção `fast-uri` de 3.1.7 para 3.1.8 e `ip-address` de 10.7.0 para 10.7.2. Auditoria de produção: zero vulnerabilidades; 280 testes e compilação aprovados após a atualização. As correções correspondem aos avisos dos mantenedores de [fast-uri](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj) e [ip-address](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-j6r3-76f7-8jcv). A auditoria completa ainda aponta dois alertas moderados e cinco altos em ferramentas de desenvolvimento; não foi aplicada atualização principal do Vitest nem mudança ampla de ferramentas.

README, exemplos de ambiente e roteiro de operação agora descrevem o catálogo de 69 etapas, as perguntas antes do código, o acesso anônimo, o BFF no mesmo domínio e o contrato de função. O roteiro diferencia o executor Docker ativo das opções futuras de E2B e tutor. Executor e túnel foram verificados ativos; disponibilidade permanente e backup/restauração seguem sem comprovação nova.

Correções publicadas em `7e2d0ac`, Pages `cd818373-a906-4339-ba34-fb0721a4d549`. A proposta personalizada do RODS foi finalmente gerada e revisada, mantendo as quatro skills preservadas byte a byte. A aplicação aguarda a escolha final no assistente; veja a [prévia dos arquivos](rods/specs/2026-10-01-skills-proposal-review.md). Para a geração foram usados somente um adaptador temporário de resposta estruturada e uma cópia temporária do CLI com prazo ampliado; o CLI instalado e a dependência RODS do projeto foram preservados.

### Perguntas antes do código — 1 de outubro de 2026

A trilha de lógica começa por dez perguntas guiadas sem editor: valores, variáveis, números, textos, verdadeiro/falso, funções, parâmetros, return, export e classes. Só depois aparecem os seis modelos para pequenas edições de código. O catálogo tem 69 etapas (dez perguntas e 59 exercícios de código), com 29 etapas na lógica. IDs, rascunhos e conclusões dos exercícios existentes foram preservados.

As perguntas recebem explicação curta, três alternativas, confirmação, feedback e próximo passo. A avaliação privada ocorre no servidor e grava tentativa, conclusão e XP na mesma transação, sem depender do executor ou consumir seus créditos. Cada pergunta oferece 20 XP antes das penalidades; erro reduz 15% desse valor inicial e a aprovação concede XP uma única vez. Repetir um envio após resposta perdida usa a mesma chave; novas escolhas ficam pausadas até confirmar o resultado. Gabaritos não fazem parte dos arquivos do navegador.

A migração `202610010001_concept_quizzes.sql` foi primeiro exercitada em transação revertida: propriedade, opção inválida, repetição sem contar dois erros, chave reaproveitada com resposta diferente, 17 XP após um erro, aprovação única, dez conclusões com um bônus de dica e ausência de jobs com execução desativada. Depois foi aplicada e registrada pelo comando oficial de reparo, autorizado pelo usuário. A API mantém sua autenticação existente.

Validação: 280 testes unitários; todos os 43 cenários de navegador aplicáveis passaram após atualizar nomes das telas e aguardar o carregamento antes de reabrir o guia mobile (um cenário exclusivo de tablet fica pulado no projeto mobile). Chromium verificou as dez perguntas em quatro larguras e dois temas (80 páginas), mais o mapa de 29 etapas, sem editor nas perguntas nem rolagem horizontal. Teclado, confirmação, erro, recuperação de envio e avanço foram inspecionados. Os 177 códigos anteriormente homologados seguem preservados; perguntas têm avaliação de suas 30 alternativas, separada da execução de código.

Publicado no GitHub em `966fd38`, com implantação Pages `5549c7ee-1b57-49ca-a3bb-b0d5128abf05` concluída antes da sincronização das 69 etapas. A verificação no site usou um perfil anônimo novo: dez perguntas aprovadas, primeiro erro contado uma única vez, primeira recompensa de 17 XP, demais recompensas de 20 XP e total de 197 XP. Repetir envios não duplicou pontos; a próxima recomendação foi `literal-number`. O filtro de Python manteve as perguntas e a execução real do primeiro exercício mostrou a mensagem do console e o retorno 7 sem conceder XP. O cabeçalho das etapas passa a dizer “Desafio”, adequado tanto às perguntas quanto ao código. Compilação e tipos do BFF passaram novamente após esse ajuste de texto.

### Revisão de linguagem e usabilidade — 1 de outubro de 2026

Interface publicada no commit `11a00d2`, Pages `18fd25ba-f71d-4b51-bf29-5a0074a3cf00`, e conferida no site. O endereço anterior do Quick Tunnel deixou de resolver apesar do serviço ativo; o túnel autorizado foi reiniciado e somente `LOCAL_EXECUTOR_URL` foi atualizado para `https://calcium-alloy-returning-walt.trycloudflare.com`. Token e isolamento preservados. Execução real confirmou novamente erro orientado sem XP, soma com função auxiliar e console, e aprovação do primeiro passo com 30 XP e indicação de Seu primeiro texto.

As seis lições iniciais apresentam a ação e o resultado esperado antes da explicação. Os exemplos usam os valores pedidos na tarefa. A orientação curta aparece também junto ao editor; os detalhes da função ficam recolhidos nas etapas iniciais. O exemplo auxiliar da primeira soma usa os dois campos recebidos em `input`. O guia de boas-vindas aponta para o primeiro passo, as dificuldades aparecem em português e os avisos de envio explicam a redução sobre o XP inicial do desafio.

Validação: 253 testes unitários, dez testes de navegador focados no guia, rascunhos, linguagem, execução e envio, lint e compilação passaram. Inspeção local em Chromium em 390, 768, 844 e 1440 px, nos temas claro e escuro: sete desafios e a trilha sem rolagem horizontal. Telas de erro e aprovação verificadas em 390 e 1440 px com APIs simuladas e XP zero no erro de execução. Capturas temporárias em `/tmp/rods-beginner-*`. Textos públicos sincronizados nos 59 desafios e API publicada mantendo a autenticação existente. Esta revisão não altera as soluções nem os critérios de aprovação já homologados.

### Início guiado e validação completa

O catálogo agora tem 59 desafios e a trilha de lógica tem 19 etapas. Seis passos precedem Primeira soma: número, texto, variável, console/print, entrada e transformação dentro da função. Os modelos desses passos executam sem lançar “Não implementado” e pedem uma edição pequena. JavaScript é a escolha inicial na lógica; seleção explícita, preferências e rascunhos existentes são preservados. O mapa recomenda uma sequência, mas permite visitar qualquer etapa. Avançar pelo link do próximo desafio mantém a linguagem escolhida.

A orientação explica a função fornecida, chamada automática, entrada e return. A função auxiliar `teste(a, b)` pode ser usada dentro de `solve(input)`; chamada manual com outro nome não substitui o ponto de entrada. Erros de função ausente e retorno indefinido agora trazem orientação acessível. Submissões não expõem diagnósticos dos casos privados.

Todas as 177 variantes de código (três por desafio) passaram pelo executor isolado, com 981 casos públicos e privados. Os seis novos passos também passaram em Python e TypeScript: 44 casos adicionais, total de 1.025 execuções. A cobertura principal usa JavaScript, TypeScript em shortest-path e SQL; as variantes verificam formas de escrever a lógica canônica, sem alegar três algoritmos independentes nem cobertura de todas as linguagens. Veja [relatório por desafio](../judge/validation/catalog-report.md).

A validação revelou dois defeitos de codificação SQL: leitura de texto como bytes e falha ao carregar dados acentuados. As conexões do preparo e da consulta usam UTF-8; todas as 30 variantes SQL passaram sem mudar o comparador. Imagem local corrigida: `sha256:2ef3a4758df9ed1cb5af52d0a9b5907b2d09dce5ee9ab20150a1ba81f280b3a4`.

API e coordenador atualizados; 59 definições públicas sincronizadas. Nova sessão anônima no site confirmou erro orientado para a função da captura, execução da soma com função auxiliar e console, aprovação do primeiro passo com 30 XP, recomendação do próximo passo e aprovação SQL com 100 XP. Verificações locais: 253 testes, lint, tipos e build; suíte de navegador com 39 testes aprovados e um caso de tablet omitido no projeto mobile (o mesmo caso passou no projeto desktop). Os testes de rascunho TypeScript foram corrigidos para declarar sua linguagem após a introdução do padrão JavaScript.

### Histórico da publicação inicial

Esclarecimento posterior do usuário: a interface usa somente a função do modelo. Não oferece seletor de forma de execução. console/print aparecem na saída de estudo; o coordenador avalia o retorno da função separado dessas mensagens. Modelos de função voltam a ser o ponto inicial, sem substituir rascunhos existentes automaticamente. O contrato de programa continua no servidor por compatibilidade, sem opção na interface.

Interface de função publicada no commit `7a805a3`, Pages `8bb993f8-e13f-4913-abc8-4f79a3fb7d89`. Executar chama a função com o primeiro exemplo público e mostra as mensagens e o retorno, sem avaliar a resposta. Submeter verifica os casos oficiais pelo retorno, ignorando as mensagens de diagnóstico. Teste real em nova sessão anônima confirmou `diagnostico` seguido de `5`, rejeição do retorno incorreto, aprovação com 85 XP após um erro e nova execução com retorno `7` após a aprovação, sem XP adicional. Seis testes focados do coordenador e leitura da saída passaram; editor verificado em desktop e celular.

Código enviado à branch `main` no commit `a89487a`; publicação Pages `2853bdd8-4a2e-4c38-9352-cff54892d647`. Migração `202609300001_public_beta.sql` aplicada; Anonymous Sign-Ins habilitado, preservando os demais parâmetros remotos. API, sessão e coordenador publicados. API mantém `verify_jwt=true`; acesso anônimo usa uma identidade válida, sem dispensar autenticação interna.

Catálogo sincronizado com 53 desafios. Imagem Docker local atualizada para a versão homologada de programas livres, digest `sha256:33f1992a606a5943e906d2cffc6585e0189242c8c02204bc0383fd7f8857c2d1`. Gateway e Quick Tunnel supervisionados como serviços de usuário `rods-leet-executor` e `rods-leet-tunnel`, com reinício automático. O túnel público foi explicitamente autorizado e exige o token privado do gateway; Docker não é exposto.

Teste real em sessão anônima nova: execução de `print(2+3)` retornou `5`; solução incorreta foi rejeitada sem XP; correção passou os casos oficiais e concedeu 85 XP; após aprovar, uma execução de estudo retornou `7` sem novo XP. O Cron existente processou os trabalhos. No navegador publicado, tutor ausente, primeiro fundamento disponível, editor com execução habilitada e confirmação de submissão funcionando. Conta GitHub anterior manteve 100 XP e uma conclusão.

**Limite operacional:** execução depende deste computador, Docker e serviços ativos. Os serviços atuais são transitórios da sessão de usuário; não garantem retorno após reiniciar o computador. Reiniciar o Quick Tunnel pode trocar seu endereço: atualizar `LOCAL_EXECUTOR_URL` no arquivo privado `.env.supabase-executor` e nos secrets do coordenador. Não há hospedagem permanente do executor nem custo de nuvem contratado. Hard continua desativado.

O plano personalizado do RODS foi aprovado, mas a geração de arquivos pelo CLI ainda falhou por timeout/resposta inválida. As oito skills de scaffolding estão versionadas; a personalização de onze skills permanece pendente.

- Frontend: https://rods-leet.pages.dev, Cloudflare Pages, repositório privado `PedroHRFerreira/rods-leet`, branch `main`.
- Build: Node 22, `npm run build`, saída `dist`. Novos commits em `main` publicam automaticamente.
- Supabase: projeto `bsjcuygtpiqyomnulpsw`, plano Free. Migrações até `202609070005` aplicadas; 53 desafios públicos publicados.
- Funções `api` e `coordinator` publicadas. `APP_ORIGIN` corresponde ao domínio acima. Segredos administrativos ficam no Supabase, nunca em variáveis `VITE_`.
- GitHub OAuth habilitado. Site URL: `https://rods-leet.pages.dev`; redirect permitido: `https://rods-leet.pages.dev/auth/callback`.
- O callback do aplicativo OAuth do GitHub é `https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/callback`, sem curingas.
- O acesso público usa somente GitHub OAuth. Google e login por e-mail não fazem parte da interface.
- A migração `202609190001_open_github_access.sql` remove a lista de convites e o limite de perfis: qualquer conta GitHub com e-mail verificado pode criar seu perfil.

## Custos e funcionalidades pendentes

Nenhum domínio comprado, plano atualizado ou serviço pago contratado neste deploy. O endereço `pages.dev` atende aos testes iniciais.

A avaliação do modo Normal está ativa por um executor Docker local, exposto ao coordenador por Cloudflare Quick Tunnel. As dez linguagens algorítmicas e SQL foram homologadas na imagem `local-docker-v1`. O custo monetário dos jobs está configurado como zero, sem E2B, Oracle, Render, assinatura paga ou método de cobrança.

O Quick Tunnel é temporário e depende deste computador, do Docker, do gateway e do processo do túnel permanecerem ativos. Reiniciar o túnel muda o endereço e exige atualizar `LOCAL_EXECUTOR_URL` no Supabase. Um túnel nomeado e estável exige um domínio administrado na Cloudflare; nenhuma compra foi feita. O modo Hard permanece para a fase 2.

O tutor usa resposta editorial enquanto não houver credencial de Workers AI e validação de sua cota. Isso não representa inferência de IA ativa.

Backups externos e ensaio de restauração continuam pendentes. Consulte [operação e homologação](deployment.md) para os critérios restantes.

## Verificações realizadas

- Build de produção e 147 testes locais aprovados antes da primeira publicação.
- Interface publicada, catálogo com 53 desafios, rota direta de desafio e editor carregando no navegador.
- Migrações aplicadas com PGMQ, Cron e pg_net reais.
- API sem sessão retorna 401 e permite CORS somente para a origem configurada.
- OAuth GitHub retorna ao aplicativo e apresenta o perfil real da conta autenticada.
- Configuração do banco verificada: execução e Hard desativados, crédito zero e catálogo publicado.
- Rascunho sincronizado e preservado após recarga. O comentário usado na verificação foi removido, preservando o template inicial.
- Após tentar Executar com executor pausado: uma conta, um rascunho, zero submissões, zero execuções cobradas, zero rejeições e zero XP, confirmados no banco.
- Botão de login GitHub e erro do modo local verificados em navegador em desktop e 390 × 844, sem cortes no card. Typecheck e build aprovados após o ajuste do provedor Google.
- Gateway rejeita chamadas sem credencial; sandbox bloqueia rede, limita CPU, memória, processos, tempo e saída, e não monta diretórios do host.
- Referências de Python, JavaScript, TypeScript, Java, C#, C++, C, Go, Rust, Kotlin e SQL passaram pela mesma imagem Docker homologada.
- Em produção, **Executar** passou os três exemplos públicos. **Submeter** passou os testes oficiais, concedeu 100 XP uma única vez e atualizou o desafio como concluído.
- O erro 500 em `POST /api/runs` foi corrigido com filtros explícitos nas atualizações do registro único de configuração, conforme exigido pelo papel da API do Supabase.

## Atualização BFF, lint e formatação

Migração `202609050003_security.sql` aplicada: armazenamento privado de sessões cifradas, transações OAuth de uso único, nonces, limites atômicos e idempotência vinculada ao conteúdo. Função `session` publicada. BFF Pages Functions usa cookies HttpOnly/Secure/SameSite, CSRF, rotas permitidas e cabeçalhos de segurança. Segredos do BFF foram autorizados e configurados no projeto Cloudflare de produção; nenhuma chave administrativa do Supabase foi enviada à Cloudflare.

Ao finalizar o rollout, `BFF_REQUIRED=true` deve estar ativo na API. O caminho assinado omite o prefixo `/functions/v1`, removido pelo gateway Supabase. API também valida JWT GitHub e propriedade dos dados. O registro da publicação e dos workflows deve ser conferido no commit implantado; implementação local não substitui essa verificação.

ESLint e Prettier integram o workflow. O tutor remoto continua indisponível; o fallback editorial permanece ativo e não gera cobrança.
