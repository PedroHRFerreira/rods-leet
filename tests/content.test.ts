import { describe, expect, test } from 'vitest';
import ts from 'typescript';
import { challenges, topics } from '../src/content/catalog.ts';
import { getEditorial, getEvaluation } from '../judge/index.ts';
import { equalJson, compareSql, type SqlResult } from '../judge/comparators.ts';
import { referenceSolutions } from '../judge/references/algorithms.ts';
import { MinHeap } from '../judge/references/min-heap.ts';
import { shortestPath, pathCost, comparePath, type Graph } from '../judge/references/shortest-path.ts';
import { diagnoseGrowth, type ComplexityProfile, type Measurement } from '../judge/complexity.ts';
import { sqlFixtures } from '../judge/sql.ts';

describe('published beta catalog', () => {
  test('50 distinct complete challenges, 10 topics, difficulty coverage and language templates', () => {
    expect(challenges).toHaveLength(50);
    expect(new Set(challenges.map(c => c.id)).size).toBe(50);
    expect(new Set(challenges.map(c => c.versionId)).size).toBe(50);
    expect(topics).toHaveLength(10);
    for (const [topic, count] of [['logic', 10], ['algorithms', 15], ['data-structures', 15], ['sql', 10]] as const) {
      const subset = challenges.filter(c => c.topicId === topic);
      expect(subset).toHaveLength(count);
      expect(new Set(subset.map(c => c.difficulty))).toEqual(new Set(['easy', 'medium', 'hard']));
    }
    for (const challenge of challenges) {
      expect(challenge.description.length).toBeGreaterThan(80);
      expect(challenge.examples.length).toBeGreaterThan(0);
      expect(challenge.constraints.length).toBeGreaterThan(0);
      expect(challenge.executionAvailable).toBe(false);
      expect(challenge.languageIds).toHaveLength(challenge.kind === 'sql' || challenge.id === 'shortest-path' ? 1 : 10);
      for (const language of challenge.languageIds) expect(challenge.starterFilesByLanguage[language]?.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(challenge);
      expect(serialized).not.toContain('isCorrect');
      expect(serialized).not.toContain('hiddenInputs');
      expect(serialized).not.toContain('canonicalSources');
    }
  });

  test.each(challenges.filter(c => c.kind !== 'sql'))('$id reference satisfies every public example and preserves input', challenge => {
    for (const example of challenge.examples) {
      const input = structuredClone(example.input);
      const actual = referenceSolutions[challenge.id](input);
      expect(actual).toEqual(example.output);
      expect(input).toEqual(example.input);
    }
  });

  test.each(challenges)('$id has private cases and an unlockable editorial', challenge => {
    const profile = getEvaluation(challenge.id, challenge.languageIds[0], 'submission');
    expect(profile.cases.some(c => !c.public)).toBe(true);
    expect(profile.cases.some(c => c.public)).toBe(true);
    expect(getEvaluation(challenge.id, challenge.languageIds[0], 'run').cases.every(c => c.public)).toBe(true);
    const editorial = getEditorial(challenge.id, challenge.languageIds[0]);
    expect(editorial.hints).toHaveLength(3);
    expect(editorial.files.length).toBeGreaterThan(0);
  });

  test('canonical displayed TypeScript editorials compile and solve all official cases', () => {
    // Only repository-authored reference files are compiled here. Student code is never evaluated on the host.
    for (const challenge of challenges.filter(c => c.kind !== 'sql')) {
      const editorial = getEditorial(challenge.id, 'typescript');
      const source = editorial.files.find(file => file.path === 'solution.ts')!.content;
      const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
      const exports: Record<string, (...args: any[]) => unknown> = {};
      new Function('exports', 'require', output)(exports, () => ({ MinHeap }));
      const profile = getEvaluation(challenge.id, 'typescript');
      for (const item of profile.cases) {
        const input = structuredClone(item.input);
        let actual: unknown;
        if (challenge.id === 'shortest-path') { const p = input as { graph: Graph; start: number; end: number }; actual = exports.shortestPath(p.graph, p.start, p.end); }
        else if (challenge.id === 'find-max') actual = { result: exports.findMax(input), inputAfter: input };
        else actual = exports.solve(input);
        expect(profile.compare(item.input, item.expected, actual), `${challenge.id} rejected its editorial`).toBe(true);
      }
    }
  });
});

describe('trusted comparators and adversarial cases', () => {
  test('findMax rejects zero initialization, missing boundaries, wrong empty result and mutation', () => {
    const profile = getEvaluation('find-max', 'typescript');
    const wrong = [
      (v: number[]) => v.reduce((a, b) => Math.max(a, b), 0),
      (v: number[]) => v.length ? Math.max(...v.slice(1)) : null,
      (v: number[]) => v.length ? Math.max(...v.slice(0, -1)) : null,
      (v: number[]) => v.length ? Math.max(...v) : 0,
    ];
    for (const solve of wrong) expect(profile.cases.some(c => !profile.compare(c.input, c.expected, { result: solve(c.input as number[]), inputUnchanged: true }))).toBe(true);
    expect(profile.compare([3, 1], 3, { result: 3, inputAfter: [1, 3] })).toBe(false);
    expect(profile.compare([3, 1], 3, { result: 3, inputUnchanged: false })).toBe(false);
    expect(profile.compare([3, 1], 3, 3)).toBe(false);
    expect(profile.compare([], null, { result: null, inputUnchanged: true })).toBe(true);
  });

  test('JSON comparison distinguishes types, order, missing keys and inherited properties', () => {
    expect(equalJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(equalJson(1, '1')).toBe(false);
    expect(equalJson([1, 2], [2, 1])).toBe(false);
    expect(equalJson({ a: null }, {})).toBe(false);
    expect(equalJson({ a: 1 }, Object.create({ a: 1 }))).toBe(false);
  });

  test('Dijkstra matches independent Floyd-Warshall distances in 200 generated graphs', () => {
    let seed = 314159;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let iteration = 0; iteration < 200; iteration++) {
      const n = 1 + random() % 10;
      const graph: Array<Array<{ to: number; weight: number }>> = Array.from({ length: n }, () => []);
      const distance = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : Infinity));
      for (let i = 0; i < n * n; i++) {
        const a = random() % n, b = random() % n, weight = random() % 8;
        if (random() % 3 === 0) continue;
        graph[a].push({ to: b, weight }); distance[a][b] = Math.min(distance[a][b], weight);
      }
      for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) distance[i][j] = Math.min(distance[i][j], distance[i][k] + distance[k][j]);
      for (let start = 0; start < n; start++) for (let end = 0; end < n; end++) expect(pathCost({ graph, start, end }, shortestPath(graph, start, end))).toBe(distance[start][end]);
    }
  });

  test('graph comparator accepts tied routes and rejects nonexistent edges and endpoints', () => {
    const input = { graph: [[{ to: 1, weight: 4 }, { to: 1, weight: 1 }, { to: 2, weight: 1 }], [{ to: 3, weight: 1 }], [{ to: 3, weight: 1 }], []], start: 0, end: 3 };
    expect(comparePath(input, [0, 1, 3], [0, 2, 3])).toBe(true);
    expect(comparePath(input, [0, 1, 3], [0, 3])).toBe(false);
    expect(comparePath(input, [0, 1, 3], [1, 3])).toBe(false);
    expect(comparePath(input, [0, 1, 3], [])).toBe(false);
  });

  test('SQL comparison preserves NULL, types, duplicate counts and specified ordering', () => {
    const expected: SqlResult = { columns: [{ name: 'n', type: 'int4' }], rows: [[1], [1], [null]] };
    expect(compareSql(expected, { ...expected, rows: [[null], [1], [1]] }, false)).toBe(true);
    expect(compareSql(expected, { ...expected, rows: [[null], [1], [1]] }, true)).toBe(false);
    expect(compareSql(expected, { ...expected, rows: [[null], [1]] }, false)).toBe(false);
    expect(compareSql(expected, { ...expected, rows: [[null], [1], [2]] }, false)).toBe(false);
    expect(compareSql(expected, { ...expected, columns: [{ name: 'n', type: 'int8' }] }, false)).toBe(false);
    expect(compareSql(expected, { ...expected, rows: [[1], [1], ['null']] }, false)).toBe(false);
  });

  test.each(challenges.filter(c => c.kind === 'sql'))('$id public fixture matches the published SQL example', challenge => {
    const fixtures = sqlFixtures(challenge.id, challenge.sqlSchema!, challenge.examples);
    expect(fixtures.filter(f => !f.public)).toHaveLength(3);
    for (let i = 0; i < challenge.examples.length; i++) {
      const result = fixtures[i].expected;
      const objects = result.rows.map(row => Object.fromEntries(result.columns.map((column, index) => [column.name, row[index]])));
      expect(objects).toEqual(challenge.examples[i].output);
    }
  });
});

describe('empirical growth is advisory and conservative', () => {
  const profile: ComplexityProfile = { challengeId: 'find-max', languageId: 'typescript', runtimeId: 'test-runtime', environmentId: 'calibration-fixture', parameter: 'n', models: ['constant', 'logarithmic', 'linear', 'linear-logarithmic', 'quadratic'], calibrated: true };
  const measure = (fn: (n: number) => number): Measurement[] => [128, 256, 512, 1024, 2048, 4096].flatMap(n => [1, 2, 3].map(seed => ({ n, seed, source: 'supervisor' as const, samplesMs: Array(5).fill(fn(n)) })));
  test('reports observed linear growth and measured interval', () => {
    const result = diagnoseGrowth(profile, measure(n => 0.2 + n * 0.001));
    expect(result.status).toBe('compatible'); expect(result.model).toBe('linear'); expect(result.measuredRange).toEqual([128, 4096]); expect(result.sampleCount).toBe(90);
  });
  test('reports inconclusive without calibration, enough sizes, or independent seeds', () => {
    expect(diagnoseGrowth({ ...profile, calibrated: false }, measure(n => n)).status).toBe('inconclusive');
    expect(diagnoseGrowth(profile, measure(n => n).slice(0, 15)).status).toBe('inconclusive');
    expect(diagnoseGrowth(profile, measure(n => n).map(m => ({ ...m, seed: 1 }))).status).toBe('inconclusive');
  });
  test('does not flatten graphs to n, trust student metrics, or extrapolate a changed algorithm', () => {
    expect(diagnoseGrowth(profile, measure(n => n).map(m => ({ ...m, dimensions: { V: m.n, E: m.n * 2 } }))).status).toBe('inconclusive');
    expect(diagnoseGrowth(profile, measure(n => n).map(m => ({ ...m, source: 'student' as 'supervisor' }))).status).toBe('inconclusive');
    expect(diagnoseGrowth(profile, measure(n => n <= 1024 ? n : n * n)).status).toBe('inconclusive');
  });
});
