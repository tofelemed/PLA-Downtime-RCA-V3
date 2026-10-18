import { EntityManager } from 'typeorm';
import { parseValuationBackdate } from './valuation-backdate';
import { assertValuationBackdateAllowed } from './valuation-backdate.guard';

const NOW = new Date('2026-10-18T12:00:00Z');
const FROM = '2026-10-17T02:30:00Z';
const REASON = 'Commissioning: guide baseline is contribution margin';

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error: unknown) {
    return (error as { response?: { code?: string } }).response?.code;
  }
  return null;
};

describe('parseValuationBackdate', () => {
  it('is null for a future instant without a reason', () => {
    expect(
      parseValuationBackdate({ effectiveFrom: '2027-01-01T00:00:00Z' }, NOW),
    ).toBeNull();
  });

  it('is the backdate for a past instant with a reason', () => {
    expect(
      parseValuationBackdate(
        { effectiveFrom: FROM, backdateReason: ` ${REASON} ` },
        NOW,
      ),
    ).toEqual({
      effectiveFrom: new Date(FROM),
      reason: REASON,
      restateApproved: false,
    });
  });

  it('keeps the restatement choice', () => {
    expect(
      parseValuationBackdate(
        { effectiveFrom: FROM, backdateReason: REASON, restateApproved: true },
        NOW,
      )?.restateApproved,
    ).toBe(true);
  });

  it('refuses a past instant without a reason', () => {
    expect(
      codeOf(() => parseValuationBackdate({ effectiveFrom: FROM }, NOW)),
    ).toBe('BACKDATE_REASON_REQUIRED');
  });

  it('refuses a reason or a restatement without a past instant', () => {
    const future = '2027-01-01T00:00:00Z';
    expect(
      codeOf(() =>
        parseValuationBackdate(
          { effectiveFrom: future, backdateReason: REASON },
          NOW,
        ),
      ),
    ).toBe('BACKDATE_REASON_WITHOUT_EFFECTIVE_FROM');
    expect(
      codeOf(() =>
        parseValuationBackdate(
          { effectiveFrom: future, restateApproved: true },
          NOW,
        ),
      ),
    ).toBe('RESTATE_WITHOUT_BACKDATE');
  });
});

const PERIOD_ROW = {
  period_id: 'p1',
  unit_id: 'u1',
  unit_name: 'HDPE Extruder 1',
  local_date: '2026-10-17',
  shift_name: 'A',
  utc_start: new Date('2026-10-17T02:30:00Z'),
  utc_end: new Date('2026-10-17T10:30:00Z'),
  total: '3',
};

/** A manager answering the latest-approved query, then the approved-periods query. */
function managerWith(latest: Date | null, periods: object[]) {
  const query = jest
    .fn<Promise<unknown>, [string, unknown[]]>()
    .mockResolvedValueOnce([{ latest }])
    .mockResolvedValueOnce(periods);
  return { manager: { query } as unknown as EntityManager, query };
}

const backdate = (restateApproved = false) => ({
  effectiveFrom: new Date(FROM),
  reason: REASON,
  restateApproved,
});

describe('assertValuationBackdateAllowed (valuation backdate guard)', () => {
  it('passes when no period of the plant has approved figures in range', async () => {
    const { manager, query } = managerWith(new Date('1970-01-01Z'), []);
    await expect(
      assertValuationBackdateAllowed(manager, 't1', backdate(), NOW),
    ).resolves.toBeUndefined();
    expect(query.mock.calls[0][1]).toEqual(['t1', 'valuation_basis', 'tenant']);
    expect(query.mock.calls[1][1]).toEqual(['t1', new Date(FROM), NOW]);
  });

  it('refuses approved figures in range, naming the periods', async () => {
    const { manager } = managerWith(null, [PERIOD_ROW]);
    await expect(
      assertValuationBackdateAllowed(manager, 't1', backdate(), NOW),
    ).rejects.toMatchObject({
      response: {
        code: 'BACKDATE_OVERLAPS_APPROVED_VALUE',
        details: {
          total: 3,
          periods: [
            { periodId: 'p1', shiftName: 'A', localDate: '2026-10-17' },
          ],
        },
      },
    });
  });

  it('accepts approved figures in range with the restatement path, without reading periods', async () => {
    const { manager, query } = managerWith(null, [PERIOD_ROW]);
    await expect(
      assertValuationBackdateAllowed(manager, 't1', backdate(true), NOW),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('refuses to rewrite history even with the restatement path', async () => {
    const { manager } = managerWith(new Date('2026-10-17T06:00:00Z'), []);
    await expect(
      assertValuationBackdateAllowed(manager, 't1', backdate(true), NOW),
    ).rejects.toMatchObject({
      response: { code: 'BACKDATE_REWRITES_HISTORY' },
    });
  });
});
