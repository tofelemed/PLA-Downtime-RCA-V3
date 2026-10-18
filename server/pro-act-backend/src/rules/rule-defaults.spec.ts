import {
  ActiveCodingRule,
  filledClassification,
  fillOpenAxes,
  openAxesOf,
  withRuleBasis,
} from './rule-defaults';
import { RuleEventSource } from './rule-event-facts';

const EVENT: RuleEventSource = {
  physicalType: 'downtime',
  scheduleClass: 'unknown',
  oeeComponent: 'availability',
  impactMode: 'full_stop',
  sourceKind: 'source',
  eventType: 'ProductionLoss',
  source: 'MQTT',
  startTime: new Date('2026-10-08T06:00:00Z'),
  endTime: new Date('2026-10-08T08:00:00Z'),
  unitId: 'unit-1',
};

const rule = (
  id: string,
  then: ActiveCodingRule['definition']['then'],
  when: ActiveCodingRule['definition']['when'] = {
    all: [{ field: 'sourceKind', op: 'in', value: ['source', 'derived'] }],
  },
): ActiveCodingRule => ({ id, version: 2, definition: { when, then } });

/** Plan 3.8: active `coding_default` rules fill only open axes, first rule wins, provenance recorded. */
describe('rule defaults', () => {
  it('fills only the open axes and records the declarative_rule basis with the rule version', () => {
    const fill = fillOpenAxes(
      [
        rule('r-1', [
          { set: 'scheduleClass', value: 'external' },
          { set: 'oeeComponent', value: 'quality' },
        ]),
      ],
      EVENT,
      new Set(['oeeComponent', 'impactCodeId']),
    );
    expect(fill.values).toEqual({ oeeComponent: 'quality' });
    expect(fill.basis).toEqual({
      oeeComponent: {
        source: 'declarative_rule',
        ruleId: 'r-1',
        ruleVersion: 2,
        defaultValue: 'quality',
        overridesDefault: false,
      },
    });
  });

  it('takes the first rule (evaluation order) that sets an axis', () => {
    const fill = fillOpenAxes(
      [
        rule('first', [{ set: 'scheduleClass', value: 'planned' }]),
        rule('second', [{ set: 'scheduleClass', value: 'external' }]),
      ],
      EVENT,
      new Set(['scheduleClass']),
    );
    expect(fill.values.scheduleClass).toBe('planned');
    expect(fill.basis.scheduleClass?.ruleId).toBe('first');
  });

  it('fills nothing when the rule does not match or no axis is open', () => {
    const longOnly = rule('long', [{ set: 'oeeComponent', value: 'quality' }], {
      all: [{ field: 'durationSeconds', op: 'gt', value: 86_400 }],
    });
    expect(fillOpenAxes([longOnly], EVENT, new Set(['oeeComponent']))).toEqual({
      values: {},
      basis: {},
    });
    const any = rule('any', [{ set: 'oeeComponent', value: 'quality' }]);
    expect(fillOpenAxes([any], EVENT, new Set())).toEqual({
      values: {},
      basis: {},
    });
  });

  it('treats stated values (user, source, reason code) as closed axes', () => {
    expect([
      ...openAxesOf({
        scheduleClass: 'planned',
        oeeComponent: null,
        impactCodeId: '',
      }),
    ]).toEqual(['oeeComponent', 'impactCodeId']);
  });

  it('merges the rule basis after the reason-code basis and exposes the classification', () => {
    const fill = fillOpenAxes(
      [rule('r-1', [{ set: 'oeeComponent', value: 'quality' }])],
      EVENT,
      new Set(['oeeComponent']),
    );
    const coded = {
      scheduleClass: {
        source: 'code_default' as const,
        ruleId: null,
        ruleVersion: null,
        defaultValue: 'planned',
        overridesDefault: false,
      },
    };
    expect(withRuleBasis(coded, fill)).toEqual({
      ...coded,
      oeeComponent: fill.basis.oeeComponent,
    });
    expect(withRuleBasis(null, { values: {}, basis: {} })).toBeNull();
    expect(filledClassification(fill)).toEqual({ oeeComponent: 'quality' });
  });
});
