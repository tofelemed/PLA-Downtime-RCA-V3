import { randomUUID } from 'crypto';
import { IntegrationHarness } from './harness';

const CALENDARS = 'Calendars1792188800000';

/**
 * Plan 2.1 step 1: the `Calendars` migration gives every existing tenant one default site from
 * `tenants.timezone` (trimmed; `UTC` + `timezone_fallback` when it is not a time-zone name), operational
 * day start 06:00 (D03), and points every unit at its tenant's default site.
 */
describe('Calendars migration: default sites and units.site_id backfill', () => {
  const harness = new IntegrationHarness();
  const org = randomUUID();
  const tenants = {
    tehran: randomUUID(),
    berlin: randomUUID(),
    invalid: randomUUID(),
    none: randomUUID(),
  };
  const unitOf: Record<keyof typeof tenants, string> = {
    tehran: randomUUID(),
    berlin: randomUUID(),
    invalid: randomUUID(),
    none: randomUUID(),
  };

  beforeAll(async () => {
    await harness.start();
    while (await executed(CALENDARS)) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    await harness.dataSource.query(
      `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Org', true)`,
      [org, `ORG-${org.slice(0, 8)}`],
    );
    const zones: Record<keyof typeof tenants, string | null> = {
      tehran: 'Asia/Tehran',
      berlin: ' Europe/Berlin ',
      invalid: 'Iran Standard Time',
      none: null,
    };
    for (const key of Object.keys(tenants) as Array<keyof typeof tenants>) {
      await harness.dataSource.query(
        `INSERT INTO tenants (id, code, name, organization_id, is_active, timezone) VALUES ($1, $2, $3, $4, true, $5)`,
        [
          tenants[key],
          `T-${key}-${org.slice(0, 6)}`,
          `Plant ${key}`,
          org,
          zones[key],
        ],
      );
      await harness.dataSource.query(
        `INSERT INTO units (id, code, name, tenant_id, organization_id) VALUES ($1, $2, $2, $3, $4)`,
        [unitOf[key], `unit-${key}`, tenants[key], org],
      );
    }
    await harness.runMigrations();
  });

  afterAll(() => harness.stop());

  async function executed(name: string): Promise<boolean> {
    const rows = await harness.dataSource.query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM migrations WHERE name = $1`,
      [name],
    );
    return rows[0].n > 0;
  }

  it('creates one default site per tenant with the tenant zone or a flagged UTC fallback', async () => {
    const sites = await harness.dataSource.query<
      Array<{
        tenant_id: string;
        name: string;
        timezone: string;
        timezone_fallback: boolean;
        day_start: string;
      }>
    >(
      `SELECT tenant_id, name, timezone, timezone_fallback, operational_day_start::text AS day_start
         FROM sites WHERE is_default AND tenant_id = ANY($1)`,
      [Object.values(tenants)],
    );
    const byTenant = new Map(sites.map((s) => [s.tenant_id, s]));
    expect(sites).toHaveLength(4);
    expect(byTenant.get(tenants.tehran)).toMatchObject({
      timezone: 'Asia/Tehran',
      timezone_fallback: false,
      day_start: '06:00:00',
      name: 'Plant tehran',
    });
    expect(byTenant.get(tenants.berlin)).toMatchObject({
      timezone: 'Europe/Berlin',
      timezone_fallback: false,
    });
    expect(byTenant.get(tenants.invalid)).toMatchObject({
      timezone: 'UTC',
      timezone_fallback: true,
    });
    expect(byTenant.get(tenants.none)).toMatchObject({
      timezone: 'UTC',
      timezone_fallback: true,
    });
  });

  it('points every unit at its tenant default site', async () => {
    const rows = await harness.dataSource.query<
      Array<{ unit: string; site_tenant: string; tenant: string }>
    >(
      `SELECT u.id AS unit, s.tenant_id AS site_tenant, u.tenant_id AS tenant
         FROM units u JOIN sites s ON s.id = u.site_id WHERE u.id = ANY($1)`,
      [Object.values(unitOf)],
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.site_tenant === r.tenant)).toBe(true);
  });
});
