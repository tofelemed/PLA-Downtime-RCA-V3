import { describe, expect, it } from 'vitest';
import { draftFromView, manualProblems, toPayload, type ManualDraft } from './draft-lines';
import { evidenceTypesOf, needsEvidence } from './line-evidence';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';

const reversal: ManualDraft = {
  uid: 'm1',
  sliceId: 's1',
  kind: 'reversal',
  quantity: '-10',
  eventIds: [],
  missingEvent: false,
  missingCode: false,
  reason: 'duplicate entry',
  evidenceType: 'log',
  evidenceRef: 'shift log',
  reversesLineId: 'l1',
};

/** SME R9: a reversal names the approved line, its record and a reason; never an event. */
describe('reversal draft lines (SME R9)', () => {
  it('is complete without an event when it names the line, the record and the reason', () => {
    expect(manualProblems(reversal)).toEqual([]);
    expect(manualProblems({ ...reversal, reversesLineId: undefined })).toContain('Choose the approved line it reverses.');
    expect(manualProblems({ ...reversal, reason: undefined })).toContain('A reversal needs a written reason.');
    expect(needsEvidence('reversal', 0)).toBe(true);
    expect(evidenceTypesOf('reversal')).not.toContain('investigation_note');
  });

  it('sends reversesLineId with the line and reads it back from the view', () => {
    const view = { lines: [], candidates: [] } as unknown as ReconciliationView;
    const state = { ...draftFromView(view), manual: [reversal] };
    expect(toPayload(state, []).lines[0]).toMatchObject({ action: 'manual', kind: 'reversal', quantity: '-10', reversesLineId: 'l1' });
    const saved = {
      lines: [{ id: 'x', position: 0, action: 'manual', autoKey: null, sliceId: 's1', kind: 'reversal', quantity: '-10', baseQuantity: null, uom: 't', basis: null, reasonCodeId: null, impactCodeId: null, evidence: [], adjustmentId: null, missingCode: false, missingEvent: false, reversesLineId: 'l1', reason: 'r', comment: null, authorId: 'u', flags: [] }],
      candidates: [],
    } as unknown as ReconciliationView;
    expect(draftFromView(saved).manual[0].reversesLineId).toBe('l1');
  });
});
