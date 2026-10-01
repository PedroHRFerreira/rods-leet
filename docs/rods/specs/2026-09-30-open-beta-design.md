# Primeiro beta aberto — escopo autorizado

O usuário autorizou em 30 de setembro de 2026: uso sem login obrigatório, tutor retirado da navegação, execução real livre e submissão simples com confirmação. Esclareceu que erros permitem novas tentativas e reduzem o XP em 15% por erro. As regras vigentes ficam em `docs/product-rules.md` e `spec/main/rules.md`.

## Comportamento de aceite

- Visitante entra sem formulário de login; sessão anônima segura identifica seus próprios rascunhos e progresso. Cookies/CSRF/propriedade de dados permanecem protegidos.
- Navegações desktop e móvel, cards e boas-vindas não oferecem tutor. A rota do tutor não integra o primeiro beta.
- Executar roda o programa real no executor isolado, mostra stdout/stderr e erros de compilação/execução, recebe entrada opcional e não tem cota diária de estudo. Há suporte a programa com console/print e ao formato de função existente.
- Submeter abre confirmação. Todos os casos obrigatórios comparam o resultado real com resultados esperados do juiz, fora do sandbox. Não há execução, aprovação ou XP fictícios.
- Ao errar, o aluno recebe explicação e pode corrigir; a recompensa futura cai 15% do XP base por rejeição, linearmente até zero. Erros do executor são isentos e não retiram XP já obtido.
- Ao aprovar, recebe XP uma única vez por desafio e segue ao próximo; execuções de estudo permanecem disponíveis.
- Rascunhos existentes são preservados. A identidade anônima é vinculada à sessão do navegador; não promete recuperação em outro dispositivo.

## Estrutura e entrega

Manter React/Vite, Pages Functions BFF, Supabase e executor Docker existentes. Sessão anônima usa Supabase Auth e cookie cifrado/opaco no BFF; não transforma endpoints em acesso irrestrito aos dados de todos. Alterações no banco vêm em nova migração.

A skill `agents-sdk` e a documentação oficial de [integração em projeto existente](https://developers.cloudflare.com/agents/getting-started/add-to-existing-project/) foram consultadas. A demanda não requer um novo agente persistente de IA; aproveitar os serviços atuais evita introduzir uma migração de plataforma na correção do beta.

Entrega paralela segue os seis papéis da skill do projeto: domínio, regra/validação isolada, UI principal, UI complementar, rotas/fluxo e integração visual/revisão. O coordenador integra e verifica os contratos.

## Validação

- Testes de sessão anônima, CSRF, acesso apenas aos próprios dados, cota diária removida, XP/rejeições/idempotência.
- PostgreSQL isolado com migrações e invariantes; declarar quando fila/Cron usam substitutos locais.
- Docker real para console/print, stdin, função existente, SQL, compilação, timeout, saída excessiva e erros.
- Navegador real para acesso aberto, ausência do tutor, confirmação, reprovação/repetição, aprovação/avanço e persistência em desktop/móvel.
- Formatação, lint, tipos frontend/BFF/Edge Functions, testes e builds.
- Implantação deve aplicar a migração, habilitar sessões anônimas no Supabase, publicar catálogo de 53 desafios e versão compatível do coordenador/executor. Validação local não confirma implantação remota.
