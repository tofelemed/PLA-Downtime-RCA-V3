import { randomUUID } from 'crypto';
import { SuperAdminApprovalOverride1794190400000 } from '../../src/database/migrations/1794190400000-SuperAdminApprovalOverride';
import { A, B } from './support/actuals-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';
import { signToken } from './support/test-app';

/** Permanent SuperAdmin exception, exercised through HTTP and real Postgres on proact_test only. */
describe('SuperAdmin completes approval workflows alone', () => {
  const env = new ReconciliationWorld();
  const actor = randomUUID();
  let admin = '';

  beforeAll(async () => {
    await env.start();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'SuperAdmin test', $2, 'x', 'SuperAdmin', $3)`,
      [actor, `${actor}@test.local`, env.world.tenantA],
    );
    admin = signToken(env.app, {
      userId: actor,
      tenantId: env.world.tenantA,
      role: 'SuperAdmin',
    });
  });
  afterAll(() => env.stop());

  const decision = async (table: string, id: string) => {
    const [row] = await env.rows<{
      author_id: string;
      decided_by: string;
      super_admin_override: boolean;
    }>(
      `SELECT author_id, decided_by, super_admin_override FROM "${table}" WHERE id = $1`,
      [id],
    );
    expect(row).toEqual({
      author_id: actor,
      decided_by: actor,
      super_admin_override: true,
    });
    // The independent-user CHECK still protects ordinary decisions at the database boundary.
    await expect(
      env.rows(
        `UPDATE "${table}" SET super_admin_override = false WHERE id = $1`,
        [id],
      ),
    ).rejects.toThrow(/independent/);
  };

  it('approves its own profile using the authenticated role', async () => {
    const created = await env
      .post(
        'profiles',
        {
          unitId: env.world.unitA3,
          productId: env.products.p2,
          quantityUom: 't',
          rateTimebase: 'h',
          effectiveFrom: '2026-10-01T00:00:00Z',
        },
        admin,
      )
      .expect(201);
    const approved = await env
      .post(
        `profiles/${(created.body as { id: string }).id}/approve`,
        {},
        admin,
      )
      .expect(200);
    expect(approved.body).toMatchObject({
      state: 'approved',
      createdBy: actor,
      approvedBy: actor,
    });
  });

  it('approves its own actuals adjustment and records the durable exception', async () => {
    const sliceId = (await env.detail(env.periodB1)).data.slices[0].id;
    const created = await env
      .post(
        'actuals/adjustments',
        {
          sliceId,
          kind: 'gross',
          quantity: '1',
          basis: 'measured',
          reason: 'Weighbridge correction',
          evidenceRef: 'WB-TEST-1',
        },
        admin,
      )
      .expect(201);
    const id = (created.body as { id: string }).id;
    await env.post(`actuals/adjustments/${id}/approve`, {}, admin).expect(200);
    await decision('actuals_adjustments', id);
    await env.post(`actuals/adjustments/${id}/approve`, {}, admin).expect(409);
  });

  it('approves its own lot disposition across author and quality roles', async () => {
    const created = await env
      .post(
        'lot-dispositions',
        {
          unitId: env.world.unitA1,
          productId: env.products.p1,
          lotCode: 'SA-LOT',
          dispositionClass: 'scrap',
          quantity: '1',
          uom: 't',
          productionStart: A,
          productionEnd: B,
          labReleasedAt: B,
          evidenceRef: 'LIMS-TEST-1',
        },
        admin,
      )
      .expect(201);
    const id = (created.body as { id: string }).id;
    await env.post(`lot-dispositions/${id}/approve`, {}, admin).expect(200);
    await decision('lot_dispositions', id);
  });

  it('approves and adopts its own metrology budget without accepting a client override', async () => {
    const created = await env
      .post(
        'uncertainty-budgets',
        {
          unitId: env.world.unitA3,
          boundary: 'extruder_outlet',
          uom: 't',
          components: [
            {
              kind: 'meter',
              label: 'Certified totalizer',
              standardUncertainty: '1',
            },
          ],
          coverageFactor: '2',
          calibrationRef: 'CAL-TEST-1',
          effectiveFrom: '2026-01-01T00:00:00Z',
          reviewDueAt: '2031-01-01T00:00:00Z',
        },
        admin,
      )
      .expect(201);
    const id = (created.body as { id: string }).id;
    const checker = await env.unitUser(env.world.unitA3, 'metrology_approver');
    await env
      .post(
        `uncertainty-budgets/${id}/approve`,
        { isSuperAdmin: true },
        checker,
      )
      .expect(422);
    await env.post(`uncertainty-budgets/${id}/approve`, {}, admin).expect(200);
    await decision('uncertainty_budgets', id);
    await env
      .post(`uncertainty-budgets/${id}/adopt-as-tolerance`, {}, admin)
      .expect(200);
    // Demotion does not invalidate the historical exception or leave privilege in an old token.
    await env.rows(`UPDATE users SET role = 'TenantAdmin' WHERE id = $1`, [
      actor,
    ]);
    await env.rows(
      `UPDATE uncertainty_budgets SET notes = 'Historical decision retained' WHERE id = $1`,
      [id],
    );
    await env
      .post(`uncertainty-budgets/${id}/adopt-as-tolerance`, {}, admin)
      .expect(403);
    await env.rows(`UPDATE users SET role = 'SuperAdmin' WHERE id = $1`, [
      actor,
    ]);
  });

  it('authors, submits, approves all shifts and certifies the day, retaining stale-input checks and audit', async () => {
    await env.settle();
    const reason = await env.reasonCode('SA-FEED');
    const day = `production-days/${env.world.unitA1}/2027-03-01/certify`;
    await env.post(day, {}, admin).expect(422);
    for (const periodId of [env.periodA1, env.periodB1, env.periodC1]) {
      const view = await env.view(periodId, admin);
      await env
        .saveLines(
          view,
          env.rejectAllPlus(view, view.slices[0].gap as string, reason),
          admin,
          periodId,
        )
        .expect(200);
      await env
        .submit(await env.view(periodId, admin), admin, periodId)
        .expect(200);
      const submitted = await env.view(periodId, admin);
      await env
        .approve(
          {
            ...submitted,
            revision: { ...submitted.revision, submittedHash: 'f'.repeat(64) },
          },
          admin,
          periodId,
        )
        .expect(409);
      const approved = await env
        .approve(submitted, admin, periodId)
        .expect(200);
      expect((approved.body as ReconciliationBody).revision.lifecycle).toBe(
        'approved',
      );
      const [snapshot] = await env.rows<{
        content: { submittedBy: string; approvedBy: string };
      }>('SELECT content FROM approval_snapshots WHERE revision_id = $1', [
        submitted.revision.id,
      ]);
      expect(snapshot.content).toMatchObject({
        submittedBy: actor,
        approvedBy: actor,
      });
    }
    const certified = await env.post(day, {}, admin).expect(200);
    expect(certified.body).toMatchObject({ state: 'certified' });
    await env.post(day, {}, admin).expect(409);
  });

  it('refuses to roll back over historical SuperAdmin self-decisions', async () => {
    const runner = env.harness.dataSource.createQueryRunner();
    try {
      await expect(
        new SuperAdminApprovalOverride1794190400000().down(runner),
      ).rejects.toThrow(
        'Cannot revert SuperAdmin approval overrides while self-decisions exist',
      );
    } finally {
      await runner.release();
    }
  });
});
