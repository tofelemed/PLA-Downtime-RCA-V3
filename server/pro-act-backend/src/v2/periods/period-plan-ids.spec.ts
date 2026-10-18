import { EntityManager } from 'typeorm';
import { planIdOf, planIdsOfVersions } from './period-plan-ids';

const TENANT = '11111111-1111-1111-1111-111111111111';

describe('planIdsOfVersions (UX G-2)', () => {
  it('resolves the distinct plan versions of a page in one tenant-guarded query', async () => {
    const query = jest
      .fn<Promise<unknown>, [string, unknown[]]>()
      .mockResolvedValue([{ id: 'v1', planId: 'p1' }]);
    const manager = { query } as unknown as EntityManager;
    const periods = [
      { selectedPlanVersionId: 'v1' },
      { selectedPlanVersionId: 'v1' },
      { selectedPlanVersionId: null },
    ];
    const plans = await planIdsOfVersions(manager, TENANT, periods);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([TENANT, ['v1']]);
    expect(planIdOf(periods[0], plans)).toBe('p1');
    expect(planIdOf(periods[2], plans)).toBeNull();
    expect(planIdOf({ selectedPlanVersionId: 'v9' }, plans)).toBeNull();
  });

  it('makes no query when no period has a plan version', async () => {
    const query = jest.fn();
    const manager = { query } as unknown as EntityManager;
    const plans = await planIdsOfVersions(manager, TENANT, [
      { selectedPlanVersionId: null },
    ]);
    expect(plans.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
