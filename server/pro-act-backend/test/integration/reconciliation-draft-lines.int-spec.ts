import { randomUUID } from 'crypto';
import { LineSetWriter } from '../../src/reconciliation/line-set.writer';
import { A, B, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface IssuesError {
  code: string;
  details?: {
    issues?: Array<{
      code: string;
      line?: number;
      expectedRemainingAllocation?: string;
    }>;
    currentRunId?: string;
    added?: string[];
  };
}

/**
 * Plan 2.8 step 2 on real Postgres: the atomic draft-lines command (§15.3). A save replaces the full set of
 * decisions and manual lines and recomputes the totals from the same run (no new run, the actuals result is
 * reused — T44); If-Match / 412; a stale base run is 409 RUN_CHANGED with the candidate diff; invalid lines
 * are 422 with their index (unknown candidate, foreign references, code combination, evidence outside the
 * slice, allocation budget with the remaining allocation, Unaccounted not allowed); a failure half-way
 * leaves the previous set and ETag intact (T33); every save is audited and the audit / workflow rows
 * refuse UPDATE and DELETE.
 */
describe('reconciliation draft lines (plan 2.8)', () => {
  const env = new ReconciliationWorld();
  let reason = '';

  const issues = (body: unknown) => (body as IssuesError).details?.issues ?? [];

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
  });
  afterAll(() => env.stop());

  it('saves decisions and manual lines atomically; totals are recomputed without a new run', async () => {
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    const before = await env.view();
    expect(before.candidates).toEqual([
      expect.objectContaining({
        kind: 'availability',
        quantity: '90',
        state: 'proposed',
      }),
    ]);
    expect(before.slices[0]).toMatchObject({
      target: '1000',
      actual: '850',
      gap: '150',
      attributed: '90',
      residual: '60',
    });
    const [results] = await env.rows<{ ids: string[] }>(
      `SELECT array_agg(id ORDER BY id) AS ids FROM actuals_results WHERE period_id = $1`,
      [env.periodA1],
    );
    const runs = (await env.runs(env.periodA1)).length;
    const response = await env
      .saveLines(before, [
        {
          action: 'adjust',
          autoKey: before.candidates[0].autoKey,
          quantity: '80',
          reason: 'stop was shorter',
        },
        {
          action: 'manual',
          sliceId: before.slices[0].sliceId,
          kind: 'performance',
          quantity: '70',
          missingEvent: true,
          reasonCodeId: reason,
          reason: 'slow feed',
        },
      ])
      .expect(200);
    expect(response.headers.etag).toBe(`"${before.rowVersion + 1}"`);
    const after = await env.view();
    expect(after.candidates[0]).toMatchObject({
      state: 'adjusted',
      effectiveQuantity: '80',
    });
    expect(after.slices[0]).toMatchObject({ attributed: '150', residual: '0' });
    expect(after.baseRunId).toBe(before.baseRunId);
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(await env.runs(env.periodA1)).toHaveLength(runs);
    const [again] = await env.rows<{ ids: string[] }>(
      `SELECT array_agg(id ORDER BY id) AS ids FROM actuals_results WHERE period_id = $1`,
      [env.periodA1],
    );
    expect(again.ids).toEqual(results.ids);
  });

  it('If-Match is required and must be current (428 / 412)', async () => {
    const view = await env.view();
    await env
      .put(
        `production-periods/${env.periodA1}/draft-lines`,
        { revision: 1, baseRunId: view.baseRunId, lines: [] },
        '',
      )
      .expect(428);
    const stale = await env
      .saveLines({ ...view, rowVersion: view.rowVersion - 1 }, [])
      .expect(412);
    expect((stale.body as ApiError).code).toBe('STALE_REVISION');
  });

  it('a stale base run is 409 RUN_CHANGED with the candidate diff', async () => {
    const seen = await env.view();
    await env.lossEvent(env.world.unitA1, plus(A, 4 * HOUR), 0.5);
    await env.settle();
    const current = await env.view();
    expect(current.baseRunId).not.toBe(seen.baseRunId);
    const response = await env.saveLines(seen, []).expect(409);
    const body = response.body as IssuesError;
    expect(body.code).toBe('RUN_CHANGED');
    expect(body.details?.currentRunId).toBe(current.baseRunId);
    expect(body.details?.added).toHaveLength(1);
    expect(current.lines.map((l) => l.flags)).toEqual([[], []]);
  });

  it('invalid lines are 422 with the offending line index', async () => {
    const view = await env.view();
    const sliceId = view.slices[0].sliceId;
    const manual = (extra: Record<string, unknown>) => ({
      action: 'manual',
      sliceId,
      kind: 'availability',
      quantity: '1',
      missingEvent: true,
      reasonCodeId: reason,
      ...extra,
    });
    const impact = await env.impactCode('MECH');
    const other = await env.impactCode('ELEC');
    await env.rows(
      `INSERT INTO code_mapping_rules (tenant_id, row_version, rule_kind, source_code_id, target_code_id, version, effective_from)
       VALUES ($1, 1, 'reason_to_impact', $2, $3, 1, '2026-01-01T00:00:00Z')`,
      [env.world.tenantA, reason, impact],
    );
    const outside = await env.lossEvent(env.world.unitA1, plus(B, HOUR), 1);
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ action: 'accept', autoKey: 'no-such-key' }, 'UNKNOWN_CANDIDATE'],
      [manual({ impactCodeId: other }), 'CODE_COMBINATION_INVALID'],
      [
        manual({
          missingEvent: undefined,
          reasonCodeId: undefined,
          eventIds: [outside],
        }),
        'EVIDENCE_OUTSIDE_SEGMENT',
      ],
      [manual({ sliceId: randomUUID() }), 'INVALID_REFERENCE'],
      [manual({ reasonCodeId: randomUUID() }), 'INVALID_REFERENCE'],
      [manual({ kind: 'unaccounted_classified' }), 'UNACCOUNTED_NOT_ALLOWED'],
      [manual({ missingEvent: undefined }), 'EVIDENCE_REQUIRED'],
      [manual({ quantity: '-1' }), 'NEGATIVE_QUANTITY'],
    ];
    for (const [line, code] of cases) {
      const response = await env
        .saveLines(view, [manual({ impactCodeId: impact }), line])
        .expect(422);
      expect(issues(response.body)[0]).toMatchObject({ code, line: 1 });
    }
    const precision = await env
      .saveLines(view, [manual({ quantity: '1.123456789' })])
      .expect(422);
    expect((precision.body as ApiError).code).toBe('VALIDATION_FAILED');
    expect((await env.view()).rowVersion).toBe(view.rowVersion);
  });

  it('allocation budget: a line beyond gap + tolerance is 422 with the remaining allocation', async () => {
    const view = await env.view(env.periodB1);
    expect(view.slices[0].gap).toBe('150');
    const line = (quantity: string) => ({
      action: 'manual',
      sliceId: view.slices[0].sliceId,
      kind: 'availability',
      quantity,
      missingEvent: true,
      reasonCodeId: reason,
    });
    const response = await env
      .saveLines(view, [line('100'), line('70')], env.admin, env.periodB1)
      .expect(422);
    expect(issues(response.body)[0]).toMatchObject({
      code: 'ALLOCATION_EXCEEDED',
      line: 1,
      expectedRemainingAllocation: '50',
    });
    await env
      .saveLines(
        view,
        [line('100'), line('70'), { ...line('-20'), kind: 'bridge' }],
        env.admin,
        env.periodB1,
      )
      .expect(200);
  });

  it('T33: a failure after half the lines leaves the previous set, lines and ETag intact', async () => {
    const view = await env.view(env.periodC1);
    const lines = Array.from({ length: 10 }, () => ({
      action: 'manual',
      sliceId: view.slices[0].sliceId,
      kind: 'availability',
      quantity: '15',
      missingEvent: true,
      reasonCodeId: reason,
    }));
    await env
      .saveLines(view, lines.slice(0, 2), env.admin, env.periodC1)
      .expect(200);
    const saved = await env.view(env.periodC1);
    const count = async (table: string) =>
      (
        await env.rows<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${table} WHERE period_id = $1`,
          [env.periodC1],
        )
      )[0].n;
    const [sets, rows] = [
      await count('reconciliation_line_sets'),
      await count('reconciliation_lines'),
    ];
    const writer = env.app.get(LineSetWriter);
    const original = writer.insertLines.bind(writer);
    const spy = jest
      .spyOn(writer, 'insertLines')
      .mockImplementationOnce(async (manager, all) => {
        await original(manager, all.slice(0, all.length / 2));
        throw new Error('injected failure after half the lines');
      });
    await env.saveLines(saved, lines, env.admin, env.periodC1).expect(500);
    spy.mockRestore();
    const after = await env.view(env.periodC1);
    expect(after.rowVersion).toBe(saved.rowVersion);
    expect(after.revision).toEqual(saved.revision);
    expect(after.lines).toHaveLength(2);
    expect(after.slices[0].attributed).toBe('30');
    expect(await count('reconciliation_line_sets')).toBe(sets);
    expect(await count('reconciliation_lines')).toBe(rows);
    const etag = await env
      .get(`production-periods/${env.periodC1}/reconciliation`)
      .expect(200);
    expect(etag.headers.etag).toBe(`"${saved.rowVersion}"`);
  });

  it('every save is audited; audit and workflow rows refuse UPDATE and DELETE', async () => {
    const view = await env.view();
    const audit = await env.rows<{
      id: string;
      action: string;
      actor_id: string;
    }>(
      `SELECT id, action, actor_id FROM audit_log WHERE entity_id = $1 ORDER BY at`,
      [view.revision.id],
    );
    expect(audit.map((a) => a.action)).toContain(
      'accounting_revision.save_draft',
    );
    expect(audit[0].actor_id).not.toBeNull();
    const actions = await env.rows<{ id: string }>(
      `SELECT id FROM approval_actions WHERE revision_id = $1`,
      [view.revision.id],
    );
    expect(actions.length).toBeGreaterThan(0);
    for (const sql of [
      `UPDATE audit_log SET reason = 'x' WHERE id = $1`,
      `DELETE FROM audit_log WHERE id = $1`,
    ]) {
      await expect(env.rows(sql, [audit[0].id])).rejects.toThrow(/append-only/);
    }
    await expect(
      env.rows(`DELETE FROM approval_actions WHERE id = $1`, [actions[0].id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      env.rows(
        `UPDATE reconciliation_lines SET quantity = 1 WHERE period_id = $1`,
        [env.periodA1],
      ),
    ).rejects.toThrow(/append-only/);
  });
});
