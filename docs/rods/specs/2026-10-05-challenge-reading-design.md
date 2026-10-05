# Leitura e edição dos desafios

Escopo confirmado pelo usuário em 2026-10-05 ao pedir para continuar.

- Enunciados apresentam objetivo, entrada, saída e regras; não incluem código resolvido nem estratégia de implementação.
- Dicas existentes mantêm orientações e fórmulas. Exemplos públicos continuam ilustrando o comportamento esperado.
- Remover orientação resolvida dos primeiros passos e do guia da função; preservar ajuda sobre a interface do modelo.
- Manter regras relevantes e recolher limites de execução em detalhes técnicos.
- Executar apresenta retorno, saída e erros de execução, sem aprovação, comparação com esperado ou indicadores de acerto.
- Submeter mantém avaliação, XP e regras atuais; nenhuma alteração no juiz ou execução.
- Em desktop, leitura com rolagem independente ao lado de um editor mais amplo. Em telas menores, empilhar os painéis e manter acesso às abas.
- Validar tipos, lint, testes e layout em navegador real, incluindo erro e larguras responsivas.
- Deixar preview local na porta 5178 para aprovação do usuário. Não publicar em produção nesta tarefa.

## Validação

- `npm run typecheck`, `npm run lint`, `npm run build`: passaram.
- `npm test`: 611 testes passaram, em 44 arquivos.
- Suíte `tests/e2e/local-practice.spec.ts`: fluxos JS/TS com workers reais, retorno incorreto sem veredito, erros de sintaxe/tempo, cancelamento por navegação/linguagem, execução remota Python e submissão após recuperação do executor; desktop e mobile.
- Layout: larguras 320, 390, 800 e 1280, temas claro e escuro, saída e erro de execução. Capturas temporárias em `/tmp/rods-local-success-*`, `/tmp/rods-local-error-*` e `/tmp/rods-challenge-*.png`, inspecionadas visualmente.
- Preview manual: `http://127.0.0.1:5178/desafios/function-double?language=javascript`; editor Monaco e enunciado sem fórmula; ajuda e detalhes técnicos recolhidos. Abas ajustadas após detectar corte em painel estreito.
- Backend remoto real não foi conectado; fluxo remoto foi validado com respostas simuladas nos testes existentes. Preview usa modo de exploração e prática JS/TS no navegador.
- Publicação em produção aprovada pelo usuário em 2026-10-05: “gostei pode subi”.

- Conferência final do Monaco em 320 pixels: largura do documento igual à tela (320 pixels), sem transbordamento horizontal.
