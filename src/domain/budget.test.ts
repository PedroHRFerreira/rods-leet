import { expect, it } from 'vitest';
import { reserveExecution, settleExecution } from './budget';
import type { BudgetState } from './budget';

const initial = (): BudgetState => ({ confirmedCreditMicros: 100_000_000, reservations: [], lastSandboxCreatedAt: null });
const request = { id: 'r1', userId: 'u1', serverNow: '2026-09-05T00:00:00Z', maxCostMicros: 500_000 };
it('fails closed without confirmed credits and reserves daily maximum cost', () => {
  expect(() => reserveExecution({ ...initial(), confirmedCreditMicros: 0 }, request)).toThrow();
  const first = reserveExecution(initial(), request);
  expect(reserveExecution(first, request)).toBe(first);
  const second = reserveExecution(first, { ...request, id: 'r2', userId: 'u2', serverNow: '2026-09-05T00:00:01Z' });
  expect(() => reserveExecution(second, { ...request, id: 'r3', userId: 'u3', serverNow: '2026-09-05T00:00:02Z' })).toThrow('Orçamento diário');
});
it('enforces concurrency and creation rate while keeping failed cost accounted', () => {
  const first = reserveExecution(initial(), request);
  expect(() => reserveExecution(first, { ...request, id: 'same-user', serverNow: '2026-09-05T00:00:02Z' })).toThrow('andamento');
  expect(() => reserveExecution(first, { ...request, id: 'other-user', userId: 'u2' })).toThrow('janela');
  const settled = settleExecution(first, { id: 'r1', actualCostMicros: 10_000, infrastructureFailure: true });
  expect(settled.reservations[0].chargedMicros).toBe(10_000);
  expect(settleExecution(settled, { id: 'r1', actualCostMicros: 0, infrastructureFailure: false })).toBe(settled);
});
