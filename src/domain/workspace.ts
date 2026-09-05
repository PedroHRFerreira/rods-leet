import type { SourceFile } from '../lib/contracts';
import { DEFAULT_EXECUTION_LIMITS } from './rules';

export interface WorkspaceManifest {
  editableFiles: readonly string[];
  editableDirectories?: readonly string[];
  requiredFiles?: readonly string[];
  maxFiles?: number;
  maxSourceBytes?: number;
}
export function normalizeSourcePath(path: string): string {
  if (typeof path !== 'string' || path.length > 180 || !/^[a-zA-Z0-9_.\/-]+$/.test(path)) throw new Error('Caminho de arquivo inválido');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '' || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new Error('Use somente caminhos relativos dentro do projeto');
  }
  return path;
}
export function validateWorkspace(files: readonly SourceFile[], manifest: WorkspaceManifest): SourceFile[] {
  if (!Array.isArray(files) || files.length < 1 || files.length > (manifest.maxFiles ?? DEFAULT_EXECUTION_LIMITS.maxFiles)) throw new Error('Quantidade de arquivos inválida');
  const seen = new Set<string>();
  const encoder = new TextEncoder();
  let bytes = 0;
  const snapshot = files.map(file => {
    if (!file || typeof file !== 'object' || Object.keys(file).some(key => key !== 'path' && key !== 'content')) throw new Error('Somente arquivos de texto são permitidos');
    const path = normalizeSourcePath(file.path);
    if (seen.has(path)) throw new Error('Há caminhos de arquivo duplicados');
    seen.add(path);
    const allowed = manifest.editableFiles.includes(path) || manifest.editableDirectories?.some(directory => path.startsWith(`${normalizeSourcePath(directory)}/`));
    if (!allowed) throw new Error('Arquivo fora das áreas editáveis');
    if (typeof file.content !== 'string' || file.content.includes('\0')) throw new Error('O conteúdo deve ser texto sem bytes nulos');
    bytes += encoder.encode(file.content).byteLength;
    if (bytes > (manifest.maxSourceBytes ?? DEFAULT_EXECUTION_LIMITS.maxSourceBytes)) throw new Error('O código excede o limite de tamanho');
    return { path, content: file.content };
  });
  for (const path of manifest.requiredFiles ?? []) if (!seen.has(path)) throw new Error(`Arquivo obrigatório ausente: ${path}`);
  return snapshot;
}
