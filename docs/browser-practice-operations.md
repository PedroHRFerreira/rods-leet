# Operação da prática no navegador

JavaScript e TypeScript usam QuickJS/Wasm 0.32.0 somente ao clicar em Executar. TypeScript carrega seu compilador sob demanda. O Worker é descartado ao terminar; downloads podem usar o cache HTTP do navegador. O visitante não instala programas. A primeira execução exige baixar o runtime; não há garantia de menor latência em todos os dispositivos.

Executar chama a função síncrona exportada com o primeiro exemplo público. Console e retorno são exibidos como texto, sem aprovação, XP ou conclusão. O resultado local não é um veredito oficial. Submeter mantém a avaliação privada existente no servidor.

Python, SQL, Java, Kotlin, C#, Go, Rust, C e C++ permanecem remotos nesta entrega. Um navegador sem Worker/WebAssembly, vários arquivos ou falha no carregamento também preserva essa alternativa. Quando o servidor estiver offline, a interface informa a indisponibilidade; não simula resultado.

## Isolamento e limites

O aluno executa dentro de uma VM QuickJS com memória própria, e não por `eval` do navegador. O único vínculo com o host é console com saída limitada. Não existem APIs de DOM, rede, armazenamento, arquivos, processo ou mensagens de Worker na VM. Imports externos não são permitidos. Runtimes novos exigem nova validação de isolamento.

Um arquivo, 64 KiB de código, 64 KiB de entrada JSON, 16 KiB combinados de retorno/mensagens, 32 MiB na VM e três segundos por teste. A entrada e o retorno possuem limites de profundidade e quantidade de nós. O compilador TypeScript está fora da memória QuickJS, mas no Worker descartável, com limite de duração; seu consumo depende do dispositivo. Não apresentar os limites do executor oficial como limites da prática local.

A rota `/practice-worker/local-practice.worker-<hash>.js` entrega somente o loader compilado, por Pages Function e `ASSETS.fetch`. Sua CSP permite carregar Wasm confiável e bloqueia rede; substitui a CSP herdada do asset sem ampliar a política da página HTML. Os demais assets, inclusive workers Monaco, mantêm suas rotas originais. [Referência ASSETS](https://developers.cloudflare.com/pages/functions/api-reference/), [combinação de headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Configuração e recuperação

O recurso fica habilitado por padrão. Para desativá-lo, reconstruir e publicar com `VITE_LOCAL_PRACTICE_ENABLED=false`. Não há segredos novos. O build de produção inclui os runtimes locais; os testes de navegador constroem esse build antes de usar o preview, evitando recargas de dependências de desenvolvimento.

Não habilitar runtimes locais adicionais apenas porque há um pacote Wasm disponível. Exigir contratos do modelo, casos públicos, alternativas de solução, limites e isolamento real. E-mail continua desativado; retomar separadamente a integração Gmail.
