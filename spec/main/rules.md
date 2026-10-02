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
