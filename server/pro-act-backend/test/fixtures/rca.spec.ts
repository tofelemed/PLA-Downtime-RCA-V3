import * as fs from 'fs';
import * as path from 'path';
import { parseRcaPolicy, RcaPolicy } from '../../src/domain/rca/rca-policy';
import {
  decideTrigger,
  evaluateTriggers,
  TriggerContext,
  TriggerEvent,
} from '../../src/domain/rca/rca-triggers';
import { realizedDifference } from '../../src/domain/rca/rca-verification';

/**
 * Plan 3.9 fixtures: RCA01 (trigger idempotency, provisional → confirmed, replay), RCA03 (realized
 * difference kept apart from claims) and T42 (an advisory event can only ever be recommended). RCA02 links run against Postgres in `rca-integration.int-spec.ts`.
 */
type Json = Record<string, unknown>;
const fixture = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8')) as {
    inputs: Json;
    expected: Record<string, Json>;
  };

const T0 = Date.parse('2027-03-03T02:00:00Z');
const after = (seconds: number) => new Date(T0 + seconds * 1000);
const POLICY_REF = { id: 'policy-1', version: 1 };

function stop(overrides: Partial<TriggerEvent> = {}): TriggerEvent {
  return {
    eventId: 'e1',
    occurrenceId: 'occ-1',
    unitId: 'u1',
    assetId: 'a1',
    physicalType: 'downtime',
    scheduleClass: 'unplanned',
    physicalState: 'open',
    eventType: 'ProductionLoss',
    failureMode: null,
    start: after(0),
    end: null,
    facts: { physicalType: 'downtime', durationSeconds: null },
    ...overrides,
  };
}

function context(
  policy: RcaPolicy,
  now: number,
  extra: Partial<TriggerContext> = {},
): TriggerContext {
  return {
    now: after(now),
    policy,
    policyRef: POLICY_REF,
    rules: [],
    recentFailures: 0,
    ...extra,
  };
}

describe('RCA01 trigger evaluation (D13 policy)', () => {
  const { inputs, expected } = fixture('RCA01');
  // a D13 body: parsed as stored versions are (per-asset repeats, D17 options off)
  const policy = parseRcaPolicy(inputs.policy);
  const open = () =>
    evaluateTriggers(
      stop(),
      context(policy, inputs.elapsedAtSweepSeconds as number),
    );

  it('an open stop below the threshold does not fire', () => {
    const fired = evaluateTriggers(
      stop(),
      context(policy, inputs.elapsedBeforeThresholdSeconds as number),
    );
    expect(fired).toHaveLength(expected.beforeThreshold.candidates as number);
  });

  it('an open stop past the threshold fires once, provisionally, as a recommendation', () => {
    const [candidate] = open();
    expect(candidate).toMatchObject({
      trigger: expected.openAfterThreshold.trigger,
      provisional: expected.openAfterThreshold.provisional,
      firedOn: expected.openAfterThreshold.firedOn,
    });
    expect(decideTrigger(candidate, policy, null)).toEqual({
      action: expected.openAfterThreshold.decision,
      outcome: expected.openAfterThreshold.outcome,
    });
  });

  it('closure re-evaluates under the same key and only confirms (no second case)', () => {
    const [provisional] = open();
    const closed = stop({
      physicalState: 'closed',
      end: after(inputs.closedDurationSeconds as number),
    });
    const [confirmed] = evaluateTriggers(closed, context(policy, 99_999));
    expect(confirmed.idempotencyKey).toBe(provisional.idempotencyKey);
    expect(confirmed).toMatchObject({
      provisional: false,
      firedOn: expected.closedReEvaluation.firedOn,
    });
    expect(
      decideTrigger(confirmed, policy, {
        outcome: 'recommended',
        provisional: true,
      }),
    ).toEqual({
      action: expected.closedReEvaluation.decision,
      outcome: expected.closedReEvaluation.outcome,
    });
  });

  it('a replay of the confirmed event is a suppressed duplicate', () => {
    const closed = stop({ physicalState: 'closed', end: after(5400) });
    const [again] = evaluateTriggers(closed, context(policy, 99_999));
    expect(
      decideTrigger(again, policy, {
        outcome: 'recommended',
        provisional: false,
      }),
    ).toEqual({
      action: expected.replay.decision,
      outcome: expected.replay.outcome,
    });
  });

  it('three functional failures of one asset in the window fire the repeat trigger', () => {
    const failure = stop({
      physicalState: 'closed',
      end: after(600),
      failureMode: 'BRG-01',
    });
    const fired = evaluateTriggers(
      failure,
      context(policy, 700, {
        recentFailures: inputs.failuresOfAssetIn30Days as number,
      }),
    );
    expect(fired.map((c) => c.trigger)).toEqual([
      expected.repeatedFailure.trigger,
    ]);
    expect(decideTrigger(fired[0], policy, null).outcome).toBe(
      expected.repeatedFailure.outcome,
    );
  });

  it('RCA-07: no repeat trigger while the asset already has an open case', () => {
    const failure = stop({
      physicalState: 'closed',
      end: after(600),
      failureMode: 'BRG-01',
    });
    const fired = evaluateTriggers(
      failure,
      context(policy, 700, {
        recentFailures: inputs.failuresOfAssetIn30Days as number,
        openCaseId: 'open-case',
      }),
    );
    expect(fired.map((c) => c.trigger)).not.toContain('repeat');
  });

  it('policy autoCreate=create opens a case; planned and retracted stops never fire', () => {
    const create: RcaPolicy = { ...policy, autoCreate: 'create' };
    expect(decideTrigger(open()[0], create, null).outcome).toBe(
      expected.policyCreate.outcome,
    );
    expect(
      evaluateTriggers(
        stop({ scheduleClass: 'planned' }),
        context(policy, 9_999),
      ),
    ).toHaveLength(0);
    expect(
      evaluateTriggers(
        stop({ physicalState: 'retracted' }),
        context(policy, 9_999),
      ),
    ).toHaveLength(0);
  });

  it('the rule version is part of the key: a new version may fire again, the same never', () => {
    const rule = (version: number) => ({
      id: 'r1',
      version,
      name: 'long stop',
      definition: {
        when: {
          all: [{ field: 'durationSeconds', op: 'gte' as const, value: 1800 }],
        },
        then: [{ flag: 'rca' }],
      },
    });
    const keyOf = (version: number) =>
      evaluateTriggers(
        stop(),
        context({ ...policy, durationThresholdSeconds: 0 }, 2000, {
          rules: [rule(version)],
        }),
      )[0].idempotencyKey;
    expect(keyOf(1)).toBe(keyOf(1));
    expect(keyOf(1)).not.toBe(keyOf(2));
  });
});

describe('T42 advisory without impact evidence', () => {
  const advisory = stop({
    physicalType: 'advisory',
    scheduleClass: 'unknown',
    eventType: 'IOW',
    facts: {
      physicalType: 'advisory',
      eventType: 'IOW',
      durationSeconds: null,
    },
  });
  const policy: RcaPolicy = parseRcaPolicy({
    durationThresholdSeconds: 60,
    costThreshold: null,
    repeatCount: 1,
    repeatWindowDays: 30,
    autoCreate: 'create',
  });

  it('policy thresholds never fire; a matching hint rule only recommends, even under autoCreate=create', () => {
    const rule = {
      id: 'r-iow',
      version: 1,
      name: 'IOW breach',
      definition: {
        when: {
          all: [{ field: 'eventType', op: 'eq' as const, value: 'IOW' }],
        },
        then: [{ flag: 'rca' }],
      },
    };
    const fired = evaluateTriggers(
      advisory,
      context(policy, 7200, { recentFailures: 5, rules: [rule] }),
    );
    expect(fired.map((c) => c.trigger)).toEqual(['rule']);
    expect(fired[0].recommendOnly).toBe(true);
    expect(decideTrigger(fired[0], policy, null).outcome).toBe('recommended');
  });

  // The accounting engine cannot receive an advisory at all (`LossEventType` excludes it and the run
  // loader selects downtime / slowdown / quality_loss only); the zero-attribution end to end is in
  // `rca-triggers.int-spec.ts` (T42).
});

describe('RCA03 realized difference', () => {
  const { inputs, expected } = fixture('RCA03');

  it('scales the baseline to the verification window and subtracts what was observed', () => {
    const result = realizedDifference(
      inputs.baseline as Parameters<typeof realizedDifference>[0],
      inputs.post as Parameters<typeof realizedDifference>[1],
    );
    expect(result).toEqual(expected.realized);
  });

  it('downtime metric uses the observed loss seconds', () => {
    const result = realizedDifference(
      {
        metric: 'downtime_seconds',
        windowDays: 30,
        value: '7200',
        declared: false,
      },
      { windowDays: 15, recurrences: 4, observedLossSeconds: '1800' },
    );
    expect(result).toEqual({
      metric: 'downtime_seconds',
      expected: '3600',
      observed: '1800',
      difference: '1800',
    });
  });
});
