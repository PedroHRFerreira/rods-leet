# Recuperação do executor — 02/10/2026

## Causa confirmada

A imagem `rods-leet-executor:local` e o contêiner do executor não estavam presentes no Docker desta máquina macOS. O cliente `cloudflared` também não estava instalado. O catálogo e os modelos das linguagens continuam disponíveis. JavaScript/TypeScript têm prática local; nenhuma linguagem ganha aprovação oficial sem o executor remoto.

## Correção e validação da interface

O editor agora mostra o motivo da indisponibilidade junto ao botão Submeter, inclusive em JavaScript/TypeScript. README e estado de implantação diferenciam prática local, avaliação oficial e registros históricos.

`npm ci` sincronizou as dependências pelo lockfile. Os 466 testes unitários passaram, assim como lint, os builds frontend/BFF e tipos do BFF. O navegador confirmou prática local, bloqueio de submissões, preservação das dez linguagens de programação e os fluxos de confirmação/envio com API controlada: oito cenários desktop e a regressão offline no perfil mobile; a regressão foi repetida nos dois perfis após adicionar a conferência do tema claro. O aviso foi inspecionado em 320, 390, 800 e 1280 px no tema escuro e em 320/1280 px no tema claro. Essas verificações não comprovam disponibilidade nem XP em produção.

## Recuperação local

A reconstrução usa `executor/Dockerfile`, com a imagem-base Debian fixada por digest e os runtimes existentes. O gateway escuta somente em `127.0.0.1:8789`. A configuração privada original fica em `.env.executor`; o instalador local, o cliente oficial Cloudflare e a homologação ficam em `.supabase/executor/`, fora do Git. Nenhum token é registrado nesta documentação.

A imagem local foi reconstruída: `sha256:ef21b5de7d8cea003e9fa8be3e41b01cf51e2b2efe88b0cf83e62da1d24c216e`. Para repetir a homologação:

```bash
node --env-file=.env.executor executor/homologate-local.mjs
```

O roteiro confere programas livres e contratos de função nas dez linguagens de programação, consultas SQL em banco isolado, erros reais, limite de saída e duração. O manifesto esperado continua com SHA-256 `86f807ab6cf2ac57cbf33c6056216c2475e51064a01e35b4d7f37d689d8ae4cc`.

**Resultado real:** homologação encerrada com código zero. Python, JavaScript, TypeScript, Java, C#, C++, C, Go, Rust e Kotlin passaram em `program` e `function`; SQL passou em banco isolado. Entrada padrão em múltiplos casos, erro de programa, limite de saída, timeout e diagnóstico de compilação também passaram. Evidência local: `.supabase/executor/homologation.log`.

Os LaunchAgents `dev.rods-leet.executor` e `dev.rods-leet.tunnel` foram instalados e iniciados. Os serviços usam cópias privadas em `~/Library/Application Support/Rods Leet Executor/`, com a configuração do token em arquivo 0600, evitando depender do acesso do processo em segundo plano ao Desktop. Os plists ficam em `~/Library/LaunchAgents/`; não contêm o valor do token. Logs ativos: `gateway.log` e `tunnel.log` na pasta de suporte. Mudanças futuras no gateway/configuração exigem reinstalar essas cópias antes de reiniciar os serviços.

A saúde local autenticada retornou `200 {"status":"ready"}`. O túnel desta sessão, `https://sympathy-pst-phys-toolbar.trycloudflare.com`, encaminha a `127.0.0.1:8789`; `/health` sem credenciais retornou `401 {"error":"unauthorized"}`. Após a autorização explícita do usuário, o teste HTTPS com token também retornou `200 {"status":"ready"}`. O túnel autenticado está validado; isso não atualiza a conexão do coordenador em produção.

## Reconexão de produção

O acesso pelo navegador confirmou o projeto Supabase existente `bsjcuygtpiqyomnulpsw` (PedroHRFerreira's Project), saudável, com as funções `api`, `coordinator`, `session` e `feedback-mail`. O Cloudflare confirmou o projeto Pages `rods-leet`, com publicação automática de `main`. Nenhuma organização ou projeto novo foi criado.

Após autorização explícita, `LOCAL_EXECUTOR_URL` e `LOCAL_EXECUTOR_TOKEN` foram substituídos no painel do projeto existente em 02/10/2026 às 15:01:59 UTC. Os novos digests e a data foram conferidos sem registrar valores privados. No domínio `https://rods-leet.pages.dev`, uma sessão visitante nova executou `sum-two-integers` em Python, recebeu saída `5` e submeteu a solução real. A avaliação oficial confirmou aprovação e 100 XP. O seletor mantém as dez linguagens de programação e o botão de submissão voltou a ficar habilitado antes da aprovação.

Os testes privados, autenticação e regras de XP foram preservados. A publicação do aviso frontend usa a integração Pages existente; seu estado deve ser conferido no deployment correspondente. A homologação completa de todas as linguagens foi local; o teste oficial conectado descrito acima foi em Python.

Os serviços locais dependem deste computador e do Docker. Um Quick Tunnel pode mudar de endereço ao reiniciar; seu novo endereço precisa ser atualizado no coordenador. Não há hospedagem permanente contratada.
