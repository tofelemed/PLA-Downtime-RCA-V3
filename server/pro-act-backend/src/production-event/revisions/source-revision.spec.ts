import { ActiveCodingRule } from '../../rules/rule-defaults';
import { ProductionEvent } from '../production-event.entity';
import { retypes, sourceColumns } from './source-revision';

const RULE: ActiveCodingRule = {
  id: 'rule-1',
  version: 3,
  definition: {
    when: { all: [{ field: 'sourceKind', op: 'in', value: ['source'] }] },
    then: [{ set: 'scheduleClass', value: 'external' }],
  },
};

const ruled = {
  source: 'declarative_rule' as const,
  ruleId: 'rule-1',
  ruleVersion: 3,
  defaultValue: 'external',
  overridesDefault: false,
};

/** An advisory MQTT event whose schedule class a rule filled, with a user override of the OEE component. */
const stored = (): ProductionEvent =>
  ({
    id: 'event-1',
    tenantId: 'tenant-1',
    unitId: 'unit-1',
    assetId: null,
    source: 'MQTT',
    sourceKind: 'source',
    eventType: 'IOW',
    startTime: new Date('2026-10-08T06:00:00Z'),
    endTime: new Date('2026-10-08T07:00:00Z'),
    physicalType: 'advisory',
    scheduleClass: 'external',
    oeeComponent: 'quality',
    impactMode: 'none',
    impactCodeId: null,
    reasonCodeId: null,
    rcaId: null,
    investigationPending: false,
    physicalState: 'closed',
    codingState: 'uncoded',
    rcaState: 'none',
    classificationBasis: { scheduleClass: ruled },
    userOverrides: { oeeComponent: 2 },
  }) as unknown as ProductionEvent;

/** Item 8 open question 1: a source revision that changes the event type re-applies the rules. */
describe('sourceColumns on an event-type change', () => {
  it('detects a change of the stored event type only', () => {
    const event = stored();
    expect(retypes(event, { eventType: 'ProductionLoss' }, ['eventType'])).toBe(
      true,
    );
    expect(retypes(event, { eventType: 'IOW' }, ['eventType'])).toBe(false);
    expect(retypes(event, { eventType: 'ProductionLoss' }, ['endTime'])).toBe(
      false,
    );
  });

  it('re-fills the rule axis, keeps the user override and rebuilds the basis', () => {
    const columns = sourceColumns(
      stored(),
      { eventType: 'ProductionLoss' },
      ['eventType'],
      [RULE],
    );
    expect(columns).toMatchObject({
      eventType: 'ProductionLoss',
      physicalType: 'downtime',
      scheduleClass: 'external',
      oeeComponent: 'quality',
      impactCodeId: null,
      classificationBasis: { scheduleClass: ruled },
    });
  });

  it('takes the event-type default and drops the stale rule basis without a matching rule', () => {
    const columns = sourceColumns(
      stored(),
      { eventType: 'ProductionLoss' },
      ['eventType'],
      [],
    );
    expect(columns).toMatchObject({
      scheduleClass: 'unknown',
      oeeComponent: 'quality',
      classificationBasis: null,
    });
  });

  it('leaves the axes and basis alone when the event type does not change', () => {
    const columns = sourceColumns(
      stored(),
      { endTime: '2026-10-08T07:30:00Z' },
      ['endTime'],
      [],
    );
    expect(columns.scheduleClass).toBe('external');
    expect('classificationBasis' in columns).toBe(false);
  });
});

describe('sourceColumns of a production loss', () => {
  it('keeps kind and axes when the delivery changes the event type', () => {
    const loss = {
      ...stored(),
      physicalType: 'production_loss',
      impactMode: 'measured',
      oeeComponent: 'none',
      eventType: null,
      quantity: 7.5,
      declaredFigures: {
        planned: null,
        actual: null,
        shortfall: 7.5,
        uom: 't',
        measurementQuality: null,
        sourceStatus: null,
        plan: null,
        piSource: null,
      },
      userOverrides: {},
      endTime: new Date('2027-03-02T00:00:00Z'),
    } as unknown as ProductionEvent;
    const columns = sourceColumns(
      loss,
      { eventType: 'ProductionLoss' },
      ['eventType'],
      [RULE],
    );
    expect(columns).toMatchObject({
      physicalType: 'production_loss',
      impactMode: 'measured',
      oeeComponent: 'none',
    });
  });
});
