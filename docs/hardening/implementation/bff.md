# Implementação da fronteira BFF

## Design selecionado e restrições

Autorizado pelo usuário em 2026-09-05: corrigir problemas de segurança, publicar e validar o workflow. Pages Functions no domínio do produto; nenhum plano pago. Tokens OAuth ficam cifrados no servidor. Cookie opaco HttpOnly. O BFF não recebe service_role.

## Revisão e divergência

Os seis hashes E1–E6 de context.md foram novamente calculados antes da edição e coincidem integralmente. Base remota conhecida: 213bcb116a5c2c0952d11d0f487e5177a0e2553c; conferir novamente antes do envio.

## Componentes e pacotes ordenados

1. Migração privada: sessões, transações OAuth de uso único, nonces, limites atômicos e associação de idempotência ao corpo.
2. Serviço de sessão restrito por assinatura e API com verificação de assinatura mais identidade do usuário.
3. Pages BFF: OAuth PKCE, cookie opaco, criptografia, refresh com posse/CAS, CSRF e proxy com rotas permitidas.
4. Cliente: retirar tokens do navegador, preservar rascunhos, mudanças de conta e estados de erro.
5. Cabeçalhos, CSP, dependências, testes negativos e integração.
6. Implantar serviço antes de exigir assinatura; configurar segredos, publicar BFF, exigir assinatura e verificar navegador e GitHub Actions.

## Compatibilidade e migração

Sessões antigas do navegador não são convertidas: será necessário entrar novamente. Excluir somente as chaves antigas de autenticação deste projeto, preservando rascunhos. Durante a transição BFF_REQUIRED permanece desativado; depois da validação deve ficar ativado. Não remover autorização, convites, RLS, cotas ou transações existentes.

## Testes e critérios de aceite

Cobrir CSRF, origem, cookie, proxy/SSRF, bytes reais, timeout, assinatura, replay, acesso entre usuários, refresh concorrente, logout, expiração e idempotência conflitante. Executar testes existentes, build, verificação Deno, SQL, Python e navegador. GitHub Actions precisa terminar com sucesso para o commit publicado. Não afirmar ausência absoluta de vulnerabilidades.

## Desempenho e recursos

Armazenamento privado no Supabase já existente; sem novo serviço pago. Limites atômicos no banco e limpeza dos registros expirados. Não usar estado de processo como autoridade. Medir latência e erros; carga de 100 usuários não está homologada apenas por testes unitários.

## Rollout e rollback

API e migração são aditivas. Não publicar o cliente BFF sem os segredos necessários. Em falha, preservar catálogo e rascunhos, negar operações privadas. Reverter interface somente junto com decisão explícita sobre reabrir a API legada. Revogar sessões em incidente ou restauração; não restaurar tokens de uma cópia de segurança.

## Dependências operacionais

Executor permanece desativado: usuário ainda não tem conta E2B. Homologação de isolamento exige o executor real. Backup externo criptografado e ensaio de restauração dependem de destino disponível. Não marcar SEC-21, SEC-22 ou teste de carga SEC-24 como concluídos sem evidência. Tutor remoto também permanece desativado sem credenciais/cota.
