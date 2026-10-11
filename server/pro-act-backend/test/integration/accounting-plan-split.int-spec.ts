import { A, B, HOUR, MINUTE } from './support/actuals-world';
import {
  AccountingBody,
  AccountingWorld,
  LineBody,
  plus,
  TotalsBody,
} from './support/accounting-world';
import { DAY1, DAY2 } from './support/plan-world';

type SliceLine = LineBody & { sliceId: string; flags: string[] };

/**
 * PS01 on Postgres: shift A of unit A1 is planned by two approved plans meeting at 06:30 UTC (two plan
 * slices of one product). The shift output event (gross 640, rejects 8) is apportioned by time; a stop
 * and a micro-stop fall in the first slice, a quality event (8 t) in the second. Before engine 2.5.1
 * each slice was checked alone and the run failed with IMPOSSIBLE_CLAIM.
 */
describe('loss accounting: a period split across two plan versions', () => {
  const env = new AccountingWorld();
  const MID = plus(A, 4 * HOUR);
  let periodId = '';
  let qualityId = '';
  let microId = '';
  let body: AccountingBody;
  let slices: Array<{ id: string; window_from: Date }> = [];

  beforeAll(async () => {
    await env.start();
    const unit = env.world.unitA1;
    await env.approvedPlan(unit, { validFrom: DAY1, validTo: MID });
    await env.approvedPlan(unit, {
      name: 'HDPE plan v2',
      validFrom: MID,
      validTo: DAY2,
    });
    await env.materialize([unit]);
    periodId = await env.periodId(unit, A);
    const output = await env.outputEvent(unit, A, B, '640');
    await env.rows(
      `UPDATE production_events SET defective_quantity = 8 WHERE id = $1`,
      [output],
    );
    await env.lossEvent(unit, plus(A, HOUR), 2);
    const microStart = plus(A, 30 * MINUTE);
    microId = await env.lossEvent(unit, microStart, 0, {
      endTime: plus(microStart, 30_000),
    });
    qualityId = await env.lossEvent(unit, plus(A, 5 * HOUR), 0.25, {
      physicalType: 'quality_loss',
      quantity: '8',
      quantityUom: 't',
    });
    await env.settle();
    body = await env.accounting(periodId);
    slices = await env.rows(
      `SELECT id, window_from FROM period_product_slices
        WHERE period_id = $1 AND superseded_at IS NULL ORDER BY window_from`,
      [periodId],
    );
  });
  afterAll(() => env.stop());

  const totals = (sliceIndex: number, ledger: 'capacity' | 'plan') =>
    body.data.totals.find(
      (t: TotalsBody) =>
        t.sliceId === slices[sliceIndex].id && t.ledger === ledger,
    );
  const causeLines = (eventId: string, ledger: string) =>
    (body.data.lines as SliceLine[]).filter(
      (l) => l.causeEventId === eventId && l.ledger === ledger,
    );

  it('the period has two plan slices and the run validates', async () => {
    expect(slices).toHaveLength(2);
    expect(new Date(slices[1].window_from).toISOString()).toBe(MID);
    const [latest] = await env.runs(periodId);
    expect(latest).toMatchObject({ status: 'validated', error: null });
    expect(body.data.run?.id).toBe(latest.id);
  });

  it('capacity totals per slice: the stop lowers slice 1, quality is gross − good of each slice', () => {
    expect(totals(0, 'capacity')).toMatchObject({
      capacity: '400',
      availability: '200',
      performance: '0',
      gain: '120',
      quality: '4',
      good: '316',
      residual: '0',
    });
    expect(totals(1, 'capacity')).toMatchObject({
      capacity: '400',
      availability: '0',
      performance: '80',
      quality: '4',
      good: '316',
      residual: '0',
    });
  });

  it('the quality event is shared 4 / 4 and the micro-stop claims slice 2 performance', () => {
    const quality = causeLines(qualityId, 'capacity');
    expect(quality.map((l) => [l.sliceId, l.quantity]).sort()).toEqual(
      [
        [slices[0].id, '4'],
        [slices[1].id, '4'],
      ].sort(),
    );
    expect(quality.every((l) => l.flags.includes('product_run_share'))).toBe(
      true,
    );
    const micro = causeLines(microId, 'capacity');
    expect(micro).toHaveLength(1);
    expect(micro[0]).toMatchObject({
      sliceId: slices[1].id,
      kind: 'performance',
      quantity: '0.83333333',
    });
  });
});
