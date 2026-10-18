import { EntityManager } from 'typeorm';
import { LossLineEvidence } from '../../accounting/entities/loss-line-evidence.entity';
import { LossLine } from '../../accounting/entities/loss-line.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { PeriodLedgerTotal } from '../../accounting/entities/period-ledger-total.entity';
import {
  derivationOf,
  loadCandidateDerivations,
  scaledSliceIds,
} from './candidate-derivation';

const T = '00000000-0000-4000-8000-0000000000aa';

function line(overrides: Partial<LossLine> = {}): LossLine {
  return Object.assign(new LossLine(), {
    id: 'line-1',
    tenantId: T,
    ledger: 'plan',
    kind: 'availability',
    basis: 'planning_rate',
    segmentStart: new Date('2026-10-01T06:00:00Z'),
    segmentEnd: new Date('2026-10-01T07:30:00Z'),
    rateVersionId: 'rate-1',
    causeEventId: 'event-1',
    occurrenceId: 'occ-1',
    quantity: '187.5',
    flags: ['upstream_starvation'],
    ...overrides,
  });
}

function rate(): UnitProductRate {
  return Object.assign(new UnitProductRate(), {
    id: 'rate-1',
    rateKind: 'planning',
    rate: '125.00000000',
    timebase: 'hour',
  });
}

function evidence(lossLineId: string, share: string): LossLineEvidence {
  return Object.assign(new LossLineEvidence(), {
    id: `ev-${lossLineId}-${share}`,
    lossLineId,
    eventId: 'event-1',
    eventRevisionId: 'rev-1',
    occurrenceId: 'occ-1',
    share,
    clippedStart: new Date('2026-10-01T06:00:00Z'),
    clippedEnd: new Date('2026-10-01T07:30:00Z'),
  });
}

describe('candidate derivation (UX D-2)', () => {
  it('exposes the stored segment, rate version, cause and evidence without recomputing', () => {
    const view = derivationOf(
      line(),
      [evidence('line-1', '0.50000000')],
      new Map([['rate-1', rate()]]),
    );
    expect(view).toEqual({
      basis: 'planning_rate',
      ledger: 'plan',
      segmentStart: '2026-10-01T06:00:00.000Z',
      segmentEnd: '2026-10-01T07:30:00.000Z',
      durationSeconds: 5400,
      rate: {
        versionId: 'rate-1',
        kind: 'planning',
        value: '125',
        timebase: 'hour',
      },
      rateScaledToTarget: false,
      appliedRate: null,
      sourceEventId: 'event-1',
      occurrenceId: 'occ-1',
      evidence: [
        {
          eventId: 'event-1',
          eventRevisionId: 'rev-1',
          occurrenceId: 'occ-1',
          share: '0.5',
          clippedStart: '2026-10-01T06:00:00.000Z',
          clippedEnd: '2026-10-01T07:30:00.000Z',
        },
      ],
      flags: ['upstream_starvation'],
    });
  });

  it('exposes the stored applied rate (planning rate scaled to target) as a decimal string', () => {
    const view = derivationOf(
      line({ appliedRate: '62.50000000', appliedRateTimebase: 'h' }),
      [],
      new Map([['rate-1', rate()]]),
      true,
    );
    expect(view.appliedRate).toEqual({ value: '62.5', timebase: 'h' });
    expect(view.rate?.value).toBe('125');
    expect(view.rateScaledToTarget).toBe(true);
  });

  it('a line of an earlier run (no stored applied rate) has appliedRate null', () => {
    expect(
      derivationOf(line({ appliedRate: null }), [], new Map()).appliedRate,
    ).toBeNull();
  });

  it('a line without a rate version (measured basis) has rate null', () => {
    const view = derivationOf(
      line({ rateVersionId: null, basis: 'measured', kind: 'performance' }),
      [],
      new Map(),
    );
    expect(view.rate).toBeNull();
    expect(view.basis).toBe('measured');
  });

  it('a rate version that is not readable keeps its id with null values', () => {
    expect(derivationOf(line(), [], new Map()).rate).toEqual({
      versionId: 'rate-1',
      kind: null,
      value: null,
      timebase: null,
    });
  });

  it('marks plan-ledger candidates of slices whose plan total is planned_rate_scaled (SME Q1)', async () => {
    const totals = [
      { sliceId: 's1', ledger: 'plan', flags: ['planned_rate_scaled'] },
      { sliceId: 's2', ledger: 'plan', flags: [] },
      { sliceId: 's3', ledger: 'capacity', flags: ['planned_rate_scaled'] },
    ] as unknown as PeriodLedgerTotal[];
    const scaled = scaledSliceIds(totals);
    expect([...scaled]).toEqual(['s1']);
    const find = jest.fn(() => Promise.resolve([]));
    const manager = { find } as unknown as EntityManager;
    const result = await loadCandidateDerivations(
      manager,
      T,
      [line({ sliceId: 's1' }), line({ id: 'line-2', sliceId: 's2' })],
      scaled,
    );
    expect(result.get('line-1')?.rateScaledToTarget).toBe(true);
    expect(result.get('line-2')?.rateScaledToTarget).toBe(false);
  });

  it('loads evidence and rate versions with one query each, grouped per line', async () => {
    const find = jest.fn((entity: unknown) =>
      Promise.resolve(
        entity === LossLineEvidence
          ? [
              evidence('line-1', '0.5'),
              evidence('line-2', '1'),
              evidence('line-1', '0.25'),
            ]
          : [rate()],
      ),
    );
    const manager = { find } as unknown as EntityManager;
    const lines = [line(), line({ id: 'line-2', rateVersionId: 'rate-1' })];
    const result = await loadCandidateDerivations(manager, T, lines);
    expect(find).toHaveBeenCalledTimes(2);
    expect(result.get('line-1')?.evidence.map((e) => e.share)).toEqual([
      '0.5',
      '0.25',
    ]);
    expect(result.get('line-2')?.evidence).toHaveLength(1);
    expect(result.get('line-2')?.rate?.value).toBe('125');
  });

  it('runs no query without candidates and skips the rate query without rate versions', async () => {
    const find = jest.fn(() => Promise.resolve([]));
    const manager = { find } as unknown as EntityManager;
    expect((await loadCandidateDerivations(manager, T, [])).size).toBe(0);
    expect(find).not.toHaveBeenCalled();
    await loadCandidateDerivations(manager, T, [line({ rateVersionId: null })]);
    expect(find).toHaveBeenCalledTimes(1);
  });
});
