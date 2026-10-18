import { ConflictException, HttpException } from '@nestjs/common';
import {
  assertAfterApprovedHistory,
  backdateOverlapsCalculation,
  CalculatedPeriod,
  parseBackdate,
} from './policy-backdate';

const NOW = new Date('2026-10-18T12:00:00Z');

function codeOf(run: () => unknown): { status: number; code: unknown } {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { code?: unknown };
      return { status: error.getStatus(), code: body.code };
    }
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('parseBackdate (commissioning backdate, owner 18 Oct 2026)', () => {
  it('is null without effectiveFrom: the version takes effect now, as before', () => {
    expect(parseBackdate({}, NOW)).toBeNull();
    expect(parseBackdate({ backdateReason: '  ' }, NOW)).toBeNull();
  });

  it('accepts a past instant with a trimmed reason', () => {
    expect(
      parseBackdate(
        {
          effectiveFrom: '2026-10-01T00:00:00Z',
          backdateReason: ' commissioning ',
        },
        NOW,
      ),
    ).toEqual({
      effectiveFrom: new Date('2026-10-01T00:00:00Z'),
      reason: 'commissioning',
    });
  });

  it('refuses a present or future instant', () => {
    for (const effectiveFrom of [NOW.toISOString(), '2026-10-19T00:00:00Z']) {
      expect(
        codeOf(() =>
          parseBackdate({ effectiveFrom, backdateReason: 'x' }, NOW),
        ),
      ).toEqual({ status: 422, code: 'INVALID_EFFECTIVE_FROM' });
    }
  });

  it('refuses a backdate without a reason, and a reason without a backdate', () => {
    expect(
      codeOf(() =>
        parseBackdate(
          { effectiveFrom: '2026-10-01T00:00:00Z', backdateReason: ' ' },
          NOW,
        ),
      ),
    ).toEqual({ status: 422, code: 'BACKDATE_REASON_REQUIRED' });
    expect(codeOf(() => parseBackdate({ backdateReason: 'why' }, NOW))).toEqual(
      { status: 422, code: 'BACKDATE_REASON_WITHOUT_EFFECTIVE_FROM' },
    );
  });

  it('refuses an unparseable instant', () => {
    expect(
      codeOf(() =>
        parseBackdate({ effectiveFrom: 'yesterday', backdateReason: 'x' }, NOW),
      ),
    ).toEqual({ status: 422, code: 'INVALID_EFFECTIVE_FROM' });
  });
});

describe('assertAfterApprovedHistory', () => {
  const backdate = {
    effectiveFrom: new Date('2026-10-05T00:00:00Z'),
    reason: 'commissioning',
  };

  it('passes without an approved version or after the latest one', () => {
    expect(() => assertAfterApprovedHistory(null, backdate)).not.toThrow();
    expect(() =>
      assertAfterApprovedHistory(new Date('2026-10-04T23:59:59Z'), backdate),
    ).not.toThrow();
  });

  it('refuses rewriting approved history (at or before the latest approved version)', () => {
    for (const latest of ['2026-10-05T00:00:00Z', '2026-10-10T00:00:00Z']) {
      expect(
        codeOf(() => assertAfterApprovedHistory(new Date(latest), backdate)),
      ).toEqual({ status: 409, code: 'BACKDATE_REWRITES_HISTORY' });
    }
  });
});

describe('backdateOverlapsCalculation', () => {
  const period = (n: number): CalculatedPeriod => ({
    periodId: `p${n}`,
    unitId: 'u1',
    unitName: 'Extruder 1',
    localDate: `2026-10-0${n}`,
    shiftName: n === 1 ? 'Day' : null,
    utcStart: new Date(`2026-10-0${n}T00:00:00Z`),
    utcEnd: new Date(`2026-10-0${n}T12:00:00Z`),
  });

  it('is a 409 that names the listed periods and the total', () => {
    const error = backdateOverlapsCalculation([period(1), period(2)], 5);
    expect(error).toBeInstanceOf(ConflictException);
    const body = error.getResponse() as {
      code: string;
      message: string;
      details: { total: number; periods: Array<{ periodId: string }> };
    };
    expect(body.code).toBe('BACKDATE_OVERLAPS_CALCULATION');
    expect(body.message).toContain(
      'Extruder 1 2026-10-01 Day, Extruder 1 2026-10-02 and 3 more',
    );
    expect(body.details.total).toBe(5);
    expect(body.details.periods.map((p) => p.periodId)).toEqual(['p1', 'p2']);
  });
});
