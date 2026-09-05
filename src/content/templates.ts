import type { ContentLanguageId, StarterFile } from "./types.ts";

export const allProgrammingLanguages: ContentLanguageId[] = [
  "python",
  "javascript",
  "typescript",
  "java",
  "csharp",
  "cpp",
  "c",
  "go",
  "rust",
  "kotlin",
];
export const algorithmLanguages = allProgrammingLanguages;

export function algorithmTemplates(): Partial<
  Record<ContentLanguageId, StarterFile[]>
> {
  return {
    typescript: [
      {
        path: "solution.ts",
        content:
          'export function solve(input: any): any {\n  // Retorne o resultado descrito no contrato.\n  throw new Error("Não implementado");\n}\n',
      },
    ],
    javascript: [
      {
        path: "solution.js",
        content:
          'export function solve(input) {\n  // Retorne o resultado descrito no contrato.\n  throw new Error("Não implementado");\n}\n',
      },
    ],
    python: [
      {
        path: "solution.py",
        content:
          'def solve(input):\n    """Retorne o resultado descrito no contrato."""\n    raise NotImplementedError("Não implementado")\n',
      },
    ],
    java: [
      {
        path: "Solution.java",
        content:
          'import com.fasterxml.jackson.databind.JsonNode;\n\npublic final class Solution {\n    public static JsonNode solve(JsonNode input) {\n        throw new UnsupportedOperationException("Não implementado");\n    }\n}\n',
      },
    ],
    csharp: [
      {
        path: "Solution.cs",
        content:
          "using System.Text.Json.Nodes;\n\npublic static class Solution {\n    public static JsonNode? Solve(JsonNode? input) {\n        throw new System.NotImplementedException();\n    }\n}\n",
      },
    ],
    cpp: [
      {
        path: "solution.cpp",
        content:
          '#include <nlohmann/json.hpp>\n#include <stdexcept>\n\nnlohmann::json solve(const nlohmann::json& input) {\n    throw std::logic_error("Não implementado");\n}\n',
      },
    ],
    c: [
      {
        path: "solution.c",
        content:
          "#include <cjson/cJSON.h>\n\n// Retorne um novo valor JSON. O adaptador libera o resultado.\ncJSON *solve(const cJSON *input) {\n    (void)input;\n    return cJSON_CreateNull();\n}\n",
      },
    ],
    go: [
      {
        path: "solution.go",
        content:
          'package solution\n\nfunc Solve(input any) any {\n    panic("Não implementado")\n}\n',
      },
    ],
    rust: [
      {
        path: "solution.rs",
        content:
          'use serde_json::Value;\n\npub fn solve(input: Value) -> Value {\n    todo!("Não implementado")\n}\n',
      },
    ],
    kotlin: [
      {
        path: "Solution.kt",
        content:
          'import kotlinx.serialization.json.JsonElement\n\nfun solve(input: JsonElement): JsonElement {\n    TODO("Não implementado")\n}\n',
      },
    ],
  };
}

export const findMaxTemplates: Partial<
  Record<ContentLanguageId, StarterFile[]>
> = {
  typescript: [
    {
      path: "solution.ts",
      content:
        'export function findMax(values: readonly number[]): number | null {\n  throw new Error("Não implementado");\n}\n',
    },
  ],
  javascript: [
    {
      path: "solution.js",
      content:
        'export function findMax(values) {\n  throw new Error("Não implementado");\n}\n',
    },
  ],
  python: [
    {
      path: "solution.py",
      content:
        'def find_max(values: list[int]) -> int | None:\n    raise NotImplementedError("Não implementado")\n',
    },
  ],
  java: [
    {
      path: "Solution.java",
      content:
        'public final class Solution {\n    public static Integer findMax(int[] values) {\n        throw new UnsupportedOperationException("Não implementado");\n    }\n}\n',
    },
  ],
  csharp: [
    {
      path: "Solution.cs",
      content:
        "public static class Solution {\n    public static int? FindMax(int[] values) {\n        throw new System.NotImplementedException();\n    }\n}\n",
    },
  ],
  cpp: [
    {
      path: "solution.cpp",
      content:
        '#include <optional>\n#include <vector>\n#include <stdexcept>\n\nstd::optional<int> find_max(const std::vector<int>& values) {\n    throw std::logic_error("Não implementado");\n}\n',
    },
  ],
  c: [
    {
      path: "solution.c",
      content:
        "#include <stdbool.h>\n#include <stddef.h>\n\n// present=false representa null no protocolo do juiz.\ntypedef struct { bool present; int value; } MaxResult;\nMaxResult find_max(const int *values, size_t length) {\n    (void)values; (void)length;\n    return (MaxResult){false, 0};\n}\n",
    },
  ],
  go: [
    {
      path: "solution.go",
      content:
        'package solution\n\n// O segundo retorno indica se existe resultado.\nfunc FindMax(values []int) (int, bool) {\n    panic("Não implementado")\n}\n',
    },
  ],
  rust: [
    {
      path: "solution.rs",
      content:
        'pub fn find_max(values: &[i32]) -> Option<i32> {\n    todo!("Não implementado")\n}\n',
    },
  ],
  kotlin: [
    {
      path: "Solution.kt",
      content:
        'fun findMax(values: IntArray): Int? {\n    TODO("Não implementado")\n}\n',
    },
  ],
};

export const shortestPathTemplates: Partial<
  Record<ContentLanguageId, StarterFile[]>
> = {
  typescript: [
    {
      path: "solution.ts",
      content:
        'import { MinHeap } from "./min-heap";\n\nexport type Graph = ReadonlyArray<ReadonlyArray<{ to: number; weight: number }>>;\n\nexport function shortestPath(graph: Graph, start: number, end: number): number[] {\n  throw new Error("Não implementado");\n}\n',
    },
    {
      path: "min-heap.ts",
      content:
        'type Entry = [cost: number, vertex: number];\n\nexport class MinHeap {\n  get size(): number { throw new Error("Não implementado"); }\n  push(item: Entry): void { throw new Error("Não implementado"); }\n  pop(): Entry { throw new Error("Não implementado"); }\n}\n',
    },
    {
      path: "solution.test.ts",
      content:
        'import { expect, test } from "vitest";\nimport { shortestPath } from "./solution";\n\ntest("origem igual ao destino", () => {\n  expect(shortestPath([[]], 0, 0)).toEqual([0]);\n});\n',
    },
  ],
};
