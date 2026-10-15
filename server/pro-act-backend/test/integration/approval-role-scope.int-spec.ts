import { randomUUID } from 'crypto';
import { ReconciliationWorld } from './support/reconciliation-world';
import { signToken } from './support/test-app';

/** Read visibility and decision authority are separate when a persona has mixed scope grants. */
describe('accounting and source-authority decisions honor role scope', () => {
  const env = new ReconciliationWorld();
  let managerElsewhere = '';
  let managerHere = '';
  let accountantElsewhere = '';
  let financeElsewhere = '';
  let bridgeElsewhere = '';
  let sourceAuthor = '';
  let reason = '';

  async function scopedPerson(
    role: string,
    unitId: string,
    extra?: { role: string; unitId: string },
  ): Promise<string> {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'Scoped approver', $2, 'x', 'Operator', $3)`,
      [id, `${id}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, 'viewer', 1), ($1, $2, 'unit', $3, $4, 1)`,
      [env.world.tenantA, id, unitId, role],
    );
    if (extra)
      await env.rows(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, $4, 1)`,
        [env.world.tenantA, id, extra.unitId, extra.role],
      );
    return signToken(env.app, {
      userId: id,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  }

  beforeAll(async () => {
    await env.start();
    managerElsewhere = await scopedPerson('manager_approver', env.world.unitA2);
    managerHere = await scopedPerson('manager_approver', env.world.unitA1);
    accountantElsewhere = await scopedPerson(
      'production_accountant',
      env.world.unitA2,
    );
    financeElsewhere = await scopedPerson('finance_approver', env.world.unitA2);
    bridgeElsewhere = await scopedPerson(
      'production_accountant',
      env.world.unitA2,
      { role: 'manager_approver', unitId: env.world.unitA1 },
    );
    sourceAuthor = env.user('integration_admin');
    reason = await env.reasonCode('SCOPED-FEED');
  });
  afterAll(() => env.stop());

  async function submitted(periodId: string) {
    const view = await env.view(periodId);
    await env
      .saveLines(
        view,
        env.rejectAllPlus(view, view.slices[0].gap!, reason),
        env.admin,
        periodId,
      )
      .expect(200);
    await env.submit(await env.view(periodId), env.admin, periodId).expect(200);
    return env.view(periodId);
  }

  async function draft(unitId?: string): Promise<string> {
    const result = await env
      .post(
        'source-authority/versions',
        { unitId, measurementHierarchy: null },
        sourceAuthor,
      )
      .expect(201);
    return (result.body as { id: string }).id;
  }

  it('a local manager cannot borrow another unit accountant role to save a bridge', async () => {
    const view = await env.view(env.periodA1);
    const lines = [
      ...env.rejectAllPlus(
        view,
        String(Number(view.slices[0].gap) - 1),
        reason,
      ),
      {
        action: 'manual',
        sliceId: view.slices[0].sliceId,
        kind: 'bridge',
        quantity: '1',
        missingEvent: true,
        reasonCodeId: reason,
        classification: 'inventory',
        evidenceType: 'movement_record',
        evidenceRef: 'MOVEMENT-42',
        reason: 'Verified inventory movement',
      },
    ];
    const response = await env.saveLines(
      view,
      lines,
      bridgeElsewhere,
      env.periodA1,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 422, body: { code: 'BRIDGE_NOT_ALLOWED' } });
  });

  it.each(['manager', 'accountant'])(
    'a narrow %s cannot save or submit accounting on another readable unit',
    async (role) => {
      const token = role === 'manager' ? managerElsewhere : accountantElsewhere;
      const initial = await env.view(env.periodA1);
      const lines = env.rejectAllPlus(initial, initial.slices[0].gap!, reason);
      const save = await env.saveLines(initial, lines, token, env.periodA1);
      expect({ status: save.status, body: save.body as unknown }).toMatchObject(
        { status: 403, body: { code: 'FORBIDDEN_ROLE' } },
      );
      await env
        .saveLines(await env.view(env.periodA1), lines, env.admin, env.periodA1)
        .expect(200);
      const submit = await env.submit(
        await env.view(env.periodA1),
        token,
        env.periodA1,
      );
      expect({
        status: submit.status,
        body: submit.body as unknown,
      }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
    },
  );

  it('a narrow manager cannot cancel or recompute another readable unit', async () => {
    const view = await env.view(env.periodA1);
    for (const [action, body] of [
      ['cancel', { revision: view.revision.revision, reason: 'scope check' }],
      ['recompute', {}],
    ] as const) {
      const response = await env.post(
        `production-periods/${env.periodA1}/${action}`,
        body,
        managerElsewhere,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
    }
  });

  it('a manager role on unit A2 cannot approve unit A1 despite tenant viewer access', async () => {
    const view = await submitted(env.periodA1);
    const response = await env.approve(view, managerElsewhere, env.periodA1);
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 403,
      body: { code: 'FORBIDDEN_ROLE' },
    });
  });

  it('a manager role on unit A2 cannot reject unit A1 despite tenant viewer access', async () => {
    const view = await submitted(env.periodB1);
    const response = await env.post(
      `production-periods/${env.periodB1}/reject`,
      { revision: view.revision.revision, reason: 'scope boundary check' },
      managerElsewhere,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 403,
      body: { code: 'FORBIDDEN_ROLE' },
    });
  });

  it('a narrow manager cannot perform a bridge review of another unit', async () => {
    const view = await env.view(env.periodA1);
    const response = await env.post(
      `production-periods/${env.periodA1}/bridge-review`,
      {
        revision: view.revision.revision,
        submittedHash: view.revision.submittedHash,
      },
      managerElsewhere,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });

  it('the manager role on the period unit can still approve', async () => {
    const view = await submitted(env.periodC1);
    await env.approve(view, managerHere, env.periodC1).expect(200);
  });

  it('a narrow manager cannot reopen an approved period of another unit', async () => {
    const view = await env.view(env.periodC1);
    const response = await env.post(
      `production-periods/${env.periodC1}/revise`,
      { approvedRevision: view.revision.revision, reason: 'scope check' },
      managerElsewhere,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });

  it('a narrow finance approver cannot set posting treatment on another unit', async () => {
    const view = await env.view(env.periodC1);
    const response = await env.post(
      `production-periods/${env.periodC1}/revisions/${view.revision.revision}/posting`,
      {
        postingDate: '2027-03-02',
        treatment: 'no_posting',
        note: 'scope check',
      },
      financeElsewhere,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });

  it('a narrow accountant cannot propose a manual correction of another unit', async () => {
    const view = await env.view(env.periodC1);
    const response = await env.post(
      'period-change-proposals',
      {
        periodId: env.periodC1,
        approvedRevision: view.revision.revision,
        reason: 'scope check',
        evidenceType: 'log',
        evidenceRef: 'SHIFT-LOG-42',
      },
      accountantElsewhere,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });

  it('a narrow manager cannot accept or dismiss another unit change proposal', async () => {
    const view = await env.view(env.periodC1);
    const proposalId = randomUUID();
    await env.rows(
      `INSERT INTO period_change_proposals (id, tenant_id, unit_id, period_id, approved_revision_id, trigger, state, "before", row_version)
       VALUES ($1, $2, $3, $4, $5, 'actuals_change', 'open', '{}', 1)`,
      [
        proposalId,
        env.world.tenantA,
        env.world.unitA1,
        env.periodC1,
        view.revision.id,
      ],
    );
    for (const action of ['accept', 'dismiss']) {
      const response = await env.post(
        `period-change-proposals/${proposalId}/${action}`,
        { reason: 'scope check' },
        managerElsewhere,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
    }
  });

  it.each(['approve', 'reject'])(
    'a unit A2 accountant cannot %s a source-authority version of unit A1',
    async (action) => {
      const id = await draft(env.world.unitA1);
      const response = await env.post(
        `source-authority/versions/${id}/${action}`,
        { reason: 'scope boundary check' },
        accountantElsewhere,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({
        status: 403,
        body: { code: 'FORBIDDEN_ROLE' },
      });
    },
  );

  it('a unit accountant cannot approve a tenant-wide source-authority version', async () => {
    const id = await draft();
    const response = await env.post(
      `source-authority/versions/${id}/approve`,
      {},
      accountantElsewhere,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 403,
      body: { code: 'FORBIDDEN_ROLE' },
    });
  });

  it.each(['other unit', 'whole plant'])(
    'a unit accountant cannot draft source authority for the %s',
    async (scope) => {
      const unitId = scope === 'other unit' ? env.world.unitA1 : undefined;
      const response = await env.post(
        'source-authority/versions',
        { unitId, measurementHierarchy: null },
        accountantElsewhere,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({
        status: 403,
        body: { code: 'FORBIDDEN_ROLE' },
      });
    },
  );

  it('a unit accountant can approve source authority on their own unit', async () => {
    const id = await draft(env.world.unitA2);
    await env
      .post(`source-authority/versions/${id}/approve`, {}, accountantElsewhere)
      .expect(200);
  });
});
