import { describe, expect, it } from 'vitest';
import { proposalCodingChangesOf, proposalFieldChangeText, proposalTriggersText, proposalTriggerText, proposalValuesOf } from './proposal-labels';
import { snapshotFigures } from './snapshot-figures';

describe('change proposal labels (Marun E2E)', () => {
  it('a valuation change names the input that changed; other triggers keep their words', () => {
    expect(proposalTriggerText({ trigger: 'valuation_change', detail: { reason: 'valuation_policy_changed' } })).toBe('Valuation policy changed');
    expect(proposalTriggerText({ trigger: 'valuation_change', detail: { reason: 'fx_rate_changed' } })).toBe('Exchange rate changed');
    expect(proposalTriggerText({ trigger: 'valuation_change', detail: {} })).toBe('Valuation input changed');
    expect(proposalTriggerText({ trigger: 'rate_change', detail: { reason: 'profile_baseline_changed' } })).toBe('Rate changed');
  });

  it('reads the approved value per currency and keeps it out of the figure list', () => {
    const before = { revision: 1, values: { view: 'economic_impact', policyVersion: 1, amounts: [{ currency: 'USD', amount: '4960', status: 'valued' }, { currency: 'IRR', amount: null, status: 'mixed' }] } };
    expect(proposalValuesOf(before)).toEqual({
      view: 'economic_impact',
      amounts: [
        { currency: 'USD', amount: '4960', status: 'valued' },
        { currency: 'IRR', amount: null, status: 'mixed' },
      ],
    });
    expect(proposalValuesOf({ revision: 1 })).toBeNull();
    expect(proposalValuesOf(null)).toBeNull();
    expect(snapshotFigures(before).map((f) => f.label)).toEqual(['Revision']);
  });

  it('a reused proposal lists every cause, oldest first', () => {
    const detail = { reason: 'valuation_policy_changed', triggers: [
      { trigger: 'event_change', reason: 'loss_event_changed', at: '2026-10-18T15:33:35.000Z' },
      { trigger: 'valuation_change', reason: 'valuation_policy_changed', at: '2026-10-18T15:50:00.000Z' },
    ] };
    expect(proposalTriggersText({ trigger: 'valuation_change', detail })).toBe('Event changed, then Valuation policy changed');
    expect(proposalTriggersText({ trigger: 'event_change', detail: {} })).toBe('Event changed');
  });

  it('reads the re-coded lines and keeps them out of the figure list', () => {
    const after = { inputHash: 'h', codingChanges: [{ autoKey: 'k', sliceId: 's', kind: 'availability', quantity: '14', before: 'speed-loss', after: null }, { bad: true }] };
    expect(proposalCodingChangesOf(after)).toEqual([{ autoKey: 'k', kind: 'availability', quantity: '14', before: 'speed-loss', after: null, fields: [] }]);
    expect(proposalCodingChangesOf(null)).toEqual([]);
    expect(snapshotFigures(after)).toEqual([]);
  });

  it('names a changed cause classification with labels (Marun regression R3)', () => {
    const after = {
      codingChanges: [
        { autoKey: 'k', kind: 'availability', quantity: '14', before: null, after: null, fields: [{ field: 'oeeComponent', before: 'performance', after: 'availability' }] },
      ],
    };
    const [change] = proposalCodingChangesOf(after);
    expect(change.fields).toEqual([{ field: 'oeeComponent', before: 'performance', after: 'availability' }]);
    expect(proposalFieldChangeText(change.fields[0])).toBe('OEE component changed: Performance → Availability');
    expect(proposalFieldChangeText({ field: 'scheduleClass', before: 'planned', after: null })).toMatch(/^Schedule class changed: .+ → none$/);
  });
});
