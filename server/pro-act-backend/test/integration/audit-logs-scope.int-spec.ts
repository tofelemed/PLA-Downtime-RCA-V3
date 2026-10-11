import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AuditLogModule } from '../../src/audit-log/audit-log.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface ErrorBody {
  code: string;
}

interface AuditRow {
  id: string;
  tenantId: string | null;
  entityType: string;
}

/**
 * v1 audit-log reads (APPLICATION_LOGIC_GUIDE §23): only administrators and approvers read the trail,
 * and only the trail of the tenant they act on (`X-Tenant-Id` or the token tenant). Writing a client
 * audit entry stays open to every member.
 */
describe('v1 audit logs: roles and tenant scope', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  const rows = { a: randomUUID(), b: randomUUID() };
  const PROBE = 'AuditScopeProbe';

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [AuditLogModule] });
    for (const [id, tenantId] of [
      [rows.a, world.tenantA],
      [rows.b, world.tenantB],
    ]) {
      await harness.dataSource.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, organization_id, tenant_id, timestamp)
         VALUES ($1, $2, 'UPDATE', $3, $4, 'probe', $5, $6, now())`,
        [id, randomUUID(), PROBE, randomUUID(), world.organizationId, tenantId],
      );
    }
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  /** A user of tenant A with `legacyRole` there (plus `scopes`); returns its token. */
  async function member(
    legacyRole: string,
    scopes: Array<{ tenantId: string; role: string }> = [],
  ): Promise<string> {
    const id = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id, organization_id)
       VALUES ($1, 'u', $2, 'x', $3, $4, $5)`,
      [id, `${id}@test.local`, legacyRole, world.tenantA, world.organizationId],
    );
    for (const scope of scopes) {
      await harness.dataSource.query(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
         VALUES ($1, $2, 'tenant', $1, $3, 1)`,
        [scope.tenantId, id, scope.role],
      );
    }
    return signToken(app, {
      userId: id,
      tenantId: world.tenantA,
      organizationId: world.organizationId,
      role: legacyRole,
    });
  }

  const probeIds = (body: unknown): string[] =>
    (body as AuditRow[])
      .filter((row) => row.entityType === PROBE)
      .map((row) => row.id);

  it('refuses an Operator and a reliability engineer the trail with 403 FORBIDDEN_ROLE; their client audit still lands', async () => {
    const operator = await member('Operator', [
      { tenantId: world.tenantA, role: 'operator' },
    ]);
    const engineer = await member('Engineer', [
      { tenantId: world.tenantA, role: 'reliability_engineer' },
    ]);
    for (const token of [operator, engineer]) {
      const list = await http()
        .get(`/api/audit-logs?entityType=${PROBE}`)
        .set(bearer(token))
        .expect(403);
      expect((list.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
      const one = await http()
        .get(`/api/audit-logs/${rows.a}`)
        .set(bearer(token))
        .expect(403);
      expect((one.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    }
    const created = await http()
      .post('/api/audit-logs')
      .set(bearer(operator))
      .send({ action: 'VIEW', entityType: 'Report', entityId: randomUUID() })
      .expect(201);
    expect((created.body as AuditRow).tenantId).toBe(world.tenantA);
  });

  it("shows a Manager only its own tenant's rows; naming another tenant is 403 TENANT_MISMATCH", async () => {
    const manager = await member('Manager');
    const filtered = await http()
      .get(`/api/audit-logs?entityType=${PROBE}`)
      .set(bearer(manager))
      .expect(200);
    expect(probeIds(filtered.body)).toEqual([rows.a]);
    const unfiltered = await http()
      .get('/api/audit-logs')
      .set(bearer(manager))
      .expect(200);
    expect(
      (unfiltered.body as AuditRow[]).every(
        (row) => row.tenantId === world.tenantA,
      ),
    ).toBe(true);
    expect(probeIds(unfiltered.body)).toEqual([rows.a]);

    const other = await http()
      .get(`/api/audit-logs?tenantId=${world.tenantB}`)
      .set(bearer(manager))
      .expect(403);
    expect((other.body as ErrorBody).code).toBe('TENANT_MISMATCH');

    const own = await http()
      .get(`/api/audit-logs/${rows.a}`)
      .set(bearer(manager))
      .expect(200);
    expect((own.body as AuditRow).id).toBe(rows.a);
    const foreign = await http()
      .get(`/api/audit-logs/${rows.b}`)
      .set(bearer(manager))
      .expect(200);
    expect((foreign.body as Partial<AuditRow>).id).toBeUndefined();
  });

  it('lets a SuperAdmin read the tenant it selects with X-Tenant-Id', async () => {
    const admin = await member('SuperAdmin');
    const selected = await http()
      .get(`/api/audit-logs?entityType=${PROBE}`)
      .set(bearer(admin))
      .set('X-Tenant-Id', world.tenantB)
      .expect(200);
    expect(probeIds(selected.body)).toEqual([rows.b]);
    const one = await http()
      .get(`/api/audit-logs/${rows.b}`)
      .set(bearer(admin))
      .set('X-Tenant-Id', world.tenantB)
      .expect(200);
    expect((one.body as AuditRow).id).toBe(rows.b);
    const home = await http()
      .get(`/api/audit-logs?entityType=${PROBE}`)
      .set(bearer(admin))
      .expect(200);
    expect(probeIds(home.body)).toEqual([rows.a]);
  });
});
