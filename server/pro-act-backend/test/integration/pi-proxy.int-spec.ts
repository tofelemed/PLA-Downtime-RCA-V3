import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { CredentialEncryptionService } from '../../src/common/services/credential-encryption.service';
import { PIConnection } from '../../src/pi-connection/pi-connection.entity';
import { PIProxyModule } from '../../src/pi-proxy/pi-proxy.module';
import { IntegrationHarness } from './harness';
import { FakePiServer, startFakePiServer } from './support/fake-pi-server';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/** Spec §4.2: the proxy may only reach the tenant's configured PI hosts, allowlisted paths, GET/POST. */
describe('pi-proxy hardening', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let pi: FakePiServer;
  let tokenA: string;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const connectionA = randomUUID();
  const connectionB = randomUUID();

  beforeAll(async () => {
    await harness.start();
    pi = await startFakePiServer();
    const encryption = new CredentialEncryptionService();
    await harness.dataSource.getRepository(PIConnection).insert([
      {
        id: connectionA,
        tenantId: tenantA,
        connectionName: 'Plant PI',
        piWebApiUrl: pi.baseUrl,
        username: 'svc-proact',
        passwordEncrypted: encryption.encrypt('s3cret'),
        isActive: true,
      },
      {
        id: connectionB,
        tenantId: tenantB,
        connectionName: 'Other plant PI',
        piWebApiUrl: 'https://pi-b.example.local:7443/piwebapi',
        isActive: true,
      },
    ]);
    app = await createIntegrationApp(harness, { modules: [PIProxyModule] });
    tokenA = signToken(app, {
      userId: randomUUID(),
      tenantId: tenantA,
      role: 'Engineer',
    });
  });

  afterAll(async () => {
    await app?.close();
    await pi?.close();
    await harness.stop();
  });

  const proxy = (body: Record<string, unknown>, token = tokenA) =>
    request(app.getHttpServer())
      .post('/api/pi-proxy/request')
      .set(bearer(token))
      .send(body);

  it('forwards an allowlisted GET to the tenant connection with the stored credentials', async () => {
    const response = await proxy({ path: '/assetservers' }).expect(200);

    expect(response.body.status).toBe(200);
    expect(response.body.data.Items[0].Name).toBe('PI-AF-01');
    const upstream = pi.requests.at(-1);
    expect(upstream?.url).toBe('/piwebapi/assetservers');
    expect(upstream?.authorization).toBe(
      `Basic ${Buffer.from('svc-proact:s3cret').toString('base64')}`,
    );
  });

  it('accepts a target that matches the connection host, with query parameters', async () => {
    const response = await proxy({
      target: pi.baseUrl,
      path: 'assetservers',
      params: { selectedFields: 'Items.Name' },
    }).expect(200);

    expect(response.body.status).toBe(200);
    expect(pi.requests.at(-1)?.url).toBe(
      '/piwebapi/assetservers?selectedFields=Items.Name',
    );
  });

  it('refuses a foreign host without contacting it', async () => {
    const before = pi.requests.length;

    const response = await proxy({
      target: 'https://evil.example.com/piwebapi',
      path: '/assetservers',
    }).expect(403);

    expect(response.body.code).toBe('PI_PROXY_HOST_NOT_ALLOWED');
    expect(pi.requests.length).toBe(before);
  });

  it('refuses another tenant connection id', async () => {
    const response = await proxy({
      connectionId: connectionB,
      path: '/assetservers',
    }).expect(403);
    expect(response.body.code).toBe('PI_PROXY_CONNECTION_NOT_ALLOWED');
  });

  it('refuses paths outside the allowlist, including traversal', async () => {
    const before = pi.requests.length;

    const system = await proxy({ path: '/system/versions' }).expect(403);
    expect(system.body.code).toBe('PI_PROXY_PATH_NOT_ALLOWED');

    await proxy({ path: '/assetservers/../../system/versions' }).expect(403);
    await proxy({ path: '//evil.example.com/piwebapi/assetservers' }).expect(
      403,
    );
    expect(pi.requests.length).toBe(before);
  });

  it('allows only GET and POST', async () => {
    const response = await proxy({
      path: '/assetservers',
      method: 'DELETE',
    }).expect(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.fieldErrors[0].field).toBe('method');
  });

  it('caps the upstream response at 5 MiB', async () => {
    const response = await proxy({ path: '/streams/big/recorded' }).expect(502);
    expect(response.body).toMatchObject({
      code: 'UPSTREAM_RESPONSE_TOO_LARGE',
      retryable: true,
    });
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/pi-proxy/request')
      .send({ path: '/assetservers' })
      .expect(401);
  });

  it('refuses identities without a tenant', async () => {
    const orphan = signToken(app, { userId: randomUUID(), role: 'Analyst' });
    const response = await proxy({ path: '/assetservers' }, orphan).expect(403);
    expect(response.body.code).toBe('TENANT_REQUIRED');
  });

  it('test-connection uses the same policy', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/pi-proxy/test-connection')
      .set(bearer(tokenA))
      .send({ connectionId: connectionA })
      .expect(200);
    expect(ok.body).toMatchObject({ connected: true, status: 200 });

    await request(app.getHttpServer())
      .post('/api/pi-proxy/test-connection')
      .set(bearer(tokenA))
      .send({ target: 'https://evil.example.com' })
      .expect(403);
  });
});
