import * as request from 'supertest';
import { RcaVerificationService } from '../../../src/rca-case/rca-verification.service';
import { RcaWorld } from './rca-world';

interface Versioned {
  id: string;
  row_version: number;
}

/**
 * QA H1: one request per write route of a closed investigation (case, logic tree, analysis tool, file,
 * action, verification, cause, task, delete) — each must answer 409 CASE_CLOSED. Factories, so each
 * request starts only when awaited.
 */
export function closedCaseWrites(
  env: RcaWorld,
  ids: { caseId: string; etag: string; action: Versioned; cause: Versioned },
): Array<() => request.Test> {
  const { caseId, etag, action, cause } = ids;
  const bearer = `Bearer ${env.admin}`;
  return [
    () => env.patch(`rcas/${caseId}`, { title: 'after close' }, etag),
    () => env.post(`rcas/${caseId}/logic-tree/reset`, {}).set('If-Match', etag),
    () =>
      env
        .http()
        .put(`/api/v2/rcas/${caseId}/analyses/five-why`)
        .set('Authorization', bearer)
        .send({ problem: 'p', whyLevels: [], rootCause: 'r' }),
    () =>
      env
        .http()
        .post(`/api/v2/rcas/${caseId}/attachments`)
        .set('Authorization', bearer)
        .attach('file', Buffer.from('a,b'), 'note.csv'),
    () => env.post(`rcas/${caseId}/actions`, { title: 'late action' }),
    () =>
      env.patch(
        `rca-actions/${action.id}`,
        { title: 'renamed' },
        `"${action.row_version}"`,
      ),
    () =>
      env
        .post(`rca-actions/${action.id}/verify`, {})
        .set('If-Match', `"${action.row_version}"`),
    () =>
      env.post(`rcas/${caseId}/causes`, {
        kind: 'contributing',
        statement: 'late cause',
      }),
    () =>
      env.patch(
        `rca-case-causes/${cause.id}`,
        { statement: 'changed' },
        `"${cause.row_version}"`,
      ),
    () =>
      env.post('tasks', {
        title: 'Late task',
        assigneeId: env.members[1],
        priority: 'High',
        linkType: 'RCA',
        linkId: caseId,
      }),
    () =>
      env
        .http()
        .delete(`/api/v2/rcas/${caseId}`)
        .set('Authorization', bearer)
        .set('If-Match', etag),
  ];
}

/** The hourly verification sweep leaves a due action of a closed investigation alone (state restored after). */
export async function expectSweepSkips(
  env: RcaWorld,
  actionId: string,
): Promise<void> {
  const [saved] = await env.rows<{
    end: Date | null;
    post: unknown;
    baseline: unknown;
  }>(
    `SELECT verification_window_end AS "end", post_action AS post, baseline FROM rca_actions WHERE id = $1`,
    [actionId],
  );
  await env.rows(
    `UPDATE rca_actions SET verification_window_end = now() - interval '1 day', post_action = NULL,
            baseline = COALESCE(baseline, '{"metric":"recurrences","windowDays":90,"value":"0","declared":true}'::jsonb)
      WHERE id = $1`,
    [actionId],
  );
  await env.app.get(RcaVerificationService).sweep();
  const [untouched] = await env.rows<{ post: unknown }>(
    `SELECT post_action AS post FROM rca_actions WHERE id = $1`,
    [actionId],
  );
  expect(untouched.post).toBeNull();
  const json = (value: unknown) =>
    value === null ? null : JSON.stringify(value);
  await env.rows(
    `UPDATE rca_actions SET verification_window_end = $2, post_action = $3::jsonb, baseline = $4::jsonb WHERE id = $1`,
    [actionId, saved.end, json(saved.post), json(saved.baseline)],
  );
}

interface HistoryBody {
  items: Array<{
    action: string;
    service: string | null;
    actorId: string | null;
    reason: string | null;
    changedFields: string[];
  }>;
}

/** M1: the 18:47Z repair is in the case History (System, reason, field); up is idempotent, down exact. */
export async function expectRepairHistory(
  env: RcaWorld,
  id: string,
): Promise<void> {
  const { RecordClosedRecommendationRepairHistory1794222810000: History } =
    await import(
      '../../../src/database/migrations/1794222810000-RecordClosedRecommendationRepairHistory'
    );
  const repairs = async () =>
    (
      (await env.get(`rcas/${id}/history?limit=100`).expect(200))
        .body as HistoryBody
    ).items.filter((entry) => entry.action === 'rca_case.repaired');
  const runner = env.harness.dataSource.createQueryRunner();
  await runner.connect();
  try {
    const migration = new History();
    await migration.up(runner);
    await migration.up(runner);
    const entries = await repairs();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      service: 'data_repair',
      actorId: null,
      changedFields: ['recommendations'],
    });
    // QA N4: the History shows the repair in its words — no "Data repair:" prefix, statuses as "Done"
    expect(entries[0].reason).toMatch(
      /^Recommendations completed after the investigation closed: .*Done or Cancelled/,
    );
    await migration.down(runner);
    expect(await repairs()).toHaveLength(0);
  } finally {
    await runner.release();
  }
}
