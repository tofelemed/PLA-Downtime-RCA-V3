import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import {
  DEMO_TRANSITION_POLICY_NOTE,
  ensureDemoTransitionPolicy,
} from '../../scripts/demo-personas/demo-oee-policy';
import { PlantRow, WorldSummary } from '../../scripts/demo-personas/demo-world';
import { dataSourceOptions } from '../../src/database/data-source';
import { AccountingPoliciesService } from '../../src/periods/accounting-policies.service';
import { IntegrationHarness } from './harness';

/**
 * Demo seeder (LA-08): the Demo Plant stays on `transitionAllowanceInPlan = loss` because the showcase
 * plans do not deduct grade transitions — version 1 for a plant without a policy, a `loss` copy over the
 * same window for every scope whose latest version says `planned`, nothing on a re-run. Demo data only.
 */
describe('demo oee_policy: Demo Plant keeps the transition allowance as a plan loss', () => {
  const harness = new IntegrationHarness();
  const policies = new AccountingPoliciesService();
  const org = randomUUID();
  let client: Client;

  const q = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => harness.dataSource.query<T[]>(sql, params);

  async function plant(): Promise<PlantRow> {
    const id = randomUUID();
    const code = `demo-${id.slice(0, 8)}`;
    await q(
      `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES ($1, $2, $2, $3, true)`,
      [id, code, org],
    );
    return { id, code, name: code, organizationId: org };
  }

  const optionAt = async (tenantId: string, unitId: string, at: string) =>
    (
      await policies.resolveEngine(
        harness.dataSource.manager,
        { tenantId, unitId },
        new Date(at),
      )
    ).oee.transitionAllowanceInPlan;

  const ensure = async (row: PlantRow) => {
    const summary: WorldSummary = { created: [], kept: [] };
    await ensureDemoTransitionPolicy(client, row, summary);
    return summary;
  };

  beforeAll(async () => {
    await harness.start();
    await q(
      `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Org', true)`,
      [org, `ORG-${org.slice(0, 8)}`],
    );
    const options = dataSourceOptions as PostgresConnectionOptions;
    client = new Client({
      host: options.host,
      port: options.port,
      user: options.username,
      password: typeof options.password === 'string' ? options.password : '',
      database: harness.database,
    });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
    await harness.stop();
  });

  it('a plant without a policy gets version 1 of the default with loss, from 1970; a re-run keeps it', async () => {
    const row = await plant();
    expect((await ensure(row)).created).toHaveLength(1);
    const [v1] = await q<{ version: number; notes: string; from: string }>(
      `SELECT version, notes, effective_from::text AS "from" FROM accounting_policies
        WHERE tenant_id = $1 AND policy_kind = 'oee_policy'`,
      [row.id],
    );
    expect(v1).toMatchObject({
      version: 1,
      notes: DEMO_TRANSITION_POLICY_NOTE,
    });
    expect(await optionAt(row.id, randomUUID(), '2027-03-01T00:00:00Z')).toBe(
      'loss',
    );
    const again = await ensure(row);
    expect(again.created).toEqual([]);
    expect(again.kept).toHaveLength(1);
  });

  it('every scope whose latest version is planned gets a loss copy over the same window, nothing else changes', async () => {
    const row = await plant();
    const unitId = randomUUID();
    // first use seeds the product default (planned) from 1970; a unit override says planned from 2027-01-01
    expect(await optionAt(row.id, unitId, '2026-06-01T00:00:00Z')).toBe(
      'planned',
    );
    await q(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       SELECT tenant_id, 1, 'oee_policy', $2::uuid, $2, 1, body || '{"microStopSeconds": 120}'::jsonb,
              '2027-01-01T00:00:00Z', now()
         FROM accounting_policies WHERE tenant_id = $1 AND policy_kind = 'oee_policy'`,
      [row.id, unitId],
    );
    expect((await ensure(row)).created).toHaveLength(2);
    expect(await optionAt(row.id, unitId, '2026-06-01T00:00:00Z')).toBe('loss');
    expect(await optionAt(row.id, unitId, '2027-03-01T00:00:00Z')).toBe('loss');
    const unit = await policies.resolveEngine(
      harness.dataSource.manager,
      { tenantId: row.id, unitId },
      new Date('2027-03-01T00:00:00Z'),
    );
    expect(unit.oee.microStopSeconds).toBe(120);
    expect(unit.refs.find((r) => r.kind === 'oee_policy')?.version).toBe(2);
    // before the unit override the unit still reads the tenant scope
    const before = await policies.resolveEngine(
      harness.dataSource.manager,
      { tenantId: row.id, unitId },
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(before.oee.microStopSeconds).toBe(60);
  });
});
