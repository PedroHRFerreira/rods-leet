import { useEffect, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { LANGUAGES } from "../domain/rules";
import { hasUnsafeSourceCharacters } from "../domain/source-security";
import type { LanguageId } from "../lib/contracts";

// Workers and editor assets are served by this application, without a public CDN.
self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    return label === "typescript" || label === "javascript"
      ? new TypeScriptWorker()
      : new EditorWorker();
  },
};
monaco.editor.defineTheme("rods-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#000000",
    "editor.foreground": "#e5e5e5",
    "editor.lineHighlightBackground": "#111111",
    "editorLineNumber.foreground": "#737373",
    "editorLineNumber.activeForeground": "#f5f5f5",
    "editor.selectionBackground": "#453313",
    "editorCursor.foreground": "#f59e0b",
    "editorIndentGuide.background1": "#252525",
    "editorWidget.background": "#111111",
    "editorWidget.border": "#252525",
  },
});
monaco.editor.defineTheme("rods-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#171717",
    "editor.lineHighlightBackground": "#f5f5f4",
    "editorLineNumber.foreground": "#737373",
    "editor.selectionBackground": "#ffedd5",
    "editorCursor.foreground": "#b45309",
  },
});
loader.config({ monaco });

export default function CodeEditor({
  value,
  onChange,
  language,
  path,
  readOnly = false,
  onUnsafeInput,
}: {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId;
  path: string;
  hard?: boolean;
  readOnly?: boolean;
  onUnsafeInput?: () => void;
}) {
  const [simple, setSimple] = useState(false);
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme === "light"
      ? "rods-light"
      : "rods-dark",
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(
        document.documentElement.dataset.theme === "light"
          ? "rods-light"
          : "rods-dark",
      ),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  const acceptChange = (next: string) => {
    if (hasUnsafeSourceCharacters(next)) {
      onUnsafeInput?.();
      return;
    }
    onChange(next);
  };
  return (
    <div className="code-editor-wrap">
      <div className="editor-accessibility">
        <span>Escreva, cole e experimente seu código livremente</span>
        <button type="button" onClick={() => setSimple(!simple)}>
          {simple ? "Editor avançado" : "Editor simples"}
        </button>
      </div>
      {simple ? (
        <textarea
          className="simple-code-editor"
          aria-label={`Código de ${path}`}
          spellCheck={false}
          value={value}
          onChange={(event) => acceptChange(event.target.value)}
          readOnly={readOnly}
        />
      ) : (
        <Editor
          height="clamp(320px, 48dvh, 560px)"
          language={
            path.endsWith(".json")
              ? "json"
              : LANGUAGES.find((item) => item.id === language)?.monacoId
          }
          path={path}
          value={value}
          onChange={(next) => acceptChange(next ?? "")}
          theme={theme}
          loading={
            <div className="editor-loading" role="status">
              Preparando seu editor…
            </div>
          }
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"Fira Code", "SFMono-Regular", Consolas, monospace',
            lineHeight: 24,
            padding: { top: 20, bottom: 20 },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            readOnly,
            ariaLabel: `Código de ${path}`,
            accessibilitySupport: "on",
            folding: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            wordBasedSuggestions: "currentDocument",
            parameterHints: { enabled: true },
            inlineSuggest: { enabled: true },
            snippetSuggestions: "inline",
          }}
        />
      )}
    </div>
  );
}
