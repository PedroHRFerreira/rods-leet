# Constelação de fundamentos

## Decisão aprovada

Substituir o mapa de Lógica por uma constelação de habilidades. No desktop, os
desafios serão nós conectados em um canvas interativo; no mobile, a mesma rota
será apresentada como uma mini constelação de contexto seguida de uma lista
guiada e um painel inferior de detalhes.

## Experiência desktop

- Usar React Flow para posicionar e conectar os nós sem assumir uma grade fixa.
- Organizar os 13 desafios em quatro clusters visuais — Fundamentos, Padrões,
  Raciocínio e Domínio — conectados pela ordem de `learningPath` já publicada.
- Destacar o desafio atual em âmbar; concluídos em verde; próximos em violeta;
  bloqueados em grafite.
- Exibir o detalhe do nó selecionado em um painel lateral, com tempo, XP,
  dificuldade, tags e ação contextual.
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
