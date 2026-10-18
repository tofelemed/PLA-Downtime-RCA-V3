import { ActiveCodingRule } from '../rules/rule-defaults';
import { engineCreateFields, EngineDraft } from './derived-rule-defaults';

const RULES: ActiveCodingRule[] = [
  {
    id: 'rule-1',
    version: 1,
    definition: {
      when: { all: [{ field: 'sourceKind', op: 'eq', value: 'derived' }] },
      then: [
        { set: 'scheduleClass', value: 'external' },
        { set: 'oeeComponent', value: 'quality' },
      ],
    },
  },
];

const stop: EngineDraft = {
  unitId: 'unit-1',
  stated: ['scheduleClass'],
  input: {
    startTime: new Date('2026-10-08T06:00:00Z'),
    endTime: new Date('2026-10-08T06:30:00Z'),
    eventType: 'ProductionLoss',
    source: 'State engine',
    classification: {
      physicalType: 'downtime',
      scheduleClass: 'unplanned',
      oeeComponent: 'availability',
      impactMode: 'full_stop',
    },
  },
};

/** Plan 3.8 on state-engine events: rules fill the open axes, never the engine's own facts. */
describe('engineCreateFields', () => {
  it('fills the open OEE component and keeps the stated schedule class', () => {
    const { fields, columns } = engineCreateFields(RULES, stop);
    expect(fields).toMatchObject({
      scheduleClass: 'unplanned',
      oeeComponent: 'quality',
      physicalType: 'downtime',
      impactMode: 'full_stop',
    });
    expect(columns.classificationBasis).toEqual({
      oeeComponent: {
        source: 'declarative_rule',
        ruleId: 'rule-1',
        ruleVersion: 1,
        defaultValue: 'quality',
        overridesDefault: false,
      },
    });
  });

  it('leaves the engine fields untouched without rules', () => {
    const { fields, columns } = engineCreateFields([], stop);
    expect(fields).toMatchObject({
      scheduleClass: 'unplanned',
      oeeComponent: 'availability',
    });
    expect(columns).toEqual({});
  });
});
