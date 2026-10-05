# Regras permanentes

- Quando existir um design Figma, seguir seu padrão responsivo.
- Em alterações visuais do frontend, validar diretamente em navegador real com a skill visual-check antes de concluir.
- Se visual-check não completar a interação, usar um MCP de navegador como último recurso, mantendo o fluxo nas skills.
- Usar Prettier como formatador padrão do projeto, com formatação ao salvar. Preservar as preferências de editor fornecidas pelo usuário em .vscode/settings.json, incluindo fonte, tema, ícones e salvamento ao mudar de janela.
- Usar a mesma configuração Prettier no editor e nos comandos do projeto. Verificar formatação e lint no workflow antes dos testes.
- No primeiro beta, permitir uso sem login obrigatório, mantendo identidade anônima interna para separar rascunhos, submissões e progresso.
- Ocultar o tutor de IA da navegação enquanto não estiver pronto; retirar também os atalhos que levam usuários ao tutor.
- Executar código real livremente para estudo, incluindo console/print e saída de erro, sem cota diária por usuário; manter sandbox e limites de recursos por execução.
- Submeter exige confirmação no padrão visual do projeto. Rejeição permite corrigir e tentar novamente, reduzindo a recompensa em 15% do XP base por erro, de forma linear até zero; falhas de infraestrutura não contam.
- Primeira aprovação de um desafio concede XP uma única vez e conduz ao próximo desafio; novas execuções para estudo continuam disponíveis.
- Valores esperados fixos servem para comparar a saída real do código; nunca simular execução nem aprovação.
- Esclarecimento posterior: usar somente a função do modelo na interface, sem seletor “Forma de executar”. console/print exibem diagnóstico; a submissão avalia o retorno da função. Preservar os rascunhos ao simplificar a interface.

# Aprendizado para iniciantes

- Notificações de feedback do produto devem ser recebidas em devpedrohr@gmail.com, usando Gmail. Credenciais ficam nos segredos do servidor; o visitante não escolhe o destinatário.

- A trilha de lógica começa antes de funções e return: ensinar valores, variáveis, mensagens e entrada com passos pequenos e modelos guiados, mantendo uma progressão clara entre desafios.
- Ensinar explicitamente o contrato da função fornecida antes de exigir seu uso e oferecer erros que expliquem a correção em linguagem acessível.
- Validar pelo menos três formas de solução por desafio no executor isolado e registrar a cobertura real de linguagens e casos.
- Esclarecimento posterior: antes dos exercícios de código, usar perguntas simples de múltipla escolha, sem editor, para ensinar valores, variáveis, tipos, funções, parâmetros, return, export e classes. Apresentar uma explicação curta e feedback após a resposta; somente depois pedir código. Para perguntas, validar todas as alternativas no avaliador; a exigência de três códigos se aplica aos exercícios de programação.

- Execução de estudo deve aproveitar o dispositivo do visitante sem instalação, somente pelo navegador, após validar isolamento e compatibilidade de cada runtime. Linguagens ou ambientes locais ainda não validados usam o servidor como alternativa. Aprovação, XP, conclusão e casos privados permanecem exclusivamente no servidor. O objetivo cobre todas as linguagens; não declarar cobertura local antes da validação real.

# Moedas, loja e conta

- Login desta versão é próprio, por e-mail e senha, com confirmação e recuperação; não oferecer Google/GitHub. Permitir explorar sem conta e preservar progresso ao cadastrar a identidade de visitante.
- Moedas são conquistadas somente estudando: 10 por primeira conclusão distinta, 25 por novo nível, 50/200 ao atingir 7/30 dias de sequência. Combinar presentes de marcos com desbloqueios exclusivos na loja.
- Oferecer dicas extras, avatares equipáveis, cores de nome e temas, com inventário e ofertas semanais. Dica extra custa 30 moedas e mantém as recompensas gratuitas e o efeito sobre XP existentes.
- XP permanece acumulado; compras não consomem XP nem conferem vantagens no ranking. Saldo, preço, compras, inventário e recompensas são confirmados pelo servidor sem duplicação.

- Loja v2 oferece personagens/skins, molduras, títulos, cores e temas completos, com prévias, coleções e ofertas reais. Conservar IDs, saldo e itens já adquiridos. Presentes de marcos não devem ser cobrados no marco que os concede. Conteúdo de estudo permanece gratuito, sem caixas aleatórias ou venda de XP.
- Compras e premiações continuam exclusivas para contas cadastradas; visitantes podem visualizar loja e ranking, mas não recebem prêmios semanais. Cadastro não será ativado como parte do redesenho da loja.
- Manter ranking geral e adicionar top 5 semanal por XP ganho no período, com pelo menos três conclusões distintas e conta cadastrada. Semana fecha segunda-feira às 00h em America/Sao_Paulo. Premiar 500/350/250/150/100 moedas e cosméticos exclusivos, automaticamente e sem duplicação ou crédito retroativo de semanas encerradas.

# Acesso e continuidade — atualização de 05/10/2026

- A orientação atual substitui a restrição anterior a login somente por e-mail: oferecer Google, entrada por e-mail, cadastro e recuperação funcionais.
- Visitantes podem concluir dez desafios distintos; antes de concluir um novo após esse limite, exigir conta com mensagem clara, retorno ao desafio e preservação do progresso ao cadastrar a identidade visitante. Desafios já concluídos permanecem disponíveis para estudo.
- Não bloquear Submeter por configuração de interface ou consulta antiga de disponibilidade. Somente operações em andamento, entradas inválidas, aprovação já registrada, limite de visitante e falhas reais de infraestrutura justificam impedir o envio; explicar o motivo e preservar o código.
- Escolha posterior de 05/10/2026: publicar cadastro e acesso por Google por enquanto. Manter entrada de contas antigas com senha; adiar cadastro e recuperação por e-mail até existir envio transacional configurado. Isso não ativa notificações de feedback ao administrador.
