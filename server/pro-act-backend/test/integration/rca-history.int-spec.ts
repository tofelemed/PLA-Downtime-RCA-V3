import { CaseBody, RcaWorld } from './support/rca-world';

interface HistoryEntry {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  reason: string | null;
  changedFields: string[];
  values: Record<string, { from: unknown; to: unknown }>;
  beforeHash: string | null;
  afterHash: string | null;
}

interface HistoryPage {
  items: HistoryEntry[];
  nextCursor: string | null;
}

/**
 * RCA field history (item 2) on real Postgres: case and action commands append `audit_log` rows in their
 * transaction; `GET /v2/rcas/{id}/history` returns them newest first in keyset pages with the actor's
 * name, and answers 404 outside the caller's units. The audit table refuses rewrites.
 */
describe('RCA field history', () => {
  const env = new RcaWorld();
  let caseId = '';
  let actionId = '';

  beforeAll(async () => {
    await env.start();
  });
  afterAll(() => env.stop());

  const history = async (query = '', token = env.reliability) =>
    (await env.get(`rcas/${caseId}/history${query}`, token).expect(200))
      .body as HistoryPage;
  const rowVersion = async () =>
    `"${((await env.get(`rcas/${caseId}`).expect(200)).body as CaseBody).rowVersion}"`;

  it('records create, edit, transition and action commands with changed fields', async () => {
    caseId = (await env.createCase(env.example(), env.reliability)).id;
    await env
      .patch(
        `rcas/${caseId}`,
        { rootCause: 'Coupling misaligned', logicTree: [] },
        await rowVersion(),
        env.reliability,
      )
      .expect(200);
    await env
      .http()
      .post(`/api/v2/rcas/${caseId}/transitions`)
      .set('Authorization', `Bearer ${env.reliability}`)
      .set('If-Match', await rowVersion())
      .send({ to: 'Analysis', note: 'team formed' })
      .expect(200);
    const action = await env
      .post(
        `rcas/${caseId}/actions`,
        { title: 'Realign', ownerId: env.members[1] },
        env.reliability,
      )
      .expect(201);
    actionId = (action.body as { id: string }).id;
    await env
      .patch(
        `rca-actions/${actionId}`,
        { status: 'cancelled', cancelReason: 'covered by the PM plan' },
        `"${(action.body as { rowVersion: number }).rowVersion}"`,
        env.reliability,
      )
      .expect(200);

    const page = await history();
    expect(page.items.map((entry) => entry.action)).toEqual([
      'rca_action.updated',
      'rca_action.created',
      'rca_case.transitioned',
      'rca_case.updated',
      'rca_case.created',
    ]);
    const [cancelled, , moved, edited, created] = page.items;
    expect(cancelled).toMatchObject({
      entityType: 'rca_action',
      entityId: actionId,
      reason: 'covered by the PM plan',
      actorName: 'unit user',
    });
    expect(cancelled.values.status).toEqual({ from: 'open', to: 'cancelled' });
    expect(moved.values.status).toEqual({
      from: 'In Progress',
      to: 'Analysis',
    });
    expect(moved.reason).toBe('team formed');
    expect(edited.changedFields).toEqual(['logicTree', 'rootCause']);
    expect(edited.values.rootCauseLength.to).toBe(19);
    expect(edited.beforeHash).toBe(created.afterHash);
    expect(created.beforeHash).toBeNull();
  });

  it('pages newest first with a cursor', async () => {
    const first = await history('?limit=2');
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const rest = await history(
      `?limit=10&cursor=${encodeURIComponent(first.nextCursor as string)}`,
    );
    expect(rest.items.map((entry) => entry.action)).toEqual([
      'rca_case.transitioned',
      'rca_case.updated',
      'rca_case.created',
    ]);
  });

  it('is 404 for a case outside the caller units, and the audit rows cannot be rewritten', async () => {
    const other = await env.createCase(
      env.example({ unitId: env.world.unitA2, teamMemberIds: [] }),
    );
    await env.get(`rcas/${other.id}/history`, env.reliability).expect(404);
    await env.get(`rcas/${other.id}/history`).expect(200);
    await expect(
      env.rows(
        `UPDATE audit_log SET reason = 'x' WHERE entity_type = 'rca_case'`,
      ),
    ).rejects.toThrow();
  });
});
