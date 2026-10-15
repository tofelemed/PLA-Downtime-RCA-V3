import { randomUUID } from 'crypto';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';
import { signToken } from './support/test-app';

interface DelegationBody {
  id: string;
  delegatorId: string;
  delegateId: string;
  role: string;
  inForce: boolean;
  revokedAt: string | null;
}

const DAY_MS = 86_400_000;

/**
 * SME R1 / R6 delegates on real Postgres: plant management hands its approval role to a deputy for a week;
 * the deputy then approves a period (the history names the delegation), never their own submission; a
 * revoked delegation grants nothing; only what the delegator holds can be delegated, at most 90 days.
 */
describe('role delegations (SME R1 / R6)', () => {
  const env = new ReconciliationWorld();
  let reason = '';
  const people: Record<
    'manager' | 'deputy' | 'accountant',
    { id: string; token: string }
  > = {
    manager: { id: '', token: '' },
    deputy: { id: '', token: '' },
    accountant: { id: '', token: '' },
  };

  const person = async (role: string) => {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, 'x', 'Operator', $4)`,
      [id, `Demo ${role}`, `${id}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [env.world.tenantA, id, role],
    );
    return {
      id,
      token: signToken(env.app, {
        userId: id,
        tenantId: env.world.tenantA,
        role: 'Operator',
      }),
    };
  };
  const delegation = (patch: Record<string, unknown> = {}) => ({
    delegatorId: people.manager.id,
    delegateId: people.deputy.id,
    role: 'manager_approver',
    scopeKind: 'tenant',
    scopeId: env.world.tenantA,
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 7 * DAY_MS).toISOString(),
    reason: 'annual leave',
    ...patch,
  });
  const submitted = async (periodId: string, token: string) => {
    const view = await env.view(periodId);
    await env
      .saveLines(
        view,
        env.rejectAllPlus(view, view.slices[0].gap as string, reason),
        token,
        periodId,
      )
      .expect(200);
    await env.submit(await env.view(periodId), token, periodId).expect(200);
    return env.view(periodId);
  };

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    people.manager = await person('manager_approver');
    people.deputy = await person('production_engineer');
    people.accountant = await person('production_accountant');
  });
  afterAll(() => env.stop());

  let delegationId = '';

  it('the manager delegates the approval role to a deputy for a week', async () => {
    const body = (
      await env
        .post('role-delegations', delegation(), people.manager.token)
        .expect(201)
    ).body as DelegationBody;
    expect(body).toMatchObject({
      delegatorId: people.manager.id,
      delegateId: people.deputy.id,
      inForce: true,
    });
    delegationId = body.id;
    const list = (
      await env
        .get('role-delegations?state=in_force', people.deputy.token)
        .expect(200)
    ).body as {
      items: DelegationBody[];
    };
    expect(list.items.map((d) => d.id)).toContain(delegationId);
  });

  it('the deputy approves a period as delegate; the history names the delegation', async () => {
    const view = await submitted(env.periodA1, env.admin);
    await env.approve(view, people.deputy.token).expect(200);
    const [step] = await env.rows<{
      detail: { asDelegate?: { delegationId: string; delegatorId: string } };
    }>(
      `SELECT detail FROM approval_actions WHERE period_id = $1 AND action = 'approve'`,
      [env.periodA1],
    );
    expect(step.detail.asDelegate).toMatchObject({
      delegationId,
      delegatorId: people.manager.id,
    });
  });

  it('a delegate never approves their own submission', async () => {
    const view = await submitted(env.periodB1, people.deputy.token);
    const refused = await env
      .approve(view, people.deputy.token, env.periodB1)
      .expect(403);
    expect((refused.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
  });

  it('only a role the delegator holds, at most 90 days, never to oneself', async () => {
    const lacks = await env
      .post(
        'role-delegations',
        delegation({ delegatorId: people.accountant.id }),
        people.accountant.token,
      )
      .expect(422);
    expect((lacks.body as ApiError).code).toBe('DELEGATOR_LACKS_ROLE');
    const forOthers = await env
      .post(
        'role-delegations',
        delegation({ delegatorId: people.manager.id }),
        people.accountant.token,
      )
      .expect(403);
    expect((forOthers.body as ApiError).code).toBe('DELEGATION_NOT_ALLOWED');
    const long = await env
      .post(
        'role-delegations',
        delegation({
          validUntil: new Date(Date.now() + 91 * DAY_MS).toISOString(),
        }),
        people.manager.token,
      )
      .expect(422);
    expect((long.body as ApiError).code).toBe('TOO_LONG');
    const self = await env
      .post(
        'role-delegations',
        delegation({ delegateId: people.manager.id }),
        people.manager.token,
      )
      .expect(422);
    expect((self.body as ApiError).code).toBe('SELF_DELEGATION');
  });

  it('a revoked delegation grants nothing', async () => {
    await env
      .post(
        `role-delegations/${delegationId}/revoke`,
        { reason: 'back from leave' },
        people.manager.token,
      )
      .expect(200);
    const view = await submitted(env.periodC1, env.admin);
    await env.approve(view, people.deputy.token, env.periodC1).expect(403);
    const again = await env
      .post(
        `role-delegations/${delegationId}/revoke`,
        { reason: 'twice' },
        people.manager.token,
      )
      .expect(409);
    expect((again.body as ApiError).code).toBe('DELEGATION_OVER');
  });
});
