import { ApiError } from "./db.ts";
export interface SourceFile {
  path: string;
  content: string;
}
export function validateFiles(
  value: unknown,
  allowedPaths: string[],
): SourceFile[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new ApiError("invalid_files");
  }
  const paths = new Set<string>();
  let bytes = 0;
  const files = value.map((file: unknown) => {
    if (!file || typeof file !== "object") throw new ApiError("invalid_files");
    const { path, content } = file as Record<string, unknown>;
    if (
      typeof path !== "string" ||
      !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/.test(path) ||
      path.length > 160 ||
      !allowedPaths.includes(path) ||
      paths.has(path)
    )
      throw new ApiError("invalid_file_path");
    if (typeof content !== "string" || content.includes("\0")) {
      throw new ApiError("invalid_file_content");
    }
    paths.add(path);
    bytes += new TextEncoder().encode(content).length;
    if (bytes > 256 * 1024) throw new ApiError("source_too_large", 413);
    return { path, content };
  });
  if (
    !allowedPaths
      .filter((path) => !path.includes(".test."))
      .every((path) => paths.has(path))
  )
    throw new ApiError("missing_source_file");
  return files;
}
