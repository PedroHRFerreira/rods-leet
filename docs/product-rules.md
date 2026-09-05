# Regras vigentes do CodeGamer

Estas regras consolidam a instrução aprovada pelo usuário e prevalecem sobre documentos anteriores. O produto inicia como beta fechado gratuito para até 100 convidados. Hard é uma capacidade da segunda fase e só pode ser habilitado após homologação.

## Avaliação e progresso

- Todos os testes obrigatórios devem passar. Testes do aluno, tutor e diagnósticos de crescimento não decidem aprovação.
- `easy`, `medium`, `hard` são dificuldades. `normal`, `hard` são modos independentes.
- Normal não retira XP por erro. Hard retira até 30 XP por submissão rejeitada; o saldo nunca fica negativo.
- Primeira aprovação por usuário, desafio e modo: XP base no Normal, três vezes a base no Hard. Linguagem, versão e nova sessão não reiniciam a recompensa.
- Recompensa: 100% sem dicas, 95% com uma, 85% com duas ou mais; arredondar para baixo para XP inteiro. Assistência é cumulativa por desafio, em todas as sessões e linguagens.
- Uma dica inicial; mais uma a cada dez desafios distintos concluídos. Repetir desafio ou mudar modo não concede outra conclusão distinta.
- Gabarito gratuito após uma aprovação ou três submissões incorretas acumuladas. Abrir antes de resolver torna futuras submissões desse desafio prática sem XP. Uma submissão pendente preserva o snapshot de assistência do envio.
- Nível inicial zero. A transição do nível L para L+1 custa 150 × (L+1) XP adicionais. Penalidades podem reduzir nível, mas não apagam conclusões.
- Ranking único, ordenado por XP líquido, conclusões distintas e instante em que a pontuação foi alcançada. Nunca vender XP, multiplicadores de XP ou posição no ranking.

## Sessões Hard

- Prazos do servidor: Easy 45, Medium 60 e Hard 90 minutos. Reload, múltiplas abas e troca de dispositivo não alteram o prazo.
- Três submissões oficiais atribuíveis ao programa por sessão; uma avaliação em andamento por usuário. Submissões recebidas até o prazo podem terminar depois dele.
- Falha da plataforma não retira XP nem consome tentativa/cota do aluno. Custos reais da falha continuam contabilizados no orçamento da plataforma.
- Desistência/expiração não acrescentam penalidade. Três rejeições encerram a sessão. Boss tem no máximo três novas sessões por janela móvel de 24 horas.
- Editor permite múltiplos arquivos com autocomplete desativado. Testes oficiais e gabaritos não são enviados no documento público nem montados no workspace editável.

## Limites e segurança

- Até 20 arquivos de texto e 256 KiB, com paths relativos dentro de áreas declaradas pelo manifesto; proibir travessia, links e arquivos de configuração não autorizados.
- Dez execuções remotas por usuário/dia, quatro globais simultâneas, uma por usuário, no máximo uma criação de sandbox por segundo.
- Sandbox: 90 segundos absolutos; compilação até 45 segundos; por caso, 2 segundos CPU e 5 segundos de duração, com perfil homologado por runtime. Limites de saída 64 KiB por caso/256 KiB por job.
- Código arbitrário executa apenas no provedor isolado configurado. Demonstração local não executa código nem finge aprovação/XP.
- Reserva prévia de custo máximo; teto US$1/dia e 80% dos créditos gratuitos confirmados. Sem saldo confirmado, bloquear execução. Não cadastrar pagamento nem habilitar upgrade automático.
- Coordenador deve reservar orçamento e finalizar resultado/progresso em transações protegidas. As funções puras de domínio modelam as regras; não substituem locks, RLS ou autorização do servidor.
- PostgreSQL 18 é modalidade separada; SELECT em base sintética descartável com parser compatível, papel restrito, readonly e watchdog. Nunca executar SQL do aluno na base do produto.
- Big O é consultivo: medir crescimento em intervalo declarado e admitir inconclusão. Nunca declarar prova assintótica a partir de tempo de execução.

## Tutor e operação

- Duas interações/dia por usuário, entrada até 2.048 tokens, saída até 1.024 e reserva global 8.000 neurons/dia. Cota esgotada fornece conteúdo editorial.
- Ajuda sobre desafio ativo conta como dica; revisão após aprovação e estudo geral não reduzem XP conquistado. O tutor nunca decide veredito nem recebe segredos ou testes ocultos.
- Manter rascunhos e soluções aceitas; rejeitadas por 30 dias e logs por sete. Backup diário criptografado fora do projeto Supabase e ensaio de restauração antes dos convites.
- Nunca apresentar runtimes, isolamento ou serviços externos como homologados antes de executar suas verificações reais. Catálogo público pode existir antes da habilitação do executor.

## Identidade e temas

- O produto se chama **Rods Leet**.
- O tema padrão é escuro, com fundo preto verdadeiro (`#000000`), superfícies neutras e destaque discreto.
- Os temas escuro e claro são suportados integralmente, incluindo editor, estados vazios, erros, navegação e telas menores. A escolha explícita é preservada.
- A interface prioriza os problemas, o código e o progresso real; não simula resultados ou atividade.
