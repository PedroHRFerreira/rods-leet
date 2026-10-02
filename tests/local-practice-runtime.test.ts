import { beforeAll, describe, expect, it } from "vitest";
import variant from "@jitl/quickjs-singlefile-browser-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";
import { executeLocalJavaScript } from "../src/lib/local-practice-runtime";
import { validateLocalPractice } from "../src/domain/local-practice-validation";

let module: QuickJSWASMModule;
beforeAll(async () => {
  module = await newQuickJSWASMModuleFromVariant(variant);
});
function run(
  source: string,
  input: unknown = { a: 3, b: 4 },
  functionName = "solve",
  wallMs = 3000,
) {
  const prepared = validateLocalPractice({
    languageId: "javascript",
    files: [{ path: "solution.js", content: source }],
    functionName,
    input,
  });
  if (!prepared.available) throw new Error("Invalid test input");
  return executeLocalJavaScript(module, prepared, wallMs);
}
describe("confined local JavaScript", () => {
  it("runs a real exported model function and separates console from its return", () => {
    const result = run(
      'export function solve(input){console.log("Olá");return input.a+input.b}',
    );
    expect(result).toMatchObject({
      status: "ok",
      stdout: "Olá\n",
      stderr: "",
      output: 7,
    });
    expect(result).not.toHaveProperty("xpAwarded");
  });
  it("has no DOM, network, storage, process, worker messaging, or host Function escape", () => {
    const result = run(
      'export function solve(){return [typeof fetch,typeof XMLHttpRequest,typeof window,typeof document,typeof localStorage,typeof process,typeof postMessage,globalThis.constructor.constructor("return typeof fetch")()]}',
    );
    expect(result.output).toEqual(Array(8).fill("undefined"));
  });
  it("does not leak guest state between executions", () => {
    run('globalThis.secret="old";export function solve(){return 1}');
    expect(run("export function solve(){return typeof secret}").output).toBe(
      "undefined",
    );
  });
  it("distinguishes syntax, missing export, missing return and real runtime errors", () => {
    expect(run("export function solve( {").status).toBe("compile_error");
    expect(run("function solve(){return 7}").stderr).toContain(
      "exportada solve",
    );
    expect(run("export function solve(){}").stderr).toContain("return");
    expect(
      run('export function solve(){throw new Error("Problema real")}').stderr,
    ).toContain("Problema real");
  });
  it("interrupts infinite loops, even a loop swallowing guest exceptions", () => {
    expect(
      run(
        "export function solve(){while(true){try{}catch{}}}",
        undefined,
        "solve",
        25,
      ).status,
    ).toBe("time_limit");
  });
  it("stops output floods and oversized returned data", () => {
    expect(
      run('export function solve(){while(true)console.log("🐱".repeat(100))}')
        .status,
    ).toBe("output_limit");
    expect(
      run('export function solve(){return "x".repeat(20000)}').status,
    ).toBe("output_limit");
  });
  it("confines excessive memory allocation", () => {
    expect(
      run("export function solve(){return new Array(100000000).fill(1)}")
        .status,
    ).toBe("memory_limit");
  });
  it("matches special public findMax and shortestPath function adapters", () => {
    expect(
      run(
        "export function findMax(input){return Math.max(...input)}",
        [2, 8, 5],
        "findMax",
      ).output,
    ).toEqual({ result: 8, inputUnchanged: true });
    expect(
      run(
        "export function shortestPath(graph,start,end){return [graph,start,end]}",
        { graph: { a: ["b"] }, start: "a", end: "b" },
        "shortestPath",
      ).output,
    ).toEqual([{ a: ["b"] }, "a", "b"]);
  });
  it("prevents imports from opening host modules or network", () => {
    expect(
      run(
        'import fs from "node:fs";export function solve(){return fs.readFileSync("/etc/passwd")}',
      ).status,
    ).toBe("runtime_error");
  });
  it("rejects asynchronous returns and excessively nested data without remote fallback", () => {
    expect(run("export async function solve(){return 7}").status).toBe(
      "runtime_error",
    );
    expect(
      run(
        "export function solve(){let value=1;for(let i=0;i<40;i++)value=[value];return value}",
      ).status,
    ).toBe("output_limit");
  });
});
