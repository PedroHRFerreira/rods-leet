# Rods Leet — ambiente de testes

Registro histórico da publicação de 7 de setembro de 2026. Para a auditoria de 30 de setembro e a preparação local do beta aberto, consulte [validação do beta](beta-readiness-2026-09-30.md) e [escopo da atualização](rods/specs/2026-09-30-open-beta-design.md). A configuração histórica abaixo não comprova disponibilidade atual.

## Beta aberto publicado — 30 de setembro de 2026

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
