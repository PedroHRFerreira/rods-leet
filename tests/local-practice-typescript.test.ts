import { describe, expect, it } from "vitest";
import { prepareTypeScript } from "../src/lib/local-practice-typescript";
import { validateLocalPractice } from "../src/domain/local-practice-validation";

function compile(source: string) {
  const prepared = validateLocalPractice({
    languageId: "typescript",
    files: [{ path: "solution.ts", content: source }],
    functionName: "solve",
    input: 1,
  });
  if (!prepared.available) throw new Error("Invalid fixture");
  return prepareTypeScript(prepared);
}
describe("local TypeScript virtual compiler", () => {
  it("checks standard types and erases annotations for confined execution", () => {
    const result = compile(
      "export function solve(input: number[]): number { console.log(input.length); return Math.max(...input); }",
    );
    expect(result).toHaveProperty("source");
    if ("source" in result) expect(result.source).not.toContain(": number");
  });
  it("reports semantic errors rather than merely stripping types", () => {
    expect(
      compile(
        'export function solve(input: number): number { return "wrong"; }',
      ),
    ).toHaveProperty("error", expect.stringContaining("TS2322"));
  });
  it("does not resolve host files or expose browser globals", () => {
    expect(
      compile('import fs from "node:fs"; export function solve(){return fs}'),
    ).toHaveProperty("error");
    expect(
      compile("export function solve(){return document.cookie}"),
    ).toHaveProperty("error");
  });
});
