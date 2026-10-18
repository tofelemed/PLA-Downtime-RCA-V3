import { recalcTriggerOf } from '../periods/baseline-recalc.consumer';
import { Dec } from '../domain/actuals/decimal';
import { PeriodAccounting } from '../domain/accounting/accounting.types';
import { PeriodChangeProposal } from './entities/period-change-proposal.entity';
import { codingChangesOf } from './proposal-coding';
import { triggerHistory, triggerOf } from './proposal-writer';
import { RevisionState } from './revision-state';

describe('change proposal trigger (Marun E2E)', () => {
  it('a valuation input change is a valuation change, not a rate change', () => {
    expect(recalcTriggerOf({ subject: 'valuation_policy' })).toBe(
      'valuation_policy_changed',
    );
    expect(recalcTriggerOf({ subject: 'fx_rate' })).toBe('fx_rate_changed');
    expect(recalcTriggerOf({ subject: 'demand_status' })).toBe(
      'demand_status_changed',
    );
    for (const reason of [
      'valuation_policy_changed',
      'fx_rate_changed',
      'demand_status_changed',
    ]) {
      expect(triggerOf(reason)).toBe('valuation_change');
    }
  });

  it('profiles and rates keep the rate change trigger', () => {
    expect(recalcTriggerOf({ subject: 'valuation_rate' })).toBe(
      'profile_baseline_changed',
    );
    expect(recalcTriggerOf({})).toBe('profile_baseline_changed');
    expect(triggerOf('profile_baseline_changed')).toBe('rate_change');
  });
});

describe('a reused change proposal (Marun E2E note D)', () => {
  const at = new Date('2026-10-18T15:50:00.000Z');
  it('keeps the earlier trigger and adds the new one', () => {
    const open = {
      trigger: 'event_change',
      detail: { reason: 'loss_event_changed' },
      createdAt: new Date('2026-10-18T15:33:35.000Z'),
      updatedAt: new Date('2026-10-18T15:33:35.000Z'),
    } as unknown as PeriodChangeProposal;
    const first = triggerHistory(
      open,
      {
        trigger: 'valuation_change',
        detail: { reason: 'valuation_policy_changed' },
      },
      at,
    );
    expect(first).toEqual([
      {
        trigger: 'event_change',
        reason: 'loss_event_changed',
        at: '2026-10-18T15:33:35.000Z',
      },
      {
        trigger: 'valuation_change',
        reason: 'valuation_policy_changed',
        at: '2026-10-18T15:50:00.000Z',
      },
    ]);
    const again = triggerHistory(
      { ...open, detail: { triggers: first } },
      { trigger: 'event_change', detail: { reason: 'loss_event_changed' } },
      at,
    );
    expect(again.map((t) => t.trigger)).toEqual([
      'event_change',
      'valuation_change',
      'event_change',
    ]);
    expect(
      triggerHistory(null, { trigger: 'plan_change', detail: {} }, at),
    ).toEqual([
      { trigger: 'plan_change', reason: null, at: '2026-10-18T15:50:00.000Z' },
    ]);
  });

  it('lists the loss lines whose reason code the new inputs change', () => {
    const state = {
      candidateLines: [
        { ledger: 'plan', autoKey: 'k-stop', reasonCodeId: 'speed-loss' },
        { ledger: 'plan', autoKey: 'k-quality', reasonCodeId: null },
      ],
    } as unknown as RevisionState;
    const line = (
      autoKey: string,
      kind: string,
      reasonCodeId: string | null,
    ) => ({
      ledger: 'plan',
      kind,
      autoKey,
      sliceId: 's1',
      quantity: new Dec('14'),
      cause: reasonCodeId === undefined ? null : { reasonCodeId },
    });
    const preview = {
      lines: [
        line('k-stop', 'availability', null),
        line('k-quality', 'quality', null),
        line('k-new', 'availability', 'x'),
      ],
    } as unknown as PeriodAccounting;
    expect(codingChangesOf(state, preview)).toEqual([
      {
        autoKey: 'k-stop',
        sliceId: 's1',
        kind: 'availability',
        quantity: '14',
        before: 'speed-loss',
        after: null,
      },
    ]);
  });

  it('names a changed OEE component of the cause even when the reason stays (regression R3)', () => {
    const state = {
      candidateLines: [
        { ledger: 'plan', autoKey: 'k-stop', reasonCodeId: null },
      ],
    } as unknown as RevisionState;
    const preview = {
      lines: [
        {
          ledger: 'plan',
          kind: 'availability',
          autoKey: 'k-stop',
          sliceId: 's1',
          quantity: new Dec('14'),
          cause: {
            reasonCodeId: null,
            oeeComponent: 'availability',
            scheduleClass: 'unplanned',
            impactMode: 'full_stop',
          },
        },
      ],
    } as unknown as PeriodAccounting;
    const approved = new Map([
      [
        'k-stop',
        {
          oeeComponent: 'performance',
          scheduleClass: 'unplanned',
          impactMode: 'full_stop',
        },
      ],
    ]);
    expect(codingChangesOf(state, preview, approved)).toEqual([
      {
        autoKey: 'k-stop',
        sliceId: 's1',
        kind: 'availability',
        quantity: '14',
        before: null,
        after: null,
        fields: [
          {
            field: 'oeeComponent',
            before: 'performance',
            after: 'availability',
          },
        ],
      },
    ]);
    expect(codingChangesOf(state, preview)).toEqual([]);
  });
});
