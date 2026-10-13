import { classifyLegacyEventType, sourceKindOf } from './event-classification';
import {
  assertNotInFuture,
  IntervalViolation,
  resolveInterval,
} from './event-interval.validation';
import {
  fromLegacyStatus,
  LEGACY_STATUSES,
  LegacyStatus,
  toLegacyStatus,
} from './legacy-status';

const at = (time: string) => new Date(`2026-10-07T${time}:00.000Z`);

describe('classifyLegacyEventType (§3.2)', () => {
  it('maps ProductionLoss to a full-stop availability downtime', () => {
    expect(classifyLegacyEventType('ProductionLoss')).toEqual({
      physicalType: 'downtime',
      scheduleClass: 'unknown',
      oeeComponent: 'availability',
      impactMode: 'full_stop',
    });
  });

  it.each(['IOW', 'SOL', 'APM', 'FailureWO', 'Unknown', null, undefined])(
    'T42: %p is advisory with no OEE impact',
    (eventType) => {
      expect(classifyLegacyEventType(eventType)).toEqual({
        physicalType: 'advisory',
        scheduleClass: 'unknown',
        oeeComponent: 'none',
        impactMode: 'none',
      });
    },
  );

  it('maps the source column to a source kind', () => {
    expect(sourceKindOf('Manual')).toBe('manual');
    expect(sourceKindOf(null)).toBe('manual');
    expect(sourceKindOf('PI')).toBe('source');
  });
});

describe('legacy status adapter (DT11)', () => {
  /** label → label the adapter writes back (two synonyms collapse; Completed needs a linked RCA). */
  const CANONICAL: Record<LegacyStatus, LegacyStatus> = {
    Open: 'Open',
    Coded: 'Coded',
    'RCA Required': 'RCA Required',
    Investigating: 'Investigating',
    'In Progress': 'Investigating',
    Completed: 'Completed',
    Closed: 'Closed',
    Cancelled: 'Cancelled',
  };

  it.each(LEGACY_STATUSES.map((status) => [status]))(
    'round-trips %p',
    (status) => {
      const states = fromLegacyStatus(status, {
        hasEnd: true,
        hasReasonCode: false,
        hasRca: status === 'Completed',
      });
      expect(toLegacyStatus(states)).toBe(CANONICAL[status]);
      expect(
        fromLegacyStatus(toLegacyStatus(states), {
          hasEnd: true,
          hasReasonCode: false,
          hasRca: status === 'Completed',
        }),
      ).toEqual(states);
    },
  );

  it('shows a superseded split/merge contributor as Cancelled (plan 1.4)', () => {
    expect(
      toLegacyStatus({
        physicalState: 'superseded',
        codingState: 'coded',
        rcaState: 'linked',
      }),
    ).toBe('Cancelled');
  });

  it('takes the physical state from the interval, not the label', () => {
    expect(
      fromLegacyStatus('Open', {
        hasEnd: true,
        hasReasonCode: false,
        hasRca: false,
      }).physicalState,
    ).toBe('closed');
    expect(
      fromLegacyStatus('Closed', {
        hasEnd: false,
        hasReasonCode: false,
        hasRca: false,
      }).physicalState,
    ).toBe('open');
    expect(
      fromLegacyStatus('Cancelled', {
        hasEnd: false,
        hasReasonCode: false,
        hasRca: false,
      }).physicalState,
    ).toBe('retracted');
  });

  it('infers coding and RCA from the row when the label is missing or unknown', () => {
    expect(
      fromLegacyStatus(undefined, {
        hasEnd: false,
        hasReasonCode: true,
        hasRca: true,
      }),
    ).toEqual({
      physicalState: 'open',
      codingState: 'coded',
      rcaState: 'linked',
    });
    expect(
      fromLegacyStatus('Whatever', {
        hasEnd: true,
        hasReasonCode: false,
        hasRca: false,
      }),
    ).toEqual({
      physicalState: 'closed',
      codingState: 'uncoded',
      rcaState: 'none',
    });
  });

  it('a closed event with no RCA reads Completed only when an RCA exists', () => {
    expect(
      toLegacyStatus(
        fromLegacyStatus('Completed', {
          hasEnd: true,
          hasReasonCode: true,
          hasRca: false,
        }),
      ),
    ).toBe('Closed');
  });
});

describe('resolveInterval (DT08)', () => {
  const base = { start: at('06:00'), physicalType: 'downtime' as const };

  function violation(
    input: Parameters<typeof resolveInterval>[0],
  ): string | undefined {
    try {
      resolveInterval(input);
      return undefined;
    } catch (error) {
      return error instanceof IntervalViolation ? error.code : 'unexpected';
    }
  }

  it('keeps an explicit end; computes the end from a duration; leaves an event open otherwise', () => {
    expect(resolveInterval({ ...base, end: at('07:30') })).toEqual({
      start: at('06:00'),
      end: at('07:30'),
    });
    expect(resolveInterval({ ...base, durationSeconds: 5400 })).toEqual({
      start: at('06:00'),
      end: at('07:30'),
    });
    expect(resolveInterval(base)).toEqual({ start: at('06:00'), end: null });
  });

  it('accepts end and duration that agree within 1 s', () => {
    expect(
      resolveInterval({ ...base, end: at('07:30'), durationSeconds: 5400.5 })
        .end,
    ).toEqual(at('07:30'));
  });

  it('rejects disagreement, reversed and zero-length stops', () => {
    expect(violation({ ...base, end: at('07:30'), durationSeconds: 600 })).toBe(
      'DURATION_CONFLICT',
    );
    expect(violation({ ...base, end: at('05:00') })).toBe('END_BEFORE_START');
    expect(violation({ ...base, end: at('06:00') })).toBe(
      'ZERO_DURATION_DOWNTIME',
    );
    expect(violation({ ...base, durationSeconds: 0 })).toBe(
      'ZERO_DURATION_DOWNTIME',
    );
    expect(
      violation({ ...base, physicalType: 'advisory', end: at('06:00') }),
    ).toBe('END_BEFORE_START');
    expect(violation({ ...base, durationSeconds: -1 })).toBe(
      'NEGATIVE_DURATION',
    );
    expect(violation({ ...base, start: new Date('nope') })).toBe(
      'INVALID_START',
    );
  });
});

describe('assertNotInFuture (DT-09)', () => {
  const now = at('12:00');

  function violation(interval: {
    start: Date;
    end: Date | null;
  }): { code: string; field: string } | undefined {
    try {
      assertNotInFuture(interval, now);
      return undefined;
    } catch (error) {
      return error instanceof IntervalViolation
        ? { code: error.code, field: error.field }
        : { code: 'unexpected', field: '' };
    }
  }

  it('accepts past and open events and a start or end within the 2 min clock allowance', () => {
    expect(violation({ start: at('06:00'), end: at('11:59') })).toBeUndefined();
    expect(violation({ start: at('06:00'), end: null })).toBeUndefined();
    expect(violation({ start: at('12:02'), end: null })).toBeUndefined();
    expect(violation({ start: at('11:00'), end: at('12:02') })).toBeUndefined();
  });

  it('rejects a start or an end beyond the allowance, naming the field', () => {
    expect(violation({ start: at('12:03'), end: null })).toEqual({
      code: 'IN_FUTURE',
      field: 'startTime',
    });
    expect(violation({ start: at('11:00'), end: at('13:00') })).toEqual({
      code: 'IN_FUTURE',
      field: 'endTime',
    });
  });
});
