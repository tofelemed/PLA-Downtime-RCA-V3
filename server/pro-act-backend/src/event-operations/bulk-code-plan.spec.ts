import {
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProductionEvent } from '../production-event/production-event.entity';
import {
  affectedWindows,
  assertAssetUnit,
  classifyItems,
  codingPatch,
  codingSnapshot,
  rejectExclusions,
} from './bulk-code-plan';

const at = (time: string): Date => new Date(`2026-10-08T${time}:00.000Z`);

function event(id: string, extra: Partial<ProductionEvent> = {}) {
  return {
    id,
    unitId: 'u1',
    rowVersion: 1,
    startTime: at('10:00'),
    endTime: at('11:00'),
    physicalType: 'downtime',
    scheduleClass: 'unknown',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    physicalState: 'closed',
    codingState: 'uncoded',
    rcaState: 'none',
    source: 'Manual',
    ...extra,
  } as ProductionEvent;
}

describe('classifyItems (DT10 preview rules)', () => {
  it('excludes unknown, repeated, superseded, retracted and stale items', () => {
    const events = [
      event('a'),
      event('s', { physicalState: 'superseded' }),
      event('r', { physicalState: 'retracted' }),
      event('v', { rowVersion: 4 }),
    ];
    const result = classifyItems(
      [
        { eventId: 'a', expectedVersion: 1 },
        { eventId: 'x', expectedVersion: 1 },
        { eventId: 'a', expectedVersion: 1 },
        { eventId: 's', expectedVersion: 1 },
        { eventId: 'r', expectedVersion: 1 },
        { eventId: 'v', expectedVersion: 1 },
      ],
      events,
    );
    expect(result.eligible.map(({ event: e }) => e.id)).toEqual(['a']);
    expect(result.exclusions).toEqual([
      { eventId: 'x', reason: 'not_found' },
      { eventId: 'a', reason: 'duplicate' },
      { eventId: 's', reason: 'superseded' },
      { eventId: 'r', reason: 'retracted' },
      { eventId: 'v', reason: 'stale_version', currentVersion: 4 },
    ]);
  });
});

describe('rejectExclusions (atomic apply)', () => {
  it.each([
    ['not_found', NotFoundException],
    ['superseded', ConflictException],
    ['retracted', ConflictException],
    ['stale_version', PreconditionFailedException],
    ['duplicate', UnprocessableEntityException],
  ] as const)('%s → %p', (reason, type) => {
    expect(() => rejectExclusions([{ eventId: 'e', reason }])).toThrow(type);
  });

  it('accepts a batch without exclusions; 404 wins over 412', () => {
    expect(() => rejectExclusions([])).not.toThrow();
    expect(() =>
      rejectExclusions([
        { eventId: 'a', reason: 'stale_version' },
        { eventId: 'b', reason: 'not_found' },
      ]),
    ).toThrow(NotFoundException);
  });
});

describe('codingPatch', () => {
  it('codes the event and applies the reason defaults the caller did not set', () => {
    const patch = codingPatch(
      event('a'),
      { reasonCodeId: 'r1', oeeComponent: 'performance' },
      {
        scheduleClass: {
          value: 'unplanned',
          source: 'code_default',
          ruleId: null,
          ruleVersion: null,
        },
        impactCodeId: {
          value: 'i1',
          source: 'code_rule',
          ruleId: 'rule',
          ruleVersion: 2,
        },
      },
    );
    expect(patch).toMatchObject({
      reasonCodeId: 'r1',
      codingState: 'coded',
      scheduleClass: 'unplanned',
      oeeComponent: 'performance',
      impactCodeId: 'i1',
      status: 'Coded',
    });
    expect(patch.classificationBasis?.scheduleClass?.source).toBe(
      'code_default',
    );
  });

  it('never replaces an existing impact code with a default', () => {
    const patch = codingPatch(
      event('a', { impactCodeId: 'kept' }),
      { reasonCodeId: 'r1' },
      {
        impactCodeId: {
          value: 'i1',
          source: 'code_default',
          ruleId: null,
          ruleVersion: null,
        },
      },
    );
    expect(patch.impactCodeId).toBeUndefined();
  });
});

describe('affectedWindows', () => {
  it('merges intervals per unit and leaves running windows open', () => {
    const windows = affectedWindows([
      event('a'),
      event('b', { startTime: at('10:30'), endTime: at('11:30') }),
      event('c', { startTime: at('13:00'), endTime: undefined }),
      event('d', { unitId: 'u2' }),
    ]);
    expect(windows).toEqual([
      {
        unitId: 'u1',
        from: at('10:00').toISOString(),
        to: at('11:30').toISOString(),
      },
      { unitId: 'u1', from: at('13:00').toISOString(), to: null },
      {
        unitId: 'u2',
        from: at('10:00').toISOString(),
        to: at('11:00').toISOString(),
      },
    ]);
  });
});

describe('bulk asset and investigation flag (UX A-1 / E-3)', () => {
  it('writes the asset and the investigation flag when given, and leaves them otherwise', () => {
    const patch = codingPatch(
      event('a'),
      { assetId: 'asset-1', investigationPending: true },
      {},
    );
    expect(patch).toMatchObject({
      assetId: 'asset-1',
      investigationPending: true,
    });
    const untouched = codingPatch(event('a'), { scheduleClass: 'planned' }, {});
    expect(untouched).not.toHaveProperty('assetId');
    expect(untouched).not.toHaveProperty('investigationPending');
  });

  it('clears the investigation flag with false', () => {
    const patch = codingPatch(
      event('a', { investigationPending: true }),
      { investigationPending: false },
      {},
    );
    expect(patch.investigationPending).toBe(false);
  });

  it('shows asset and flag in the preview snapshot', () => {
    expect(
      codingSnapshot(event('a', { assetId: 'x', investigationPending: true })),
    ).toMatchObject({ assetId: 'x', investigationPending: true });
    expect(codingSnapshot(event('b'))).toMatchObject({
      assetId: null,
      investigationPending: false,
    });
  });

  it('accepts an asset of every event unit and refuses another unit or an unknown asset (422)', () => {
    const events = [event('a'), event('b', { unitId: 'u2' })];
    expect(() => assertAssetUnit([events[0]], { unitId: 'u1' })).not.toThrow();
    for (const asset of [{ unitId: 'u1' }, null]) {
      try {
        assertAssetUnit(events, asset);
        throw new Error('expected a refusal');
      } catch (error) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        const body = (error as UnprocessableEntityException).getResponse();
        expect(body).toMatchObject({ code: 'INVALID_REFERENCE' });
      }
    }
    try {
      assertAssetUnit(events, { unitId: 'u1' });
    } catch (error) {
      const body = (error as UnprocessableEntityException).getResponse();
      expect(body).toMatchObject({ details: { eventIds: ['b'] } });
    }
  });
});
