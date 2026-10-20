import { EntityManager } from 'typeorm';
import { plantTimezone } from './plant-timezone';

const KNOWN = new Set(['Asia/Tehran', 'Europe/Berlin']);

function managerWith(site: string | null, tenant: string | null) {
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>(
    (sql, params) =>
      Promise.resolve(
        sql.includes('pg_timezone_names')
          ? [{ known: KNOWN.has(params?.[0] as string) }]
          : [{ site, tenant }],
      ),
  );
  return { manager: { query } as unknown as EntityManager, query };
}
const zoneLookups = (query: jest.Mock) =>
  query.mock.calls.filter(([sql]) =>
    (sql as string).includes('pg_timezone_names'),
  ).length;

describe('plantTimezone (perf audit P05)', () => {
  it("uses the default site's zone, then the plant's, then UTC; only zones Postgres knows", async () => {
    expect(
      await plantTimezone(managerWith('Asia/Tehran', null).manager, 't'),
    ).toBe('Asia/Tehran');
    expect(
      await plantTimezone(
        managerWith('Mars/Olympus', 'Europe/Berlin').manager,
        't',
      ),
    ).toBe('Europe/Berlin');
    expect(
      await plantTimezone(managerWith(null, 'Not/AZone').manager, 't'),
    ).toBe('UTC');
    expect(await plantTimezone(managerWith(null, null).manager, 't')).toBe(
      'UTC',
    );
  });

  it('asks Postgres about each zone name once per process', async () => {
    const first = managerWith('Antarctica/Troll', null);
    const second = managerWith('Antarctica/Troll', null);
    await plantTimezone(first.manager, 't');
    await plantTimezone(second.manager, 't');
    await plantTimezone(second.manager, 't');
    expect(zoneLookups(first.query) + zoneLookups(second.query)).toBe(1);
  });

  it('retries a zone whose lookup failed', async () => {
    const failing = managerWith('Pacific/Auckland', null);
    failing.query.mockImplementation((sql: string) =>
      sql.includes('pg_timezone_names')
        ? Promise.reject(new Error('connection lost'))
        : Promise.resolve([{ site: 'Pacific/Auckland', tenant: null }]),
    );
    await expect(plantTimezone(failing.manager, 't')).rejects.toThrow(
      'connection lost',
    );
    const healthy = managerWith('Pacific/Auckland', null);
    await plantTimezone(healthy.manager, 't');
    expect(zoneLookups(healthy.query)).toBe(1);
  });
});
