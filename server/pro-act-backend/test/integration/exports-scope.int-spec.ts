import { A, B } from './support/actuals-world';
import { DAY1, ApiError } from './support/plan-world';
import { NEXT_DAY } from './support/actuals-world';
import { ExportWorld } from './support/export-world';

/**
 * Plan 2.9 exports under tenancy and the unit scope (WF05): a unit-limited user exports only its units
 * (tenant-wide → 403 TENANT_SCOPE_REQUIRED, another unit or another tenant's unit or revision → 422
 * INVALID_REFERENCE); it never sees, cancels or downloads a tenant-wide export or one that also covers
 * another unit (404), and loses access at download time when its grant no longer covers the content;
 * tenant B sees nothing of tenant A; unknown ids are 404 and `tenantId` in the query is refused.
 */
describe('exports and the unit scope (plan 2.9)', () => {
  const env = new ExportWorld();
  let unitUser = '';
  let periodA3 = '';
  let revisionA3 = '';

  beforeAll(async () => {
    await env.start();
    const reason = await env.reasonCode('FEED');
    await env.materialize([env.world.unitA3], DAY1, B);
    periodA3 = await env.periodId(env.world.unitA3, A);
    await env.outputEvent(env.world.unitA3, A, B, '500');
    await env.settle();
    await env.approvePeriod(env.periodA1, reason);
    revisionA3 = (await env.approvePeriod(periodA3, reason)).revision.id;
    unitUser = await env.unitUser(env.world.unitA1, 'viewer');
  });
  afterAll(() => env.stop());

  const body = (extra: Record<string, unknown> = {}) => ({
    reportType: 'period_summary',
    format: 'csv',
    revisionSelector: 'published',
    from: DAY1,
    to: NEXT_DAY,
    ...extra,
  });

  it('a unit-limited user exports its own unit and downloads it', async () => {
    const jobId = await env.exportDay({}, unitUser);
    await env.runExports();
    expect((await env.exportJob(jobId, unitUser)).unitIds).toEqual([
      env.world.unitA1,
    ]);
    const file = await env.download(jobId, unitUser);
    expect(file.status).toBe(200);
    const units = ExportWorld.records(file.text).map((r) => r.unit_id);
    expect(new Set(units)).toEqual(new Set([env.world.unitA1]));
    const listed = await env.get('exports', unitUser).expect(200);
    const ids = (listed.body as { items: Array<{ id: string }> }).items.map(
      (i) => i.id,
    );
    expect(ids).toEqual([jobId]);
  });

  it('tenant-wide needs a tenant-wide grant (403); other units and foreign ids are 422', async () => {
    const wide = await env.requestExport(body(), unitUser).expect(403);
    expect((wide.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
    const cases = [
      body({ unitIds: [env.world.unitA3] }),
      body({ unitIds: [env.world.unitB1] }),
      body({ unitIds: [env.world.unitA1, env.world.unitA3] }),
      {
        ...body({
          revisionSelector: 'revision_ids',
          revisionIds: [revisionA3],
        }),
        from: undefined,
        to: undefined,
      },
    ];
    for (const request of cases) {
      const response = await env
        .requestExport(
          JSON.parse(JSON.stringify(request)) as Record<string, unknown>,
          unitUser,
        )
        .expect(422);
      expect((response.body as ApiError).code).toBe('INVALID_REFERENCE');
    }
    const foreign = await env
      .requestExport(
        {
          reportType: 'period_summary',
          format: 'csv',
          revisionSelector: 'revision_ids',
          revisionIds: [revisionA3],
        },
        env.adminB,
      )
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
    const foreignUnit = await env
      .requestExport(body({ unitIds: [env.world.unitA1] }), env.adminB)
      .expect(422);
    expect((foreignUnit.body as ApiError).code).toBe('INVALID_REFERENCE');
  });

  it('tenant-wide or mixed-unit exports are invisible to a unit-limited user (404)', async () => {
    const wide = await env.exportDay({ unitIds: undefined });
    const mixed = await env.exportDay({
      unitIds: [env.world.unitA1, env.world.unitA3],
    });
    await env.runExports();
    expect((await env.exportJob(wide)).unitIds).toBeNull();
    for (const id of [wide, mixed]) {
      await env.get(`exports/${id}`, unitUser).expect(404);
      await env.get(`exports/${id}/sources`, unitUser).expect(404);
      await env.post(`exports/${id}/cancel`, {}, unitUser).expect(404);
      expect((await env.download(id, unitUser)).status).toBe(404);
      expect((await env.download(id)).status).toBe(200);
    }
    const listed = await env.get('exports', unitUser).expect(200);
    const ids = (listed.body as { items: Array<{ id: string }> }).items.map(
      (i) => i.id,
    );
    expect(ids).not.toContain(wide);
    expect(ids).not.toContain(mixed);
  });

  it('download re-authorizes: a grant moved to another unit loses the file', async () => {
    const userId = (
      await env.rows<{ user_id: string }>(
        `SELECT user_id FROM user_scopes WHERE scope_id = $1 AND role = 'viewer' LIMIT 1`,
        [env.world.unitA1],
      )
    )[0].user_id;
    const jobId = await env.exportDay({}, unitUser);
    await env.runExports();
    expect((await env.download(jobId, unitUser)).status).toBe(200);
    await env.rows(`UPDATE user_scopes SET scope_id = $2 WHERE user_id = $1`, [
      userId,
      env.world.unitA3,
    ]);
    try {
      expect((await env.download(jobId, unitUser)).status).toBe(404);
    } finally {
      await env.rows(
        `UPDATE user_scopes SET scope_id = $2 WHERE user_id = $1`,
        [userId, env.world.unitA1],
      );
    }
  });

  it('tenant B sees nothing; unknown ids are 404; tenantId in the query is 400', async () => {
    const jobId = await env.exportDay();
    await env.runExports();
    await env.get(`exports/${jobId}`, env.adminB).expect(404);
    await env.get(`exports/${jobId}/sources`, env.adminB).expect(404);
    await env.post(`exports/${jobId}/cancel`, {}, env.adminB).expect(404);
    expect((await env.download(jobId, env.adminB)).status).toBe(404);
    const listed = await env.get('exports', env.adminB).expect(200);
    expect((listed.body as { items: unknown[] }).items).toEqual([]);
    await env.get('exports/00000000-0000-4000-8000-000000000000').expect(404);
    await env.get(`exports/${jobId}?tenantId=x`).expect(400);
    await env
      .get(
        'deliveries/reconciliation?from=2020-01-01T00:00:00Z&to=2100-01-01T00:00:00Z',
        env.adminB,
      )
      .expect(200)
      .expect((res) =>
        expect((res.body as { items: unknown[] }).items).toEqual([]),
      );
  });

  it('delivery reconciliation is unit-scoped', async () => {
    const window = 'from=2020-01-01T00:00:00Z&to=2100-01-01T00:00:00Z';
    const all = await env
      .get(`deliveries/reconciliation?${window}`)
      .expect(200);
    const own = await env
      .get(`deliveries/reconciliation?${window}`, unitUser)
      .expect(200);
    const units = (res: { body: unknown }) =>
      new Set(
        (res.body as { items: Array<{ unitId: string }> }).items.map(
          (i) => i.unitId,
        ),
      );
    expect(units(all)).toEqual(new Set([env.world.unitA1, env.world.unitA3]));
    expect(units(own)).toEqual(new Set([env.world.unitA1]));
  });
});
