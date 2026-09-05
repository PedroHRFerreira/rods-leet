/** JSON equality preserves types and array order, but ignores object key order. */
export function equalJson(expected: unknown, actual: unknown): boolean {
  if (expected === actual) return true;
  if (typeof expected !== typeof actual || expected === null || actual === null) return false;
  if (typeof expected !== 'object') return false;
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.length === actual.length && expected.every((v, i) => equalJson(v, actual[i]));
  if (Array.isArray(actual)) return false;
  const a = expected as Record<string, unknown>, b = actual as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equalJson(a[key], b[key]));
}

export interface SqlColumn { name: string; type: 'int4' | 'int8' | 'text' | 'date' | 'numeric' | 'bool' }
export interface SqlResult { columns: SqlColumn[]; rows: unknown[][] }

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object' && !Array.isArray(value)) return `{${Object.keys(value as object).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',')}}`;
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return JSON.stringify(value);
}

export function compareSql(expected: SqlResult, actual: unknown, ordered: boolean): boolean {
  if (!actual || typeof actual !== 'object') return false;
  const candidate = actual as SqlResult;
  if (!equalJson(expected.columns, candidate.columns) || !Array.isArray(candidate.rows) || candidate.rows.length !== expected.rows.length) return false;
  if (candidate.rows.some(row => !Array.isArray(row) || row.length !== expected.columns.length)) return false;
  if (ordered) return equalJson(expected.rows, candidate.rows);
  // A multiset, not a set: duplicate counts affect correctness.
  const counts = new Map<string, number>();
  for (const row of expected.rows) { const key = canonical(row); counts.set(key, (counts.get(key) ?? 0) + 1); }
  for (const row of candidate.rows) { const key = canonical(row), count = counts.get(key) ?? 0; if (!count) return false; counts.set(key, count - 1); }
  return true;
}
