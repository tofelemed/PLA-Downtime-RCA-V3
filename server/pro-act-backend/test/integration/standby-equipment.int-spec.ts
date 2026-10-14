import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface Fraction {
  numerator: number;
  denominator: number;
  value: number | null;
  reason: string | null;
}

interface MetricsRow {
  assetId: string;
  demands: number;
  failedStarts: number;
  failureOnDemand: Fraction;
  tests: number;
  runningSeconds: number;
  operatingMtbf: Fraction;
}

const day = (n: number, hour = 0) =>
  new Date(Date.UTC(2026, 0, 1 + n, hour)).toISOString();

/**
 * SME D9 on real Postgres: a spare pump registered as standby, its demand / test / running log imported
 * (by asset code, idempotent on the log's own ref), and the measures: failure on demand = failed starts /
 * demands, tests apart, operating MTBF on its own running hours — null with the exposure when it never
 * failed while running. Tenant B sees nothing.
 */
describe('standby equipment (SME D9)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let admin = '';
  let adminB = '';
  let assetCode = '';

  const http = () => request(app.getHttpServer());
  const post = (path: string, body: object, token = admin) =>
    http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    adminB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    const [asset] = await harness.dataSource.query<Array<{ code: string }>>(
      `SELECT "code" FROM "assets" WHERE "id" = $1`,
      [world.assetA1],
    );
    assetCode = asset.code;
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('registers the asset once', async () => {
    await post('standby-equipment', {
      assetId: world.assetA1,
      evaluation: 'demand_and_running',
      effectiveFrom: day(0),
    }).expect(201);
    const again = await post('standby-equipment', {
      assetId: world.assetA1,
      evaluation: 'demand',
    }).expect(409);
    expect((again.body as { code: string }).code).toBe(
      'STANDBY_ALREADY_REGISTERED',
    );
  });

  it('imports the log all or nothing; a re-import of a ref replaces the entry', async () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      assetCode,
      kind: 'demand',
      startedAt: day(i * 10, 6),
      outcome: i === 7 ? 'failed_start' : 'success',
      externalRef: `DEM-${i}`,
    }));
    const runs = [0, 1, 2, 3, 4].map((i) => ({
      assetId: world.assetA1,
      kind: 'run',
      startedAt: day(i * 10, 6),
      endedAt: day(i * 10, 16),
      outcome: 'success',
      externalRef: `RUN-${i}`,
    }));
    const bad = await post('standby-records/import', {
      records: [{ ...runs[0], outcome: 'failed_start' }],
    }).expect(422);
    expect((bad.body as { code: string }).code).toBe('STANDBY_IMPORT_INVALID');
    const first = await post('standby-records/import', {
      records: [
        ...records,
        ...runs,
        {
          assetId: world.assetA1,
          kind: 'test',
          startedAt: day(3, 9),
          outcome: 'success',
        },
      ],
    }).expect(200);
    expect(first.body).toEqual({ total: 26, created: 26, updated: 0 });
    const again = await post('standby-records/import', {
      records: [records[7]],
    }).expect(200);
    expect(again.body).toEqual({ total: 1, created: 0, updated: 1 });
  });

  it('reports failure on demand, tests apart and exposure with no running failure', async () => {
    const response = await http()
      .get(`/api/v2/standby-equipment/metrics?from=${day(0)}&to=${day(365)}`)
      .set(bearer(admin))
      .expect(200);
    const [row] = response.body as MetricsRow[];
    expect(row).toMatchObject({
      assetId: world.assetA1,
      demands: 20,
      failedStarts: 1,
      tests: 1,
      runningSeconds: 50 * 3600,
    });
    expect(row.failureOnDemand.value).toBe(0.05);
    expect(row.operatingMtbf).toEqual({
      numerator: 50 * 3600,
      denominator: 0,
      value: null,
      reason: 'no_failures',
    });
    const other = await http()
      .get(`/api/v2/standby-equipment/metrics?from=${day(0)}&to=${day(365)}`)
      .set(bearer(adminB))
      .expect(200);
    expect(other.body).toEqual([]);
    await http()
      .get(`/api/v2/standby-equipment/metrics?from=${day(2)}&to=${day(1)}`)
      .set(bearer(admin))
      .expect(422);
  });

  it('lists the log by window', async () => {
    const page = await http()
      .get(
        `/api/v2/standby-records?assetIds=${world.assetA1}&from=${day(0)}&to=${day(5)}`,
      )
      .set(bearer(admin))
      .expect(200);
    expect(
      (page.body as { items: Array<{ kind: string }> }).items
        .map((r) => r.kind)
        .sort(),
    ).toEqual(['demand', 'run', 'test']);
  });
});
