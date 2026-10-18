import { describe, expect, it } from 'vitest';
import type { ReconciliationLineView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { countDraftChanges } from './draft-changes';
import { addManual, draftFromView, removeManual, setDecision } from './draft-lines';
import { residualStateOf } from './residual-state';

const line = (fields: Partial<ReconciliationLineView>): ReconciliationLineView => ({
  id: 'l1', position: 0, action: 'accept', autoKey: 'k1', sliceId: 's1', kind: null, quantity: null, baseQuantity: null, uom: 't', basis: null,
  reasonCodeId: null, impactCodeId: null, evidence: [], adjustmentId: null, missingCode: false, missingEvent: false, reason: null, comment: null,
  authorId: null, flags: [], ...fields,
});

const VIEW = {
  lines: [line({}), line({ id: 'm1', action: 'manual', autoKey: null, kind: 'availability', quantity: '5', evidence: [{ eventId: 'e1' }] })],
} as unknown as ReconciliationView;

describe('countDraftChanges (D-11: what a discard drops)', () => {
  it('is zero for the saved set, whatever the key order', () => {
    expect(countDraftChanges(draftFromView(VIEW), VIEW)).toBe(0);
  });

  it('counts set, changed and cleared decisions, added and removed manual lines and an unfinished line', () => {
    let draft = draftFromView(VIEW);
    draft = setDecision(draft, 'k1', null);
    draft = setDecision(draft, 'k2', { action: 'reject', reason: 'wrong' });
    expect(countDraftChanges(draft, VIEW)).toBe(2);
    draft = removeManual(draft, 'm1');
    draft = addManual(draft, { sliceId: 's1', kind: 'quality', quantity: '1', eventIds: [], missingEvent: true, missingCode: false });
    expect(countDraftChanges(draft, VIEW)).toBe(4);
    expect(countDraftChanges({ ...draft, pendingManual: { sliceId: 's1', kind: 'availability', quantity: null, eventIds: [], missingEvent: false, missingCode: false } }, VIEW)).toBe(5);
  });

  it('a decision set back to its saved value is not a change', () => {
    const draft = setDecision(setDecision(draftFromView(VIEW), 'k1', { action: 'reject', reason: 'x' }), 'k1', { action: 'accept' });
    expect(countDraftChanges(draft, VIEW)).toBe(0);
  });
});

describe('residualStateOf (D-3: the residual state in words, from server flags only)', () => {
  it('maps blocking flags to "Above tolerance" and balanced ones to "Within tolerance"', () => {
    expect(residualStateOf(['unaccounted'])).toEqual({ label: 'Above tolerance', tone: 'warning' });
    expect(residualStateOf(['over_accounted', 'within_tolerance'])).toEqual({ label: 'Above tolerance', tone: 'warning' });
    expect(residualStateOf(['within_tolerance'])).toEqual({ label: 'Within tolerance', tone: 'ok' });
    expect(residualStateOf(['balanced'])).toEqual({ label: 'Within tolerance', tone: 'ok' });
    expect(residualStateOf(['not_computable'])?.label).toBe('Not computable');
    expect(residualStateOf(['planned_rate_scaled'])).toBeNull();
  });
});
