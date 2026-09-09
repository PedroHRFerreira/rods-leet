# Executor permanente do beta

O executor é um serviço separado do site e do banco. O navegador nunca chama a
VM diretamente; a função `coordinator` chama o serviço através de um Cloudflare
Tunnel autenticado por `LOCAL_EXECUTOR_TOKEN`.

## Pré-requisitos

- VM Oracle Always Free com cgroup v2 delegado para Docker.
- Docker e Cloudflared instalados pela imagem oficial do fornecedor.
- Um domínio administrado pela Cloudflare. A compra do domínio depende de
  aprovação explícita do responsável pelo Rods Leet.
- Segredos exclusivos: `LOCAL_EXECUTOR_TOKEN` na VM e no Supabase,
  `COORDINATOR_SECRET` no Supabase e `TUNNEL_TOKEN` apenas na VM.

## Serviço

1. Construir a imagem `rods-leet-executor:local` a partir de `executor/Dockerfile`.
2. Executar `npm run executor:serve` como usuário sem privilégios, limitado a
   `127.0.0.1:8789`.
3. Criar unidade systemd com reinício automático e dependência de Docker.
4. Criar túnel nomeado cujo hostname aponta exclusivamente para
   `http://127.0.0.1:8789`.
5. Manter entrada pública da VM fechada; somente SSH administrativo restrito e
   conexões de saída do Cloudflared são necessárias.

## Homologação antes de ativar

- Confirmar `/health` autenticado como `ready`, depois `busy` durante um job.
- Executar `npm run executor:homologate` para as dez linguagens e SQL.
- Reiniciar a VM e confirmar que systemd, Docker e túnel retornam.
- Configurar `EXECUTION_PROVIDER=local`, URL HTTPS do túnel e token no Supabase
  somente depois de todos os testes passarem.
- Manter a capacidade inicial em um job simultâneo. O BFF devolve `busy` sem
  criar submissão, sem gastar cota e sem aplicar penalidade.
