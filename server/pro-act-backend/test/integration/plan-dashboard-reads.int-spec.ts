import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError, DAY1 } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface SummaryBody {
  periodId: string;
  workflowState: string;
  revision: { revision: number; lifecycle: string } | null;
  run: { id: string; status: string } | null;
  plan: {
    uom: string | null;
    target: string | null;
    actual: string | null;
    gap: string | null;
    attributed: string | null;
    residual: string | null;
    overAccounted: string | null;
    residualState: string;
  } | null;
  qualityStates: string[];
  productIds: string[];
}

interface WaterfallBody {
  ledger: string;
  uom: string | null;
  bars: Array<{
    key: string;
    kind: string;
    delta: string | null;
    start: string;
    end: string;
  }>;
  opening: string | null;
  closing: string | null;
  closes: boolean;
  isProvisional: boolean;
  excluded: Array<{ periodId: string; reason: string }>;
}

/**
 * Plan 3.5 backend reads on real Postgres: the period grid (`GET /period-summaries`) shows the shown
 * revision's plan figures after its saved decisions (T15: gap 150, attributed 140, residual 10 →
 * `unaccounted`), workflow state and run, filters by workflow state, is unit-scoped and refuses foreign
 * units; the waterfall (`GET /reports/waterfall`) closes exactly to actual on both ledgers (the v1 Plan
 * Dashboard routes are retired).
 */
describe('plan dashboard reads (plan 3.5)', () => {
  const env = new ReconciliationWorld();
  const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
  let reason = '';

  const summaries = async (query: string, token = env.admin) =>
    (
      (await env.get(`period-summaries?${query}`, token).expect(200)).body as {
        items: SummaryBody[];
      }
    ).items;
  const waterfall = async (query: string) =>
    (await env.get(`reports/waterfall?${query}`).expect(200))
      .body as WaterfallBody;

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    const view = await env.view(env.periodA1);
    await env
      .saveLines(view, [
        { action: 'accept', autoKey: view.candidates[0].autoKey },
        {
          action: 'manual',
          sliceId: view.slices[0].sliceId,
          kind: 'availability',
          quantity: '15',
          missingEvent: true,
          // SME R11: a stop without an event cites its record
          evidenceType: 'log',
          evidenceRef: 'shift log',
          reasonCodeId: reason,
        },
      ])
      .expect(200);
  });
  afterAll(() => env.stop());

  it('grid rows carry the reconciled plan figures, workflow state and run of each period (T15)', async () => {
    const rows = await summaries(`unitIds=${env.world.unitA1}&${window}`);
    expect(rows.map((r) => r.periodId)).toEqual([
      env.periodA1,
      env.periodB1,
      env.periodC1,
    ]);
    const a = rows[0];
    expect(a.workflowState).toBe('draft');
    expect(a.run?.status).toBeDefined();
    expect(a.plan).toMatchObject({
      uom: 't',
      target: '1000',
      actual: '850',
      gap: '150',
      attributed: '140',
      residual: '10',
      residualState: 'unaccounted',
    });
    expect(a.productIds).toHaveLength(1);
    expect(rows[1].plan).toMatchObject({
      gap: '150',
      attributed: '0',
      residual: '150',
    });
  });

  it('filters by workflow state; the approved view shows only published revisions', async () => {
    const drafts = await summaries(
      `unitIds=${env.world.unitA1}&${window}&workflowState=draft`,
    );
    expect(drafts).toHaveLength(3);
    expect(
      await summaries(
        `unitIds=${env.world.unitA1}&${window}&workflowState=approved`,
      ),
    ).toHaveLength(0);
    const approvedView = await summaries(
      `unitIds=${env.world.unitA1}&${window}&view=approved`,
    );
    expect(
      approvedView.every((r) => r.revision === null && r.plan === null),
    ).toBe(true);
  });

  it('refuses units of another tenant (422) and tenantId in the query (400)', async () => {
    const foreign = await env
      .get(`period-summaries?unitIds=${env.world.unitB1}&${window}`)
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
    await env.get(`period-summaries?tenantId=${env.world.tenantA}`).expect(400);
    expect(await summaries(`${window}`, env.adminB)).toEqual([]);
  });

  it('plan waterfall: target → availability → unaccounted → actual, closing exactly', async () => {
    const body = await waterfall(`periodIds=${env.periodA1}&ledger=plan`);
    expect(body).toMatchObject({
      ledger: 'plan',
      uom: 't',
      opening: '1000',
      closing: '850',
      closes: true,
      isProvisional: true,
    });
    expect(body.bars.map((b) => [b.key, b.delta ?? b.end])).toEqual([
      ['target', '1000'],
      ['availability', '-140'],
      ['unaccounted', '-10'],
      ['actual', '850'],
    ]);
    expect(body.bars[2]).toMatchObject({ start: '860', end: '850' });
  });

  it('capacity waterfall closes to good; several periods are summed by the server', async () => {
    const one = await waterfall(`periodIds=${env.periodA1}&ledger=capacity`);
    expect(one.closes).toBe(true);
    expect(one.closing).toBe('850');
    const three = await waterfall(
      `periodIds=${env.periodA1}&periodIds=${env.periodB1}&periodIds=${env.periodC1}&ledger=plan`,
    );
    expect(three).toMatchObject({
      opening: '3000',
      closing: '2550',
      closes: true,
    });
    const unaccounted = three.bars.find((b) => b.key === 'unaccounted');
    expect(unaccounted?.delta).toBe('-310');
  });

  it('waterfall refuses periods of another tenant (422 INVALID_REFERENCE)', async () => {
    const response = await env
      .get(`reports/waterfall?periodIds=${env.periodA1}`, env.adminB)
      .expect(422);
    expect((response.body as ApiError).code).toBe('INVALID_REFERENCE');
  });
});
