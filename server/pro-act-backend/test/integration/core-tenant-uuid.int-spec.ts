import { randomUUID } from 'crypto';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';

const MIGRATION = 'CoreTenantUuid1794070000000';

const RCA_CHILDREN = [
  'fmea_analyses',
  'five_why_analyses',
  'fault_tree_analyses',
  'fishbone_diagrams',
  'barrier_analyses',
  'change_analyses',
  'rca_fmea_analyses',
  'rca_five_why_analyses',
  'rca_fault_tree_analyses',
  'rca_fishbone_diagrams',
  'rca_barrier_analyses',
  'rca_change_analyses',
  'rca_knowledge_base',
];
const CONVERTED = [
  'production_events',
  'audit_logs',
  'production_plans',
  'assets',
  'pi_connections',
  'rcas',
  'rca_analysis_configs',
  'rca_trigger_configs',
  ...RCA_CHILDREN,
];

type Row = Record<string, unknown>;

/**
 * DB-05: core v1 tables get `tenant_id uuid` with a FK to tenants. Rows that name an unknown tenant are
 * kept (the FK stays NOT VALID), a value that is not a UUID keeps its table varchar, the
 * production_events shadow column goes, and `down` restores the varchar shape.
 */
describe('CoreTenantUuid migration (DB-05)', () => {
  const harness = new IntegrationHarness();
  let world: EventWorld;
  const unknownTenant = randomUUID();
  const orphanPlan = randomUUID();
  const orphanAudit = randomUUID();
  const legacyProduct = randomUUID();

  const q = (sql: string, params: unknown[] = []): Promise<Row[]> =>
    harness.dataSource.query(sql, params);

  const executed = async (): Promise<boolean> =>
    (await q('SELECT 1 FROM migrations WHERE name = $1', [MIGRATION])).length >
    0;

  const typeOf = async (table: string, column = 'tenant_id') => {
    const [row] = await q(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return row?.data_type ?? null;
  };

  const tenantFk = async (table: string) =>
    q(
      `SELECT convalidated FROM pg_constraint
        WHERE contype = 'f' AND conrelid = $1::regclass AND confrelid = 'tenants'::regclass`,
      [`public.${table}`],
    );

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    while (await executed()) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    await q(
      `INSERT INTO production_plans (id, plan_name, unit_id, start_date, end_date, tenant_id)
       VALUES ($1, 'orphan', $2, $3, $4, $5)`,
      [orphanPlan, world.unitA1, at('06:00'), at('18:00'), unknownTenant],
    );
    await q(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, "timestamp", tenant_id)
       VALUES ($1, $2, 'CREATE', 'unit', 'x', now(), $3)`,
      [orphanAudit, randomUUID(), unknownTenant],
    );
    await q(
      `INSERT INTO products (id, name, code, tenant_id) VALUES ($1, 'legacy', 'LEG-1', 'legacy-plant')`,
      [legacyProduct],
    );
    await harness.runMigrations();
  });

  afterAll(() => harness.stop());

  it('converts tenant_id to uuid with a FK to tenants', async () => {
    for (const table of CONVERTED) {
      expect([table, await typeOf(table)]).toEqual([table, 'uuid']);
      expect([table, (await tenantFk(table)).length]).toEqual([table, 1]);
    }
  });

  it('validates the FK where every row names a tenant and keeps orphans with the FK NOT VALID', async () => {
    expect(await tenantFk('production_events')).toEqual([
      { convalidated: true },
    ]);
    expect(await tenantFk('production_plans')).toEqual([
      { convalidated: false },
    ]);
    expect(await tenantFk('audit_logs')).toEqual([{ convalidated: false }]);
    expect(
      await q('SELECT tenant_id FROM production_plans WHERE id = $1', [
        orphanPlan,
      ]),
    ).toEqual([{ tenant_id: unknownTenant }]);
    expect(
      await q('SELECT tenant_id FROM audit_logs WHERE id = $1', [orphanAudit]),
    ).toEqual([{ tenant_id: unknownTenant }]);
  });

  it('checks new rows against the FK even while it is NOT VALID', async () => {
    await expect(
      q(
        `INSERT INTO production_plans (plan_name, unit_id, start_date, end_date, tenant_id)
         VALUES ('new orphan', $1, $2, $3, $4)`,
        [world.unitA1, at('06:00'), at('18:00'), randomUUID()],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
  });

  it('leaves a table with a non-UUID tenant value varchar and its rows untouched', async () => {
    expect(await typeOf('products')).toBe('character varying');
    expect(await tenantFk('products')).toEqual([]);
    expect(
      await q('SELECT tenant_id FROM products WHERE id = $1', [legacyProduct]),
    ).toEqual([{ tenant_id: 'legacy-plant' }]);
  });

  it('drops the tenant_uuid shadow and keeps failure_events_v and the RCA tenant triggers', async () => {
    expect(await typeOf('production_events', 'tenant_uuid')).toBeNull();
    expect(
      await q(
        `SELECT 1 FROM pg_proc WHERE proname = 'production_events_sync_tenant_uuid'`,
      ),
    ).toEqual([]);
    expect(await typeOf('failure_events_v')).toBe('uuid');
    const events = await q(
      'SELECT count(*)::int AS n FROM production_events WHERE tenant_id = $1',
      [world.tenantA],
    );
    expect(events[0].n).toBeGreaterThan(0);
    await q('SELECT * FROM failure_events_v WHERE tenant_id = $1', [
      world.tenantA,
    ]);
    const triggers = await q(
      `SELECT tgrelid::regclass::text AS "table" FROM pg_trigger
        WHERE tgname IN ('trg_rca_child_tenant', 'trg_rca_tenant_propagates') ORDER BY 1`,
    );
    expect(triggers.map((row) => row.table).sort()).toEqual(
      ['rcas', ...RCA_CHILDREN].sort(),
    );
    expect(
      await q('SELECT * FROM rca_shared_lessons($1, 10, NULL, NULL)', [
        world.tenantA,
      ]),
    ).toEqual([]);
  });

  it('down restores varchar(36) without FKs and the tenant_uuid shadow kept in sync', async () => {
    await harness.dataSource.undoLastMigration({ transaction: 'all' });
    expect(await typeOf('production_events')).toBe('character varying');
    expect(await typeOf('rca_knowledge_base')).toBe('character varying');
    expect(await tenantFk('production_events')).toEqual([]);
    expect(await typeOf('failure_events_v')).toBe('character varying');
    const mismatched = await q(
      `SELECT count(*)::int AS n FROM production_events WHERE tenant_uuid IS DISTINCT FROM tenant_id::uuid`,
    );
    expect(mismatched).toEqual([{ n: 0 }]);
    await q('UPDATE production_events SET tenant_id = $1 WHERE id = $2', [
      world.tenantB,
      world.events.e1,
    ]);
    expect(
      await q('SELECT tenant_uuid FROM production_events WHERE id = $1', [
        world.events.e1,
      ]),
    ).toEqual([{ tenant_uuid: world.tenantB }]);
    expect(
      await q('SELECT * FROM rca_shared_lessons($1, 10, NULL, NULL)', [
        world.tenantA,
      ]),
    ).toEqual([]);
    await harness.runMigrations();
    expect(await typeOf('production_events')).toBe('uuid');
  });
});
