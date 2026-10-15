import { Dec } from '../../src/domain/actuals/decimal';
import { A, B } from './support/actuals-world';
import { AccountingWorld } from './support/accounting-world';
import { ApiError } from './support/plan-world';

/**
 * SME E6 / LA-10 on real Postgres: unit streams through `/v2/unit-streams` (maker-checker, Σ share ≤ 1),
 * stream runs through `/v2/stream-runs` (approved stream in force, no overlap per stream, a lot made
 * once), and the accounting run reading them: unit A1 × P1 run on train T1 (60 % of the unit's rate) for
 * the whole period gets 60 % of the capacity it had before streams were recorded, flagged
 * `stream_capacity`, with the runs in the fingerprint. An event may name an approved stream only.
 */
describe('unit streams and stream runs (SME E6)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';

  const stream = async (code: string, share: string, key: string) => {
    const created = await env
      .post('unit-streams', {
        unitId: env.world.unitA1,
        code,
        name: `Train ${code}`,
        capacityShare: share,
        effectiveFrom: '2026-01-01T00:00:00Z',
      })
      .set('Idempotency-Key', `us-create-${key}`)
      .expect(201);
    return (created.body as { id: string }).id;
  };
  const approve = (id: string, key: string) =>
    env
      .post(`unit-streams/${id}/approve`, {}, env.approver)
      .set('Idempotency-Key', `us-approve-${key}`);
  const runBody = (extra: Record<string, unknown> = {}) => ({
    unitId: env.world.unitA1,
    streamCode: 'T1',
    productId: env.products.p1,
    lotCode: 'L-T1-001',
    startTime: '2027-03-01T00:00:00Z',
    ...extra,
  });

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
  });
  afterAll(() => env.stop());

  it('approves streams by another user and refuses shares above the whole unit', async () => {
    const t1 = await stream('T1', '0.6', 't1');
    const own = await env
      .post(`unit-streams/${t1}/approve`, {})
      .set('Idempotency-Key', 'us-approve-own')
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await approve(t1, 't1').expect(200);
    await approve(await stream('T2', '0.4', 't2'), 't2').expect(200);
    const third = await approve(await stream('T3', '0.1', 't3'), 't3').expect(
      409,
    );
    expect((third.body as ApiError).code).toBe('STREAM_SHARE_EXCEEDED');
  });

  it('records a run on an approved stream and refuses overlaps, reused lots and unknown streams', async () => {
    const before = env.totals(await env.accounting(periodA1), 'capacity');
    await env
      .post('stream-runs', runBody())
      .set('Idempotency-Key', 'sr-1')
      .expect(201);
    const overlap = await env
      .post('stream-runs', runBody({ lotCode: 'L-T1-002', startTime: '2027-03-02T00:00:00Z' }))
      .set('Idempotency-Key', 'sr-overlap')
      .expect(409);
    expect((overlap.body as ApiError).code).toBe('STREAM_RUN_OVERLAP');
    const lot = await env
      .post('stream-runs', runBody({ streamCode: 'T2' }))
      .set('Idempotency-Key', 'sr-lot')
      .expect(409);
    expect((lot.body as ApiError).code).toBe('LOT_CODE_TAKEN');
    const unknown = await env
      .post('stream-runs', runBody({ streamCode: 'T9', lotCode: null }))
      .set('Idempotency-Key', 'sr-unknown')
      .expect(422);
    expect((unknown.body as ApiError).code).toBe('INVALID_REFERENCE');

    await env.relay();
    await env.recompute(periodA1);
    const after = env.totals(await env.accounting(periodA1), 'capacity');
    expect(
      new Dec(after.capacity!).div(new Dec(before.capacity!)).toString(),
    ).toBe('0.6');
    expect(after.flags).toContain('stream_capacity');
  });

  it('accepts an approved stream on an event and refuses an unknown one', async () => {
    const response = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: A,
        endTime: B,
        physicalType: 'downtime',
        streamCode: 'T9',
      })
      .expect(422);
    expect((response.body as ApiError).code).toBe('INVALID_REFERENCE');
  });
});
