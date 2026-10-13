import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

/**
 * LA-06 (SME Q8) on real Postgres: a production record spanning shifts A and B is split by the unit's
 * running time, not clock time — a 2 h stop in A leaves A 2 running hours and B 4, so 800 t → 266.67 / 533.33.
 */
describe('spanning output split by running time (LA-06)', () => {
  const env = new AccountingWorld();

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    await env.outputEvent(
      env.world.unitA1,
      plus(A, 4 * HOUR),
      plus(B, 4 * HOUR),
      '800',
    );
    await env.lossEvent(env.world.unitA1, plus(A, 4 * HOUR), 2);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('books each shift its share of the running time and records the method', async () => {
    const grossOf = async (start: string) => {
      const detail = await env.detail(
        await env.periodId(env.world.unitA1, start),
      );
      return detail.data.slices[0].actuals;
    };
    const a = await grossOf(A);
    const b = await grossOf(B);
    expect(a).toMatchObject({
      gross: '266.66666667',
      estimatedQty: '266.66666667',
    });
    expect(b?.gross).toBe('533.33333333');
  });
});
