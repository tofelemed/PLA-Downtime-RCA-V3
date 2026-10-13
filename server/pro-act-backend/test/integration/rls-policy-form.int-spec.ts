import { IntegrationHarness } from './harness';

/**
 * DB-04: every `tenant_isolation` policy reads the session's tenant list through a scalar subquery, so
 * Postgres evaluates `app_rls_tenant_ids()` once per query (InitPlan) instead of once per row. The
 * visibility rules themselves are unchanged (tenant-rls.int-spec).
 */
describe('RLS policies evaluate the tenant list once per query (DB-04)', () => {
  const harness = new IntegrationHarness();
  beforeAll(() => harness.start());
  afterAll(() => harness.stop());

  it('no policy calls app_rls_tenant_ids() outside a scalar subquery', async () => {
    const policies = await harness.dataSource.query<
      Array<{ tablename: string; qual: string; with_check: string }>
    >(
      `SELECT tablename, qual, with_check FROM pg_policies
        WHERE schemaname = 'public' AND policyname = 'tenant_isolation'`,
    );
    expect(policies.length).toBeGreaterThan(100);
    const perRow = policies.filter(({ qual, with_check }) =>
      [qual, with_check].some((expr) =>
        expr
          .replace(
            /\(\s*SELECT app_rls_tenant_ids\(\) AS app_rls_tenant_ids\s*\)/g,
            '',
          )
          .includes('app_rls_tenant_ids()'),
      ),
    );
    expect(perRow.map((p) => p.tablename)).toEqual([]);
  });
});
