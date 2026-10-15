import { HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { CaseBody, RcaWorld } from './support/rca-world';
import { signToken } from './support/test-app';

/**
 * SME CA1 closure independence on real Postgres (security review): the team is frozen once the
 * investigation is accepted (422 TEAM_LOCKED), and whoever ever led, joined, opened or requested the
 * case — even after leaving the team — never approves its closure (403 SEPARATION_OF_DUTIES).
 */
describe('RCA closure independence (SME CA1)', () => {
  const env = new RcaWorld();
  let caseId = '';
  const people: Record<'lead' | 'member', { id: string; token: string }> = {
    lead: { id: '', token: '' },
    member: { id: '', token: '' },
  };

  async function manager(): Promise<{ id: string; token: string }> {
    const id = await env.member();
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, 'manager_approver', 1)`,
      [env.world.tenantA, id],
    );
    const token = signToken(env.app, {
      userId: id,
      tenantId: env.world.tenantA,
      role: 'manager_approver',
    });
    return { id, token };
  }

  const read = async () =>
    (await env.get(`rcas/${caseId}`).expect(200)).body as CaseBody;
  const transition = async (body: object, token: string) =>
    env
      .http()
      .post(`/api/v2/rcas/${caseId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
      .set('If-Match', `"${(await read()).rowVersion}"`)
      .send(body);
  const codeOf = (response: { body: unknown }) =>
    (response.body as ApiError).code;

  beforeAll(async () => {
    await env.start();
    people.lead = await manager();
    people.member = await manager();
    const created = await env.createCase({
      title: 'Extruder gearbox bearing',
      unitId: env.world.unitA1,
      status: 'In Progress',
      consequenceClass: 'minor',
      rootCause: 'Lubrication interval too long for the duty',
      teamLeadId: people.lead.id,
      teamMemberIds: [people.member.id],
      logicTree: [
        {
          id: 'n1',
          parentId: null,
          label: 'Gearbox trip',
          kind: 'event',
          status: 'open',
          notes: null,
        },
        {
          id: 'n2',
          parentId: 'n1',
          label: 'Bearing distress',
          kind: 'hypothesis',
          status: 'verified',
          notes: null,
        },
      ],
    });
    caseId = created.id;
    const now = new Date().toISOString();
    const action = (
      await env
        .post(`rcas/${caseId}/actions`, {
          title: 'Shorten the lubrication interval',
          actionType: 'procedure_change',
          status: 'done',
          completionEvidenceRef: 'PM task revision PM-GB-12 rev 3',
          verificationWindowStart: plus(now, -40 * 24 * HOUR),
          verificationWindowEnd: plus(now, -24 * HOUR),
          baseline: { metric: 'recurrences' },
        })
        .expect(201)
    ).body as { id: string; rowVersion: number };
    await env
      .http()
      .post(`/api/v2/rca-actions/${action.id}/verify`)
      .set('Authorization', `Bearer ${env.admin}`)
      .set('Idempotency-Key', `verify-${action.id}`)
      .set('If-Match', `"${action.rowVersion}"`)
      .expect(200);
  });
  afterAll(() => env.stop());

  it('a member who leaves before acceptance still counts as an investigator', async () => {
    await env
      .patch(
        `rcas/${caseId}`,
        { teamMemberIds: [] },
        `"${(await read()).rowVersion}"`,
      )
      .expect(200);
    for (const step of [{ to: 'Analysis' }, { to: 'Monitoring' }]) {
      expect((await transition(step, people.lead.token)).status).toBe(200);
    }
  });

  it('once the investigation is accepted the team is locked', async () => {
    const locked = await env
      .patch(
        `rcas/${caseId}`,
        { teamLeadId: null },
        `"${(await read()).rowVersion}"`,
        people.lead.token,
      )
      .expect(422);
    expect(codeOf(locked)).toBe('TEAM_LOCKED');
    await env
      .patch(
        `rcas/${caseId}`,
        { teamMemberIds: [people.lead.id] },
        `"${(await read()).rowVersion}"`,
      )
      .expect(422);
  });

  it('the lead requests closure, leaves the team (forced around the lock) and is still refused', async () => {
    const requested = await transition(
      {
        to: 'Closure Review',
        residualRisk: 'Residual wear watched by vibration route',
      },
      people.lead.token,
    );
    expect(requested.status).toBe(200);
    // the lock is bypassed in the database to prove the check does not rely on the current team
    await env.rows(
      `UPDATE rcas SET team_lead_id = NULL, team_members = '[]' WHERE id = $1`,
      [caseId],
    );
    const lead = await transition({ to: 'Closed' }, people.lead.token);
    expect(lead.status).toBe(403);
    expect(codeOf(lead)).toBe('SEPARATION_OF_DUTIES');
    await env.rows(
      `UPDATE rcas SET closure_requested_by = NULL WHERE id = $1`,
      [caseId],
    );
    const again = await transition({ to: 'Closed' }, people.lead.token);
    expect(codeOf(again)).toBe('SEPARATION_OF_DUTIES');
    const member = await transition({ to: 'Closed' }, people.member.token);
    expect(codeOf(member)).toBe('SEPARATION_OF_DUTIES');
    const readiness = (
      await env.get(`rcas/${caseId}/readiness`, people.member.token).expect(200)
    ).body as {
      approver: { canApprove: boolean };
    };
    expect(readiness.approver.canApprove).toBe(false);
  });

  it('an independent manager approver closes it', async () => {
    expect((await transition({ to: 'Closed' }, env.approver)).status).toBe(200);
  });
});
