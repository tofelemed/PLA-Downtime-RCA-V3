import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AdapterRegistry } from '../../src/intake/adapters/adapter-registry';
import { IntakeModule } from '../../src/intake/intake.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { FakeAdapter } from './support/fake-adapter';
import { insertConnection } from './support/intake-fixtures';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/** Plan 1.5 step 8: v2 connections and ingestion jobs (roles, redaction, idempotent commands, tenancy). */
describe('intake API v2: connections and jobs (plan 1.5)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let connectionId: string;
  const tenantId = randomUUID();
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    await harness.start();
    app = await createIntegrationApp(harness, {
      modules: [IntakeModule, V2Module],
    });
    app.get(AdapterRegistry).register(new FakeAdapter());
    connectionId = await insertConnection(harness.dataSource, tenantId);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const http = () => request(app.getHttpServer());
  let admin: string;
  let analyst: string;
  let otherTenant: string;

  beforeAll(() => {
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId,
      role: 'TenantAdmin',
    });
    analyst = signToken(app, { userId: randomUUID(), tenantId });
    otherTenant = signToken(app, {
      userId: randomUUID(),
      tenantId: randomUUID(),
      role: 'TenantAdmin',
    });
  });

  const post = (path: string, token: string, body: object = {}) =>
    http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);

  it('creates a connection with an encrypted secret and never returns it', async () => {
    const response = await post('connections', admin, {
      sourceType: 'rest_import',
      displayName: 'Lab import',
      endpointConfig: { url: 'https://lab.local/export' },
      secret: 's3cret-value',
    }).expect(201);
    const body = response.body as { id: string; hasSecret: boolean };

    expect(body.hasSecret).toBe(true);
    expect(JSON.stringify(body)).not.toContain('s3cret-value');
    const [secret] = await rows<{ ciphertext: string }>(
      `SELECT s.ciphertext FROM secrets s JOIN integration_connections c ON c.secret_ref = 'secrets:' || s.id WHERE c.id = $1`,
      [body.id],
    );
    expect(secret.ciphertext).toMatch(/^enc:v1:/);
    expect(secret.ciphertext).not.toContain('s3cret-value');
  });

  it('rejects credentials in endpointConfig (422) and writers without an integration role (403)', async () => {
    const withPassword = await post('connections', admin, {
      sourceType: 'rest_import',
      displayName: 'x',
      endpointConfig: { password: 'oops' },
    }).expect(422);
    expect((withPassword.body as { code: string }).code).toBe(
      'SECRET_IN_CONFIG',
    );
    await post('connections', analyst, {
      sourceType: 'rest_import',
      displayName: 'x',
      endpointConfig: {},
    }).expect(403);
  });

  it('creates, lists and commands a job; refuses a duplicate scope and invalid transitions; isolates tenants', async () => {
    const created = await post(`connections/${connectionId}/jobs`, admin, {
      scope: { case: 'api' },
      cadence: { intervalSeconds: 30 },
      start: true,
    }).expect(201);
    const jobId = (created.body as { id: string; state: string }).id;
    expect((created.body as { state: string }).state).toBe('running');

    const duplicate = await post(`connections/${connectionId}/jobs`, admin, {
      scope: { case: 'api' },
    }).expect(409);
    expect((duplicate.body as { code: string }).code).toBe('JOB_SCOPE_EXISTS');
    await post(`ingestion-jobs/${jobId}/pause`, admin, {
      reason: 'window',
    }).expect(200);
    const again = await post(`ingestion-jobs/${jobId}/pause`, admin).expect(
      409,
    );
    expect((again.body as { code: string }).code).toBe('INVALID_TRANSITION');
    await post(`ingestion-jobs/${jobId}/explode`, admin).expect(404);
    await post(`ingestion-jobs/${jobId}/stop`, otherTenant).expect(404);
    await post(`ingestion-jobs/${jobId}/stop`, analyst).expect(403);

    const transitions = await http()
      .get(`/api/v2/ingestion-jobs/${jobId}/transitions`)
      .set(bearer(analyst))
      .expect(200);
    expect(
      (transitions.body as Array<{ action: string }>).map((row) => row.action),
    ).toEqual(['create', 'start', 'pause']);
    const list = await http()
      .get('/api/v2/ingestion-jobs')
      .query({ state: 'paused' })
      .set(bearer(analyst))
      .expect(200);
    expect(
      (list.body as { items: Array<{ id: string }> }).items.map(
        (item) => item.id,
      ),
    ).toEqual([jobId]);
    const foreign = await http()
      .get('/api/v2/ingestion-jobs')
      .set(bearer(otherTenant))
      .expect(200);
    expect((foreign.body as { items: unknown[] }).items).toEqual([]);
  });

  it('tests and discovers through the adapter; 422 when no adapter is installed', async () => {
    const tested = await http()
      .post(`/api/v2/connections/${connectionId}/test`)
      .set(bearer(admin))
      .expect(200);
    expect(tested.body).toEqual({ connected: true, message: 'fake ok' });
    const discovered = await http()
      .get(`/api/v2/connections/${connectionId}/discover`)
      .set(bearer(admin))
      .expect(200);
    expect(discovered.body).toEqual({
      capabilities: { replay: true },
      metadata: { topics: ['fake'] },
    });

    const mqtt = await insertConnection(harness.dataSource, tenantId, 'mqtt');
    const missing = await http()
      .post(`/api/v2/connections/${mqtt}/test`)
      .set(bearer(admin))
      .expect(422);
    expect((missing.body as { code: string }).code).toBe('ADAPTER_UNAVAILABLE');
  });
});
