import { randomUUID } from 'crypto';
import { ApiError } from './support/plan-world';
import { CaseBody, RcaWorld } from './support/rca-world';

interface ActionBody {
  id: string;
  status: string;
  rowVersion: number;
  recommendationId: string | null;
  taskCompletedAt: string | null;
  linkedTask: { id: string; status: string } | null;
}

interface CaseView extends CaseBody {
  recommendations: Array<{
    id: string;
    title: string;
    actions: Array<{ id: string; status: string }>;
  }>;
}

/**
 * Recommendation → action → task (item 5) on real Postgres: an action names a recommendation of its
 * case (422 otherwise), the case view lists the implementing actions, one open task per action (409),
 * and a completed task is recorded on the action without completing it.
 */
describe('RCA recommendation → action → task linkage', () => {
  const env = new RcaWorld();
  let caseId = '';
  let action: ActionBody;
  let taskId = '';

  beforeAll(async () => {
    await env.start();
    caseId = (await env.createCase(env.example())).id;
  });
  afterAll(() => env.stop());

  const readCase = async () =>
    (await env.get(`rcas/${caseId}`).expect(200)).body as CaseView;
  const actions = async () =>
    (await env.get(`rcas/${caseId}/actions`).expect(200)).body as ActionBody[];
  const task = (overrides: object = {}) =>
    env.post('tasks', {
      title: 'Replace the coupling',
      assigneeId: env.members[1],
      priority: 'High',
      linkType: 'RCA',
      linkId: caseId,
      rcaActionId: action.id,
      ...overrides,
    });

  it('an action implements a recommendation of its own case only', async () => {
    const unknown = await env
      .post(`rcas/${caseId}/actions`, {
        title: 'x',
        recommendationId: 'rec-404',
      })
      .expect(422);
    expect((unknown.body as ApiError).code).toBe('INVALID_REFERENCE');
    action = (
      await env
        .post(`rcas/${caseId}/actions`, {
          title: 'Replace the coupling',
          recommendationId: 'rec-1',
        })
        .expect(201)
    ).body as ActionBody;
    expect(action.recommendationId).toBe('rec-1');
    const view = await readCase();
    expect(view.recommendations[0].actions).toEqual([
      { id: action.id, title: 'Replace the coupling', status: 'open' },
    ]);
  });

  it('recommendations sent without an id get a stable server id; read-only actions are not stored', async () => {
    const before = await readCase();
    await env
      .patch(
        `rcas/${caseId}`,
        { recommendations: [...before.recommendations, { title: 'Train' }] },
        `"${before.rowVersion}"`,
      )
      .expect(200);
    const after = await readCase();
    expect(after.recommendations.map((r) => r.id)[0]).toBe('rec-1');
    expect(after.recommendations[1].id).toMatch(/^[0-9a-f-]{36}$/);
    const [row] = await env.rows<{ recommendations: string }>(
      `SELECT recommendations FROM rcas WHERE id = $1`,
      [caseId],
    );
    expect(row.recommendations).not.toContain('"actions"');
  });

  it('one open task per action (409); the task must name the action case', async () => {
    const wrongCase = await task({ linkId: randomUUID() }).expect(422);
    expect((wrongCase.body as ApiError).code).toBe('INVALID_REFERENCE');
    const created = await task().expect(201);
    taskId = (created.body as { id: string; rcaActionId: string }).id;
    expect((created.body as { rcaActionId: string }).rcaActionId).toBe(
      action.id,
    );
    const duplicate = await task({ title: 'Other title' }).expect(409);
    expect((duplicate.body as ApiError).code).toBe('ACTION_TASK_EXISTS');
    const [listed] = await actions();
    expect(listed.linkedTask).toMatchObject({ id: taskId, status: 'Open' });
  });

  it('a completed task is recorded on the action, which stays open until its evidence is in', async () => {
    await env.post(`tasks/${taskId}/complete`, {}).expect(200);
    const [done] = await actions();
    expect(done.status).toBe('open');
    expect(done.taskCompletedAt).not.toBeNull();
    expect(done.linkedTask).toMatchObject({ id: taskId, status: 'Completed' });
    const history = (await env.get(`rcas/${caseId}/history`).expect(200))
      .body as { items: Array<{ action: string; entityId: string }> };
    expect(history.items[0]).toMatchObject({
      action: 'rca_action.task_completed',
      entityId: action.id,
    });
    await task({ title: 'Second round' }).expect(201);
  });
});
