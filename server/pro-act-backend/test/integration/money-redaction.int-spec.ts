import { HOUR, NEXT_DAY, A } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError, DAY1 } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

type Body = Record<string, unknown>;

/**
 * QA re-test decision 2026-10-19 ("Money is withheld on the server for operators") on real Postgres:
 * an operator's token gets the same reads without money fields, and 403 MONEY_NOT_VISIBLE where the
 * request asks for nothing but money; a finance approver gets the figures.
 */
describe('money redaction for callers without the money capability', () => {
  const env = new ReconciliationWorld();
  const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
  let eventId = '';
  let operator = '';
  let finance = '';

  beforeAll(async () => {
    await env.start();
    eventId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    operator = await env.scopedUser('operator');
    finance = await env.scopedUser('finance_approver');
  });
  afterAll(() => env.stop());

  it('attributed losses: quantities for the operator, values and their basis for finance', async () => {
    const path = `production-events/${eventId}/attributed-losses`;
    const own = (await env.get(path, operator).expect(200)).body as Body;
    const items = own.items as Body[];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].quantities).toEqual(expect.any(Array));
    expect(items[0]).not.toHaveProperty('values');
    expect(own).not.toHaveProperty('valuationView');
    const full = (await env.get(path, finance).expect(200)).body as Body;
    expect(full).toHaveProperty('valuationView');
    expect((full.items as Body[])[0]).toHaveProperty('values');
  });

  it('events: the recorded cost is left out for the operator only', async () => {
    const own = (
      await env.get(`production-events/${eventId}`, operator).expect(200)
    ).body as Body;
    expect(own).not.toHaveProperty('cost');
    expect(own).toHaveProperty('quantity');
    const full = (
      await env.get(`production-events/${eventId}`, finance).expect(200)
    ).body as Body;
    expect(full).toHaveProperty('cost');
  });

  it('a value metric of the loss tree and the loss value report are refused to the operator', async () => {
    const tree = `reports/loss-tree?unitIds=${env.world.unitA1}&${window}&groupBy=reason&ledger=plan`;
    const refused = await env.get(`${tree}&metric=value`, operator).expect(403);
    expect((refused.body as ApiError).code).toBe('MONEY_NOT_VISIBLE');
    await env.get(`${tree}&metric=qty`, operator).expect(200);
    await env.get(`${tree}&metric=value`, finance).expect(200);
    const value = `reports/loss-value?${window}&unitIds=${env.world.unitA1}`;
    expect(
      ((await env.get(value, operator).expect(403)).body as ApiError).code,
    ).toBe('MONEY_NOT_VISIBLE');
    await env.get(value, finance).expect(200);
  });

  it('finance records are money: FX rates and valuation policies are refused to the operator', async () => {
    expect(
      ((await env.get('fx-rates', operator).expect(403)).body as ApiError).code,
    ).toBe('MONEY_NOT_VISIBLE');
    expect(
      (
        (await env.get('valuation-policies', operator).expect(403))
          .body as ApiError
      ).code,
    ).toBe('MONEY_NOT_VISIBLE');
    await env.get('fx-rates', finance).expect(200);
  });

  it('the reconciliation view keeps quantities and leaves out the approved valuation for the operator', async () => {
    const own = (
      await env
        .get(`production-periods/${env.periodA1}/reconciliation`, operator)
        .expect(200)
    ).body as Body;
    expect(own).not.toHaveProperty('approvedValuation');
    expect(own.lines).toEqual(expect.any(Array));
    const full = (
      await env
        .get(`production-periods/${env.periodA1}/reconciliation`, finance)
        .expect(200)
    ).body as Body;
    expect(full).toHaveProperty('approvedValuation');
  });
});
