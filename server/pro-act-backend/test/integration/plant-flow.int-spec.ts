import { Dec } from '../../src/domain/actuals/decimal';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, LineBody, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

type Line = LineBody & { flags: string[] };

/**
 * SME E2 on real Postgres: unit A2 feeds A1 through 100 t of usable buffer drawn at 100 t/h (1 h of
 * cover; A1 runs at 100 t/h). A 3 h stop of A2 starves A1 for 2 h: 200 t of A1 availability loss charged
 * to the A2 stop (`upstream_starvation`, origin A2). The map refuses a cycle and a buffer level in
 * another unit; the site-loss report counts A1 (the boundary) and keeps A2 as an upstream unit.
 */
describe('plant flow and buffers (SME E2)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  let stopId = '';

  const route = async (from: string, to: string, key: string, extra = {}) => {
    const created = await env
      .post('flow-routes', {
        fromUnitId: from,
        toUnitId: to,
        bufferName: 'Silo S-1',
        usableInventory: '100',
        inventoryUom: 't',
        drawRatePerHour: '100',
        effectiveFrom: '2026-01-01T00:00:00Z',
        ...extra,
      })
      .set('Idempotency-Key', `fr-create-${key}`)
      .expect(201);
    return (created.body as { id: string }).id;
  };
  const approve = (id: string, key: string) =>
    env
      .post(`flow-routes/${id}/approve`, {}, env.approver)
      .set('Idempotency-Key', `fr-approve-${key}`);

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '500');
  });
  afterAll(() => env.stop());

  it('approves a route by another user and refuses a cycle and an incomplete buffer', async () => {
    await approve(
      await route(env.world.unitA2, env.world.unitA1, 'a2a1'),
      'a2a1',
    ).expect(200);
    const back = await approve(
      await route(env.world.unitA1, env.world.unitA2, 'a1a2', {
        usableInventory: null,
        inventoryUom: null,
        drawRatePerHour: null,
      }),
      'a1a2',
    ).expect(422);
    expect((back.body as ApiError).code).toBe('FLOW_CYCLE');
    const incomplete = await env
      .post('flow-routes', {
        fromUnitId: env.world.unitA3,
        toUnitId: env.world.unitA1,
        usableInventory: '50',
        effectiveFrom: '2026-01-01T00:00:00Z',
      })
      .set('Idempotency-Key', 'fr-incomplete')
      .expect(422);
    expect((incomplete.body as ApiError).code).toBe('BUFFER_INCOMPLETE');
  });

  it('refuses a buffer level in another unit than the buffer', async () => {
    const response = await env
      .post('buffer-levels', {
        fromUnitId: env.world.unitA2,
        toUnitId: env.world.unitA1,
        observedAt: A,
        level: '80',
        uom: 'm3',
      })
      .set('Idempotency-Key', 'bl-uom')
      .expect(422);
    expect((response.body as ApiError).code).toBe('UOM_MISMATCH');
  });

  it('a 3 h upstream stop starves A1 for 2 h after 1 h of cover: 200 t charged to the upstream stop', async () => {
    stopId = await env.lossEvent(env.world.unitA2, plus(A, HOUR), 3, {
      description: 'test reactor trip',
    });
    await env.relay();
    await env.recompute(periodA1);
    const lines = (
      (await env.accounting(periodA1)).data.lines as Line[]
    ).filter(
      (l) => l.ledger === 'capacity' && l.flags.includes('upstream_starvation'),
    );
    const total = lines.reduce((s, l) => s.plus(l.quantity), new Dec(0));
    expect(total.toString()).toBe('200');
    expect(lines.every((l) => l.causeEventId === stopId)).toBe(true);
    expect(lines[0].flags).toContain(`origin_unit:${env.world.unitA2}`);
  });

  it('consolidates at the site boundary: A1 counts, A2 is upstream', async () => {
    const response = await env
      .get(`reports/site-loss?from=${A}&to=${B}&ledger=capacity`)
      .expect(200);
    const data = (
      response.body as {
        data: {
          boundaryUnitIds: string[];
          byOrigin: Array<{ originUnitId: string; quantity: string }>;
        };
      }
    ).data;
    expect(data.boundaryUnitIds).toContain(env.world.unitA1);
    const fromA2 = data.byOrigin.find(
      (o) => o.originUnitId === env.world.unitA2,
    );
    expect(fromA2?.quantity).toBe('200');
  });
});
