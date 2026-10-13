import { DataSource } from 'typeorm';
import { approvedImpact } from '../../src/rca-case/approved-impact';
import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { DAY1 } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface TreeBody {
  data: { groups: Array<{ key: string | null; amount: string | null }> };
}

/**
 * VA-01b on real Postgres: after approval, the plan-ledger loss tree and the RCA approved impact read the
 * approved lines — a rejected stop candidate contributes nothing, the manual line that replaced it shows
 * under its own reason with its own quantity.
 */
describe('approved ledger lines feed the loss tree and RCA impact (VA-01b)', () => {
  const env = new ReconciliationWorld();
  let stopId = '';
  let feed = '';
  let power = '';

  beforeAll(async () => {
    await env.start();
    feed = await env.reasonCode('FEED');
    power = await env.reasonCode('POWER');
    stopId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: feed,
    });
    await env.settle();
    const view = await env.view();
    const candidate = view.candidates.find((c) => c.causeEventId === stopId)!;
    await env
      .saveLines(view, [
        {
          action: 'reject',
          autoKey: candidate.autoKey,
          reason: 'the feed stop was booked on the wrong unit',
        },
        {
          action: 'manual',
          sliceId: view.slices[0].sliceId,
          kind: 'availability',
          quantity: '150',
          missingEvent: true,
          reasonCodeId: power,
        },
      ])
      .expect(200);
    await env.submit(await env.view()).expect(200);
    await env.approve(await env.view()).expect(200);
  });
  afterAll(() => env.stop());

  it('the plan loss tree shows the approved lines only', async () => {
    const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
    const tree = (
      await env
        .get(
          `reports/loss-tree?unitIds=${env.world.unitA1}&${window}&groupBy=reason&metric=qty&ledger=plan`,
        )
        .expect(200)
    ).body as TreeBody;
    const amountOf = (key: string) =>
      tree.data.groups.find((g) => g.key === key)?.amount ?? null;
    expect(amountOf(power)).toBe('150');
    expect(amountOf(feed)).toBeNull();
  });

  it('the RCA approved impact of the rejected stop is empty', async () => {
    const impact = await approvedImpact(
      env.app.get(DataSource).manager,
      env.world.tenantA,
      { eventIds: [stopId] },
    );
    expect(impact.lines).toBe(0);
  });
});
