import { describe, expect, it } from 'vitest';
import type { RevaluationRequested, WithRevaluation } from '../types/valuation';
import { carryRevaluation } from './carry-revaluation';

const queued: RevaluationRequested = { status: 'queued', scope: 'tenant', from: '2026-10-01T00:00:00.000Z', to: null };
type View = WithRevaluation & { id: string; state: string; rowVersion: number };
const read: View = { id: 'fx-1', state: 'approved', rowVersion: 2 };

describe('carryRevaluation', () => {
  it('keeps the queued revaluation of the approve answer when the refetched version is unchanged', () => {
    expect(carryRevaluation({ ...read, revaluation: queued }, { ...read })).toEqual({ ...read, revaluation: queued });
  });

  it('drops it once the version changed on the server', () => {
    const retired: View = { ...read, state: 'retired', rowVersion: 3 };
    expect(carryRevaluation({ ...read, revaluation: queued }, retired)).toEqual(retired);
  });

  it('returns the fresh view when nothing was queued, nothing is cached or the id differs', () => {
    expect(carryRevaluation(undefined, read)).toBe(read);
    expect(carryRevaluation({ ...read, revaluation: null }, read)).toBe(read);
    expect(carryRevaluation({ ...read, id: 'fx-2', revaluation: queued }, read)).toBe(read);
  });

  it('prefers a revaluation the fresh answer states itself', () => {
    const own = { ...read, revaluation: { ...queued, from: '2026-11-01T00:00:00.000Z' } };
    expect(carryRevaluation({ ...read, revaluation: queued }, own)).toBe(own);
  });
});
