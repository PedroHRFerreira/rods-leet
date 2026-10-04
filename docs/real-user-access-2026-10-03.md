# Acesso e submissão — 3 de outubro de 2026

## Decisão atual

O usuário cancelou o uso do Brevo e dos e-mails transacionais. Essa decisão substitui a prioridade anterior de publicar cadastro por e-mail. Cadastro e recuperação por e-mail permanecem desativados (`EMAIL_REGISTRATION_ENABLED=false` e `VITE_EMAIL_REGISTRATION_ENABLED=false`). Não solicitar uma nova chave SMTP para esta publicação.

O acesso previsto é **Continuar com Google**: a primeira autenticação cria a conta, sem senha própria no Rods Leet. O Discord funciona como comunidade, por meio do convite opcional `https://discord.gg/6fBryhJTfP`; entrar no servidor não cria uma sessão autenticada no site.

Exploração e estudo como visitante continuam disponíveis. A autenticação Google abre os dados da conta autenticada, sem mesclar o perfil visitante. Compras e premiações semanais continuam exclusivas para contas cadastradas. Os novos estilos de nome e molduras permanecem separados da publicação prioritária de acesso e submissão.

## Fluxo Google revisado

1. O navegador inicia `POST /auth/start` com sessão de estudo, origem válida e token CSRF. O BFF aceita somente o provedor Google quando habilitado e aplica limite de tentativas.
2. O servidor gera PKCE S256, estado aleatório e uma transação cifrada vinculada à sessão original, com validade de dez minutos. O navegador recebe somente a URL de autorização e um cookie opaco `HttpOnly`, `Secure` e `SameSite=Lax`.
3. O callback público do Google é `https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/callback`. O retorno do Supabase para o aplicativo usa `https://rods-leet.pages.dev/auth/callback?state=<nonce>`; a configuração de URLs permitidas deve aceitar esse endereço e seu parâmetro de estado.
4. O callback do aplicativo consome a transação atomicamente, verifica estado, sessão original, expiração, cifra e parâmetros duplicados antes de trocar o código no servidor. Tentativas repetidas ou inválidas não fazem a troca.
5. A sessão autenticada recebe novo identificador e token CSRF. Tokens Google/Supabase permanecem cifrados no servidor; o retorno final é uma rota interna fixa. Falhas exibem mensagem genérica, sem reproduzir parâmetros ou mensagens do provedor.

A revisão estática não encontrou falha crítica nesse fluxo. Os testes existentes cobrem PKCE, vínculo com sessão, CSRF, expiração, adulteração, parâmetro duplicado e repetição. Isso não substitui concluir a configuração do cliente Google e validar a autenticação real em produção.

## Critérios antes de anunciar disponibilidade

- Configurar o cliente OAuth Google com identidade básica e a credencial privada diretamente no provedor, sem colocá-la no chat, repositório ou navegador do aplicativo.
- Confirmar a disponibilidade pública do cliente Google e um login real completo, incluindo retorno, identidade e logout.
- Manter os dois controles de cadastro por e-mail desativados na publicação.
- Verificar submissão oficial de solução correta e incorreta no executor isolado e que repetir a mesma submissão não duplica recompensas. A interface deve habilitar Submeter somente quando o serviço estiver pronto.
- Registrar a publicação e evidências reais separadamente. Este documento não declara Google ou submissões validados em produção antes dessas verificações.

Referências oficiais: [login Google no Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google) e [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls).

## Revisão de integração e aparência

Revisão das alterações de `functions/_lib/bff.ts`, `src/lib/bff-auth.ts`, `src/pages/AuthPage.tsx` e do limite de tentativas da função `session`: nenhum bloqueador crítico identificado no código de autenticação Google. O armazenamento SQL existente usa bloqueio de linha e exclusão da transação OAuth ao consumi-la; o código não depende apenas de desabilitar um botão no navegador para impedir repetição.

Foram inspecionadas as capturas da página local de acesso em 320 × 900 (`/tmp/rods-google-access-320.png`) e do erro em 1280 × 900 (`/tmp/rods-google-error-1280.png`). O botão Google, o aviso de não mesclar o visitante e a mensagem de erro permanecem visíveis e legíveis; não foi observado corte ou sobreposição nesses dois estados. As capturas são temporárias e não fazem parte da publicação. Essa inspeção não comprova a conclusão de OAuth contra o Google real.

Uma navegação adicional em Chromium real a `http://127.0.0.1:5198/conta`, em 320 × 900, confirmou um único botão de acesso Google e ausência de rolagem horizontal (`document.documentElement.scrollWidth <= innerWidth`). O lançamento inicial dentro do sandbox do sistema falhou; a repetição autorizada fora desse sandbox concluiu a verificação. Não foi necessário instalar Chromium nem alterar dependências.

Na inspeção direcionada dos imports de `src` e de `vite.config.ts`, não foram encontradas referências a dados do juiz privado nem às credenciais de servidor. O diretório `dist` disponível no momento da revisão continha 116 arquivos, sem caminhos `judge` e sem arquivos de mapas de código-fonte. A publicação final deve ser produzida novamente após qualquer alteração posterior; essa verificação não substitui a inspeção da publicação efetiva.

O usuário pediu que o domínio comprado `rodsleet.com` seja usado. Antes de liberar esse endereço, a origem do BFF, o retorno OAuth permitido no Supabase e a configuração do domínio no Cloudflare precisam concordar. O BFF rejeita um hostname diferente de `APP_ORIGIN`; portanto, trocar a origem sem redirecionar o hostname antigo pode deixar o frontend antigo sem acesso aos dados. O callback do cliente Google permanece no Supabase, mesmo quando o endereço público do aplicativo muda para `rodsleet.com`.

### Página pública de privacidade

A página `/privacidade` foi revisada contra a identificação do usuário no servidor e o armazenamento de rascunhos no gateway. O texto descreve os dados de estudo, ranking, cookies, infraestrutura e convite opcional ao Discord; não declara certificações, garantias absolutas de segurança nem uso de e-mail transacional.

Chromium acessou `http://127.0.0.1:5209/privacidade` em 320 × 900 e 1280 × 900. Nos dois tamanhos, a página continha quatro subtítulos, um contato `mailto:devpedrohr@gmail.com` e não apresentou rolagem horizontal. Capturas temporárias: `/tmp/rods-privacy-320-content.png` e `/tmp/rods-privacy-1280-content.png`. Foram reportados ao responsável pela implementação: guia de boas-vindas cobrindo a primeira visita, ausência de separação visual entre títulos/parágrafos e precisão do trecho sobre imagem Google (o servidor de perfil utiliza identificador, nome e e-mail; a imagem pode estar nos metadados do provedor). Esta evidência corresponde à versão anterior aos ajustes sugeridos.

## Evidências e operação atual

Cloudflare confirmou `rodsleet.com` ativo com SSL; uma navegação HTTPS abriu o site. A configuração final usa esse domínio como origem principal e permite exatamente `https://rods-leet.pages.dev` como alias. Cada hostname conserva seus próprios cookies e proteção CSRF; a transação OAuth também vincula o hostname. O endereço antigo permanece acessível para visitantes existentes, sem transferir ou mesclar perfis entre domínios.

Uma submissão real de JavaScript em `sum-two-integers` foi aprovada e registrou 100 XP. A tentativa deliberadamente incorreta em produção foi bloqueada pela revisão automática porque reduziria a recompensa do perfil; esse cenário foi validado em testes isolados. O executor passou nas verificações de JavaScript/Python, saída excessiva, erro e prazo. Foi iniciado como serviço transitório `systemd --user` (`rods-leet-executor`) e o túnel como container destacado `rods-leet-executor-tunnel`. Ambos permanecem independentes da conversa; a máquina precisa continuar ligada. O serviço transitório não garante retomada após reboot e um Quick Tunnel pode mudar de endereço ao reiniciar: reconectar o segredo `LOCAL_EXECUTOR_URL` quando necessário. Não é uma promessa de disponibilidade contínua.

Validação: 536 testes unitários na primeira integração; após a proteção de aliases, 72 testes focados de autenticação/BFF passaram. Foram validados 14 cenários de acesso em desktop/celular, incluindo Google com cadastro por e-mail desligado e acesso de contas antigas com senha. A credencial e um login Google real ainda precisam de confirmação operacional antes de declarar esse acesso pronto.
