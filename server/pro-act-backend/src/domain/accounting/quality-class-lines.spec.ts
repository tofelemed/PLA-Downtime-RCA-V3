import { formatDec } from '../actuals/decimal';
import { QualityClasses } from '../actuals/period/quality-classes';
import {
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
} from './accounting.types';
import { computePeriodAccounting } from './period-accounting';

const T0 = Date.parse('2027-03-01T00:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);

const classes = (extra: Partial<QualityClasses>): QualityClasses => ({
  firstPassGood: null,
  wideSpec: '0',
  downgrade: '0',
  transitionOffGrade: '0',
  scrap: '0',
  rework: '0',
  unclassified: null,
  recovered: '0',
  reprocessedInput: '0',
  dispositionIds: ['lot'],
  ...extra,
});

const qualityEvent = (extra: Partial<LossEvent>): LossEvent => ({
  eventId: 'Q1',
  revisionId: null,
  revision: null,
  occurrenceId: 'Q1',
  physicalType: 'quality_loss',
  start: at(1),
  end: at(2),
  scheduleClass: 'unplanned',
  oeeComponent: 'quality',
  impactMode: 'measured',
  impactFraction: null,
  quantity: '2',
  reasonCodeId: null,
  impactCodeId: null,
  failureMode: null,
  ...extra,
});

function run(
  actuals: { gross: string; good: string; classes: QualityClasses | null },
  events: LossEvent[] = [],
) {
  const window = { start: at(0), end: at(8) };
  const rate = (id: string) => [
    { id, rate: '12.5', timebase: 'h' as const, from: at(-10), to: null },
  ];
  const input: PeriodAccountingInput = {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events,
    asOf: window.end,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
    },
    slices: [
      {
        sliceId: 'S',
        window,
        uom: 't',
        sustainedRates: rate('sus'),
        planningRates: rate('plan'),
        target: '100',
        actuals: { ...actuals, uom: 't' },
        concurrent: false,
      },
    ],
  };
  return computePeriodAccounting(input);
}

const quality = (lines: LossLineDraft[], ledger: 'capacity' | 'plan') =>
  lines
    .filter((l) => l.ledger === ledger && l.kind === 'quality')
    .map((l) => ({
      quantity: formatDec(l.quantity),
      cause: l.cause?.eventId ?? null,
      flags: l.flags,
    }));

describe('quality loss lines by disposition class (SME E3)', () => {
  it('E3: 5 t downgraded of a 100 t lot → one 5 t quality line of class downgrade in both ledgers', () => {
    const result = run({
      gross: '100',
      good: '95',
      classes: classes({ downgrade: '5', firstPassGood: '95' }),
    });
    expect(result.issues).toEqual([]);
    for (const ledger of ['capacity', 'plan'] as const) {
      expect(quality(result.lines, ledger)).toEqual([
        {
          quantity: '5',
          cause: null,
          flags: ['no_cause', 'quality_class:downgrade'],
        },
      ]);
    }
    const capacity = result.totals.find((t) => t.ledger === 'capacity');
    expect(capacity?.quality?.toString()).toBe('5');
    expect(capacity?.residual?.toString()).toBe('0');
  });

  it('an event with a class claims its quantity; the lot class it shares is not counted twice', () => {
    const result = run(
      {
        gross: '100',
        good: '93',
        classes: classes({ downgrade: '5', scrap: '2' }),
      },
      [qualityEvent({ dispositionClass: 'scrap' })],
    );
    expect(quality(result.lines, 'capacity')).toEqual([
      { quantity: '2', cause: 'Q1', flags: ['quality_class:scrap'] },
      {
        quantity: '5',
        cause: null,
        flags: ['no_cause', 'quality_class:downgrade'],
      },
    ]);
  });

  it('classified quantity beyond the quality loss is capped and flagged, never scaled', () => {
    const result = run({
      gross: '100',
      good: '97',
      classes: classes({ scrap: '1', downgrade: '5' }),
    });
    expect(quality(result.lines, 'capacity')).toEqual([
      {
        quantity: '1',
        cause: null,
        flags: ['no_cause', 'quality_class:scrap'],
      },
      {
        quantity: '2',
        cause: null,
        flags: [
          'no_cause',
          'quality_class:downgrade',
          'quality_classes_exceed_loss',
        ],
      },
    ]);
  });

  it('the unclassified rest stays a plain line without cause', () => {
    const result = run({
      gross: '100',
      good: '92',
      classes: classes({ rework: '5' }),
    });
    expect(quality(result.lines, 'capacity')).toEqual([
      {
        quantity: '5',
        cause: null,
        flags: ['no_cause', 'quality_class:rework'],
      },
      { quantity: '3', cause: null, flags: ['no_cause'] },
    ]);
  });

  it('rework round trip: a recovery period has no quality loss and no gain from the recovered 5 t', () => {
    const result = run({
      gross: '100',
      good: '100',
      classes: classes({ recovered: '5', reprocessedInput: '5' }),
    });
    expect(quality(result.lines, 'capacity')).toEqual([]);
    const gains = result.lines.filter(
      (l) => l.kind === 'gain' && l.quantity.abs().gt('0.000001'),
    );
    expect(gains).toEqual([]);
  });

  it('no classes: the remainder line is unchanged (old behaviour)', () => {
    const result = run({ gross: '100', good: '95', classes: null });
    expect(quality(result.lines, 'capacity')).toEqual([
      { quantity: '5', cause: null, flags: ['no_cause'] },
    ]);
  });
});
