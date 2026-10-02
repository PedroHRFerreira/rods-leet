import ts from "typescript";
import type { PreparedPractice } from "./local-practice-runtime";

const libraries = import.meta.glob<string>(
  "/node_modules/typescript/lib/lib.es*.d.ts",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);
const decorators = import.meta.glob<string>(
  "/node_modules/typescript/lib/lib.decorators*.d.ts",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

/** Virtual compiler filesystem: only standard types and the student's one source. */
export function prepareTypeScript(
  prepared: PreparedPractice,
): { source: string } | { error: string } {
  const files = new Map<string, string>();
  for (const [path, source] of Object.entries({ ...libraries, ...decorators }))
    files.set(`/${path.split("/").at(-1)}`, source);
  const name = "/solution.ts";
  files.set(name, prepared.source);
  files.set(
    "/console.d.ts",
    "declare const console: { log(...values: any[]): void; info(...values: any[]): void; warn(...values: any[]): void; error(...values: any[]): void; debug(...values: any[]): void; };",
  );
  const normalize = (name: string) => `/${name.split("/").at(-1)}`;
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    lib: ["lib.es2022.d.ts"],
    types: [],
    noEmit: true,
    skipLibCheck: true,
  };
  const host: ts.CompilerHost = {
    getSourceFile: (file, languageVersion) => {
      const text = files.get(normalize(file));
      return text === undefined
        ? undefined
        : ts.createSourceFile(file, text, languageVersion, true);
    },
    getDefaultLibFileName: () => "/lib.es2022.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (file) => files.has(normalize(file)),
    readFile: (file) => files.get(normalize(file)),
    getCanonicalFileName: (file) => file,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram([name, "/console.d.ts"], options, host);
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length)
    return {
      error: diagnostics
        .slice(0, 8)
        .map((d) => {
          const position =
            d.file && d.start !== undefined
              ? d.file.getLineAndCharacterOfPosition(d.start)
              : null;
          return `TS${d.code}${position ? ` · linha ${position.line + 1}` : ""}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
        })
        .join("\n"),
    };
  return {
    source: ts.transpileModule(prepared.source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  };
}
