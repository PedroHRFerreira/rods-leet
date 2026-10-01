/** Private answer key. Never import this module from browser-facing code. */
type OptionId = "a" | "b" | "c";
type QuizRule = { answer: OptionId; explanation: string };
const rules: Record<string, QuizRule> = {
  "concept-values": {
    answer: "b",
    explanation:
      "Um valor é uma informação, como o número 7, o texto Olá ou verdadeiro.",
  },
  "concept-variables": {
    answer: "a",
    explanation:
      "Uma variável dá um nome a um valor. Com pontos = 10, o nome pontos guarda o valor 10.",
  },
  "concept-numbers": {
    answer: "c",
    explanation:
      "Números representam quantidades e permitem cálculos. A soma 2 + 3 resulta no número 5.",
  },
  "concept-text": {
    answer: "b",
    explanation:
      'Um texto é uma sequência de caracteres escrita entre aspas, como "Olá".',
  },
  "concept-booleans": {
    answer: "a",
    explanation:
      "Um booleano representa apenas duas possibilidades: verdadeiro ou falso.",
  },
  "concept-functions": {
    answer: "c",
    explanation:
      "Uma função reúne instruções que podem ser usadas quando ela é chamada.",
  },
  "concept-parameters": {
    answer: "b",
    explanation:
      "Parâmetros são nomes que a função usa para receber valores na chamada.",
  },
  "concept-return": {
    answer: "a",
    explanation:
      "return devolve um valor para quem chamou a função; mostrar uma mensagem é outra ação.",
  },
  "concept-export": {
    answer: "c",
    explanation:
      "export permite que a aplicação encontre a função do seu arquivo.",
  },
  "concept-classes": {
    answer: "b",
    explanation:
      "Uma classe reúne informações e tarefas relacionadas em um modelo.",
  },
};

export function evaluateConceptQuiz(
  challengeId: string,
  optionId: string,
): { verdict: "accepted" | "wrong_answer"; message: string } {
  if (!Object.hasOwn(rules, challengeId))
    throw new RangeError("Questionário indisponível.");
  if (!["a", "b", "c"].includes(optionId))
    throw new RangeError("Alternativa inválida.");
  const rule = rules[challengeId];
  const accepted = rule.answer === optionId;
  return {
    verdict: accepted ? "accepted" : "wrong_answer",
    message: `${accepted ? "Isso mesmo!" : "Ainda não."} ${rule.explanation}`,
  };
}
