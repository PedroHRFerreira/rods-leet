import { expect, it } from 'vitest';
import { diagnoseGrowth } from './complexity';
import type { BenchmarkSample } from './complexity';

const samples = (fn: (n: number) => number): BenchmarkSample[] => [32, 64, 128, 256, 512, 1024].flatMap(size =>
  [1, 2, 3].flatMap(seed => Array.from({ length: 5 }, () => ({ size, seed, cpuMs: fn(size) }))));
it('labels measured linear growth without claiming a proof', () => {
  const result = diagnoseGrowth({ samples: samples(n => 2 + n / 10), trustedSupervisor: true, eligibleModels: ['constant', 'linear', 'linear_logarithmic', 'quadratic'] });
  expect(result.status).toBe('compatible');
  expect(result.model).toBe('linear');
  expect(result.measuredRange).toEqual([32, 1024]);
  expect(result.label).toContain('observado');
});
it('rejects untrusted and undersampled measurements', () => {
  expect(diagnoseGrowth({ samples: samples(n => n), trustedSupervisor: false, eligibleModels: ['linear', 'quadratic'] }).status).toBe('inconclusive');
  expect(diagnoseGrowth({ samples: [{ size: 10, seed: 1, cpuMs: 1 }], trustedSupervisor: true, eligibleModels: ['linear', 'quadratic'] }).status).toBe('inconclusive');
});
