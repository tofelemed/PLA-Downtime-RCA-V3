import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { effectiveFromOf } from './policy-backdate.guard';

const NOW = new Date('2026-10-18T12:00:00Z');
const BACKDATE = {
  effectiveFrom: new Date('2026-10-01T00:00:00Z'),
  reason: 'commissioning',
};
const SCOPE = {
  tenantId: 't1',
  kind: 'oee_policy' as const,
  scopeKey: 'u1',
  unitId: 'u1',
};

/** A manager answering the latest-approved query, then the calculated-periods query. */
function managerWith(latest: Date | null, periods: object[]) {
  const query = jest
    .fn<Promise<unknown>, [string, unknown[]]>()
    .mockResolvedValueOnce([{ latest }])
    .mockResolvedValueOnce(periods);
  return { manager: { query } as unknown as EntityManager, query };
}

describe('effectiveFromOf (commissioning backdate guard)', () => {
  it('is now without a backdate and asks the database nothing', async () => {
    const { manager, query } = managerWith(null, []);
    await expect(effectiveFromOf(manager, SCOPE, null, NOW)).resolves.toBe(NOW);
    expect(query).not.toHaveBeenCalled();
  });

  it('is the backdate when no calculated period of the unit overlaps it', async () => {
    const { manager, query } = managerWith(new Date('2026-09-01Z'), []);
    await expect(
      effectiveFromOf(manager, SCOPE, BACKDATE, NOW),
    ).resolves.toEqual(BACKDATE.effectiveFrom);
    const params = query.mock.calls[1][1];
    expect(params).toEqual(['t1', 'u1', BACKDATE.effectiveFrom, NOW]);
  });

  it('checks every unit of the plant for a plant-wide version', async () => {
    const { manager, query } = managerWith(null, []);
    await effectiveFromOf(
      manager,
      { ...SCOPE, scopeKey: 'tenant', unitId: null },
      BACKDATE,
      NOW,
    );
    expect(query.mock.calls[1][1][1]).toBeNull();
  });

  it('refuses an overlap with a calculated period', async () => {
    const { manager } = managerWith(null, [
      {
        period_id: 'p1',
        unit_id: 'u1',
        unit_name: 'Extruder 1',
        local_date: '2026-10-02',
        shift_name: null,
        utc_start: new Date('2026-10-02T00:00:00Z'),
        utc_end: new Date('2026-10-03T00:00:00Z'),
        total: '1',
      },
    ]);
    const refusal = effectiveFromOf(manager, SCOPE, BACKDATE, NOW);
    await expect(refusal).rejects.toBeInstanceOf(ConflictException);
    await expect(refusal).rejects.toMatchObject({
      response: { code: 'BACKDATE_OVERLAPS_CALCULATION' },
    });
  });

  it('refuses before the latest approved version without reading periods', async () => {
    const { manager, query } = managerWith(new Date('2026-10-10Z'), []);
    await expect(
      effectiveFromOf(manager, SCOPE, BACKDATE, NOW),
    ).rejects.toMatchObject({
      response: { code: 'BACKDATE_REWRITES_HISTORY' },
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
