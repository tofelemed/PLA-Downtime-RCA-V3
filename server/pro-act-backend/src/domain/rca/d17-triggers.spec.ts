import {
  ApprovedEventImpact,
  evaluateApprovedTriggers,
} from './approved-triggers';
import { failureModeKey } from './failure-mode-key';
import { RCA_POLICY_DEFAULT, RcaPolicy } from './rca-policy';
import {
  decideTrigger,
  evaluateTriggers,
  TriggerContext,
  TriggerEvent,
} from './rca-triggers';

const T0 = Date.parse('2027-03-03T02:00:00Z');
const at = (seconds: number) => new Date(T0 + seconds * 1000);
const REF = { id: 'p1', version: 2 };
const POLICY: RcaPolicy = RCA_POLICY_DEFAULT;

function stop(overrides: Partial<TriggerEvent> = {}): TriggerEvent {
  return {
    eventId: 'e1',
    occurrenceId: null,
    unitId: 'u1',
    assetId: 'P-101',
    physicalType: 'downtime',
    scheduleClass: 'unplanned',
    physicalState: 'closed',
    eventType: 'ProductionLoss',
    failureMode: 'Seal leak',
    start: at(0),
    end: at(15 * 60),
    facts: { physicalType: 'downtime', durationSeconds: 900 },
    ...overrides,
  };
}

const context = (extra: Partial<TriggerContext> = {}): TriggerContext => ({
  now: at(99_999),
  policy: POLICY,
  policyRef: REF,
  rules: [],
  recentFailures: 1,
  ...extra,
});

const kinds = (event: TriggerEvent, extra: Partial<TriggerContext> = {}) =>
  evaluateTriggers(event, context(extra)).map((candidate) => candidate.trigger);

describe('D17 any-of triggers on events (pilot policy)', () => {
  it('a 2 h unplanned stop fires; 1 h does not, unless the asset is critical (halved)', () => {
    const twoHours = stop({ end: at(7200) });
    const oneHour = stop({ end: at(3600) });
    expect(kinds(twoHours)).toEqual(['duration']);
    expect(kinds(oneHour)).toEqual([]);
    expect(kinds(oneHour, { criticalAsset: true })).toEqual(['duration']);
  });

  it('D17 example: three 15-minute seal leaks in 30 days fire the repeat trigger', () => {
    expect(kinds(stop(), { recentFailures: 3 })).toEqual(['repeat']);
    expect(kinds(stop(), { recentFailures: 2 })).toEqual([]);
  });

  it("CA8 example: a repeat of an open case's mode links to it; a new mode does not get swallowed", () => {
    const [linked] = evaluateTriggers(
      stop(),
      context({ recentFailures: 3, openCaseId: 'rca-seal' }),
    );
    expect(linked.linkToCaseId).toBe('rca-seal');
    expect(decideTrigger(linked, POLICY, null)).toEqual({
      action: 'insert',
      outcome: 'linked_to_case',
    });
    const motor = stop({ failureMode: 'Motor insulation' });
    const [own] = evaluateTriggers(
      motor,
      context({ recentFailures: 3, openCaseId: null }),
    );
    expect(own.linkToCaseId).toBeUndefined();
    expect(decideTrigger(own, POLICY, null).outcome).toBe('recommended');
  });

  it('CA8 bad actor: small stops summing over the cumulative limit fire', () => {
    expect(kinds(stop(), { cumulativeSeconds: 28_800 })).toEqual([
      'cumulative',
    ]);
    expect(
      kinds(stop(), { cumulativeSeconds: 14_400, criticalAsset: true }),
    ).toEqual(['cumulative']);
    expect(
      kinds(stop(), { cumulativeSeconds: 14_399, criticalAsset: true }),
    ).toEqual([]);
  });

  it('D17 example: a hazardous-release near miss fires with zero loss, and only recommends', () => {
    const nearMiss = stop({
      physicalType: 'advisory',
      scheduleClass: 'unknown',
      eventType: 'SOL',
      solType: 'Safety',
      end: at(60),
    });
    const fired = evaluateTriggers(
      nearMiss,
      context({ openCaseId: 'some-case' }),
    );
    expect(fired.map((c) => c.trigger)).toEqual(['consequence']);
    expect(fired[0].recommendOnly).toBe(true);
    expect(fired[0].linkToCaseId).toBeUndefined();
    const create = { ...POLICY, autoCreate: 'create' as const };
    expect(decideTrigger(fired[0], create, null).outcome).toBe('recommended');
  });

  it('planned stops never fire production triggers', () => {
    expect(
      kinds(stop({ scheduleClass: 'planned', end: at(9000) }), {
        recentFailures: 9,
        cumulativeSeconds: 99_999,
      }),
    ).toEqual([]);
  });
});

describe('D17 triggers on approved impact', () => {
  const impact = (
    overrides: Partial<ApprovedEventImpact> = {},
  ): ApprovedEventImpact => ({
    eventId: 'e1',
    occurrenceId: null,
    values: [{ currency: 'USD', amount: '4000' }],
    lost: [{ uom: 't', quantity: '10' }],
    dailyPlan: [{ uom: 't', quantity: '1000' }],
    criticalAsset: false,
    advisory: false,
    openCaseId: null,
    ...overrides,
  });
  const approved = (value: ApprovedEventImpact, policy: RcaPolicy = POLICY) =>
    evaluateApprovedTriggers(value, { policy, policyRef: REF }).map(
      (c) => c.trigger,
    );

  it('D17 example: at a 1,000 t/day plan the quantity line is 10 t (5 t for a critical asset)', () => {
    expect(approved(impact())).toEqual(['quantity']);
    expect(
      approved(impact({ lost: [{ uom: 't', quantity: '9.99' }] })),
    ).toEqual([]);
    expect(
      approved(
        impact({ lost: [{ uom: 't', quantity: '5' }], criticalAsset: true }),
      ),
    ).toEqual(['quantity']);
  });

  it('another unit of measure or no plan never compares', () => {
    expect(
      approved(impact({ dailyPlan: [{ uom: 'kg', quantity: '1000' }] })),
    ).toEqual([]);
    expect(approved(impact({ dailyPlan: [] }))).toEqual([]);
  });

  it('the money limit is off until finance sets it; then the approved value in its currency fires', () => {
    const none = impact({ lost: [] });
    expect(approved(none)).toEqual([]);
    const finance = {
      ...POLICY,
      costThreshold: 3000,
      costCurrency: 'USD' as const,
    };
    expect(approved(none, finance)).toEqual(['cost']);
    expect(
      approved(
        impact({ lost: [], values: [{ currency: 'USD', amount: null }] }),
        finance,
      ),
    ).toEqual([]);
    expect(
      approved(
        impact({ lost: [], values: [{ currency: 'IRR', amount: '9e9' }] }),
        finance,
      ),
    ).toEqual([]);
  });

  it('SME V7: a value converted with a provisional FX rate never fires the money limit; the final one does', () => {
    const finance = {
      ...POLICY,
      costThreshold: 3000,
      costCurrency: 'USD' as const,
    };
    const provisional = impact({
      lost: [],
      values: [{ currency: 'USD', amount: '4000', provisional: true }],
    });
    expect(approved(provisional, finance)).toEqual([]);
    const final = impact({
      lost: [],
      values: [{ currency: 'USD', amount: '4000', provisional: false }],
    });
    const [fired] = evaluateApprovedTriggers(final, {
      policy: finance,
      policyRef: REF,
    });
    expect(fired).toMatchObject({
      trigger: 'cost',
      idempotencyKey: 'policy:p1@2:cost:e1',
      detail: { amount: '4000', currency: 'USD', threshold: 3000 },
    });
  });

  it('fires on approval with a per-occurrence key (a restatement does not fire twice)', () => {
    const [fired] = evaluateApprovedTriggers(impact(), {
      policy: POLICY,
      policyRef: REF,
    });
    expect(fired).toMatchObject({
      firedOn: 'approved',
      provisional: false,
      idempotencyKey: 'policy:p1@2:quantity:e1',
    });
  });
});

describe('failureModeKey (CA8 identity)', () => {
  it('ignores case and spacing, falls back to the reason, refines by mechanism', () => {
    const base = {
      failureMode: '  Seal   LEAK ',
      failureMechanism: 'Wear',
      reasonCodeId: 'r1',
    };
    expect(failureModeKey(base, 'asset_and_mode')).toBe('mode:seal leak');
    expect(failureModeKey(base, 'asset_mode_and_mechanism')).toBe(
      'mode:seal leak|mechanism:wear',
    );
    expect(
      failureModeKey({ ...base, failureMode: null }, 'asset_and_mode'),
    ).toBe('reason:r1');
    expect(
      failureModeKey(
        { failureMode: null, failureMechanism: null, reasonCodeId: null },
        'asset_and_mode',
      ),
    ).toBeNull();
    expect(failureModeKey(base, 'asset')).toBe('');
  });
});
