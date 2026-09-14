# Constelação de fundamentos

## Decisão aprovada

Substituir o mapa de Lógica por uma constelação de habilidades compacta, com a
composição da referência aprovada: rede espacial de nós luminosos dentro de um
único painel escuro e um detalhe lateral integrado. No mobile, a mesma rota
será apresentada como uma mini constelação de contexto seguida de uma lista
guiada e um painel inferior de detalhes.

## Experiência desktop

- Usar React Flow para posicionar e conectar os nós sem assumir uma grade fixa.
- Organizar os 13 desafios em quatro grupos espaciais compactos, usando verde,
  violeta, âmbar e coral. A rota pedagógica continua sendo derivada de
  `learningPath`; as cores são uma organização visual, não novos níveis.
- Mostrar cada desafio como um disco com ícone/símbolo; nome, dificuldade e
  estado permanecem acessíveis e são expostos no painel de detalhe.
- Destacar o desafio atual em âmbar com halo; concluídos em verde; bloqueados
  ficam dessaturados.
- Integrar o detalhe do nó em um painel lateral escuro, com estado, tempo, XP,
  dificuldade, tags e ação contextual.
- Exibir por padrão somente o contexto imediato do desafio selecionado (etapa
  anterior e próxima), com opção explícita para ver todas as conexões.
- Mostrar progresso da rota e o contexto de pré-requisito e próximo desafio no
  detalhe, sempre derivados da ordem de `learningPath`.
- Manter controles de teclado, foco visível, rótulos acessíveis e uma lista
  equivalente fora do canvas para leitores de tela.

## Experiência mobile

- Mostrar uma mini constelação estática como orientação visual, sem zoom ou
  arraste.
- Usar uma sequência vertical de cartões grandes como navegação principal.
- Abrir os detalhes em um painel inferior, com uma ação clara para o desafio
  atual ou disponível.

## Restrições e critérios de aceite

- Não criar progresso, regras de bloqueio ou dados novos no servidor.
- Derivar estados apenas do catálogo e das conclusões existentes no dashboard.
- Preservar acesso ao catálogo; o bloqueio representa a rota guiada, não uma
  restrição global.
- Não incluir chefões, badges, teleporte ou recompensas artificiais.
- Não haver overflow horizontal em 390 px, 700 px ou desktop.
- Cobrir seleção, estados dos nós e a experiência desktop/mobile em testes.
