# Regras vigentes do CodeGamer

Estas regras consolidam a instrução aprovada pelo usuário e prevalecem sobre documentos anteriores. O beta é gratuito: visitantes podem concluir dez desafios distintos antes de precisar de uma conta para novos desafios. Uma sessão anônima interna separa os dados e o progresso de cada visitante. Hard é uma capacidade da segunda fase e só pode ser habilitado após homologação.

## Avaliação e progresso

- Todos os testes obrigatórios devem passar. Testes do aluno, tutor e diagnósticos de crescimento não decidem aprovação.
- `easy`, `medium`, `hard` são dificuldades. `normal`, `hard` são modos independentes.
- A interface usa somente a função do modelo, conforme esclarecimento posterior do usuário. Executar chama essa função com as entradas do desafio e mostra saída padrão, erros e falhas reais, sem conceder XP. console/print são mensagens de estudo; Submeter avalia o resultado retornado pela função, sem reprovar por essas mensagens. Não exibir seletor de forma de execução. Preservar rascunhos existentes e pedir confirmação antes de recarregar o modelo.
- Submeter pede confirmação visual inicialmente. O usuário pode dispensá-la explicitamente neste navegador, com preferências separadas por identidade para perguntas e código, e reativá-la no perfil. Cancelar o diálogo não salva essa escolha; selecionar uma alternativa não envia. O aviso da recompensa permanece junto ao envio. Submeter compara os resultados reais com os resultados esperados dos casos obrigatórios. Respostas esperadas fixas não são aprovação simulada.
- Rejeição atribuível ao código não desconta XP já conquistado. Ela reduz a recompensa futura desse desafio em 15% do XP base por erro acumulado, linearmente até zero. Falhas da plataforma não contam. É possível corrigir e tentar novamente.
- Primeira aprovação por usuário e desafio: XP base no Normal, três vezes a base no Hard quando habilitado. Linguagem, modo, versão e nova sessão não reiniciam a recompensa. Após aprovar, avançar ao próximo desafio; não aceitar outra submissão oficial do mesmo desafio, mas continuar permitindo execuções de estudo.
- Recompensa: aplicar ao XP base o multiplicador do modo, o fator de dicas (100% sem dicas, 95% com uma, 85% com duas ou mais) e `max(0, 1 - 0.15 × rejeições acumuladas)`; arredondar para baixo para XP inteiro. Assistência e rejeições são cumulativas por desafio em todas as sessões e linguagens.
- Uma dica inicial; mais uma a cada dez desafios distintos concluídos. Repetir desafio ou mudar modo não concede outra conclusão distinta.
- Gabarito gratuito após uma aprovação ou três submissões incorretas acumuladas. Abrir antes de resolver torna futuras submissões desse desafio prática sem XP. Uma submissão pendente preserva o snapshot de assistência do envio.
- Nível inicial zero. A transição do nível L para L+1 custa 150 × (L+1) XP adicionais. Erros nesta versão não reduzem nível nem apagam conclusões.
- Ranking geral ordenado por XP líquido, conclusões distintas e instante em que a pontuação foi alcançada. Ranking semanal mede XP conquistado no período e premia contas cadastradas com pelo menos três conclusões distintas; não altera a classificação geral. Nunca vender XP, multiplicadores de XP ou posição no ranking.

## Sessões Hard

- Prazos do servidor: Easy 45, Medium 60 e Hard 90 minutos. Reload, múltiplas abas e troca de dispositivo não alteram o prazo.
- Três submissões oficiais atribuíveis ao programa por sessão; uma avaliação em andamento por usuário. Submissões recebidas até o prazo podem terminar depois dele.
- Falha da plataforma não retira XP nem consome tentativa/cota do aluno. Custos reais da falha continuam contabilizados no orçamento da plataforma.
- Desistência/expiração não acrescentam penalidade. Três rejeições encerram a sessão. Boss tem no máximo três novas sessões por janela móvel de 24 horas.
- Editor permite múltiplos arquivos com autocomplete desativado. Testes oficiais e gabaritos não são enviados no documento público nem montados no workspace editável.

## Limites e segurança

- Até 20 arquivos de texto e 256 KiB, com paths relativos dentro de áreas declaradas pelo manifesto; proibir travessia, links e arquivos de configuração não autorizados.
- Execuções de estudo sem cota diária por usuário. Manter quatro globais simultâneas, uma por usuário e no máximo uma criação de sandbox por segundo; esses controles operacionais não mudam a quantidade de tentativas de estudo.
- Sandbox: 90 segundos absolutos; compilação até 45 segundos; por caso, 2 segundos CPU e 5 segundos de duração, com perfil homologado por runtime. Limites de saída 64 KiB por caso/256 KiB por job.
- Esclarecimento posterior aprovado: prática com exemplos públicos pode executar no navegador em runtime isolado e validado, sem instalação e sem aprovação/XP. Linguagens ou ambientes locais incompatíveis usam o provedor isolado configurado como alternativa. Avaliação oficial e casos privados permanecem exclusivamente no servidor. Demonstração nunca finge aprovação/XP.
- Reserva prévia de custo máximo; teto US$1/dia e 80% dos créditos gratuitos confirmados. Sem saldo confirmado, bloquear execução. Não cadastrar pagamento nem habilitar upgrade automático.
- Coordenador deve reservar orçamento e finalizar resultado/progresso em transações protegidas. As funções puras de domínio modelam as regras; não substituem locks, RLS ou autorização do servidor.
- PostgreSQL 18 é modalidade separada; SELECT em base sintética descartável com parser compatível, papel restrito, readonly e watchdog. Nunca executar SQL do aluno na base do produto.
- Big O é consultivo: medir crescimento em intervalo declarado e admitir inconclusão. Nunca declarar prova assintótica a partir de tempo de execução.

## Tutor e operação

- Tutor oculto da navegação e dos atalhos enquanto não estiver pronto. Suas regras abaixo só se aplicam quando a funcionalidade for habilitada em versão posterior.
- Duas interações/dia por usuário, entrada até 2.048 tokens, saída até 1.024 e reserva global 8.000 neurons/dia. Cota esgotada fornece conteúdo editorial.
- Ajuda sobre desafio ativo conta como dica; revisão após aprovação e estudo geral não reduzem XP conquistado. O tutor nunca decide veredito nem recebe segredos ou testes ocultos.
- Manter rascunhos e soluções aceitas; rejeitadas por 30 dias e logs por sete. Backup diário criptografado fora do projeto Supabase e ensaio de restauração contínuo.
- Nunca apresentar runtimes, isolamento ou serviços externos como homologados antes de executar suas verificações reais. Catálogo público pode existir antes da habilitação do executor.

## Identidade e temas

- O produto se chama **Rods Leet**.
- O tema padrão é escuro, com fundo preto verdadeiro (`#000000`), superfícies neutras e destaque discreto.
- Os temas escuro e claro são suportados integralmente, incluindo editor, estados vazios, erros, navegação e telas menores. A escolha explícita é preservada.
- A interface prioriza os problemas, o código e o progresso real; não simula resultados ou atividade.
- Desafios mostram conclusões distintas e etapas restantes do módulo, trilha ou tema, separadas da posição editorial atual. Somente aprovação oficial confirmada conta como conclusão. Reações visuais de resultado preservam as mensagens, respeitam movimento reduzido e não se repetem por polling ou recuperação de histórico. Execução de estudo e falha técnica não celebram aprovação nem aplicam penalidade visual ao aluno.

## Moedas, loja e login próprio — atualização aprovada em 2026-10-02

- Atualização de 05/10/2026: cadastro e acesso usam Google. Criar conta vincula a identidade de visitante, preservando progresso e moedas; entrar em conta existente abre os dados dessa conta, sem mesclar visitantes. Contas antigas com senha ainda podem entrar. Cadastro e recuperação por e-mail ficam desativados por escolha do usuário enquanto não houver envio transacional configurado.
- Depois de dez conclusões distintas válidas, exigir conta para novos desafios, com contador, benefícios, ações de cadastro/entrada e retorno ao desafio. Revisar desafios concluídos continua permitido; prática com solução e conclusões sob revisão não avançam o contador oficial.
- Submeter continua acionável quando a consulta de disponibilidade está antiga: conferir novamente o avaliador antes de abrir tentativa ou enviar código. Explicar falhas reais, permitir nova tentativa e preservar o rascunho; falhas técnicas não consomem tentativas.
- Moedas apenas por estudo: primeira conclusão distinta concede 10; cada novo nível concede 25; os dias 7 e 30 de cada sequência UTC concedem 50 e 200. Repetição de desafio, linguagem ou modo não duplica prêmio. Falhas não geram transações de moedas.
- As moedas começam na migração, sem prêmios retroativos do histórico. XP, níveis, conclusões e dicas anteriores permanecem.
- Nível 5 concede o avatar Coruja sábia; sequência de 30 dias concede Chama constante. Outros cosméticos exigem níveis indicados no catálogo. Presentes obtidos permanecem equipáveis mesmo se o nível mínimo da compra não estiver alcançado.
- Loja vende dica extra consumível por 30 moedas e cosméticos permanentes a partir de 100. Dicas gratuitas e redução de XP pelo uso continuam conforme as regras acima. Compras não consomem XP nem alteram ranking.
- Ofertas rotacionam às segundas-feiras, 00:00 UTC; desconto de até 20%, com piso de 100 moedas. Exibir desconto somente quando real. O servidor recusa preço diferente do confirmado, inclusive ao terminar uma oferta.
- Carteira, inventário, compras e equipagem são transacionais, com fonte/chave única e verificação de conta registrada. Restaurar avatar, cor e tema padrão é gratuito; itens comprados permanecem no inventário. Claro e escuro básicos continuam gratuitos.

- Loja v2 amplia o catálogo com personagens/skins, molduras, títulos, cores e temas completos. Prévia precede a compra; coleções concluídas entregam um item exclusivo uma única vez. Dicas avulsas e pacotes mantêm a penalidade de XP de uso; nenhum conteúdo gratuito passa a exigir compra.
- Cada item comprável tem uma celebração própria em tela inteira, apresentada somente após confirmação da compra pelo servidor e uma vez por operação. A revelação permite pular ou fechar por teclado, respeita movimento reduzido e mantém a compra separada da equipagem. Falha, prévia, atualização de dados e equipagem não iniciam celebrações de compra.
- Metas extras de estudo concedem 20 moedas por três primeiras conclusões distintas do dia e 75 por sete da semana, exclusivamente a contas cadastradas e uma vez por período. Não conceder essas metas retroativamente antes da ativação.
- Semana competitiva inicia segunda-feira 00h em America/Sao_Paulo e termina na segunda seguinte, com intervalo semiaberto. Top 5 elegível recebe 500/350/250/150/100 moedas e cosméticos exclusivos permanentes. Só participam contas cadastradas com XP positivo e três conclusões distintas no período; não premiar semanas encerradas antes da publicação. Encerramento, histórico de vencedores e entrega de prêmio são confirmados no servidor, com recuperação idempotente após falha operacional.
