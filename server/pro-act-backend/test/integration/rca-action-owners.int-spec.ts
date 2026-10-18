import { randomUUID } from 'crypto';
import { ApiError } from './support/plan-world';
import { RcaWorld } from './support/rca-world';
import { signToken } from './support/test-app';

interface ActionBody {
  id: string;
  rowVersion: number;
  status: string;
  ownerId: string | null;
  verifierId: string | null;
  verificationMethod: string | null;
  verificationWindowLocked: boolean;
  completionEvidenceRef: string | null;
}

interface Person {
  id: string;
  token: string;
}

/**
 * Marun E2E on real Postgres: the owner of an action who is not an RCA writer (an operator) reads the case
 * and works their own action — status open / in progress and completion evidence — but never marks it done,
 * changes its planning or touches someone else's action. The action names a verification method and a
 * verifier (never the owner; only the named verifier marks it done); its verification window is fixed once
 * done. An approved manual loss line is offered by the picker and can be linked to a case.
 */
describe('RCA action owners, verifier and window lock (Marun E2E)', () => {
  const env = new RcaWorld();
  let caseId = '';
  let owner: Person;
  let other: Person;
  let engineer: Person;
  let verifier: Person;

  async function person(role: string): Promise<Person> {
    const id = await env.member();
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [env.world.tenantA, id, role],
    );
    return {
      id,
      token: signToken(env.app, {
        userId: id,
        tenantId: env.world.tenantA,
        role,
      }),
    };
  }

  const read = async () =>
    (await env.get(`rcas/${caseId}/actions`).expect(200)).body as ActionBody[];
  const actionOf = async (id: string) =>
    (await read()).find((a) => a.id === id) as ActionBody;
  /** PATCH with the current row version as If-Match; `.expect(status)` sends it. */
  const patch = (id: string, body: object, token: string) => ({
    expect: async (status: number) => {
      const current = await actionOf(id);
      return env
        .patch(`rca-actions/${id}`, body, `"${current.rowVersion}"`, token)
        .expect(status);
    },
  });
  const code = (response: { body: unknown }) =>
    (response.body as ApiError).code;

  async function action(body: object): Promise<string> {
    const created = await env
      .post(`rcas/${caseId}/actions`, { title: 'Replace seal', ...body })
      .expect(201);
    return (created.body as ActionBody).id;
  }

  beforeAll(async () => {
    await env.start();
    owner = await person('operator');
    other = await person('operator');
    engineer = await person('reliability_engineer');
    verifier = await person('reliability_engineer');
    caseId = (
      await env.createCase({ title: 'Seal leak', unitId: env.world.unitA1 })
    ).id;
  });
  afterAll(() => env.stop());

  it('the owner reads the case and works their own action, but never marks it done or replans it', async () => {
    const id = await action({ ownerId: owner.id });
    await env.get(`rcas/${caseId}`, owner.token).expect(200);
    const mine = (
      await env.get('rca-actions?mine=true', owner.token).expect(200)
    ).body as { items: Array<{ id: string }> };
    expect(mine.items.map((a) => a.id)).toContain(id);
    const progressed = await patch(
      id,
      { status: 'in_progress', completionEvidenceRef: 'WO-1/0010' },
      owner.token,
    ).expect(200);
    expect(progressed.body).toMatchObject({
      status: 'in_progress',
      completionEvidenceRef: 'WO-1/0010',
    });
    expect(
      code(await patch(id, { status: 'done' }, owner.token).expect(403)),
    ).toBe('SEPARATION_OF_DUTIES');
    expect(
      code(await patch(id, { status: 'cancelled' }, owner.token).expect(403)),
    ).toBe('FORBIDDEN_ROLE');
    expect(
      code(await patch(id, { title: 'mine now' }, owner.token).expect(403)),
    ).toBe('FORBIDDEN_ROLE');
    expect(
      code(
        await patch(id, { completionEvidenceRef: 'x-y-z' }, other.token).expect(
          403,
        ),
      ),
    ).toBe('FORBIDDEN_ROLE');
    await env
      .post(`rcas/${caseId}/actions`, { title: 'x' }, owner.token)
      .expect(403);
  });

  it('verification method and a named verifier: never the owner, a plant member, and the only one to mark it done', async () => {
    const refused = await env
      .post(`rcas/${caseId}/actions`, {
        title: 'x',
        ownerId: owner.id,
        verifierId: owner.id,
      })
      .expect(422);
    expect(code(refused)).toBe('VERIFIER_IS_OWNER');
    const foreign = await env
      .post(`rcas/${caseId}/actions`, {
        title: 'x',
        ownerId: owner.id,
        verifierId: randomUUID(),
      })
      .expect(422);
    expect(code(foreign)).toBe('INVALID_REFERENCE');
    const id = await action({
      ownerId: owner.id,
      verifierId: verifier.id,
      verificationMethod: 'Inspection of the seal after 30 days',
      actionType: 'repair',
      completionEvidenceRef: 'WO-2/0010',
    });
    expect(await actionOf(id)).toMatchObject({
      verifierId: verifier.id,
      verificationMethod: 'Inspection of the seal after 30 days',
    });
    expect(
      code(await patch(id, { status: 'done' }, engineer.token).expect(403)),
    ).toBe('NOT_THE_VERIFIER');
    const done = await patch(id, { status: 'done' }, verifier.token).expect(
      200,
    );
    expect(done.body).toMatchObject({ status: 'done' });
  });

  it('the verification window is fixed once the action is done', async () => {
    const day = 86_400_000;
    const start = new Date(Date.now() + day).toISOString();
    const end = new Date(Date.now() + 30 * day).toISOString();
    const id = await action({
      ownerId: owner.id,
      actionType: 'repair',
      completionEvidenceRef: 'WO-3/0010',
      verificationWindowStart: start,
      verificationWindowEnd: end,
    });
    await patch(
      id,
      { verificationWindowEnd: new Date(Date.now() + 40 * day).toISOString() },
      engineer.token,
    ).expect(200);
    await patch(id, { status: 'done' }, engineer.token).expect(200);
    expect((await actionOf(id)).verificationWindowLocked).toBe(true);
    const locked = await patch(
      id,
      { verificationWindowEnd: new Date(Date.now() + 2 * day).toISOString() },
      engineer.token,
    ).expect(409);
    expect(code(locked)).toBe('VERIFICATION_WINDOW_LOCKED');
    expect(
      code(
        await patch(
          id,
          { completionEvidenceRef: 'changed' },
          owner.token,
        ).expect(409),
      ),
    ).toBe('ACTION_FINISHED');
  });

  it('an approved manual loss line is offered by the picker and links to a case', async () => {
    const reason = await env.reasonCode('SPD');
    await env.approvePeriodA1(reason);
    const [revision] = await env.rows<{
      id: string;
      period_id: string;
      slice_id: string;
    }>(
      `SELECT ar."id", ar."period_id", s."id" AS "slice_id" FROM "accounting_revisions" ar
         JOIN "production_periods" p ON p."id" = ar."period_id"
         JOIN "period_product_slices" s ON s."period_id" = p."id"
        WHERE ar."tenant_id" = $1 AND ar."lifecycle" = 'approved' AND p."unit_id" = $2
        ORDER BY ar."revision" DESC LIMIT 1`,
      [env.world.tenantA, env.world.unitA1],
    );
    const manualId = randomUUID();
    await env.rows(
      `INSERT INTO "approved_loss_lines" ("tenant_id", "row_version", "revision_id", "period_id", "slice_id", "source",
              "source_id", "kind", "reason_code_id", "uom", "quantity")
       VALUES ($1, 1, $2, $3, $4, 'line', $5, 'performance', $6, 't', 4)`,
      [
        env.world.tenantA,
        revision.id,
        revision.period_id,
        revision.slice_id,
        manualId,
        reason,
      ],
    );
    const page = (
      await env
        .get(`loss-lines?unitIds=${env.world.unitA1}&limit=200`)
        .expect(200)
    ).body as {
      items: Array<{ id: string; source: string; quantity: string }>;
    };
    expect(page.items.find((line) => line.id === manualId)).toMatchObject({
      source: 'manual',
      quantity: '4.00000000',
    });
    const linked = await env
      .post(`rcas/${caseId}/links`, {
        linkType: 'loss_line',
        targetId: manualId,
      })
      .expect(201);
    const link = (
      linked.body as {
        link: {
          evidence: {
            line: { source: string };
            approvedImpact: { lines: number };
          };
        };
      }
    ).link;
    expect(link.evidence.line.source).toBe('manual');
    expect(link.evidence.approvedImpact.lines).toBe(1);
  });

  it('linking an event and reading the similar-case search never change its coding', async () => {
    const reason = await env.reasonCode('GBX');
    const eventId = await env.stopEvent(env.world.unitA1, 120, 60, {
      reasonCodeId: reason,
    });
    const coding = () =>
      env.rows<{ reason_code_id: string | null; coding_state: string }>(
        `SELECT "reason_code_id", "coding_state" FROM "production_events" WHERE "id" = $1`,
        [eventId],
      );
    const before = await coding();
    await env.linkEvent(eventId, { rcaId: caseId }).expect(201);
    await env.get(`production-events/${eventId}/rca-evidence`).expect(200);
    await env.get(`rca-knowledge/similar?eventId=${eventId}`).expect(200);
    expect(await coding()).toEqual(before);
    const reasons = await env.rows<{ change_reason: string | null }>(
      `SELECT "change_reason" FROM "event_revisions" WHERE "event_id" = $1 AND "kind" = 'user' ORDER BY "revision"`,
      [eventId],
    );
    expect(reasons.map((r) => r.change_reason)).not.toContain('coding');
  });
});
