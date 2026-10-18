import { describe, expect, it } from 'vitest';
import { adjustmentBody, emptyAdjustment, validateAdjustment } from './model/adjustment-form';
import { snapshotFigures } from './model/snapshot-figures';
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
  it('change-proposal snapshots show figures with plain labels, never ids or hashes', () => {
    const figures = snapshotFigures({ revisionId: '7e1d6c2a-0000-4000-8000-000000000000', residual: '60', inputHash: 'abc', plan: { gap: '150', sliceId: 's1' } });
    expect(figures).toEqual([
      { label: 'Unaccounted', value: '60' },
      { label: 'Plan · gap', value: '150' },
    ]);
  });

  it('shows the server snapshot lists: the reconciliation per slice and each run ledger (Marun E2E)', () => {
    const figures = snapshotFigures({
      revision: 1,
      slices: [{ sliceId: 's1', uom: 't', target: '224', actual: '189', gap: '35', attributed: '35', residual: '0', flags: [] }],
      ledgers: [{ sliceId: 's1', ledger: 'capacity', good: '189', quality: '3', flags: [] }],
    });
    expect(figures).toEqual([
      { label: 'Revision', value: '1' },
      { label: 'Reconciliation · uom', value: 't' },
      { label: 'Reconciliation · target', value: '224' },
      { label: 'Reconciliation · actual', value: '189' },
      { label: 'Reconciliation · gap', value: '35' },
      { label: 'Reconciliation · attributed', value: '35' },
      { label: 'Reconciliation · unaccounted', value: '0' },
      { label: 'Capacity ledger · good', value: '189' },
      { label: 'Capacity ledger · quality', value: '3' },
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
