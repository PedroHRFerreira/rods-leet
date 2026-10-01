# Confirmação, reação e progresso nos desafios

Escopo aprovado em 1 de outubro de 2026: primeira entrega do plano de experiência, implementada com subagentes, validação local, publicação e teste conectado em produção.

## Comportamento

- Quiz e código oferecem “Não pedir confirmação novamente neste navegador”. A opção só é salva ao confirmar o envio, separada por identidade e tipo de desafio. O perfil permite reativar a confirmação. Selecionar alternativa nunca envia automaticamente; o aviso da recompensa permanece.
- Resultado oficial confirmado produz reação breve de acerto ou incentivo para tentar de novo, preservando texto, diagnóstico e próximo passo. Falha técnica não vira erro do aluno; executar código para estudo não celebra conclusão oficial. Sem som, bloqueio ou novas chamadas por animação. Respeitar movimento reduzido e evitar repetição de efeitos por polling, reload ou cache.
- Cada desafio mostra conclusões distintas, total e restantes do módulo de conceitos ou da trilha/tema. Posição editorial continua separada de conclusões. Aprovação recebida do servidor atualiza o progresso visível; falha, estudo e clique não completam etapas.
- Após aprovação, o cabeçalho mostra conclusão em vez de uma recompensa futura de zero. Erro de rede do quiz menciona a resposta pendente, sem falar de código inexistente.

## Limites

Esta entrega não muda avaliação, XP, testes privados, executor, esquema do banco ou contratos públicos. Feedback de texto/mídia e prática local são entregas seguintes, conforme a auditoria. Não há nova dependência de animação ou provedor pago.

## Entrega e aceite

Seguir os seis papéis de `.ai/skills/parallel-delivery`: domínio e regra isolada; UI principal, UI complementar e fluxo; integração visual/revisão após os três últimos. O coordenador integra e publica.

Testar cancelamento da preferência, persistência/reversão, identidade e tipo separados, armazenamento indisponível, acerto/erro, resposta perdida com idempotência, contagem fora de ordem, submissão duplicada e efeito único. Conferir temas claro/escuro, desktop/mobile, teclado e movimento reduzido em Chromium.

Executar tipos, lint, testes, build e build do BFF; usar preview antes da integração em produção quando o fluxo atual permitir. Publicar pelo Git/Cloudflare existente, registrar commit/deploy e testar com sessão anônima nova no site. Não modificar progresso de usuários existentes. Conter regressões restaurando a versão anterior, sem mudanças de banco nesta entrega.
