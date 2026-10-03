# Celebrações de compra — 3 de outubro de 2026

Cada um dos 27 itens compráveis tem uma composição própria em tela inteira: oficina do robô, trilha da raposa, lançamento espacial, asas do dragão, cidades e paisagens dos temas, construção das molduras, assinatura colorida, títulos e conjuntos de dicas. Ilustrações SVG locais se desenham durante uma revelação de 2,8 segundos, com partículas e cores específicas. Não há sorteio, som automático ou dependência externa.

O diálogo abre somente após a resposta de compra bem-sucedida, uma vez por chave de operação. Prévia, equipagem e recusa não abrem celebração. Uma resposta perdida permite repetir a mesma operação; a celebração começa quando sua confirmação chega. O item confirmado é guardado independentemente das consultas para preservar a tela durante falhas posteriores de atualização. Comprar continua separado de equipar.

O usuário pode continuar imediatamente, pular a introdução ou fechar com Escape. O diálogo nativo mantém o foco dentro da celebração e bloqueia a rolagem da página. Fechar restaura o foco à loja. Se o botão temporário de pular está focado quando o timer termina, o foco passa para continuar. A preferência por movimento reduzido é respeitada na abertura e quando alterada durante a revelação: sem animações, com conteúdo disponível imediatamente.

Dados de apresentação vêm do catálogo local permitido. Valores recebidos não inserem CSS nem marcação; o nome do usuário é texto React. A interface não modifica autorização, carteira, compras, XP ou regras de premiação no servidor.

Validação: 518 testes unitários; sete novos casos cobrem composições distintas e identificadores/valores falsificados. Os 28 testes de `economy-auth.spec.ts` passaram e cobrem os 27 itens, confirmação, resposta perdida e reenvio, compra recusada, falha de refetch, compra/equipagem separadas, Escape, foco, timer, pular, preferência de movimento e responsividade em Chromium desktop/mobile. Tipos, lint, formatação e build aprovados.

Inspeção visual local nas URLs `http://127.0.0.1:5196/loja` e `http://127.0.0.1:5197/loja`, com respostas de compra de teste. Telas de 320/393/800/1280/1440 px nos temas claro e escuro, cenas de personagem, moldura, cor, título, tema e dicas. Capturas inspecionadas em `/tmp/rods-purchase-astronaut-desktop.png`, `/tmp/rods-purchase-theme-ocean-mobile.png`, `/tmp/rods-purchase-frame-neon-desktop.png` e `/tmp/rods-purchase-light-{320,800,1440}-desktop.png`. Nenhuma compra real foi efetuada na validação, e o cadastro continua desativado.
