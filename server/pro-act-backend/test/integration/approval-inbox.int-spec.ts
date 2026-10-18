import { seedApprovalMonths } from './support/approval-months';
import { randomUUID } from 'crypto';
import { A, B, ActualsWorld } from './support/actuals-world';
import { signToken } from './support/test-app';
import { ApprovalInboxView } from '../../src/v2/approvals/approval-inbox-v2.dto';
import { ApprovalInboxService } from '../../src/v2/approvals/approval-inbox.service';
import {
  anonymousContext,
  RequestContext,
} from '../../src/common/context/request-context';

describe('pending approvals inbox (isolated proact_test)', () => {
  const env = new ActualsWorld();
  let superAdmin = '',
    profileId = '',
    fxId = '',
    actor = '';
  const read = async (token = superAdmin, query = '') =>
    (
      await env
        .get(`approval-inbox${query ? '?' + query : ''}`, token)
        .expect(200)
    ).body as ApprovalInboxView;
  const profile = async (unitId: string, mode: string, token = superAdmin) => {
    const result = await env
      .post(
        'profiles',
        {
          unitId,
          productId: env.products.p1,
          operatingMode: mode,
          quantityUom: 't',
          rateTimebase: 'h',
          effectiveFrom: '2027-01-01T00:00:00Z',
        },
        token,
      )
      .expect(201);
    return (result.body as { id: string }).id;
  };
  beforeAll(async () => {
    await env.start();
    actor = randomUUID();
    await env.rows(
      "INSERT INTO users (id,name,email,password_hash,role,tenant_id) VALUES ($1,'Inbox SuperAdmin',$2,'x','SuperAdmin',$3)",
      [actor, actor + '@test.local', env.world.tenantA],
    );
    superAdmin = signToken(env.app, {
      userId: actor,
      tenantId: env.world.tenantA,
      role: 'SuperAdmin',
    });
    profileId = await profile(env.world.unitA1, 'inbox-test');
    await profile(env.world.unitA2, 'inbox-test');
    const fx = await env
      .post(
        'fx-rates',
        {
          fromCurrency: 'USD',
          toCurrency: 'IRR',
          rate: '600000',
          rateType: 'economic',
          effectiveFrom: '2027-01-01T00:00:00Z',
        },
        superAdmin,
      )
      .expect(201);
    fxId = (fx.body as { id: string }).id;
  });
  afterAll(() => env.stop());
  it('reads every catalog query without writing and isolates tenants', async () => {
    const before = await env.rows(
      'SELECT id, state, row_version FROM production_profiles ORDER BY id',
    );
    const result = await read();
    expect(result.items.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['profile', 'fx-rate']),
    );
    expect(
      await env.rows(
        'SELECT id, state, row_version FROM production_profiles ORDER BY id',
      ),
    ).toEqual(before);
    expect((await read(env.adminB)).items).toEqual([]);
  });
  it('routes finance and manager records to their actual approval roles', async () => {
    expect(
      (await read(env.approver)).items.every((item) => item.kind !== 'fx-rate'),
    ).toBe(true);
    expect(
      (await read(env.financeApprover)).items.map((item) => item.id),
    ).toContain(fxId);
    expect(
      (await read(env.financeApprover)).items.some(
        (item) => item.kind === 'profile',
      ),
    ).toBe(false);
    const viewer = await env.unitUser(env.world.unitA1, 'viewer');
    expect((await read(viewer)).items).toEqual([]);
  });
  it('does not widen a unit approver through a tenant-wide viewer grant', async () => {
    const userId = randomUUID();
    const context: RequestContext = {
      ...anonymousContext('test'),
      userId,
      tenantId: env.world.tenantA,
      roles: ['viewer', 'manager_approver'],
      scopes: [
        {
          kind: 'tenant',
          id: env.world.tenantA,
          tenantId: env.world.tenantA,
          role: 'viewer',
        },
        {
          kind: 'unit',
          id: env.world.unitA1,
          tenantId: env.world.tenantA,
          role: 'manager_approver',
        },
      ],
    };
    const result = await env.app
      .get(ApprovalInboxService)
      .list(context, { limit: 100 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.unitId === env.world.unitA1)).toBe(
      true,
    );
    expect(result.items.map((item) => item.id)).toContain(profileId);
  });
  it('keeps ordinary author separation and permits SuperAdmin to decide its own work', async () => {
    const manager = await env.unitUser(env.world.unitA1, 'manager_approver');
    const id = await profile(env.world.unitA1, 'manager-own', manager);
    const own = (await read(manager)).items.find((item) => item.id === id)!;
    expect(
      own.actions.find((item) => item.action === 'approve')?.disabledReason,
    ).toBeTruthy();
    expect(
      own.actions.find((item) => item.action === 'retire')?.disabledReason,
    ).toBeNull();
    await env.post(`profiles/${id}/approve`, {}, manager).expect(403);
    const adminOwn = (await read()).items.find(
      (item) => item.id === profileId,
    )!;
    expect(
      adminOwn.actions.find((item) => item.action === 'approve')
        ?.disabledReason,
    ).toBeNull();
    await env.post(`profiles/${profileId}/approve`, {}, superAdmin).expect(200);
    expect((await read()).items.some((item) => item.id === profileId)).toBe(
      false,
    );
    await env.post(`profiles/${id}/retire`, {}, manager).expect(200);
    expect((await read(manager)).items.some((item) => item.id === id)).toBe(
      false,
    );
  });
  it('routes quality, metrology and source ownership independently of management', async () => {
    const disposition = await env
      .post(
        'lot-dispositions',
        {
          unitId: env.world.unitA1,
          productId: env.products.p1,
          lotCode: 'APPROVAL-LOT',
          dispositionClass: 'scrap',
          quantity: '1',
          uom: 't',
          productionStart: A,
          productionEnd: B,
          labReleasedAt: B,
          evidenceRef: 'LIMS-APPROVAL',
        },
        superAdmin,
      )
      .expect(201);
    const budget = await env
      .post(
        'uncertainty-budgets',
        {
          unitId: env.world.unitA1,
          boundary: 'extruder_outlet',
          uom: 't',
          components: [
            { kind: 'meter', label: 'Totalizer', standardUncertainty: '1' },
          ],
          coverageFactor: '2',
          calibrationRef: 'CAL-INBOX',
          effectiveFrom: '2026-01-01T00:00:00Z',
          reviewDueAt: '2031-01-01T00:00:00Z',
        },
        superAdmin,
      )
      .expect(201);
    const source = await env
      .post(
        'source-authority/versions',
        { unitId: env.world.unitA1, measurementHierarchy: null },
        superAdmin,
      )
      .expect(201);
    const status = await env
      .post(
        'source-status-mappings',
        {
          sourceSystem: 'inbox-lims',
          effectiveFrom: '2027-01-01T00:00:00Z',
          statuses: [{ status: 'AUTHORIZED', released: true }],
        },
        superAdmin,
      )
      .expect(201);
    const quality = await env.unitUser(env.world.unitA1, 'quality_approver');
    const metrology = await env.unitUser(
      env.world.unitA1,
      'metrology_approver',
    );
    const sourceOwner = await env.unitUser(
      env.world.unitA1,
      'production_accountant',
    );
    expect((await read(quality)).items.map((row) => row.id)).toContain(
      (disposition.body as { id: string }).id,
    );
    expect(
      (await read(quality)).items.every((row) => row.kind === 'disposition'),
    ).toBe(true);
    expect((await read(metrology)).items.map((row) => row.id)).toContain(
      (budget.body as { id: string }).id,
    );
    expect(
      (await read(metrology)).items.every(
        (row) => row.kind === 'uncertainty-budget',
      ),
    ).toBe(true);
    expect((await read(sourceOwner)).items.map((row) => row.id)).toContain(
      (source.body as { id: string }).id,
    );
    expect(
      (await read(sourceOwner)).items.some(
        (row) => row.kind === 'source-status',
      ),
    ).toBe(false);
    const all = await read();
    expect(all.items.map((row) => row.id)).toContain(
      (status.body as { id: string }).id,
    );
    for (const row of all.items.filter((entry) => entry.resource))
      await env.get(`${row.resource}/${row.commandId}`, superAdmin).expect(200);
    await env
      .post(
        `lot-dispositions/${(disposition.body as { id: string }).id}/reject`,
        { reason: 'Missing certificate' },
        quality,
      )
      .expect(200);
    expect((await read(quality)).items).toEqual([]);
  });
  it('binds site approval grants to the actual unit site', async () => {
    const [site] = await env.rows<{ id: string }>(
      'SELECT id FROM sites WHERE tenant_id = $1 LIMIT 1',
      [env.world.tenantA],
    );
    await env.rows('UPDATE units SET site_id = $1 WHERE id = $2', [
      site.id,
      env.world.unitA2,
    ]);
    const context: RequestContext = {
      ...anonymousContext('site-test'),
      userId: randomUUID(),
      tenantId: env.world.tenantA,
      roles: ['manager_approver'],
      scopes: [
        {
          kind: 'site',
          id: site.id,
          tenantId: env.world.tenantA,
          role: 'manager_approver',
        },
      ],
    };
    const result = await env.app
      .get(ApprovalInboxService)
      .list(context, { limit: 100 });
    expect(result.items.some((row) => row.unitId === env.world.unitA2)).toBe(
      true,
    );
    expect(result.items.every((row) => row.unitId === env.world.unitA2)).toBe(
      true,
    );
  });
  it('routes materiality, finance sign-off and locking by the saved close state and policy roles', async () => {
    await seedApprovalMonths(env, actor);
    const finance = (await read(env.financeApprover)).items.filter((row) =>
      row.kind.startsWith('month-'),
    );
    expect(finance.map((row) => row.kind).sort()).toEqual([
      'month-finance',
      'month-lock',
    ]);
    expect(
      finance.every(
        (row) =>
          row.actions.length === 0 && row.reviewHref.includes('?month=2027-'),
      ),
    ).toBe(true);
    const accountingContext: RequestContext = {
      ...anonymousContext('month-role'),
      tenantId: env.world.tenantA,
      userId: randomUUID(),
      roles: ['production_accountant'],
      scopes: [
        {
          kind: 'tenant',
          id: env.world.tenantA,
          tenantId: env.world.tenantA,
          role: 'production_accountant',
        },
      ],
    };
    const accounting = await env.app
      .get(ApprovalInboxService)
      .list(accountingContext, { limit: 100 });
    expect(
      accounting.items
        .filter((row) => row.kind.startsWith('month-'))
        .map((row) => row.kind),
    ).toEqual(['month-materiality']);
    expect(
      (await read(env.approver)).items.some((row) =>
        row.kind.startsWith('month-'),
      ),
    ).toBe(false);
  });
  it('indexes pending scans and round-trips the new indexes without touching records', async () => {
    const { ApprovalInboxIndexes1794190800000 } = await import(
      '../../src/database/migrations/1794190800000-ApprovalInboxIndexes'
    );
    const runner = env.harness.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const migration = new ApprovalInboxIndexes1794190800000();
      await migration.down(runner);
      await migration.up(runner);
      await runner.startTransaction();
      await runner.query('SET LOCAL enable_seqscan = off');
      const plan: unknown = await runner.query(
        "EXPLAIN (ANALYZE, FORMAT JSON) SELECT id, created_at FROM production_profiles WHERE tenant_id = $1 AND state = 'draft' ORDER BY created_at, id LIMIT 21",
        [env.world.tenantA],
      );
      expect(JSON.stringify(plan)).toContain(
        'IDX_approval_inbox_production_profiles',
      );
      await runner.rollbackTransaction();
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it('pages across workflow kinds without duplicates or losing timestamp precision', async () => {
    const all = await read(superAdmin, 'limit=100');
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await read(
        superAdmin,
        'limit=1' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      ids.push(...page.items.map((item) => item.kind + ':' + item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toEqual(all.items.map((item) => item.kind + ':' + item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('validates filters, limits and cursor binding', async () => {
    await env.get('approval-inbox?limit=101', superAdmin).expect(422);
    await env.get('approval-inbox?kind=unknown', superAdmin).expect(400);
    await env.get('approval-inbox?cursor=bad', superAdmin).expect(400);
    await env
      .get('approval-inbox?tenantId=' + env.world.tenantB, superAdmin)
      .expect(400);
    const page = await read(superAdmin, 'limit=1');
    if (page.nextCursor)
      await env
        .get(
          'approval-inbox?kind=profile&cursor=' + page.nextCursor,
          superAdmin,
        )
        .expect(400);
  });
});
