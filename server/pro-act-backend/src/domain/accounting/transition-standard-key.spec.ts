import { Dec, formatDec } from '../actuals/decimal';
import {
  GradeChange,
  LossEvent,
  PeriodAccountingInput,
  TransitionStandard,
} from './accounting.types';
import { computePeriodAccounting } from './period-accounting';
import { standardFor } from './transition-split';

/**
 * SME E1: the transition-standard key is unit × from × to × catalyst family × operating mode; a null
 * catalyst / mode on the standard means "any" and the most specific matching entry wins (catalyst
 * outranks mode on a tie). 30 t/h, 8 h, transition A→B 02:00–05:00 (3 h), 40 t off-grade.
 */
const T0 = Date.parse('2027-03-01T00:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);

function transition(change: Partial<GradeChange> = {}): LossEvent {
  return {
    eventId: 'GT',
    revisionId: null,
    revision: null,
    occurrenceId: 'GT',
    physicalType: 'grade_transition',
    start: at(2),
    end: at(5),
    scheduleClass: 'planned',
    oeeComponent: 'performance',
    impactMode: 'measured',
    impactFraction: null,
    quantity: '40',
    reasonCodeId: null,
    impactCodeId: null,
    failureMode: null,
    transition: { fromProductId: 'A', toProductId: 'B', ...change },
  };
}

const standard = (
  id: string,
  hours: number,
  extra: Partial<TransitionStandard> = {},
): TransitionStandard => ({
  id,
  fromProductId: 'A',
  toProductId: 'B',
  referenceSeconds: String(hours * 3600),
  referenceOffgradeQuantity: null,
  from: at(-100),
  to: null,
  ...extra,
});

const ANY = standard('ANY', 2);
const ZN = standard('ZN', 2.5, { catalystFamily: 'ziegler_natta' });
const SWING = standard('SWING', 1.5, { operatingMode: 'swing' });
const ZN_SWING = standard('ZN-SWING', 2.8, {
  catalystFamily: 'ziegler_natta',
  operatingMode: 'swing',
});
const MATRIX = [ANY, ZN, SWING, ZN_SWING];

describe('transition-standard key with catalyst family and operating mode (SME E1)', () => {
  it('falls back to the "any" entry when the change records no context (engine 2.5.5 match)', () => {
    expect(standardFor(transition(), MATRIX)?.id).toBe('ANY');
  });

  it('picks the most specific matching entry', () => {
    expect(
      standardFor(transition({ catalystFamily: 'ziegler_natta' }), MATRIX)?.id,
    ).toBe('ZN');
    expect(
      standardFor(transition({ operatingMode: 'swing' }), MATRIX)?.id,
    ).toBe('SWING');
    expect(
      standardFor(
        transition({ catalystFamily: 'ziegler_natta', operatingMode: 'swing' }),
        MATRIX,
      )?.id,
    ).toBe('ZN-SWING');
  });

  it('lets catalyst family outrank operating mode when only single-part entries match', () => {
    const change = transition({
      catalystFamily: 'ziegler_natta',
      operatingMode: 'swing',
    });
    expect(standardFor(change, [ANY, SWING, ZN])?.id).toBe('ZN');
  });

  it('never matches an entry for another catalyst or mode', () => {
    const change = transition({ catalystFamily: 'metallocene' });
    expect(standardFor(change, [ZN, ZN_SWING])).toBeNull();
    expect(standardFor(change, MATRIX)?.id).toBe('ANY');
    expect(standardFor(transition(), [ZN, SWING])).toBeNull();
  });

  it('prices the allowance with the matched entry: 2.5 h of 3 h for a Ziegler-Natta change', () => {
    const window = { start: at(0), end: at(8) };
    const input: PeriodAccountingInput = {
      window,
      periodExcluded: false,
      periodExclusionKind: null,
      schedule: [],
      events: [transition({ catalystFamily: 'ziegler_natta' })],
      asOf: window.end,
      transitionStandards: MATRIX,
      policy: {
        microStopSeconds: 60,
        derateComponent: 'performance',
        plannedStopsInsideScheduleReduceAvailability: true,
        epsilon: '0.000001',
      },
      slices: [
        {
          sliceId: 'S1',
          window,
          uom: 't',
          sustainedRates: [
            { id: 'sus', rate: '30', timebase: 'h', from: at(-1), to: null },
          ],
          planningRates: [
            { id: 'plan', rate: '30', timebase: 'h', from: at(-1), to: null },
          ],
          target: '240',
          actuals: { gross: '190', good: '150', uom: 't' },
          concurrent: false,
        },
      ],
    };
    const lines = computePeriodAccounting(input).lines.filter(
      (l) => l.ledger === 'capacity' && l.kind === 'transition_allowance',
    );
    const total = lines.reduce((s, l) => s.plus(l.quantity), new Dec(0));
    // 3 h × 30 t/h = 90 t of transition capacity; 2.5 / 3 of it is within the ZN standard = 75 t
    expect(formatDec(total)).toBe('75');
    expect(lines.every((l) => l.flags.includes('transition_standard:ZN'))).toBe(
      true,
    );
  });
});
