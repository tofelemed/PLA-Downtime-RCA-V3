import { randomUUID } from 'crypto';
import { RequestContext } from '../../src/common/context/request-context';
import { ActualsJobsService } from '../../src/periods/actuals-jobs.service';
import { A, ActualsWorld, B, NEXT_DAY } from './support/actuals-world';
import { DAY1 } from './support/plan-world';
import { signToken } from './support/test-app';

describe('actuals writes require the relevant role on the affected scope', () => {
  const env = new ActualsWorld();
  let managerAway: { token: string; context: RequestContext };
  let accountantAway: { token: string; context: RequestContext };
  let managerHere: { token: string; context: RequestContext };
  let periodId = '';
  let sliceId = '';

  async function person(role: string, unitId: string) {
    const id = randomUUID();
    const tenantId = env.world.tenantA;
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'Scoped actuals writer', $2, 'x', 'Operator', $3)`,
      [id, `${id}@test.local`, tenantId],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, 'viewer', 1), ($1, $2, 'unit', $3, $4, 1)`,
      [tenantId, id, unitId, role],
    );
    const context: RequestContext = {
      userId: id,
      tenantId,
      organizationId: null,
      legacyRole: 'Operator',
      roles: ['Operator', 'operator', 'viewer', role],
      isSuperAdmin: false,
      correlationId: randomUUID(),
      scopes: [
        { tenantId, kind: 'tenant', id: tenantId, role: 'viewer' },
        { tenantId, kind: 'unit', id: unitId, role },
      ],
    };
    return {
      context,
      token: signToken(env.app, { userId: id, tenantId, role: 'Operator' }),
    };
  }

  beforeAll(async () => {
    await env.start();
    managerAway = await person('manager_approver', env.world.unitA2);
    accountantAway = await person('production_accountant', env.world.unitA2);
    managerHere = await person('manager_approver', env.world.unitA1);
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodId = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '100');
    await env.relay();
    await env.runActuals();
    sliceId = (await env.detail(periodId)).data.slices[0].id;
  });
  afterAll(() => env.stop());

  function adjustment() {
    return {
      sliceId,
      kind: 'gross',
      quantity: '1',
      basis: 'estimated',
      reason: 'Verified scale correction',
      evidenceRef: 'SCALE-42',
    };
  }

  it.each(['manager', 'accountant'])(
    'a narrow %s cannot propose an adjustment on another readable unit',
    async (role) => {
      const token =
        role === 'manager' ? managerAway.token : accountantAway.token;
      const response = await env.post(
        'actuals/adjustments',
        adjustment(),
        token,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
    },
  );

  it.each(['approve', 'reject'])(
    'a narrow manager cannot %s another unit adjustment',
    async (action) => {
      const created = await env
        .post('actuals/adjustments', adjustment())
        .expect(201);
      const id = (created.body as { id: string }).id;
      const response = await env.post(
        `actuals/adjustments/${id}/${action}`,
        { reason: 'Independent review' },
        managerAway.token,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
    },
  );

  it('a manager on the affected unit can propose and independently approve', async () => {
    await env
      .post('actuals/adjustments', adjustment(), managerHere.token)
      .expect(201);
    const created = await env
      .post('actuals/adjustments', adjustment())
      .expect(201);
    await env
      .post(
        `actuals/adjustments/${(created.body as { id: string }).id}/approve`,
        {},
        managerHere.token,
      )
      .expect(200);
  });

  it('the recompute service itself rejects a narrow writer on another unit', async () => {
    await expect(
      env.app
        .get(ActualsJobsService)
        .requestRecompute(managerAway.context, periodId),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN_ROLE' } });
  });

  it.each(['named unit', 'whole plant'])(
    'a narrow manager cannot materialize the %s outside its role scope',
    async (scope) => {
      const response = await env.post(
        'production-periods/materialize',
        {
          from: DAY1,
          to: NEXT_DAY,
          ...(scope === 'named unit' ? { unitIds: [env.world.unitA1] } : {}),
        },
        managerAway.token,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
    },
  );

  it('a narrow manager can materialize and recompute its own unit', async () => {
    await env.materialize(
      [env.world.unitA1],
      DAY1,
      NEXT_DAY,
      managerHere.token,
    );
    await env
      .post(`production-periods/${periodId}/recompute`, {}, managerHere.token)
      .expect(202);
  });

  function report() {
    return {
      externalReportId: `scope-${randomUUID()}`,
      externalRevision: '1',
      localProductionDate: '2027-03-01',
      utcStart: A,
      utcEnd: NEXT_DAY,
      basis: 'gross',
      sourceStatus: 'COMPLETED',
      lines: [
        {
          unitId: env.world.unitA1,
          productId: env.products.p1,
          gross: '100',
          uom: 't',
        },
      ],
    };
  }

  it('a narrow manager with plant read access cannot import a plant document', async () => {
    const response = await env.post(
      'external-production-reports',
      report(),
      managerAway.token,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });

  it('a narrow manager with plant read access cannot enqueue a CSV import', async () => {
    const response = await env.post(
      'external-production-reports/import',
      { csv: 'externalReportId,externalRevision\nSCOPE,1' },
      managerAway.token,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });

  it('a plant-wide importer retains access to JSON and queued CSV imports', async () => {
    await env
      .post('external-production-reports', report(), env.approver)
      .expect(201);
    await env
      .post(
        'external-production-reports/import',
        { csv: 'externalReportId,externalRevision\nSCOPE,1' },
        env.approver,
      )
      .expect(202);
  });

  const statusMapping = () => ({
    sourceSystem: `scope-${randomUUID()}`,
    effectiveFrom: '2026-01-01T00:00:00Z',
    statuses: [{ status: 'RELEASED', released: true }],
  });

  it('a narrow accountant cannot draft a plant-wide source-status mapping', async () => {
    const response = await env.post(
      'source-status-mappings',
      statusMapping(),
      accountantAway.token,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });

  it('a narrow accountant cannot approve a plant-wide source-status mapping', async () => {
    const author = signToken(env.app, {
      userId: randomUUID(),
      tenantId: env.world.tenantA,
      role: 'integration_admin',
    });
    const created = await env
      .post('source-status-mappings', statusMapping(), author)
      .expect(201);
    const id = (created.body as { id: string }).id;
    const response = await env.post(
      `source-status-mappings/${id}/approve`,
      {},
      accountantAway.token,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({ status: 403, body: { code: 'FORBIDDEN_ROLE' } });
  });
});
