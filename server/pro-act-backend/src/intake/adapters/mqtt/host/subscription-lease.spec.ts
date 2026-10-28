import { EntityManager } from 'typeorm';
import { countExceptions } from './subscription-lease';

/** A manager whose query answers with the open-exception counts per error code of a connection. */
function managerReturning(rows: Array<{ code: string; count: number }>) {
  const query = jest.fn().mockResolvedValue(rows);
  return { manager: { query } as unknown as EntityManager, query };
}

describe('countExceptions (subscription health, F6)', () => {
  it('counts an open unknown_unit row as quarantined_open and an open unknown_code row as parked', async () => {
    const { manager, query } = managerReturning([
      { code: 'unknown_unit', count: 1 },
      { code: 'unknown_code', count: 1 },
    ]);
    await expect(countExceptions(manager, 'c1')).resolves.toEqual({
      parked: 1,
      quarantinedOpen: 1,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(`"state" = 'open'`),
      ['c1'],
    );
  });

  it('parks every unknown template / signal / code and quarantines every other open code', async () => {
    const { manager } = managerReturning([
      { code: 'unknown_template', count: 2 },
      { code: 'unknown_signal', count: 3 },
      { code: 'unknown_code', count: 4 },
      { code: 'schema_invalid', count: 5 },
      { code: 'order_conflict', count: 6 },
    ]);
    await expect(countExceptions(manager, 'c1')).resolves.toEqual({
      parked: 9,
      quarantinedOpen: 11,
    });
  });

  it('reports zero for a connection without open exceptions', async () => {
    const { manager } = managerReturning([]);
    await expect(countExceptions(manager, 'c1')).resolves.toEqual({
      parked: 0,
      quarantinedOpen: 0,
    });
  });
});
