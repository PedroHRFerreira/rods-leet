import type { LanguageId, SourceFile } from "../lib/contracts";

/** Public learning starters. No official answers or private judge data. */
const starters: Partial<Record<LanguageId, SourceFile>> = {
  javascript: {
    path: "solution.js",
    content:
      '// Execute e veja a saída. Depois leia a entrada e resolva o desafio.\nimport fs from "node:fs";\nconst texto = fs.readFileSync(0, "utf8").trim();\nconst entrada = texto ? JSON.parse(texto) : null;\nconsole.log("Olá, mundo!");\n// Para submeter: imprima somente o resultado, por exemplo console.log(JSON.stringify(resultado)).\n',
  },
  typescript: {
    path: "solution.ts",
    content:
      '// Execute e veja a saída. Depois leia a entrada e resolva o desafio.\ndeclare function require(name: string): { readFileSync(fd: number, encoding: string): string };\nconst fs = require("node:fs");\nconst texto = fs.readFileSync(0, "utf8").trim();\nconst entrada = texto ? JSON.parse(texto) : null;\nconsole.log("Olá, mundo!");\n// Para submeter: imprima somente o resultado, por exemplo console.log(JSON.stringify(resultado)).\n',
  },
  python: {
    path: "solution.py",
    content:
      '# Execute e veja a saída. Depois leia a entrada e resolva o desafio.\nimport sys, json\ntexto = sys.stdin.read().strip()\nentrada = json.loads(texto) if texto else None\nprint("Olá, mundo!")\n# Para submeter: imprima somente o resultado, por exemplo print(json.dumps(resultado)).\n',
  },
  java: {
    path: "Solution.java",
    content:
      'import java.util.Scanner;\npublic class Solution {\n  public static void main(String[] args) {\n    Scanner scanner = new Scanner(System.in);\n    String entrada = scanner.hasNextLine() ? scanner.nextLine() : "";\n    System.out.println("Olá, mundo!");\n    // Leia os valores de entrada (JSON) e imprima somente o resultado ao submeter.\n  }\n}\n',
  },
  csharp: {
    path: "Solution.cs",
    content:
      'using System;\nclass Program {\n  static void Main() {\n    string entrada = Console.ReadLine() ?? "";\n    Console.WriteLine("Olá, mundo!");\n    // Leia os valores de entrada (JSON) e imprima somente o resultado ao submeter.\n  }\n}\n',
  },
  c: {
    path: "solution.c",
    content:
      '#include <stdio.h>\nint main(void) {\n  char entrada[65537] = {0};\n  fgets(entrada, sizeof(entrada), stdin);\n  printf("Olá, mundo!\\n");\n  // Leia os valores de entrada (JSON) e imprima somente o resultado ao submeter.\n  return 0;\n}\n',
  },
  cpp: {
    path: "solution.cpp",
    content:
      '#include <iostream>\n#include <string>\nint main() {\n  std::string entrada;\n  std::getline(std::cin, entrada);\n  std::cout << "Olá, mundo!" << std::endl;\n  // Leia os valores de entrada (JSON) e imprima somente o resultado ao submeter.\n}\n',
  },
  go: {
    path: "solution.go",
    content:
      'package main\nimport ("fmt"; "os"; "io"; "encoding/json")\nfunc main() {\n  texto, _ := io.ReadAll(os.Stdin)\n  var entrada interface{}\n  if len(texto) > 0 { json.Unmarshal(texto, &entrada) }\n  fmt.Println("Olá, mundo!")\n  // Resolva usando entrada e imprima somente o resultado ao submeter.\n}\n',
  },
  rust: {
    path: "solution.rs",
    content:
      'use std::io::{self, Read};\nfn main() {\n  let mut entrada = String::new();\n  io::stdin().read_to_string(&mut entrada).unwrap();\n  println!("Olá, mundo!");\n  // Leia os valores de entrada (JSON) e imprima somente o resultado ao submeter.\n}\n',
  },
  kotlin: {
    path: "Solution.kt",
    content:
      'fun main() {\n  val entrada = readlnOrNull() ?: ""\n  println("Olá, mundo!")\n  // Leia os valores de entrada (JSON) e imprima somente o resultado ao submeter.\n}\n',
  },
};

export function programStarterFiles(language: LanguageId): SourceFile[] {
  const starter = starters[language];
  return starter ? [{ ...starter }] : [];
}
