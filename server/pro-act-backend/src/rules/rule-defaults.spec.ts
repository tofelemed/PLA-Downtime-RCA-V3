import {
  ActiveCodingRule,
  filledClassification,
  fillOpenAxes,
  keptRuleBasis,
  openAxesOf,
  retypedAxes,
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

  describe('keptRuleBasis (PATCH with a new reason code)', () => {
    const ruled = (value: string) => ({
      source: 'declarative_rule' as const,
      ruleId: 'r-1',
      ruleVersion: 2,
      defaultValue: value,
      overridesDefault: false,
    });
    const coded = {
      source: 'code_default' as const,
      ruleId: null,
      ruleVersion: null,
      defaultValue: 'planned',
      overridesDefault: false,
    };

    it('keeps rule entries for axes the request and the reason code leave untouched', () => {
      const previous = {
        scheduleClass: ruled('external'),
        oeeComponent: ruled('quality'),
        impactCodeId: ruled('imp-1'),
      };
      expect(
        keptRuleBasis(
          previous,
          { scheduleClass: coded },
          new Set(['scheduleClass', 'oeeComponent']),
        ),
      ).toEqual({ scheduleClass: coded, impactCodeId: ruled('imp-1') });
    });

    it('lets a rule entry win over a code entry whose value was not written', () => {
      const keptImpact = { ...coded, defaultValue: 'imp-9' };
      expect(
        keptRuleBasis(
          { impactCodeId: ruled('imp-1') },
          { impactCodeId: keptImpact },
          new Set(),
        ),
      ).toEqual({ impactCodeId: ruled('imp-1') });
    });

    it('drops earlier code and user entries and returns null when nothing is left', () => {
      const user = { ...coded, source: 'user' as const };
      expect(
        keptRuleBasis(
          { scheduleClass: coded, oeeComponent: user },
          null,
          new Set(),
        ),
      ).toBeNull();
      expect(keptRuleBasis(null, { scheduleClass: coded }, new Set())).toEqual({
        scheduleClass: coded,
      });
    });
  });

  describe('retypedAxes (source revision changes the event type, item 8 Q1)', () => {
    const external = rule('r-1', [
      { set: 'scheduleClass', value: 'external' },
      { set: 'oeeComponent', value: 'quality' },
    ]);
    const ruled = (value: string) => ({
      source: 'declarative_rule' as const,
      ruleId: 'r-1',
      ruleVersion: 2,
      defaultValue: value,
      overridesDefault: false,
    });
    // the write model re-derived the ProductionLoss defaults from the new event type
    const retyped = { ...EVENT };

    it('re-applies the rules to the axes they filled before, with their basis', () => {
      const result = retypedAxes(
        [external],
        {
          scheduleClass: 'external',
          oeeComponent: 'quality',
          classificationBasis: {
            scheduleClass: ruled('external'),
            oeeComponent: ruled('quality'),
          },
        },
        retyped,
      );
      expect(result).toEqual({
        scheduleClass: 'external',
        oeeComponent: 'quality',
        impactCodeId: null,
        classificationBasis: {
          scheduleClass: ruled('external'),
          oeeComponent: ruled('quality'),
        },
      });
    });

    it('fills axes the new type opened and keeps user overrides and reason-code values', () => {
      const coded = {
        source: 'code_default' as const,
        ruleId: null,
        ruleVersion: null,
        defaultValue: 'planned',
        overridesDefault: false,
      };
      const result = retypedAxes(
        [external],
        {
          scheduleClass: 'planned',
          oeeComponent: 'performance',
          impactCodeId: 'imp-7',
          classificationBasis: { scheduleClass: coded },
          userOverrides: { oeeComponent: 3 },
        },
        retyped,
      );
      expect(result).toEqual({
        scheduleClass: 'planned',
        oeeComponent: 'performance',
        impactCodeId: 'imp-7',
        classificationBasis: { scheduleClass: coded },
      });
    });

    it('falls back to the event-type default and drops the stale basis when no rule matches', () => {
      const advisoryOnly = rule(
        'r-1',
        [{ set: 'oeeComponent', value: 'quality' }],
        { all: [{ field: 'eventType', op: 'in', value: ['IOW'] }] },
      );
      const impactRule = rule(
        'r-1',
        [{ set: 'impactCodeId', value: 'imp-1' }],
        {
          all: [{ field: 'eventType', op: 'in', value: ['IOW'] }],
        },
      );
      const result = retypedAxes(
        [advisoryOnly, impactRule],
        {
          scheduleClass: 'unknown',
          oeeComponent: 'quality',
          impactCodeId: 'imp-1',
          classificationBasis: {
            oeeComponent: ruled('quality'),
            impactCodeId: ruled('imp-1'),
          },
        },
        retyped,
      );
      expect(result).toEqual({
        scheduleClass: 'unknown',
        oeeComponent: 'availability',
        impactCodeId: null,
        classificationBasis: null,
      });
    });
  });
});
