# Validação da produção — 3 de outubro de 2026

URL oficial: https://rodsleet.com. Produção publicada pelo Wrangler; último artefato funcional verificado: `1ab69f3f`. Fonte: `6ecedd6`.

## Resultados reais no domínio oficial

| Fluxo                 | Resultado observado                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS e rotas diretas | Conta, privacidade, painel, desafios, trilhas, ranking, loja, perfil e feedback carregaram.                                                                                                                                           |
| Sessão visitante      | Perfil estável entre telas e recarregamentos no domínio oficial. O domínio antigo mantém sessão própria.                                                                                                                              |
| Submissão JavaScript  | `sum-two-integers` aprovado pela avaliação oficial; 100 XP e 10 moedas persistidos. Após aprovação, o botão não permite ganhar novamente a recompensa.                                                                                |
| Questionário          | `concept-values` aprovado; mais 20 XP e 10 moedas; progresso atualizado.                                                                                                                                                              |
| Busca                 | Busca global por “soma” abriu catálogo filtrado com oito resultados, incluindo desafio concluído.                                                                                                                                     |
| Loja                  | Catálogo, ofertas, coleções, metas e prévia de Cidade Neon funcionaram; compras de visitantes permanecem bloqueadas. Aviso antigo de cadastro desativado corrigido para reconhecer Google.                                            |
| Ranking               | Semanal e geral carregaram; prêmios de 500/350/250/150/100 moedas e regras de elegibilidade visíveis. Não antecipamos fechamento nem concedemos premiações manualmente.                                                               |
| Perfil e Discord      | XP e moedas persistidos; convite opcional aponta para `https://discord.gg/6fBryhJTfP`. Não enviamos mensagens à comunidade.                                                                                                           |
| Feedback              | Mensagem vazia rejeitada antes do envio. Entrega completa validada em suíte isolada, sem enviar mensagem real.                                                                                                                        |
| Google                | Após o usuário substituir o Client Secret, o login completou em rodsleet.com. A conta cadastrada existente abriu com 100 XP preservados. Logout encerrou a sessão; nova autenticação retornou ao mesmo perfil, com o mesmo progresso. |

## Proteções verificadas

A prática livre após aprovação retornou 5 para o exemplo público, sem nova recompensa. Uma rota inexistente mostrou a tela de caminho não encontrado. Retorno OAuth forjado com código e estado inválidos foi rejeitado, sem autenticar nem alterar o perfil existente.

Suíte completa E2E: 117 testes passaram em desktop e Pixel 7; um caso de tablet foi omitido no projeto mobile por repetição de cobertura. Compras, equipagem, inventário, animações individuais e fechamento semanal foram exercitados com dados isolados.

Typecheck frontend, typecheck BFF, lint, build e build BFF passaram. Tipos do Wrangler atualizados para o domínio oficial; o tipo interno aceita a origem previamente validada para preservar o alias exato.

- Requisições de origem externa ao início de login recebem 403. Compras, equipagem e submissões sem sessão recebem 401 em produção.
- Consulta somente de leitura confirmou que `anon` e `authenticated` não podem executar diretamente `public.shop_purchase` nem `public.shop_equip` no banco.
- CSP restritiva, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` e restrições de câmera, microfone, localização e pagamento presentes na produção.
- 545 testes unitários passaram, incluindo controle de sessão, CSRF, OAuth, reenvio, compras, recompensas e execução isolada. Isso não constitui garantia de ausência de vulnerabilidades.
- O executor utilizado em produção passou homologação isolada em JavaScript, TypeScript, Python, Java, C#, C++, C, Go, Rust, Kotlin e SQL. Casos de stdin, erro de compilação, erro em execução, limite de saída e tempo passaram sem modificar perfis.

## Limites e pendências

- Login Google e saída/reentrada estão aprovados em produção após substituição privada do segredo. Loja da conta cadastrada e inventário vazio carregaram; compras foram bloqueadas por saldo zero. Compra/equipagem reais não foram realizadas nessa conta; esses fluxos passaram na suíte isolada. A primeira autenticação com uma identidade Google inédita não foi exercitada ao vivo, pois o teste abriu uma conta já existente.
- Rotação Google concluída: segredo antigo desativado, novo ativo. Uma nova autenticação após essa desativação abriu o mesmo perfil cadastrado com 100 XP, confirmando o uso do novo segredo. Não exportamos nem armazenamos os valores dos segredos no projeto.
- O executor está em serviço systemd do usuário e túnel Docker. O túnel anterior falhou por conexão IPv6/QUIC; substituído por IPv4/HTTP2 e reconectado ao coordenador. A máquina precisa continuar ligada. O túnel temporário não oferece endereço persistente nem disponibilidade de produção garantida.
- A tentativa de teste incorreto em produção foi anteriormente bloqueada pela revisão automática por consumir tentativa/reduzir recompensa; os casos negativos foram testados em ambiente isolado.
- O painel de atividade e a sequência base usam UTC, conforme regra existente; metas e ranking semanal usam Brasília. Não alteramos retroativamente a contagem.
- As verificações de celular, compra, inventário, animações, estados de erro e fechamento semanal usam Chromium e dados isolados na suíte E2E. A tentativa de override de viewport no navegador de produção não mudou sua largura efetiva; não registrar como prova de celular em produção.
- Os cosméticos expressivos adicionais continuam preservados no stash; não fazem parte desta publicação de acesso.
