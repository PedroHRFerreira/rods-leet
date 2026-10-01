import ts from "typescript";
import { getEditorial } from "../editorial.ts";
import type { PublicChallenge } from "../../src/content/types.ts";

export interface SolutionVariant {
  name: string;
  languageId: "javascript" | "typescript" | "python" | "sql";
  files: { path: string; content: string }[];
  logs: boolean;
}

/** Syntax variants exercise the same canonical algorithm; they are not independent proofs. */
export function solutionVariants(
  challenge: PublicChallenge,
): SolutionVariant[] {
  const languageId =
    challenge.kind === "sql"
      ? "sql"
      : challenge.id === "shortest-path"
        ? "typescript"
        : "javascript";
  const editorial = getEditorial(challenge.id, languageId);
  if (languageId === "sql") {
    const query = editorial.files[0].content.trim().replace(/;$/, "");
    return [
      query,
      `SELECT * FROM (${query}) AS answer;`,
      `WITH answer AS (${query}) SELECT * FROM answer;`,
    ].map((content, index) => ({
      name: ["query", "subquery", "cte"][index],
      languageId,
      files: [{ path: "solution.sql", content }],
      logs: false,
    }));
  }
  const functionName = challenge.functionName ?? "solve";
  const files = editorial.files.map((file) => ({
    path:
      languageId === "javascript"
        ? file.path.replace(/\.ts$/, ".js")
        : file.path,
    content:
      languageId === "javascript"
        ? ts.transpileModule(file.content, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ES2022,
            },
          }).outputText
        : file.content,
  }));
  if (challenge.id === "sum-two-integers")
    return [
      {
        name: "named-function",
        content:
          "export function solve(input) { const a = input.a; const b = input.b; return a + b; }",
      },
      {
        name: "destructured-arrow",
        content: "export const solve = ({ a, b }) => a + b;",
      },
      {
        name: "helper-with-log",
        content:
          'const teste = (a, b) => a + b;\nexport function solve(input) { const total = teste(input.a, input.b); console.log("diagnostico"); return total; }',
      },
    ].map((item) => ({
      name: item.name,
      languageId: "javascript",
      files: [{ path: "solution.js", content: item.content }],
      logs: item.name === "helper-with-log",
    }));
  const source = files[0].content;
  const syntax = ts.createSourceFile(
    files[0].path,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let implementation: ts.ArrowFunction | ts.FunctionDeclaration | undefined;
  for (const statement of syntax.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName
    )
      implementation = statement;
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        if (
          declaration.name.getText(syntax) === functionName &&
          declaration.initializer &&
          ts.isArrowFunction(declaration.initializer)
        )
          implementation = declaration.initializer;
      }
  }
  if (!implementation?.body)
    throw new Error(`No function fixture for ${challenge.id}`);
  const parameters = implementation.parameters
    .map((parameter) => parameter.getText(syntax))
    .join(", ");
  const body = ts.isBlock(implementation.body)
    ? implementation.body.getText(syntax)
    : `{ return ${implementation.body.getText(syntax)}; }`;
  const statement = ts.isFunctionDeclaration(implementation)
    ? implementation
    : implementation.parent.parent.parent;
  const before = source.slice(0, statement.getFullStart());
  const after = source.slice(statement.end);
  const contents = [
    `${before}export function ${functionName}(${parameters}) ${body}${after}`,
    `${before}export const ${functionName} = (${parameters}) => ${body};${after}`,
    `${before}function calculate(${parameters}) ${body}\nexport function ${functionName}(...args${languageId === "typescript" ? ": Parameters<typeof calculate>" : ""}) { const result = calculate(...args); console.log("diagnostico"); return result; }${after}`,
  ];
  return contents.map((content, index) => ({
    name: ["named-function", "arrow-function", "helper-with-log"][index],
    languageId,
    files: [{ ...files[0], content }, ...files.slice(1)],
    logs: index === 2,
  }));
}

export const missingExportReproduction: SolutionVariant = {
  name: "missing-export",
  languageId: "javascript",
  files: [
    {
      path: "solution.js",
      content: "const teste = (a, b) => a + b;\nteste(2, 3);",
    },
  ],
  logs: false,
};
