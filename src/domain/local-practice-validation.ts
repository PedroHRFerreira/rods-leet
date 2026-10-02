import {
  LOCAL_PRACTICE_LIMITS,
  type LocalPracticeInput,
} from "./local-practice";

export const LOCAL_PRACTICE_MAX_SOURCE_BYTES =
  LOCAL_PRACTICE_LIMITS.maxSourceBytes;
export const LOCAL_PRACTICE_MAX_INPUT_BYTES =
  LOCAL_PRACTICE_LIMITS.maxInputBytes;
const MAX_JSON_DEPTH = LOCAL_PRACTICE_LIMITS.maxInputDepth;
const MAX_JSON_NODES = LOCAL_PRACTICE_LIMITS.maxInputNodes;
const encoder = new TextEncoder();
export type LocalPracticeValidationInput = LocalPracticeInput;
export type LocalPracticeUnavailableReason =
  "unsupported_language" | "unsupported_workspace" | "invalid_input";
export type LocalPracticeValidation =
  | {
      available: true;
      source: string;
      path: string;
      languageId: "javascript" | "typescript";
      functionName: string;
      inputJson: string;
    }
  | {
      available: false;
      reason: LocalPracticeUnavailableReason;
      message: string;
    };

// Copy JSON data without invoking accessors/toJSON or changing unsupported values
// (JSON.stringify alone silently turns nonfinite numbers into null).
function safeJson(value: unknown): string {
  const ancestors = new Set<object>();
  let nodes = 0;
  function copy(value: unknown, depth: number): unknown {
    if (++nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH)
      throw new Error("input_complexity");
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "object" || ancestors.has(value))
      throw new Error("non_json_input");
    ancestors.add(value);
    try {
      const prototype = Object.getPrototypeOf(value);
      const array = Array.isArray(value);
      if (
        array
          ? prototype !== Array.prototype
          : prototype !== Object.prototype && prototype !== null
      )
        throw new Error("non_json_object");
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (array) {
        const result: unknown[] = [];
        for (let index = 0; index < value.length; index++) {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !("value" in descriptor))
            throw new Error("non_json_array");
          result.push(copy(descriptor.value, depth + 1));
        }
        return result;
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (!descriptor.enumerable) continue;
        if (!("value" in descriptor)) throw new Error("non_json_accessor");
        result[key] = copy(descriptor.value, depth + 1);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return JSON.stringify(copy(value, 0));
}

/** Unavailable means use the existing server runner; it is never a learner verdict. */
export function validateLocalPractice(
  input: LocalPracticeValidationInput,
): LocalPracticeValidation {
  const unavailable = (
    reason: LocalPracticeUnavailableReason,
  ): LocalPracticeValidation => ({
    available: false,
    reason,
    message:
      "Este exemplo precisa do executor conectado. A prática local não está disponível para esta entrada.",
  });
  if (input.languageId !== "javascript" && input.languageId !== "typescript")
    return unavailable("unsupported_language");
  if (
    !Array.isArray(input.files) ||
    input.files.length !== LOCAL_PRACTICE_LIMITS.maxFiles
  )
    return unavailable("unsupported_workspace");
  const file = input.files[0];
  if (
    !file ||
    typeof file.path !== "string" ||
    typeof file.content !== "string" ||
    file.path.length > 200 ||
    !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
    file.path.split("/").some((part) => !part || part === "." || part === "..")
  )
    return unavailable("unsupported_workspace");
  if (!file.path.endsWith(input.languageId === "javascript" ? ".js" : ".ts"))
    return unavailable("unsupported_workspace");
  if (encoder.encode(file.content).byteLength > LOCAL_PRACTICE_MAX_SOURCE_BYTES)
    return unavailable("unsupported_workspace");
  if (
    typeof input.functionName !== "string" ||
    !/^[a-zA-Z_$][a-zA-Z0-9_$]{0,127}$/.test(input.functionName) ||
    ["__proto__", "constructor", "prototype"].includes(input.functionName)
  )
    return unavailable("invalid_input");
  let inputJson: string;
  try {
    inputJson = safeJson(input.input);
  } catch {
    return unavailable("invalid_input");
  }
  if (encoder.encode(inputJson).byteLength > LOCAL_PRACTICE_MAX_INPUT_BYTES)
    return unavailable("invalid_input");
  return {
    available: true,
    source: file.content,
    path: file.path,
    languageId: input.languageId,
    functionName: input.functionName,
    inputJson,
  };
}
