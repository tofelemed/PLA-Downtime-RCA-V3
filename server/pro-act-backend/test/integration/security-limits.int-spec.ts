import { INestApplication, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { rmSync } from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { RCAEvidenceModule } from '../../src/rca-evidence/rca-evidence.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/**
 * Plan 3.11 step 3 (NFR02 / NFR03): request body and upload limits, upload type allowlist, and no
 * credential in any response or log line (regex scan of what the API returned and logged).
 */
describe('request limits and secret hygiene (plan 3.11)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let token = '';
  const logged: string[] = [];
  const uploaded: string[] = [];

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [V2Module, RCAEvidenceModule],
    });
    token = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    for (const level of ['log', 'warn', 'error', 'debug'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logged.push(args.map(String).join(' '));
        });
    }
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    for (const name of uploaded)
      rmSync(join(process.cwd(), 'uploads', world.tenantA, name), {
        force: true,
      });
    rmSync(join(process.cwd(), 'uploads', world.tenantA), {
      recursive: true,
      force: true,
    });
    await app?.close();
    await harness.stop();
  });

  it('refuses JSON bodies above 1 MiB with 413', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/production-events')
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({ description: 'x'.repeat(1024 * 1024 + 10) });
    expect(response.status).toBe(413);
  });

  it('accepts listed attachment types under random names and refuses pages and scripts', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/uploads/evidence')
      .set(bearer(token))
      .attach('file', Buffer.from('a,b\n1,2\n'), 'readings.csv')
      .expect(201);
    const { filename: name, path } = ok.body as {
      filename: string;
      path: string;
    };
    uploaded.push(name);
    expect(name).toMatch(/^[0-9a-f-]{36}\.csv$/);
    expect(path).toBe(`/api/uploads/files/${world.tenantA}/${name}`);

    // downloads need a token and membership of the file's tenant (owner decision 2026-10-10)
    const downloaded = await request(app.getHttpServer())
      .get(path)
      .set(bearer(token))
      .expect(200);
    expect(downloaded.headers['x-content-type-options']).toBe('nosniff');
    expect(downloaded.headers['content-disposition']).toContain('attachment');
    await request(app.getHttpServer()).get(path).expect(401);
    const outsider = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    await request(app.getHttpServer())
      .get(path)
      .set(bearer(outsider))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/uploads/files/${world.tenantA}/..%2F..%2F.env`)
      .set(bearer(token))
      .expect(404);
    await request(app.getHttpServer()).get(`/uploads/${name}`).expect(404);
    for (const file of ['page.html', 'logo.svg', 'run.js', 'noextension']) {
      const refused = await request(app.getHttpServer())
        .post('/api/uploads/evidence')
        .set(bearer(token))
        .attach('file', Buffer.from('<script>alert(1)</script>'), file);
      expect(refused.status).toBe(415);
      expect((refused.body as { code: string }).code).toBe(
        'UPLOAD_TYPE_NOT_ALLOWED',
      );
    }
  });

  it('never returns or logs a credential', async () => {
    const secret = `pi-Secret-${randomUUID()}`;
    const created = await request(app.getHttpServer())
      .post('/api/v2/connections')
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({
        sourceType: 'pi_web_api',
        displayName: `PI ${randomUUID().slice(0, 8)}`,
        endpointConfig: {
          piWebApiUrl: 'https://pi.example.test/piwebapi',
          username: 'svc',
        },
        secret,
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    const read = await request(app.getHttpServer())
      .get(`/api/v2/connections/${id}`)
      .set(bearer(token))
      .expect(200);
    const list = await request(app.getHttpServer())
      .get('/api/v2/connections')
      .set(bearer(token))
      .expect(200);
    // a failing request whose URL carries a token: the error log line must be redacted
    await request(app.getHttpServer())
      .get(`/api/v2/production-events/not-a-uuid?access_token=${token}`)
      .set(bearer(token));

    const responses = [created.text, read.text, list.text];
    for (const text of responses) {
      expect(text).not.toContain(secret);
      expect(text).not.toMatch(/enc:v[12]:/);
    }
    const logs = logged.join('\n');
    expect(logs).not.toContain(secret);
    expect(logs).not.toContain(token);
    expect(logs).not.toMatch(/enc:v[12]:[A-Za-z0-9+/=]{8,}/);
    const [{ ciphertext }]: Array<{ ciphertext: string }> =
      await harness.dataSource.query(
        `SELECT s.ciphertext FROM secrets s JOIN integration_connections c ON c.secret_ref = 'secrets:' || s.id::text WHERE c.id = $1`,
        [id],
      );
    expect(ciphertext).toMatch(/^enc:v[12]:/);
  });
});
