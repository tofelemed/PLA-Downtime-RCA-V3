import { randomUUID } from 'crypto';
import { DAY1, DAY2, PlanWorld } from './support/plan-world';
import { bearer } from './support/test-app';

describe('legacy plan validation before persistence', () => {
  const env = new PlanWorld();
  beforeAll(() => env.start());
  afterAll(() => env.stop());

  const valid = () => ({
    name: `legacy validation ${randomUUID()}`,
    unitId: env.world.unitA1,
    productId: env.products.p1,
    startDate: DAY1,
    endDate: DAY2,
    plannedQuantity: 900,
  });

  it.each(['name', 'unitId', 'startDate', 'endDate'] as const)(
    'refuses a missing %s without saving a header',
    async (field) => {
      const payload: Record<string, unknown> = valid();
      delete payload[field];
      await env
        .http()
        .post('/api/production-plans')
        .set(bearer(env.admin))
        .send(payload)
        .expect(400);
      expect(await env.rows('SELECT id FROM production_plans')).toEqual([]);
    },
  );

  it.each([
    { unitId: 'invalid-uuid' },
    { startDate: 'invalid-date', endDate: 'invalid-date' },
    { plannedQuantity: 'invalid-number' },
  ])('refuses malformed input %j without saving', async (patch) => {
    await env
      .http()
      .post('/api/production-plans')
      .set(bearer(env.admin))
      .send({ ...valid(), ...patch })
      .expect(400);
    expect(await env.rows('SELECT id FROM production_plans')).toEqual([]);
  });

  it('refuses a reversed create range before any header or version exists', async () => {
    const response = await env
      .http()
      .post('/api/production-plans')
      .set(bearer(env.admin))
      .send({ ...valid(), startDate: DAY2, endDate: DAY1 });
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 422,
      body: { code: 'INVALID_DATE_RANGE' },
    });
    expect(await env.rows('SELECT id FROM production_plans')).toEqual([]);
    expect(await env.rows('SELECT id FROM plan_versions')).toEqual([]);
  });

  it.each([
    { endDate: '2027-02-28T02:30:00Z' },
    { startDate: '2027-03-03T02:30:00Z' },
  ])(
    'refuses a reversed partial update %j without changing rows',
    async (patch) => {
      const created = await env
        .http()
        .post('/api/production-plans')
        .set(bearer(env.admin))
        .send(valid())
        .expect(201);
      const id = (created.body as { id: string }).id;
      const snapshot = async () => ({
        headers: await env.rows(
          'SELECT * FROM production_plans WHERE id = $1',
          [id],
        ),
        versions: await env.rows(
          'SELECT * FROM plan_versions WHERE plan_id = $1',
          [id],
        ),
      });
      const before = await snapshot();
      const response = await env
        .http()
        .put(`/api/production-plans/${id}`)
        .set(bearer(env.admin))
        .send(patch);
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({
        status: 422,
        body: { code: 'INVALID_DATE_RANGE' },
      });
      expect(await snapshot()).toEqual(before);
      await env
        .http()
        .delete(`/api/production-plans/${id}`)
        .set(bearer(env.admin))
        .expect(200);
    },
  );

  it('preserves the legacy equal-endpoint header contract', async () => {
    const created = await env
      .http()
      .post('/api/production-plans')
      .set(bearer(env.admin))
      .send({ ...valid(), endDate: DAY1 })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await env
      .http()
      .delete(`/api/production-plans/${id}`)
      .set(bearer(env.admin))
      .expect(200);
  });

  it('returns 404 for missing get, update and delete targets', async () => {
    const target = `/api/production-plans/${randomUUID()}`;
    await env.http().get(target).set(bearer(env.admin)).expect(404);
    await env
      .http()
      .put(target)
      .set(bearer(env.admin))
      .send({ name: 'missing target' })
      .expect(404);
    await env.http().delete(target).set(bearer(env.admin)).expect(404);
  });
});
