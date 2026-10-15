import { amountOf, ValuationWorld, viewOf } from './support/valuation-world';

interface FxBody {
  id: string;
  provisional: boolean;
  state: string;
  revaluation?: { status: string; from: string; to: string | null } | null;
}

interface CurrencyBody {
  currency: string;
  amount: string | null;
  status: string;
  fxProvisional: boolean;
  reasons?: string[];
}

const codeOf = (response: { body: unknown }) =>
  (response.body as { code: string }).code;

const WINDOW = 'from=2027-03-01T00:00:00Z&to=2027-03-02T00:00:00Z';
const MARCH = {
  fromCurrency: 'USD',
  toCurrency: 'IRR',
  effectiveFrom: '2027-03-01T00:00:00Z',
  effectiveTo: '2027-04-01T00:00:00Z',
};

/**
 * SME V7 provisional FX rates on real Postgres (V7 worked example, hypothetical rates, test data): the
 * stop's 100 t lose 30 million IRR of contribution; without a USD rate the USD value is not valued; finance
 * authors and authorises a provisional 600,000 IRR/USD for March, and every figure it converts ($50) is
 * marked provisional — line values, totals, the loss-value report, the loss tree and the approved ledger.
 * The final 625,000 IRR/USD rate revalues the open figures automatically (no mark, $48) and proposes the
 * change for the approved period (never an overwrite). Never an unapproved rate.
 */
describe('provisional FX rates (SME V7)', () => {
  const env = new ValuationWorld();
  let provisionalId = '';

  beforeAll(async () => {
    await env.start();
    const [slice] = await env.rows<{ product_id: string }>(
      `SELECT product_id FROM period_product_slices WHERE period_id = $1 AND superseded_at IS NULL`,
      [env.periodA1],
    );
    const [seeded] = (
      (await env.get('valuation-policies').expect(200)).body as {
        items: Array<{ id: string }>;
      }
    ).items;
    await env
      .post(`valuation-policies/${seeded.id}/approve`, {}, env.financeApprover)
      .expect(200);
    await env.valuationRate({
      profileId: env.profileId,
      basis: 'contribution_margin',
      value: '300000',
      currency: 'IRR',
    });
    const demand = await env
      .post(
        'demand-statuses',
        {
          productId: slice.product_id,
          status: 'demand_constrained',
          evidence: 'Order book exceeds output for March (test data)',
          effectiveFrom: '2027-03-01T00:00:00Z',
          effectiveTo: '2027-04-01T00:00:00Z',
        },
        env.finance,
      )
      .expect(201);
    await env
      .post(
        `demand-statuses/${(demand.body as { id: string }).id}/approve`,
        {},
        env.financeApprover,
      )
      .expect(200);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('without a rate the USD value is not valued; a provisional rate needs a window and a finance approver ≠ author', async () => {
    const before = viewOf(env.stopLine(await env.valued()), 'economic_impact');
    expect(amountOf(before, 'IRR').amount).toBe('30000000');
    expect(amountOf(before, 'USD')).toMatchObject({
      amount: null,
      reason: 'fx_rate_missing',
    });
    const open = { ...MARCH, effectiveTo: undefined };
    const unbounded = await env
      .post(
        'fx-rates',
        { ...open, rate: '600000', provisional: true },
        env.finance,
      )
      .expect(422);
    expect(codeOf(unbounded)).toBe('PROVISIONAL_RATE_UNBOUNDED');
    const body = {
      ...MARCH,
      rate: '600000',
      provisional: true,
      source: 'treasury estimate (test data)',
    };
    await env.post('fx-rates', body, env.admin).expect(403);
    const created = await env
      .post('fx-rates', body, env.financeDual)
      .expect(201);
    provisionalId = (created.body as FxBody).id;
    expect(created.body).toMatchObject({ provisional: true, state: 'draft' });
    const own = await env
      .post(`fx-rates/${provisionalId}/approve`, {}, env.financeDual)
      .expect(403);
    expect(codeOf(own)).toBe('SEPARATION_OF_DUTIES');
    const approved = await env
      .post(`fx-rates/${provisionalId}/approve`, {}, env.financeApprover)
      .expect(200);
    expect(approved.body).toMatchObject({
      provisional: true,
      state: 'approved',
      revaluation: { status: 'queued' },
    });
    const listed = await env.get('fx-rates?provisional=true').expect(200);
    expect((listed.body as { items: FxBody[] }).items.map((r) => r.id)).toEqual(
      [provisionalId],
    );
  });

  it('values converted with it are marked provisional: line, totals, loss-value and loss tree ($50)', async () => {
    await env.settle();
    const body = await env.valued();
    const usd = amountOf(viewOf(env.stopLine(body), 'economic_impact'), 'USD');
    expect(usd).toMatchObject({
      amount: '50',
      fxRateIds: [provisionalId],
      provisional: true,
    });
    expect(env.total(body, 'economic_impact', 'USD')).toMatchObject({
      amount: '50',
      status: 'valued',
      fxProvisionalLines: 1,
      reasons: ['fx_rate_provisional'],
    });
    const report = await env
      .get(
        `reports/loss-value?${WINDOW}&ledger=capacity&unitIds=${env.world.unitA1}`,
      )
      .expect(200);
    const value = report.body as {
      data: { view: string; total: { currencies: CurrencyBody[] } };
      isProvisional: boolean;
    };
    expect(value.data.view).toBe('economic_impact');
    expect(
      value.data.total.currencies.find((c) => c.currency === 'USD'),
    ).toMatchObject({
      amount: '50',
      fxProvisional: true,
      reasons: ['fx_rate_provisional'],
    });
    expect(value.isProvisional).toBe(true);
    const tree = await env
      .get(
        `reports/loss-tree?${WINDOW}&metric=value&ledger=capacity&groupBy=kind&unitIds=${env.world.unitA1}`,
      )
      .expect(200);
    const data = (
      tree.body as {
        data: Record<string, unknown> & {
          totals: Array<Record<string, unknown>>;
        };
      }
    ).data;
    expect(data).toMatchObject({
      metric: 'economic_impact',
      view: 'economic_impact',
      defaultView: true,
      valuationStatus: 'provisional',
    });
    expect(data.totals.find((t) => t.unit === 'USD')).toMatchObject({
      amount: '50',
      fxProvisional: true,
    });
  });

  it('the approved ledger keeps the provisional mark (lines and totals)', async () => {
    const approved = await env.approvePeriod(env.periodA1, env.reasonId);
    const lines = await env.rows<{ currency: string; provisional: boolean }>(
      `SELECT v.currency, v.provisional FROM approved_loss_line_valuations v
         JOIN approved_loss_lines l ON l.id = v.approved_line_id
        WHERE l.revision_id = $1 AND v.view = 'economic_impact' AND v.amount IS NOT NULL ORDER BY 1`,
      [approved.revision.id],
    );
    expect(
      lines.filter((l) => l.currency === 'USD').every((l) => l.provisional),
    ).toBe(true);
    expect(
      lines.filter((l) => l.currency === 'IRR').some((l) => l.provisional),
    ).toBe(false);
    const [total] = await env.rows<{ n: number }>(
      `SELECT sum(fx_provisional_lines)::int AS n FROM approved_valuation_totals
        WHERE revision_id = $1 AND view = 'economic_impact' AND currency = 'USD'`,
      [approved.revision.id],
    );
    expect(total.n).toBeGreaterThan(0);
  });

  it('the final rate wins: the approved period keeps its figures until its proposal is accepted, then $48 without the mark', async () => {
    const final = await env
      .post(
        'fx-rates',
        { ...MARCH, rate: '625000', source: 'treasury (test data)' },
        env.finance,
      )
      .expect(201);
    const finalId = (final.body as FxBody).id;
    expect((final.body as FxBody).provisional).toBe(false);
    const approved = await env
      .post(`fx-rates/${finalId}/approve`, {}, env.financeApprover)
      .expect(200);
    expect((approved.body as FxBody).revaluation).toMatchObject({
      status: 'queued',
    });
    await env.settle();
    // the approved figures stay as approved (still provisional) until finance restates the period (V7)
    const shown = await env.valued();
    const kept = amountOf(
      viewOf(env.stopLine(shown), 'economic_impact'),
      'USD',
    );
    expect(kept).toMatchObject({ amount: '50', provisional: true });
    const [proposal] = await env.rows<{ id: string; trigger: string }>(
      `SELECT id, trigger::text AS trigger FROM period_change_proposals WHERE period_id = $1 AND state = 'open'`,
      [env.periodA1],
    );
    expect(proposal.trigger).toBe('rate_change');
    await env
      .post(
        `period-change-proposals/${proposal.id}/accept`,
        { reason: 'final March rate' },
        env.approver,
      )
      .expect(200);
    await env.runActuals();
    const revalued = await env.rows<{ amount: string; provisional: boolean }>(
      `SELECT amount::text AS amount, provisional FROM loss_line_valuations
        WHERE period_id = $1 AND view = 'economic_impact' AND currency = 'USD' AND fx_rate_ids ? $2`,
      [env.periodA1, finalId],
    );
    expect(revalued.length).toBeGreaterThan(0);
    expect(revalued.every((r) => !r.provisional)).toBe(true);
    expect(revalued.map((r) => Number(r.amount))).toContain(48);
  });

  it('a provisional rate is refused where an approved final rate covers its window (409 FINAL_RATE_EXISTS)', async () => {
    const late = await env
      .post(
        'fx-rates',
        {
          ...MARCH,
          effectiveFrom: '2027-03-15T00:00:00Z',
          rate: '700000',
          provisional: true,
        },
        env.finance,
      )
      .expect(201);
    const refused = await env
      .post(
        `fx-rates/${(late.body as FxBody).id}/approve`,
        {},
        env.financeApprover,
      )
      .expect(409);
    expect(codeOf(refused)).toBe('FINAL_RATE_EXISTS');
  });
});
