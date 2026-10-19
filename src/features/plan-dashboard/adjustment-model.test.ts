import { describe, expect, it } from 'vitest';
import { adjustmentBody, emptyAdjustment, validateAdjustment } from './model/adjustment-form';
import { proposalComparison } from './model/snapshot-figures';
import { actorLabel } from './model/display';

describe('actuals adjustment form', () => {
  it('requires a product, a non-zero signed quantity, a reason and evidence', () => {
    const errors = validateAdjustment({ ...emptyAdjustment(''), quantity: '-0.00' });
    expect(Object.keys(errors).sort()).toEqual(['evidenceRef', 'quantity', 'reason', 'sliceId']);
    expect(validateAdjustment({ ...emptyAdjustment('s1'), quantity: '-5', reason: 'recount', evidenceRef: 'WB-1' })).toEqual({});
  });

  it('needs both ends of the measurement window, the end after the start', () => {
    const base = { ...emptyAdjustment('s1'), quantity: '-5', reason: 'recount', evidenceRef: 'WB-1' };
    expect(validateAdjustment({ ...base, windowFrom: '2026-10-12T06:00:00.000Z' }).windowTo).toMatch(/both ends/);
    expect(validateAdjustment({ ...base, windowFrom: '2026-10-12T06:00:00.000Z', windowTo: '2026-10-12T05:00:00.000Z' }).windowTo).toMatch(/after the start/);
  });

  it('sends exactly the declared fields, the window only when both ends are set', () => {
    const values = { ...emptyAdjustment('s1'), quantity: '-5', reason: ' weighbridge recount ', evidenceRef: 'WB-1' };
    expect(adjustmentBody(values)).toEqual({ sliceId: 's1', kind: 'good', quantity: '-5', basis: 'measured', reason: 'weighbridge recount', evidenceRef: 'WB-1' });
    const windowed = adjustmentBody({ ...values, windowFrom: '2026-10-12T06:00:00.000Z', windowTo: '2026-10-12T07:00:00.000Z' });
    expect(windowed).toMatchObject({ windowFrom: '2026-10-12T06:00:00.000Z', windowTo: '2026-10-12T07:00:00.000Z' });
  });
});

describe('internal values stay off screen', () => {
  it('change-proposal figures are curated with units: the reconciliation apart from each ledger, never ids, hashes or internal fields', () => {
    const groups = proposalComparison(
      {
        revisionId: '7e1d6c2a-0000-4000-8000-000000000000',
        revision: 1,
        slices: [{ sliceId: 's1', uom: 't', target: '224', actual: '189', gap: '35', attributed: '35', toleranceAdjustment: '0', unadjustedResidual: '0', residual: '0', flags: [] }],
        ledgers: [{ sliceId: 's1', ledger: 'capacity', uom: 't', capacity: '224', exclusion: '0', good: '189', actual: '189', quality: '3', residual: '0', flags: [] }],
      },
      null,
    );
    expect(groups.map((g) => g.title)).toEqual(['Reconciliation', 'Capacity ledger (calculated)']);
    expect(groups[0].rows.map((r) => r.label)).toEqual(['Target', 'Actual (good)', 'Gap', 'Attributed losses', 'Tolerance adjustment', 'Unaccounted']);
    expect(groups[0].rows[0]).toMatchObject({ unit: 't', before: '224', after: null });
    // a figure recorded on neither side is left out, never "—" on both (re-test N3)
    expect(groups[1].rows.map((r) => r.label)).toEqual(['Capacity', 'Actual (good)', 'Quality loss', 'Unaccounted']);
  });

  it('re-test N3: the capacity ledger Actual (good) is the server good output (its row has no plan actual)', () => {
    const ledger = (good: string) => ({ sliceId: 's1', ledger: 'capacity', uom: 't', capacity: '240', good, actual: null, availability: '28', residual: '0' });
    const [capacity] = proposalComparison({ ledgers: [ledger('189')] }, { ledgers: [ledger('209')] });
    expect(capacity.rows.find((r) => r.label === 'Actual (good)')).toMatchObject({ unit: 't', before: '189', after: '209' });
  });

  it('several slices are named by position; the server values are never summed', () => {
    const slice = (id: string, target: string) => ({ sliceId: id, uom: 't', target, actual: '1', gap: '0', attributed: '0', toleranceAdjustment: '0', residual: '0' });
    const [reconciliation] = proposalComparison({ slices: [slice('a', '10'), slice('b', '20')] }, { slices: [slice('a', '10'), slice('b', '25')] });
    const targets = reconciliation.rows.filter((r) => r.label.startsWith('Target'));
    expect(targets).toEqual([
      expect.objectContaining({ label: 'Target · slice 1', before: '10', after: '10' }),
      expect.objectContaining({ label: 'Target · slice 2', before: '20', after: '25' }),
    ]);
  });

  it('actors are "you", a name or a service, never a user id', () => {
    const names = (id: string) => (id === 'u-2' ? 'Laura Rossi' : 'Former user');
    expect(actorLabel('u-1', 'u-1', names)).toBe('you');
    expect(actorLabel('u-2', 'u-1', names)).toBe('Laura Rossi');
    expect(actorLabel('d9800d1c-0000-4000-8000-000000000000', 'u-1', names)).toBe('Former user');
    // owner finding 1: automatic actors read "System (source)"
    expect(actorLabel(null, 'u-1', names, 'accounting-worker')).toBe('System (accounting recalculation)');
    expect(actorLabel(null, 'u-1', names)).toBe('System');
  });
});
