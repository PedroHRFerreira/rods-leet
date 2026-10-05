# Acesso e continuidade — 05/10/2026

## Comportamento

O acesso separa **Entrar** e **Criar conta**. Cadastro Google usa a vinculação da identidade anônima existente; conquistas, XP e moedas mantêm o mesmo proprietário. Entrar em uma conta já existente abre o histórico dela, sem mesclar visitantes. O callback guarda o destino interno no estado PKCE cifrado e rejeita destinos externos. Rascunhos não são apagados ao iniciar o fluxo.

Perfil e limite exibem benefícios concretos, progresso até dez conclusões e ações distintas para cadastro/entrada. Após dez desafios distintos concluídos oficialmente, novos desafios exigem conta; revisão e prática dos concluídos continuam disponíveis. API e triggers de banco conferem o limite, inclusive tentativas abertas antes dele. Avaliações pendentes reservam a última vaga para evitar uma décima primeira conclusão concorrente. Prática com solução não entra no contador oficial.

Submeter não depende de uma consulta antiga de saúde. O clique confere o serviço antes de criar tentativa. Falha real mostra orientação para tentar novamente, preserva o código e não registra erro de resposta. Aprovação existente e envio em andamento continuam protegidos contra duplicação.

## Autenticação hospedada

Google já estava habilitado no Supabase. Vinculação manual estava desligada; foi ativada junto das URLs próprias de confirmação e da política de novas senhas com dez caracteres. Senhas anteriores continuam aceitas no login.

O usuário escolheu **Google por enquanto** depois da verificação de SMTP: a publicação dos templates foi recusada porque o projeto ainda usa o provedor padrão. Cadastro/recuperação por e-mail ficam preparados e testados localmente, mas desativados em produção (`EMAIL_REGISTRATION_ENABLED=false`, `VITE_EMAIL_REGISTRATION_ENABLED=false`). Não afirmar que a recuperação pública por e-mail está operacional. Uma ativação futura exige SMTP, publicação dos templates e teste de entrega real. Esse envio transacional é separado do feedback no Discord.

Build conectado: `VITE_BFF_ENABLED=true VITE_GOOGLE_LOGIN_ENABLED=true VITE_EMAIL_REGISTRATION_ENABLED=false VITE_LOCAL_PRACTICE_ENABLED=true npm run build`. Frontend e BFF devem ser publicados juntos. API: `supabase functions deploy api --project-ref bsjcuygtpiqyomnulpsw --use-api --import-map supabase/functions/deno.json`, mantendo `verify_jwt=true`.

## Executor

Gateway local retornou saúde autenticada `200 ready`. O túnel anterior registrou `Tunnel not found`; reiniciar o LaunchAgent gerou um novo endereço e conexão registrada. A revisão automática impediu transmitir o token ao túnel temporário, mesmo após autorização específica e verificação de procedência. A conexão do coordenador não foi alterada por esse caminho. Disponibilidade de submissões oficiais permanece uma pendência operacional até a reconexão ser validada.

## Preservação do estado publicado

A migração `202610040002_integrity.sql` existia somente no ambiente publicado; o histórico foi recuperado sem reaplicá-la. A API remota foi comparada antes da atualização: assinatura BFF obrigatória, protocolos de revisão, bloqueios de recompensa e filtros de conclusões elegíveis foram preservados. Totais agregados antes/depois da primeira migração de visitante: 166 perfis, 4.279 XP, 190 moedas.

## Validação

Tipos frontend/BFF/Deno, lint, testes de autenticação e submissão, invariantes PostgreSQL local e navegador Chromium. Layouts de acesso, perfil e limite inspecionados em 320/390/800/1440 px, claro/escuro, incluindo erros. Scripts e capturas ficam em diretório temporário. Resultado final da publicação e dos testes está em `deployment-status.md`.
