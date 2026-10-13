import { ProductionEvent } from './production-event.entity';
import { prepareCreate, prepareUpdate } from './event-write-model';

const base = {
  startTime: '2027-03-01T08:00:00Z',
  endTime: '2027-03-01T09:00:00Z',
  source: 'Manual',
};

describe('prepareCreate impact mode (LA-05, SME Q5)', () => {
  it('downtime entered without an impact mode stops the unit', () => {
    expect(
      prepareCreate({ ...base, classification: { physicalType: 'downtime' } })
        .impactMode,
    ).toBe('full_stop');
  });

  it('an explicit impact mode is kept', () => {
    for (const impactMode of ['none', 'fractional', 'full_stop'] as const) {
      expect(
        prepareCreate({
          ...base,
          classification: { physicalType: 'downtime', impactMode },
        }).impactMode,
      ).toBe(impactMode);
    }
  });

  it('legacy loss events stop the unit; advisory events have no impact', () => {
    expect(
      prepareCreate({ ...base, eventType: 'ProductionLoss' }).impactMode,
    ).toBe('full_stop');
    expect(prepareCreate({ ...base, eventType: 'IOW' }).impactMode).toBe(
      'none',
    );
  });
});

describe('prepareUpdate impact mode (LA-05)', () => {
  it('an advisory event reclassified as downtime without an impact stops the unit', () => {
    const existing = {
      startTime: new Date(base.startTime),
      endTime: new Date(base.endTime),
      physicalType: 'advisory',
      scheduleClass: 'unknown',
      oeeComponent: 'none',
      impactMode: 'none',
      physicalState: 'closed',
      codingState: 'uncoded',
      rcaState: 'none',
    } as unknown as ProductionEvent;
    expect(
      prepareUpdate(existing, { classification: { physicalType: 'downtime' } })
        .impactMode,
    ).toBe('full_stop');
  });
});
