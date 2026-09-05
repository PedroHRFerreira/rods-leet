import { expect, it } from 'vitest';
import { validateWorkspace } from './workspace';

const manifest = { editableFiles: ['solution.ts'], editableDirectories: ['src'], requiredFiles: ['solution.ts'] };
it.each(['/etc/passwd', '../solution.ts', 'src/../config.ts', 'src//bad.ts', 'C:\\file.ts', '.env', 'src/.secret'])('rejects unsafe path %s', path => {
  expect(() => validateWorkspace([{ path, content: '' }], manifest)).toThrow();
});
it('copies snapshots and checks UTF-8 bytes, extra properties, and duplicate names', () => {
  const files = [{ path: 'solution.ts', content: 'é' }];
  const snapshot = validateWorkspace(files, manifest);
  files[0].content = 'changed';
  expect(snapshot[0].content).toBe('é');
  expect(() => validateWorkspace(snapshot, { ...manifest, maxSourceBytes: 1 })).toThrow();
  expect(() => validateWorkspace([...snapshot, ...snapshot], manifest)).toThrow();
  expect(() => validateWorkspace([{ ...snapshot[0], target: '/etc/passwd' } as never], manifest)).toThrow();
  expect(() => validateWorkspace([{ path: 'src/other.ts', content: '' }], manifest)).toThrow();
});
