import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { compareScope } from '../../src/migration-cutover/compare/mig04-comparison';
import {
  explanationOperation,
  flagSwitchOperation,
  freezeOperation,
  releaseOperation,
} from '../../src/migration-cutover/cutover/cutover-operations';
import { resolveScreenKeys } from '../../src/migration-cutover/cutover/screen-order';
import { MigrationCutoverModule } from '../../src/migration-cutover/migration-cutover.module';
import { RemediationRunner } from '../../src/migration-cutover/remediation/remediation-runner';
import { buildCutoverReport } from '../../src/migration-cutover/report/cutover-report';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { LegacyWorld, seedLegacyWorld } from './support/legacy-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/**
 * Plan 3.10 steps 3–4 (MIG04 / MIG05): the v1 write freeze answers 423 for the frozen tenant only, flag
 * switch-over and rollback through audited runs, the MIG04 gate needs an explanation for every
 * difference, and the read-only report detects lost source rows.
 */
describe('migration cutover (plan 3.10)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: LegacyWorld;
  let runner: RemediationRunner;
  let adminA = '';
  let adminB = '';
  const ACTOR = 'Cutover Test';

  const http = () => request(app.getHttpServer());
  const v1Delete = (token: string) =>
    http().delete(`/api/production-events/${randomUUID()}`).set(bearer(token));
  const flagsOf = async (token: string) =>
    (
      (await http().get('/api/v2/feature-flags').set(bearer(token)).expect(200))
        .body as { items: Array<{ key: string; enabled: boolean }> }
    ).items;

  beforeAll(async () => {
    await harness.start();
    world = await seedLegacyWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module, MigrationCutoverModule],
    });
    adminA = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    adminB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    runner = new RemediationRunner(harness.dataSource);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('freezes v1 writes of the frozen tenant only (423), keeps v2 writable, releases again', async () => {
    const dry = await runner.dryRun(
      freezeOperation('cutover rehearsal', ACTOR),
      { tenantId: world.tenantA },
    );
    expect(dry.counts.changes).toEqual({ 'insert legacy_write_freezes': 1 });
    expect((await v1Delete(adminA)).status).not.toBe(423);

    await runner.apply(
      freezeOperation('cutover rehearsal', ACTOR),
      { tenantId: world.tenantA },
      ACTOR,
    );
    const frozen = await v1Delete(adminA).expect(423);
    expect((frozen.body as { code: string }).code).toBe('LEGACY_WRITES_FROZEN');
    expect((await v1Delete(adminB)).status).not.toBe(423);
    await http()
      .put('/api/v2/feature-flags/v2.rca')
      .set(bearer(adminA))
      .send({ enabled: false })
      .expect(200);
    await http().get('/api/production-events').set(bearer(adminA)).expect(200);

    const again = await runner.apply(
      freezeOperation('twice', ACTOR),
      { tenantId: world.tenantA },
      ACTOR,
    );
    expect(again.counts.findings).toEqual({ alreadyFrozen: 1 });
    expect(again.counts.changes).toEqual({});

    await runner.apply(
      releaseOperation(ACTOR),
      { tenantId: world.tenantA },
      ACTOR,
    );
    expect((await v1Delete(adminA)).status).not.toBe(423);
    const history: unknown[] = await harness.dataSource.query(
      `SELECT released_by FROM legacy_write_freezes WHERE tenant_id = $1`,
      [world.tenantA],
    );
    expect(history).toEqual([{ released_by: ACTOR }]);
  });

  it('switches every screen on in cutover order and rolls back by reverting the run', async () => {
    const before = await flagsOf(adminA);
    const on = await runner.apply(
      flagSwitchOperation(resolveScreenKeys('all', true), true),
      { tenantId: world.tenantA },
      ACTOR,
    );
    expect((await flagsOf(adminA)).every((f) => f.enabled)).toBe(true);
    expect((await flagsOf(adminB)).some((f) => f.enabled)).toBe(false);
    const order: Array<{ key: string }> = await harness.dataSource.query(
      `SELECT c.after->>'key' AS key FROM migration_changes c WHERE c.report_id = $1 AND c.kind = 'insert' ORDER BY c.seq`,
      [on.reportId],
    );
    expect(order.map((o) => o.key)[0]).toBe('v2.codesAdmin');

    await runner.revert(on.reportId, ACTOR);
    const state = (flags: Awaited<ReturnType<typeof flagsOf>>) =>
      flags.map(({ key, enabled }) => ({ key, enabled }));
    expect(state(await flagsOf(adminA))).toEqual(state(before));
  });

  it('flags-off of a screen still at its default writes nothing', async () => {
    const dry = await runner.dryRun(
      flagSwitchOperation(['v2.eventHub'], false),
      { tenantId: world.tenantA },
    );
    expect(dry.counts.changes).toEqual({});
    expect(dry.counts.findings).toEqual({ requested: 1, alreadyAtTarget: 1 });
  });

  it('MIG04: a difference fails the gate until an explanation for exactly those values exists', async () => {
    const scope = { tenantId: world.tenantA, unitIds: [world.unitA1] };
    const first = await compareScope(harness.dataSource.manager, scope);
    const target = first.rows.find((r) => r.metric === 'plan_target');
    expect(target).toMatchObject({
      scopeKey: `plan:${world.planP1}`,
      legacy: 100,
      v2: null,
      status: 'unexplained',
    });
    expect(first.gate).toBe('fail');

    for (const row of first.rows.filter((r) => r.status === 'unexplained')) {
      const explain = explanationOperation({
        metric: row.metric,
        scopeKey: row.scopeKey,
        legacyValue: row.legacy === null ? null : String(row.legacy),
        v2Value: row.v2 === null ? null : String(row.v2),
        category: 'formula_change',
        note: 'v1 plan not yet bridged to a v2 plan version in the fixture',
        author: ACTOR,
      });
      await runner.apply(explain, { tenantId: world.tenantA }, ACTOR);
    }
    const explained = await compareScope(harness.dataSource.manager, scope);
    expect(explained.gate).toBe('pass');
    expect(
      explained.rows.find((r) => r.metric === 'plan_target')?.explanation
        ?.category,
    ).toBe('formula_change');

    await harness.dataSource.query(
      `UPDATE production_plans SET target_quantity = 120 WHERE id = $1`,
      [world.planP1],
    );
    const moved = await compareScope(harness.dataSource.manager, scope);
    expect(moved.rows.find((r) => r.metric === 'plan_target')?.status).toBe(
      'unexplained',
    );
    expect(moved.gate).toBe('fail');
  });

  it('builds the read-only report and detects lost source rows against a before snapshot', async () => {
    const first = await buildCutoverReport(harness.dataSource, {
      tenantId: null,
      unitIds: null,
    });
    expect(first.markdown).toContain('# Cutover report (plan 3.10)');
    expect(first.markdown).toContain('| references |');
    expect(first.sourceRowsLost).toEqual([]);
    const reports: unknown[] = await harness.dataSource.query(
      `SELECT count(*)::int AS n FROM migration_reports`,
    );

    await harness.dataSource.query(
      `DELETE FROM loss_categories WHERE id = $1`,
      [world.category],
    );
    const after = await buildCutoverReport(harness.dataSource, {
      tenantId: null,
      unitIds: null,
      before: first.snapshot,
    });
    expect(after.sourceRowsLost).toEqual(['loss_categories']);
    expect(after.markdown).toContain('loss_categories (FAIL)');
    expect(
      await harness.dataSource.query(
        `SELECT count(*)::int AS n FROM migration_reports`,
      ),
    ).toEqual(reports);
  });
});
