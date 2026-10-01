# Início guiado e validação do catálogo

Escopo confirmado pelo usuário: sequência inicial de valores, variáveis, console/print, entrada, função e return; preservar o contrato da função do modelo; validar três soluções diferentes por desafio.

O problema mostrado nas capturas é um contrato não ensinado: `teste(a, b)` calcula a soma, mas o executor chama a função exportada `solve(input)`. A interface deve explicar nome, exportação, entrada e retorno antes de avaliar. Não inferir arbitrariamente qual função executar nem avaliar somente o exemplo fixo 2 + 3.

Adicionar passos guiados antes de Primeira soma. O iniciante completa trechos pequenos dentro da função já fornecida; instruções e modelos ensinam a sintaxe sem exigir que já saiba criar uma função. Explicar que a plataforma chama a função e passa a entrada; console/print mostra mensagens, return entrega a resposta. Mostrar progressão, pré-requisitos informativos e próximo desafio sem impedir navegação livre.

Mensagens de erro devem orientar sobre função ausente/não exportada, retorno ausente e acesso incorreto à entrada. Preservar rascunhos, código de diagnóstico e limites de isolamento. Erros de infraestrutura não penalizam XP; execução de estudo continua livre.

Validar três formas de solução por desafio usando o executor isolado e casos públicos e privados. Cobrir função tradicional, expressão/arrow e decomposição com função auxiliar ou variável intermediária. Para SQL, consultas equivalentes. Registrar linguagens, casos e limitações: variação sintática não comprova três algoritmos independentes nem todas as linguagens.

Entrega em seis papéis do fluxo paralelo do projeto: domínio, validação isolada, UI principal, erros/UI complementar, navegação e revisão visual. Coordenador integra e publica após testes, lint, tipos, build e validação em Chromium no desktop e celular.
