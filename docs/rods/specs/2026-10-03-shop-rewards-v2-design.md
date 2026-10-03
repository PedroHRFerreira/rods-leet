# Loja e recompensas v2

Desenho confirmado pelo usuário em 3 de outubro de 2026. Esta atualização amplia o valor das moedas e adiciona premiação ao ranking semanal. Não inclui mudanças no login ou ativação do cadastro.

## Experiência

- Catálogo com pelo menos 24 itens, entre personagens e skins, molduras de avatar, títulos de perfil, cores e temas completos. Personagens precisam ter ilustrações reconhecíveis; skins devem produzir uma diferença real. Raridades representam acabamento e formas de aquisição, sem vantagens competitivas.
- Prévia do perfil com nome, personagem, moldura e título, e prévia dos temas antes da compra. Comprar e equipar continuam operações distintas, com preço confirmado pelo servidor e confirmação acessível.
- Coleções Neon, Astral e Bosque, com progresso de itens adquiridos e título exclusivo entregue uma única vez ao completar o conjunto. Ofertas semanais com descontos reais e preços visíveis. Não usar urgência falsa, sorteios, caixas aleatórias ou venda de XP.
- Dica avulsa por 30 moedas e pacotes de 3/10 dicas com desconto. Toda dica mantém as regras de uso/redução de XP atuais. Conteúdo de aprendizado permanece gratuito.
- Metas de estudo: três primeiras conclusões distintas em um dia rendem 20 moedas extras; sete na semana rendem 75 moedas extras. Metas e saldo exibem progresso confirmado. A entrega é automática, exclusiva a contas registradas, por período e sem duplicação. O progresso começa na publicação, sem crédito retroativo.
- Manter 10 moedas por primeira conclusão, 25 por nível e bônus de 50/200 por sequência de 7/30 dias. Preservar IDs de itens existentes, inventário, saldo e presentes de marcos. Presentes de nível/sequência passam a aparecer como conquistas, sem cobrar por algo que o mesmo marco dá gratuitamente.
- Compras, inventário equipável, metas extras e premiação semanal exigem conta cadastrada. Visitantes podem estudar, ganhar as moedas-base e visualizar catálogo/ranking. Avisar claramente sobre o bloqueio e o estado atual de cadastro desativado; não prometer compra a visitantes.

## Ranking semanal

- Ranking geral atual permanece. Novo ranking semanal usa XP conquistado naquela semana, por eventos oficiais de progresso; nunca o XP total da conta. Não altera ou zera XP acumulado.
- Semana de segunda-feira 00h até a próxima segunda-feira 00h, no fuso America/Sao_Paulo. Intervalos de tempo são semiabertos, com início incluído e fim excluído.
- Apenas contas cadastradas com pelo menos três conclusões distintas na semana e XP positivo disputam os cinco prêmios. Dados de elegibilidade são verificados no servidor; não inferir cadastro a partir de nome de usuário.
- Prêmios: 1º 500 moedas, 2º 350, 3º 250, 4º 150, 5º 100. Cada posição concede um cosmético exclusivo permanente, indisponível para compra. Repetir a posição em outra semana concede moedas da nova semana, mas não duplica o cosmético.
- Empates: mais desafios distintos concluídos no período, instante em que a pontuação foi alcançada e identificador estável como último critério. Nenhum perfil com zero atividade recebe premiação.
- Resultados encerrados são persistidos; processamento agendado e recuperação após indisponibilidade usam a mesma operação transacional idempotente. Não premiar semanas anteriores à publicação. Exibir vencedores da última semana encerrada, valores e regras.

## Entrega e validação

Contratos/domínio, regras SQL/API, loja, perfil/ranking e integração visual seguem as seis funções da skill parallel-delivery, em ondas conforme os slots disponíveis. Cada arquivo tem um único responsável até a integração.

Critérios: compras e equipagem reais por conta registrada; preços/ofertas/pacotes confirmados; preservação de itens/saldo/XP; conclusão de coleções e metas sem duplicação; fechamento semanal correto no limite de fuso, empates determinísticos, exclusão de visitantes e semanas vazias; ranking geral intacto; prévias reais; teclado, movimento reduzido, temas claros/escuros e layouts 320/390/800/1440 px validados. Aplicar migração e publicar somente depois de tipos, lint, testes SQL/API/domínio e navegador pertinentes passarem. A ativação operacional será verificada, sem declarar login ou executor remoto disponíveis sem prova.
