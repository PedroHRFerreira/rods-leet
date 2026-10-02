# Prática no navegador — desenho aprovado

O usuário solicitou acelerar as respostas usando a máquina de cada visitante, para todas as linguagens, somente no navegador e sem instalação. Confirmou a alternativa automática pelo servidor para linguagens ou navegadores ainda não validados e autorizou continuar após a análise de viabilidade de 01/10/2026.

## Entrega e limites

- Executar é prática, com o primeiro exemplo público; não decide aprovação, XP ou conclusão.
- Começar com JavaScript e TypeScript em QuickJS/Wasm, isolado em Worker. O código do aluno não recebe DOM, rede, armazenamento, arquivos do servidor ou comunicação do Worker.
- TypeScript usa verificação semântica em sistema de arquivos virtual antes de executar JavaScript no mesmo isolamento.
- Limites independentes do executor oficial: um arquivo, 64 KiB de código e entrada, 16 KiB de saída total, 32 MiB de memória QuickJS e três segundos de execução. Compilação TypeScript é interrompida pelo descarte do Worker. Preparação pode aguardar até 12 segundos.
- Falha de preparação ou workspace/linguagem incompatível usa o servidor existente se disponível. Erro do código, loop e estouro de recursos mostram resultado local e não iniciam uma execução remota duplicada.
- Funções síncronas exportadas seguem o modelo; Promise/async recebe erro orientado. Projetos com vários arquivos continuam remotos.
- Trocar linguagem/desafio ou sair da página interrompe o teste e ignora respostas antigas.
- As outras nove linguagens ficam no fluxo remoto até validação individual. A investigação de Python/SQL não comprova equivalência, isolamento ou desempenho do produto.
- Submeter, casos privados, recompensas e progresso continuam exclusivamente no servidor.
- Feedback por e-mail permanece adiado e desativado, conforme solicitação anterior.

## Aceite

Comparar os exemplos públicos dos 49 desafios de programação com três variantes de solução em cada linguagem local. Verificar isolamento, CPU, memória, saída, erros e cancelamento. Verificar Chromium desktop e celular, temas claro/escuro e larguras 320/390/800/1280. Concluir tipos, lint, testes, builds frontend/BFF e regressões de navegador antes da publicação.

A implementação pode ser revertida com `VITE_LOCAL_PRACTICE_ENABLED=false` em um novo build. A alternativa remota continua sujeita à disponibilidade real do executor.
