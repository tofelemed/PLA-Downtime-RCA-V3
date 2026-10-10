import { REMEDIATION_JOBS } from '../../src/migration-cutover/remediation/job-registry';
import {
  AppliedRun,
  DryRunResult,
  RemediationRunner,
} from '../../src/migration-cutover/remediation/remediation-runner';
import { IntegrationHarness } from './harness';
import { LegacyWorld, seedLegacyWorld } from './support/legacy-world';

type Rows = Array<Record<string, unknown>>;

/**
 * Plan 3.10 steps 1–2 (§18.2, D11): every remediation job dry-runs without writing, applies in one
 * audited transaction, re-runs as a no-op, never writes a default tenant, keeps every source row and
 * reverts exactly what it changed.
 */
describe('migration remediation jobs (plan 3.10)', () => {
  const harness = new IntegrationHarness();
  let world: LegacyWorld;
  let runner: RemediationRunner;
  const ACTOR = 'Integration Test';

  const q = (sql: string, params: unknown[] = []): Promise<Rows> =>
    harness.dataSource.query(sql, params);
  /** Row count of every table plus a digest of the mutable legacy rows. */
  const fingerprint = async () => {
    const counts: Record<string, number> = {};
    for (const table of await harness.tableNames()) {
      const [{ n }] = (await q(
        `SELECT count(*)::int AS n FROM "${table}"`,
      )) as Array<{ n: number }>;
      counts[table] = n;
    }
    const [events] = await q(
      `SELECT md5(string_agg(e::text, '' ORDER BY e.id)) AS d FROM production_events e`,
    );
    const [plans] = await q(
      `SELECT md5(string_agg(p::text, '' ORDER BY p.id)) AS d FROM production_plans p`,
    );
    return { counts, events: events.d, plans: plans.d };
  };
  const applyAll = async () => {
    const runs: AppliedRun[] = [];
    for (const job of REMEDIATION_JOBS) {
      runs.push(await runner.apply(job, { tenantId: null }, ACTOR));
    }
    return runs;
  };
  const reviews = (issue: string) =>
    q(`SELECT * FROM migration_review WHERE issue = $1 ORDER BY legacy_id`, [
      issue,
    ]);

  beforeAll(async () => {
    await harness.start();
  });

  beforeEach(async () => {
    await harness.truncateAll();
    world = await seedLegacyWorld(harness.dataSource);
    runner = new RemediationRunner(harness.dataSource);
  });

  afterAll(async () => {
    await harness.stop();
  });

  it('dry runs report what would change and write nothing', async () => {
    const before = await fingerprint();
    const results: DryRunResult[] = [];
    for (const job of REMEDIATION_JOBS) {
      results.push(await runner.dryRun(job, { tenantId: null }));
    }
    expect(await fingerprint()).toEqual(before);
    const byJob = Object.fromEntries(results.map((r) => [r.job, r.counts]));
    expect(byJob.references.changes).toEqual({ 'update production_events': 1 });
    expect(byJob.references.reviews.TENANT_UNRESOLVED).toBe(1);
    expect(byJob.sentinels.changes).toEqual({ 'update production_events': 1 });
    expect(byJob.durations.reviews).toEqual({
      DURATION_UNIT_UNKNOWN: 1,
      DURATION_MISMATCH: 1,
    });
    expect(byJob.duplicates.reviews).toEqual({
      DUPLICATE_MERGE_PENDING: 1,
      DUPLICATE_CONFLICT: 1,
    });
    expect(byJob.duplicates.crosswalk).toEqual({ duplicate_of: 1 });
    expect(byJob['legacy-values'].legacyValues).toEqual({
      production_losses: 4,
      reconcile_forms: 6,
      loss_categories: 1,
      oee_summaries: 2,
    });
    expect(byJob.links.crosswalk).toEqual({ explains_event: 1 });
    expect(byJob.links.reviews).toEqual({ LINK_UNRESOLVED: 1 });
    expect(byJob.periods.crosswalk).toEqual({ period_day: 1 });
    expect(byJob.periods.reviews).toEqual({ PERIOD_AMBIGUOUS: 1 });
    expect(byJob.rates.reviews).toEqual({ STANDARD_RATE_AMBIGUOUS: 1 });
    expect(byJob.units.reviews).toMatchObject({
      UOM_MISSING: 1,
      CURRENCY_UNMAPPED: 1,
      EVENT_QUANTITY_UOM_MISSING: 1,
    });
  });

  it('applies every job with an audit trail and fixes only what has evidence', async () => {
    const runs = await applyAll();
    const reports = await q(
      `SELECT job, status, actor, database_name FROM migration_reports ORDER BY job`,
    );
    expect(reports).toHaveLength(REMEDIATION_JOBS.length);
    expect(
      reports.every((r) => r.status === 'applied' && r.actor === ACTOR),
    ).toBe(true);
    expect(reports[0].database_name).toBe(harness.database);

    const [tenantless] = await q(
      `SELECT tenant_id, tenant_uuid FROM production_events WHERE id = $1`,
      [world.events.tenantless],
    );
    expect(tenantless).toEqual({
      tenant_id: world.tenantA,
      tenant_uuid: world.tenantA,
    });
    const [sentinel] = await q(
      `SELECT end_time, legacy_end_sentinel IS NOT NULL AS raw_kept, physical_state::text AS state FROM production_events WHERE id = $1`,
      [world.events.sentinel],
    );
    expect(sentinel).toEqual({ end_time: null, raw_kept: true, state: 'open' });
    const changes = await q(
      `SELECT table_name, before, after FROM migration_changes ORDER BY seq`,
    );
    expect(changes).toHaveLength(2);
    expect(
      changes.find(
        (c) =>
          c.table_name === 'production_events' &&
          (c.after as Record<string, unknown>).tenant_id === world.tenantA,
      ),
    ).toMatchObject({ before: { tenant_id: 'legacy-plant-7' } });

    const values = await q(
      `SELECT DISTINCT method FROM legacy_reported_values`,
    );
    expect(values).toEqual([{ method: 'UnknownLegacy' }]);
    const [link] = await q(
      `SELECT new_id FROM legacy_id_crosswalk WHERE relation = 'explains_event'`,
    );
    expect(link.new_id).toBe(world.events.e1);
    const [period] = await q(
      `SELECT new_id FROM legacy_id_crosswalk WHERE relation = 'period_day'`,
    );
    expect(period.new_id).toBe(world.periodDay);
    expect(runs.find((r) => r.job === 'duplicates')?.counts.crosswalk).toEqual({
      duplicate_of: 1,
    });
  });

  it('never writes a default tenant: rows without ownership evidence stay as they were', async () => {
    await applyAll();
    const [orphan] = await q(
      `SELECT tenant_id FROM production_plans WHERE id = $1`,
      [world.planOrphan],
    );
    expect(orphan.tenant_id).toBeNull();
    const [item] = await reviews('TENANT_UNRESOLVED');
    expect(item).toMatchObject({
      legacy_table: 'production_plans',
      legacy_id: world.planOrphan,
      tenant_id: null,
      status: 'open',
    });
    const tenants = await q(
      `SELECT DISTINCT tenant_id FROM legacy_reported_values`,
    );
    expect(tenants).toEqual([{ tenant_id: world.tenantA }]);
  });

  it('is idempotent: a second apply and a later dry run find nothing new', async () => {
    await applyAll();
    const after = await fingerprint();
    const second = await applyAll();
    for (const run of second) {
      expect(run.counts.changes).toEqual({});
      expect(run.counts.reviews).toEqual({});
      expect(run.counts.crosswalk).toEqual({});
      expect(run.counts.legacyValues).toEqual({});
    }
    const again = await fingerprint();
    expect(again.events).toBe(after.events);
    expect(again.counts.migration_review).toBe(after.counts.migration_review);
    expect(again.counts.legacy_reported_values).toBe(
      after.counts.legacy_reported_values,
    );
    expect(again.counts.migration_reports).toBe(
      after.counts.migration_reports + REMEDIATION_JOBS.length,
    );
  });

  it('reverts one applied run exactly, and refuses a second revert', async () => {
    const before = await fingerprint();
    const runs = await applyAll();
    for (const run of [...runs].reverse())
      await runner.revert(run.reportId, ACTOR);
    const reverted = await fingerprint();
    for (const table of [
      'production_events',
      'production_plans',
      'production_losses',
      'reconcile_forms',
      'loss_categories',
      'oee_summaries',
      'products',
    ]) {
      expect(reverted.counts[table]).toBe(before.counts[table]);
    }
    expect(reverted.plans).toBe(before.plans);
    const [tenantless] = await q(
      `SELECT tenant_id, end_time FROM production_events WHERE id = $1`,
      [world.events.tenantless],
    );
    expect(tenantless.tenant_id).toBe('legacy-plant-7');
    const [sentinel] = await q(
      `SELECT end_time::text AS e, legacy_end_sentinel FROM production_events WHERE id = $1`,
      [world.events.sentinel],
    );
    expect(sentinel.legacy_end_sentinel).toBeNull();
    expect(String(sentinel.e)).toMatch(/^9999-12-31/);
    expect(reverted.counts.migration_review).toBe(0);
    expect(reverted.counts.legacy_id_crosswalk).toBe(0);
    expect(reverted.counts.legacy_reported_values).toBe(0);
    await expect(runner.revert(runs[0].reportId, ACTOR)).rejects.toMatchObject({
      response: { code: 'MIGRATION_NOT_REVERTIBLE' },
    });
  });

  it('refuses a revert when a changed row moved since, or a review item was decided', async () => {
    const references = REMEDIATION_JOBS.find((j) => j.name === 'references');
    const run = await runner.apply(references!, { tenantId: null }, ACTOR);
    await q(`UPDATE production_events SET tenant_id = $1 WHERE id = $2`, [
      world.tenantB,
      world.events.tenantless,
    ]);
    await expect(runner.revert(run.reportId, ACTOR)).rejects.toMatchObject({
      response: { code: 'MIGRATION_ROW_CHANGED' },
    });
    const [still] = await q(
      `SELECT tenant_id FROM production_events WHERE id = $1`,
      [world.events.tenantless],
    );
    expect(still.tenant_id).toBe(world.tenantB);

    const rates = REMEDIATION_JOBS.find((j) => j.name === 'rates');
    const ratesRun = await runner.apply(rates!, { tenantId: null }, ACTOR);
    await q(
      `UPDATE migration_review SET status = 'resolved', resolved_by = 'owner' WHERE job = 'rates'`,
    );
    await expect(runner.revert(ratesRun.reportId, ACTOR)).rejects.toMatchObject(
      {
        response: { code: 'MIGRATION_REVIEW_DECIDED' },
      },
    );
  });

  it('scopes a run to one tenant', async () => {
    const result = await runner.dryRun(
      REMEDIATION_JOBS.find((j) => j.name === 'duplicates')!,
      { tenantId: world.tenantB },
    );
    expect(result.counts.reviews).toEqual({});
    expect(result.plan.crosswalk).toEqual([]);
  });

  it('refuses an apply without an operator name', async () => {
    await expect(
      runner.apply(REMEDIATION_JOBS[0], { tenantId: null }, ' '),
    ).rejects.toMatchObject({
      response: { code: 'ACTOR_REQUIRED' },
    });
    expect(await q(`SELECT 1 FROM migration_reports`)).toEqual([]);
  });
});
