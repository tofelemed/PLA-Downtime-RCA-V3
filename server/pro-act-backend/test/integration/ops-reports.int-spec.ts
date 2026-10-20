import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { DAY1 } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface Envelope<T> {
  data: T;
  isProvisional: boolean;
  coverage: { ratio: number };
}

interface ProductionBody {
  groupBy: string;
  rows: Array<{
    key: string;
    productId: string | null;
    uom: string | null;
    capacity: string | null;
    target: string | null;
    actual: string | null;
    gross: string | null;
    good: string | null;
    prime: string | null;
    primeYield: string | null;
    planAttainment: string | null;
    slices: number;
    completeSlices: number;
  }>;
  calculationRunIds: string[];
}

interface EventStatusBody {
  rows: Array<{
    physicalType: string;
    events: number;
    open: number;
    uncoded: number;
    coded: number;
    verified: number;
    seconds: string;
  }>;
}

/**
 * Persona reports R1 (`plans/REPORTS_R1_R12.md`) on real Postgres, in the 2.8 world: unit A1, three
 * 1000 t shifts producing 850 t each and a 1 h stop in shift A. Production by product sums the shown
 * runs' plan ledger and actuals and divides the sums; event status counts the window's live events.
 */
describe('Operating reports (R1)', () => {
  const env = new ReconciliationWorld();
  const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
  let scope = '';

  beforeAll(async () => {
    await env.start();
    scope = `unitIds=${env.world.unitA1}&${window}`;
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: await env.reasonCode('FEED'),
    });
    await env.settle();
  });
  afterAll(() => env.stop());

  it('production by product: plan target, actual and attainment of the window, one row per product', async () => {
    const body = (
      await env.get(`reports/production-by-product?${scope}`).expect(200)
    ).body as Envelope<ProductionBody>;
    expect(body.data.groupBy).toBe('total');
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0]).toMatchObject({
      key: 'total',
      uom: 't',
      target: '3000',
      actual: '2550',
      planAttainment: '0.85',
      slices: 3,
    });
    expect(body.data.calculationRunIds).toHaveLength(3);
    expect(body.isProvisional).toBe(true);
  });

  it('production by product per day keeps the same sums', async () => {
    const body = (
      await env
        .get(`reports/production-by-product?${scope}&groupBy=day`)
        .expect(200)
    ).body as Envelope<ProductionBody>;
    const total = body.data.rows.reduce(
      (sum, row) => sum + Number(row.actual ?? 0),
      0,
    );
    expect(total).toBe(2550);
  });

  it('event status: the 1 h stop, ended, with its seconds', async () => {
    const body = (await env.get(`reports/event-status?${scope}`).expect(200))
      .body as EventStatusBody;
    const downtime = body.rows.find((r) => r.physicalType === 'downtime');
    expect(downtime).toMatchObject({ events: 1, open: 0, seconds: '3600' });
    expect((downtime?.coded ?? 0) + (downtime?.uncoded ?? 0)).toBe(1);
  });

  it('rejects an unknown groupBy (422)', async () => {
    await env
      .get(`reports/production-by-product?${scope}&groupBy=shift`)
      .expect(422);
  });
});
