import { RCA_POLICY_DEFAULT } from '../../src/domain/rca/rca-policy';
import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { approvedValuation } from './support/approved-valuation';
import { RcaWorld } from './support/rca-world';

interface Evaluation {
  trigger: string;
  outcome: string;
  fired_on: string;
  idempotency_key: string;
  detail: Record<string, unknown>;
}

/**
 * SME D17 money limit on real Postgres (finance sets it; pilot money limit of this world: 1,000 USD,
 * test data): with an approved valuation (policy v3, economic view by default, a 300 USD/t margin and a
 * sold-out March) the approval of period A1 fires the cost trigger of its stop once — on the approved
 * economic value, recorded with the view it compared — and the restatement of the same period
 * (PeriodRestated) does not fire it again (one key per occurrence and policy version).
 */
describe('RCA D17 cost trigger on approved valuation', () => {
  const env = new RcaWorld();
  let stop = '';
  let reason = '';

  const costEvaluations = (eventId: string) =>
    env.rows<Evaluation>(
      `SELECT "trigger", outcome::text AS outcome, fired_on::text AS fired_on, idempotency_key, detail
         FROM rca_trigger_evaluations WHERE event_id = $1 AND "trigger" = 'cost' ORDER BY fired_at`,
      [eventId],
    );

  beforeAll(async () => {
    await env.start();
    await env.unitRcaPolicy(env.world.unitA1, {
      ...RCA_POLICY_DEFAULT,
      costThreshold: 1000,
      costCurrency: 'USD',
      lostQuantityShareOfDailyPlan: null,
    });
    reason = await env.reasonCode('EXT');
    stop = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: reason,
    });
    await env.settle();
    await approvedValuation(env);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('the approval fires the money limit once on the approved economic value', async () => {
    await env.approvePeriodA1(reason);
    await env.relay();
    const [approvedTotal] = await env.rows<{ amount: string | null }>(
      `SELECT sum(a.amount)::text AS amount FROM approved_valuation_totals a
         JOIN accounting_revisions r ON r.id = a.revision_id
        WHERE r.period_id = $1 AND a.view = 'economic_impact' AND a.currency = 'USD'`,
      [env.periodA1],
    );
    expect(Number(approvedTotal.amount)).toBeGreaterThanOrEqual(1000);
    const fired = await costEvaluations(stop);
    expect(fired).toEqual([
      expect.objectContaining({
        trigger: 'cost',
        fired_on: 'approved',
        outcome: 'recommended',
      }),
    ]);
    expect(fired[0].detail).toMatchObject({
      currency: 'USD',
      threshold: 1000,
      view: 'economic_impact',
    });
    expect(fired[0].idempotency_key).toMatch(/:cost:/);
  });

  it('a restatement of the same period (PeriodRestated) does not fire it again', async () => {
    await env
      .post(`production-periods/${env.periodA1}/revise`, {
        approvedRevision: 1,
        reason: 'recheck (test data)',
      })
      .expect(201);
    await env.settle();
    await env.approvePeriodA1(reason);
    await env.relay();
    const restated = await env.rows<{ id: string }>(
      `SELECT id FROM outbox WHERE aggregate_id = $1 AND type = 'PeriodRestated'`,
      [env.periodA1],
    );
    expect(restated).toHaveLength(1);
    const deliveries = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM inbox WHERE scope = 'rca-trigger' AND type = 'PeriodRestated'`,
    );
    expect(deliveries[0].n).toBe(1);
    expect(await costEvaluations(stop)).toHaveLength(1);
  });
});
