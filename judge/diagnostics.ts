/** Server-only guidance. Never echo private test inputs or raw runtime errors. */
export interface FunctionDiagnosticContext {
  languageId: string;
  functionName: string;
  publicInput: unknown;
  stdout?: string;
  stderr?: string;
}

export function functionDiagnostic(
  context: FunctionDiagnosticContext,
): string | undefined {
  const { languageId, publicInput, stdout = "", stderr = "" } = context;
  if (!["javascript", "typescript", "python"].includes(languageId))
    return undefined;
  if (!["solve", "findMax"].includes(context.functionName)) return undefined;
  const name =
    languageId === "python" && context.functionName === "findMax"
      ? "find_max"
      : context.functionName;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const missing = new RegExp(
    `(?:student\\.${escapedName} is not a function|module ['"]solution['"] has no attribute ['"]${escapedName}['"])`,
  ).test(stderr);
  if (missing) {
    const signature =
      languageId === "python"
        ? `def ${name}(input):`
        : `export function ${name}(input) { ... }`;
    const inputHelp =
      publicInput !== null &&
      typeof publicInput === "object" &&
      !Array.isArray(publicInput)
        ? ` A entrada é um objeto: acesse ${Object.keys(publicInput)
            .map((key) =>
              languageId === "python"
                ? `input[${JSON.stringify(key)}]`
                : `input.${key}`,
            )
            .join(" e ")}.`
        : Array.isArray(publicInput)
          ? " A entrada é uma lista recebida no parâmetro input."
          : " O parâmetro input recebe o valor apresentado no exemplo.";
    return `Não encontramos a função ${name} do modelo. Mantenha a assinatura ${signature}${inputHelp} A plataforma chama essa função com cada entrada; você não precisa chamá-la manualmente. Devolva a resposta com return. ${languageId === "python" ? "print" : "console.log"} serve para acompanhar seu código e não substitui return.`;
  }
  if (
    ["javascript", "typescript"].includes(languageId) &&
    !stderr &&
    stdout.trimEnd().split(/\r?\n/).at(-1) === "undefined"
  ) {
    return `A função ${name} terminou sem devolver uma resposta. Use return para entregar o resultado; console.log apenas mostra mensagens. Em uma função de seta com chaves, escreva return dentro das chaves.`;
  }
  return undefined;
}
