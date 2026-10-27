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

describe('prepareUpdate source kind', () => {
  const stop = (sourceKind: string, source: string) =>
    ({
      startTime: new Date(base.startTime),
      endTime: new Date(base.endTime),
      physicalType: 'downtime',
      scheduleClass: 'unplanned',
      oeeComponent: 'availability',
      impactMode: 'full_stop',
      physicalState: 'closed',
      codingState: 'uncoded',
      rcaState: 'none',
      reasonCodeId: null,
      rcaId: null,
      source,
      sourceKind,
    }) as unknown as ProductionEvent;

  it('coding a state-engine stop keeps it derived (Marun E2E: it became "source")', () => {
    const fields = prepareUpdate(stop('derived', 'State engine'), {
      reasonCodeId: 'r-1',
    });
    expect(fields.sourceKind).toBe('derived');
    expect(fields.codingState).toBe('coded');
  });

  it('a source revision of an imported event keeps it imported', () => {
    const fields = prepareUpdate(stop('imported', 'CSV import'), {
      endTime: new Date('2027-03-01T09:30:00Z'),
    });
    expect(fields.sourceKind).toBe('imported');
  });

  it('a changed source label re-derives the kind', () => {
    expect(
      prepareUpdate(stop('manual', 'Manual'), { source: 'PI' }).sourceKind,
    ).toBe('source');
  });
});

describe('prepareUpdate coding state when a reason is cleared (Marun E2E note A)', () => {
  const coded = (overrides: Partial<ProductionEvent> = {}) =>
    ({
      startTime: new Date(base.startTime),
      endTime: new Date(base.endTime),
      physicalType: 'downtime',
      scheduleClass: 'unplanned',
      oeeComponent: 'performance',
      impactMode: 'full_stop',
      physicalState: 'closed',
      codingState: 'coded',
      rcaState: 'none',
      reasonCodeId: 'speed-loss',
      rcaId: null,
      investigationPending: false,
      source: 'State engine',
      sourceKind: 'derived',
      ...overrides,
    }) as unknown as ProductionEvent;

  it('clearing the reason makes the stop uncoded again (status Open)', () => {
    const fields = prepareUpdate(coded(), { reasonCodeId: null });
    expect(fields.codingState).toBe('uncoded');
    expect(fields.status).not.toBe('Coded');
  });

  it('a reviewed stop whose reason is cleared is uncoded too', () => {
    expect(
      prepareUpdate(coded({ codingState: 'reviewed' }), { reasonCodeId: null })
        .codingState,
    ).toBe('uncoded');
  });

  it('a stop under investigation keeps its coding state when the reason is cleared', () => {
    expect(
      prepareUpdate(coded(), { reasonCodeId: null, investigationPending: true })
        .codingState,
    ).toBe('coded');
    expect(
      prepareUpdate(coded({ investigationPending: true }), {
        reasonCodeId: null,
      }).codingState,
    ).toBe('coded');
  });

  it('an edit that leaves the reason untouched keeps the coding state', () => {
    expect(
      prepareUpdate(coded(), { endTime: new Date(base.endTime) }).codingState,
    ).toBe('coded');
    expect(prepareUpdate(coded(), {}).codingState).toBe('coded');
  });

  it('an OEE-only edit on a reasonless coded stop makes it uncoded (regression R1)', () => {
    const fields = prepareUpdate(coded({ reasonCodeId: undefined }), {
      classification: { oeeComponent: 'availability' },
    });
    expect(fields.codingState).toBe('uncoded');
    expect(fields.status).toBe('Open');
  });

  it('any write recomputes the coding state from the data', () => {
    expect(
      prepareUpdate(coded({ reasonCodeId: undefined }), {}).codingState,
    ).toBe('uncoded');
    expect(
      prepareUpdate(coded({ codingState: 'uncoded' }), {}).codingState,
    ).toBe('coded');
    expect(
      prepareUpdate(coded({ codingState: 'reviewed' }), {}).codingState,
    ).toBe('reviewed');
    expect(
      prepareUpdate(
        coded({ reasonCodeId: undefined, investigationPending: true }),
        {},
      ).codingState,
    ).toBe('coded');
  });

  it('a non-stop event without a reason keeps its stored coding state', () => {
    expect(
      prepareUpdate(
        coded({
          reasonCodeId: undefined,
          physicalType: 'advisory',
          codingState: 'reviewed',
        }),
        {},
      ).codingState,
    ).toBe('reviewed');
  });
});

describe('production_loss events (declared mode)', () => {
  const figures = {
    planned: 120,
    actual: 112.5,
    shortfall: 7.5,
    uom: 't',
    measurementQuality: null,
    sourceStatus: null,
    plan: null,
    piSource: null,
  };
  const loss = {
    ...base,
    classification: { physicalType: 'production_loss' as const },
    declaredFigures: figures,
  };

  const refused = (input: Parameters<typeof prepareCreate>[0]): unknown => {
    try {
      prepareCreate(input);
    } catch (error) {
      return (error as { getResponse(): unknown }).getResponse();
    }
    return null;
  };

  it('is measured tonnes with no OEE component, closed because it has an end', () => {
    expect(prepareCreate(loss)).toMatchObject({
      physicalType: 'production_loss',
      impactMode: 'measured',
      oeeComponent: 'none',
      scheduleClass: 'unknown',
      physicalState: 'closed',
    });
  });

  it('keeps the measured impact whatever the caller or a code default states', () => {
    const fields = prepareCreate({
      ...loss,
      classification: {
        physicalType: 'production_loss',
        impactMode: 'full_stop',
        oeeComponent: 'availability',
        scheduleClass: 'unplanned',
      },
    });
    expect(fields).toMatchObject({
      impactMode: 'measured',
      oeeComponent: 'none',
      scheduleClass: 'unplanned',
    });
  });

  it('needs an end, declared figures and a quantity equal to the shortfall', () => {
    expect(refused({ ...loss, endTime: null })).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: [{ field: 'endTime' }],
    });
    expect(refused({ ...loss, declaredFigures: undefined })).toMatchObject({
      fieldErrors: [{ field: 'declaredFigures' }],
    });
    expect(refused({ ...loss, quantity: '9' })).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: [expect.stringContaining('9')],
      fieldErrors: [{ field: 'quantity' }],
    });
    expect(refused({ ...loss, quantity: '7.5' })).toBeNull();
  });

  it('an update keeps the stored figures and validates the effective ones', () => {
    const existing = {
      ...prepareCreate(loss),
      quantity: 7.5,
      declaredFigures: figures,
      reasonCodeId: null,
      rcaId: null,
      source: 'Manual',
    } as unknown as ProductionEvent;
    expect(prepareUpdate(existing, { reasonCodeId: 'r-1' })).toMatchObject({
      physicalType: 'production_loss',
      physicalState: 'closed',
      codingState: 'coded',
    });
    expect(() => prepareUpdate(existing, { quantity: '1' })).toThrow();
    expect(() => prepareUpdate(existing, { endTime: null })).toThrow();
  });
});
