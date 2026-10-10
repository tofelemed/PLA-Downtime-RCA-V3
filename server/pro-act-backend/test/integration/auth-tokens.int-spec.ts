import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp } from './support/test-app';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface ErrorBody {
  code: string;
}

const PASSWORD = 'S3cure!pass';

/**
 * Plan 3.11 step 1 (D15 JWT hardening, NFR01): short-lived access tokens, refresh tokens that are signed
 * with their own key, single-use and rotated, reuse detection that revokes the sign-in family, logout
 * revocation, and the auth cases of the plan's test list (expired, foreign issuer, role downgrade).
 */
describe('JWT hardening (plan 3.11)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let email = '';
  let userId = '';

  const http = () => request(app.getHttpServer());
  const login = async (): Promise<Session> =>
    (
      await http()
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200)
    ).body as Session;
  const refresh = (token: string) =>
    http().post('/api/auth/refresh').send({ refreshToken: token });
  const listEvents = (token: string) =>
    http().get('/api/v2/production-events').set(bearer(token));

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    userId = randomUUID();
    email = `${userId}@test.local`;
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id, is_active)
       VALUES ($1, 'engineer', $2, $3, 'Engineer', $4, true)`,
      [userId, email, await bcrypt.hash(PASSWORD, 4), world.tenantA],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, 'production_engineer', 1)`,
      [world.tenantA, userId],
    );
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('issues a 15-minute access token and a refresh token that is not an access token', async () => {
    const session = await login();
    expect(session.expires_in).toBe(900);
    const claims = app
      .get(JwtService)
      .decode<{ typ: string; exp: number; iat: number }>(session.access_token);
    expect(claims.typ).toBe('access');
    expect(claims.exp - claims.iat).toBe(900);
    await listEvents(session.access_token).expect(200);
    await listEvents(session.refresh_token).expect(401);
    // the access token is not a refresh token either (different key and type)
    await refresh(session.access_token).expect(401);
  });

  it('rotates refresh tokens and revokes the family when a spent token is replayed', async () => {
    const first = await login();
    const second = (await refresh(first.refresh_token).expect(200))
      .body as Session;
    expect(second.refresh_token).not.toBe(first.refresh_token);
    await listEvents(second.access_token).expect(200);

    // replay after the grace window for parallel tabs: theft → whole family revoked
    await harness.dataSource.query(
      `UPDATE auth_refresh_tokens SET used_at = now() - interval '1 hour' WHERE used_at IS NOT NULL AND user_id = $1`,
      [userId],
    );
    const replay = await refresh(first.refresh_token).expect(401);
    expect((replay.body as ErrorBody).code).toBe('REFRESH_TOKEN_REUSED');
    const revoked = await refresh(second.refresh_token).expect(401);
    expect((revoked.body as ErrorBody).code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('lets two tabs refresh with the same token inside the grace window', async () => {
    const session = await login();
    await refresh(session.refresh_token).expect(200);
    await refresh(session.refresh_token).expect(200);
  });

  it('revokes the family on logout', async () => {
    const session = await login();
    await http()
      .post('/api/auth/logout')
      .send({ refreshToken: session.refresh_token })
      .expect(200);
    const after = await refresh(session.refresh_token).expect(401);
    expect((after.body as ErrorBody).code).toBe('REFRESH_TOKEN_REVOKED');
    await http().post('/api/auth/logout').send({}).expect(200);
  });

  it('refuses expired tokens, tokens from another issuer and pre-3.11 tokens without a type', async () => {
    const jwt = app.get(JwtService);
    const claims = {
      sub: userId,
      email,
      role: 'Engineer',
      tenantId: world.tenantA,
    };
    const expired = jwt.sign({ ...claims, typ: 'access' }, { expiresIn: -10 });
    const foreign = jwt.sign(
      { ...claims, typ: 'access' },
      { secret: 'another-issuer-secret-0123456789abcdef' },
    );
    const untyped = jwt.sign(claims);
    await listEvents(expired).expect(401);
    await listEvents(foreign).expect(401);
    await listEvents(untyped).expect(401);
  });

  it('applies a role downgrade on the next request', async () => {
    const session = await login();
    const create = () =>
      http()
        .post('/api/v2/production-events')
        .set(bearer(session.access_token))
        .set('Idempotency-Key', randomUUID())
        .send({
          unitId: world.unitA1,
          eventType: 'ProductionLoss',
          startTime: '2026-10-05T06:00:00.000Z',
          endTime: '2026-10-05T07:00:00.000Z',
        });
    await create().expect(201);
    await harness.dataSource.query(
      `UPDATE users SET role = 'viewer' WHERE id = $1`,
      [userId],
    );
    await harness.dataSource.query(
      `UPDATE user_scopes SET role = 'viewer' WHERE user_id = $1`,
      [userId],
    );
    // the token still says Engineer; roles come from the database on every request
    const refused = await create().expect(403);
    expect((refused.body as ErrorBody).code).toBe('READ_ONLY_ROLE');
    await harness.dataSource.query(
      `UPDATE users SET role = 'Engineer' WHERE id = $1`,
      [userId],
    );
    await harness.dataSource.query(
      `UPDATE user_scopes SET role = 'production_engineer' WHERE user_id = $1`,
      [userId],
    );
  });
});
