import { beforeAll, describe, expect, it } from "vitest";
import ts from "typescript";
import variant from "@jitl/quickjs-singlefile-browser-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";
import { challenges } from "../src/content/catalog";
import { solutionVariants } from "../judge/validation/solutions";
import { validateLocalPractice } from "../src/domain/local-practice-validation";
import { executeLocalJavaScript } from "../src/lib/local-practice-runtime";
import { prepareTypeScript } from "../src/lib/local-practice-typescript";

// Private solutions are imported only by Node tests, never by the browser application.
let module: QuickJSWASMModule;
beforeAll(async () => {
  module = await newQuickJSWASMModuleFromVariant(variant);
});
describe("local practice public catalog parity", () => {
  for (const challenge of challenges.filter(
    (c) => c.kind !== "sql" && c.kind !== "quiz",
  )) {
    it(`${challenge.id}: three variants, JS and TS, public examples`, () => {
      for (const languageId of ["javascript", "typescript"] as const) {
        for (const solution of solutionVariants(challenge, languageId)) {
          if (solution.files.length > 1) {
            expect(
              validateLocalPractice({
                languageId,
                files: solution.files,
                functionName: challenge.functionName ?? "solve",
                input: challenge.examples[0].input,
              }),
            ).toMatchObject({
              available: false,
              reason: "unsupported_workspace",
            });
          }
          const original = solution.files
            .slice()
            .reverse()
            .map((file) =>
              file.content.replace(
                /^import\s+\{\s*MinHeap\s*\}\s+from\s+['"]\.\/min-heap(?:\.ts)?['"];?\s*/m,
                "",
              ),
            )
            .join("\n");
          const source =
            languageId === "javascript"
              ? ts.transpileModule(original, {
                  compilerOptions: {
                    target: ts.ScriptTarget.ES2022,
                    module: ts.ModuleKind.ESNext,
                  },
                }).outputText
              : original;
          for (const example of challenge.examples) {
            const prepared = validateLocalPractice({
              languageId,
              files: [
                {
                  path:
                    languageId === "javascript" ? "solution.js" : "solution.ts",
                  content: source,
                },
              ],
              functionName: challenge.functionName ?? "solve",
              input: example.input,
            });
            expect(prepared.available).toBe(true);
            if (!prepared.available) continue;
            if (languageId === "typescript") {
              const compiled = prepareTypeScript(prepared);
              expect(
                compiled,
                `${challenge.id}/${solution.name}: ${"error" in compiled ? compiled.error : ""}`,
              ).toHaveProperty("source");
              if (!("source" in compiled)) continue;
              prepared.source = compiled.source;
            }
            const result = executeLocalJavaScript(module, prepared);
            expect(
              result.status,
              `${challenge.id}/${solution.name}/${languageId}: ${result.stderr}`,
            ).toBe("ok");
            expect(result.output).toEqual(
              challenge.functionName === "findMax"
                ? { result: example.output, inputUnchanged: true }
                : example.output,
            );
          }
        }
      }
    }, 20000);
  }
});
