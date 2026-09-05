# Rods Leet — ambiente de testes

Atualizado em 5 de setembro de 2026.

- Frontend: https://rods-leet.pages.dev, Cloudflare Pages, repositório privado `PedroHRFerreira/rods-leet`, branch `main`.
- Build: Node 22, `npm run build`, saída `dist`. Novos commits em `main` publicam automaticamente.
- Supabase: projeto `bsjcuygtpiqyomnulpsw`, plano Free. Migrações `202609050001` e `202609050002` aplicadas; 50 desafios públicos publicados.
- Funções `api` e `coordinator` publicadas. `APP_ORIGIN` corresponde ao domínio acima. Segredos administrativos ficam no Supabase, nunca em variáveis `VITE_`.
- GitHub OAuth habilitado. Site URL: `https://rods-leet.pages.dev`; redirect permitido: `https://rods-leet.pages.dev/auth/callback`.
- O callback do aplicativo OAuth do GitHub é `https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/callback`, sem curingas.
- Google OAuth ainda não configurado. O botão só aparece com `VITE_GOOGLE_AUTH_ENABLED=true`, após configurar o provedor no Supabase.
- Cadastro continua restrito a emails verificados presentes em `private.invites`; limite de 100 perfis. A conta do proprietário foi admitida e o login real foi verificado.

## Custos e funcionalidades pendentes

Nenhum domínio comprado, plano atualizado ou serviço pago contratado neste deploy. O endereço `pages.dev` atende aos testes iniciais.

Execução remota e modo Hard permanecem desativados no banco. Crédito confirmado é zero; nenhuma execução E2B foi iniciada. Avaliação de código, aceite e XP exigem homologar o executor isolado e confirmar créditos disponíveis. O botão Executar deve responder com pausa sem consumir tentativa ou XP.

O tutor usa resposta editorial enquanto não houver credencial de Workers AI e validação de sua cota. Isso não representa inferência de IA ativa.

Backups externos e ensaio de restauração ainda precisam ser configurados antes de ampliar os convites. Consulte [operação e homologação](deployment.md) para os critérios restantes. Este ambiente permite testar cadastro, navegação e persistência; não declara homologação completa do beta.

## Verificações realizadas

- Build de produção e 147 testes locais aprovados antes da primeira publicação.
- Interface publicada, catálogo com 50 desafios, rota direta de desafio e editor carregando no navegador.
- Migrações aplicadas com PGMQ, Cron e pg_net reais.
- API sem sessão retorna 401 e permite CORS somente para a origem configurada.
- OAuth GitHub retorna ao aplicativo e apresenta perfil real com convite confirmado.
- Configuração do banco verificada: execução e Hard desativados, crédito zero e catálogo publicado.
- Rascunho sincronizado e preservado após recarga. O comentário usado na verificação foi removido, preservando o template inicial.
- Após tentar Executar com executor pausado: uma conta, um rascunho, zero submissões, zero execuções cobradas, zero rejeições e zero XP, confirmados no banco.
- Botão de login GitHub e erro do modo local verificados em navegador em desktop e 390 × 844, sem cortes no card. Typecheck e build aprovados após o ajuste do provedor Google.
