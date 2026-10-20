import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { HealthModule } from '../../src/health/health.module';
import { ProductModule } from '../../src/product/product.module';
import { IntegrationHarness } from './harness';
import { seedPlant } from './support/seed-plant';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/**
 * Plan 0.4 step 3 (API03): error envelope, correlation ids, 401 instead of 500 on missing tokens,
 * throttling, and the B18 DTO fix end to end.
 */
describe('API contract: error envelope, correlation id, auth, throttling', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let token: string;
  const tenantId = randomUUID();

  beforeAll(async () => {
    await harness.start();
    await seedPlant(harness.dataSource, tenantId);
    app = await createIntegrationApp(harness, {
      modules: [HealthModule, ProductModule],
    });
    token = signToken(app, {
      userId: randomUUID(),
      tenantId,
      role: 'TenantAdmin',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('keeps /api/health public', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body.status).toBeDefined();
  });

  it('answers 401 with the standard envelope when the token is missing (was a 500 "No auth token")', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products')
      .expect(401);

    expect(response.body).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'No auth token',
      correlationId: expect.any(String),
      retryable: false,
    });
    expect(response.body).not.toHaveProperty('stack');
    expect(response.headers['x-correlation-id']).toBe(
      response.body.correlationId,
    );
  });

  it('answers 401 for a malformed token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });

  it('echoes a client correlation id on success and failure', async () => {
    const ok = await request(app.getHttpServer())
      .get('/api/health')
      .set('X-Correlation-Id', 'ui-health-77')
      .expect(200);
    expect(ok.headers['x-correlation-id']).toBe('ui-health-77');

    const failed = await request(app.getHttpServer())
      .get('/api/products')
      .set('X-Correlation-Id', 'ui-products-78')
      .expect(401);
    expect(failed.body.correlationId).toBe('ui-products-78');
    expect(failed.headers['x-correlation-id']).toBe('ui-products-78');
  });

  it('shapes 404s for unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/definitely-not-a-route')
      .set(bearer(token))
      .expect(404);
    expect(response.body).toMatchObject({
      code: 'NOT_FOUND',
      retryable: false,
      correlationId: expect.any(String),
    });
    expect(typeof response.body.message).toBe('string');
  });

  it('keeps v1 validation failures at 400 with message[] (frontend contract) and adds fieldErrors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/products')
      .set(bearer(token))
      .send({ name: 'Missing code', bogus: true })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(response.body.message)).toBe(true);
    expect(response.body.message.join(' ')).toContain('code');
    expect(response.body.message.join(' ')).toContain('bogus');
    const fields = response.body.fieldErrors.map(
      (error: { field: string }) => error.field,
    );
    expect(fields).toEqual(expect.arrayContaining(['code', 'bogus']));
    expect(response.body).not.toHaveProperty('stack');
  });

  it('B18: product create accepts tenantId, unitId, organizationId and isActive', async () => {
    const payload = {
      name: 'HDPE film grade',
      code: `HDPE-${randomUUID().slice(0, 8)}`,
      tenantId,
      unitId: randomUUID(),
      organizationId: randomUUID(),
      isActive: false,
    };

    const created = await request(app.getHttpServer())
      .post('/api/products')
      .set(bearer(token))
      .send(payload)
      .expect(201);
    expect(created.body).toMatchObject(payload);

    const fetched = await request(app.getHttpServer())
      .get(`/api/products/${created.body.id}`)
      .set(bearer(token))
      .expect(200);
    expect(fetched.body).toMatchObject({
      tenantId,
      unitId: payload.unitId,
      isActive: false,
    });
  });

  describe('throttling', () => {
    let limited: INestApplication;

    beforeAll(async () => {
      limited = await createIntegrationApp(harness, {
        modules: [HealthModule],
        throttleLimit: 3,
      });
    });

    afterAll(async () => {
      await limited?.close();
    });

    const badLogin = () =>
      request(limited.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.invalid', password: 'wrong' });

    it('returns 429 RATE_LIMITED with Retry-After once the per-client limit is exceeded', async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await badLogin().expect(401);
      }

      const response = await badLogin().expect(429);

      expect(response.body).toMatchObject({
        code: 'RATE_LIMITED',
        retryable: true,
        correlationId: expect.any(String),
      });
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('never throttles health probes (perf audit P11)', async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await request(limited.getHttpServer()).get('/api/health').expect(200);
      }
    });
  });
});
