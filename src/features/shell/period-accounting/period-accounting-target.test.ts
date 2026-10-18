import { describe, expect, it } from 'vitest';
import type { PlanView } from '@/api/v2/types/plans';
import { periodAccountingTarget, PLAN_LIST_PATH, singleUnitOf } from './period-accounting-target';

const NOW = Date.parse('2026-10-18T08:00:00Z');

const OCTOBER = { validFrom: '2026-10-01T00:00:00Z', validTo: '2026-11-01T00:00:00Z' };

function plan(id: string, unitId: string, approvalState: string, window = OCTOBER): PlanView {
  return { id, name: id, version: { unitId, approvalState, ...window } } as unknown as PlanView;
}

describe('periodAccountingTarget', () => {
  it('exactly one active approved plan opens its period grid', () => {
    const plans = [plan('p1', 'u1', 'approved'), plan('p2', 'u1', 'draft'), plan('p3', 'u1', 'approved', { validFrom: '2026-09-01T00:00:00Z', validTo: '2026-10-01T00:00:00Z' })];
    expect(periodAccountingTarget(plans, null, NOW)).toEqual({ kind: 'plan', to: '/plans/p1' });
  });

  it('several active plans, or none, open the plan list with the reason', () => {
    const plans = [plan('p1', 'u1', 'approved'), plan('p2', 'u2', 'approved')];
    expect(periodAccountingTarget(plans, null, NOW)).toEqual({ kind: 'list', to: PLAN_LIST_PATH, reason: 'several' });
    expect(periodAccountingTarget([plan('p2', 'u1', 'submitted')], null, NOW)).toEqual({ kind: 'list', to: PLAN_LIST_PATH, reason: 'none' });
  });

  it('a unit scope narrows the choice; validTo is exclusive', () => {
    const plans = [plan('p1', 'u1', 'approved'), plan('p2', 'u2', 'approved')];
    expect(periodAccountingTarget(plans, 'u2', NOW)).toEqual({ kind: 'plan', to: '/plans/p2' });
    expect(periodAccountingTarget([plan('p1', 'u1', 'approved', { validFrom: '2026-10-01T00:00:00Z', validTo: '2026-10-18T08:00:00Z' })], null, NOW).kind).toBe('list');
  });

  it('only a single unit of the analysis scope counts', () => {
    expect(singleUnitOf(new URLSearchParams('units=u1'))).toBe('u1');
    expect(singleUnitOf(new URLSearchParams('units=u1,u2'))).toBeNull();
    expect(singleUnitOf(new URLSearchParams(''))).toBeNull();
  });
});
