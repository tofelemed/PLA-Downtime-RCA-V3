import {
  amountOf as amount,
  ValuationWorld,
  viewOf as view,
} from './support/valuation-world';

interface Revaluation {
  status: string;
  scope: string;
  from: string;
  to: string | null;
}

const codeOf = (response: { body: unknown }) =>
  (response.body as { code: string }).code;

/**
 * SME answers V1–V8 (14 Oct 2026) on real Postgres: a tenant's first policy carries the v3 pilot settings
 * (economic view by default), finance roles author and approve demand statuses and FX rates, the economic
 * view waits for an approved demand status (never a zero), an approval queues the revaluation it names
 * and the worker path revalues the period (V7), FX rates of another rate table are never used (V5), and
 * the loss-value report opens on the policy's default view with its approval status (V8). Test data only.
 */
describe('valuation economic view (SME V1–V8)', () => {
  const env = new ValuationWorld();
  let productId = '';

  beforeAll(async () => {
    await env.start();
    const [slice] = await env.rows<{ product_id: string }>(
      `SELECT product_id FROM period_product_slices WHERE period_id = $1 AND superseded_at IS NULL`,
      [env.periodA1],
    );
    productId = slice.product_id;
  });
  afterAll(() => env.stop());

  it('the seeded version 1 has the v3 body; finance approves it; the economic view needs a demand status', async () => {
    const list = await env.get('valuation-policies').expect(200);
    const [seeded] = (
      list.body as {
        items: Array<{ id: string; body: Record<string, unknown> }>;
      }
    ).items;
    expect(seeded.body).toMatchObject({
      defaultBasis: 'economic_impact',
      demandRule: 'demand_constrained_only',
      fxRateType: 'economic',
    });
    const approved = await env
      .post(`valuation-policies/${seeded.id}/approve`, {}, env.financeApprover)
      .expect(200);
    expect((approved.body as { revaluation: Revaluation }).revaluation).toEqual(
      {
        status: 'queued',
        scope: 'tenant',
        from: '1970-01-01T00:00:00.000Z',
        to: null,
      },
    );
    await env.valuationRate({
      profileId: env.profileId,
      basis: 'contribution_margin',
      value: '300',
      currency: 'USD',
    });
    await env.settle();
    const body = await env.valued();
    const economic = view(env.stopLine(body), 'economic_impact');
    expect(economic).toMatchObject({
      status: 'unvalued',
      reason: 'demand_status_missing',
    });
    expect(
      amount(view(env.stopLine(body), 'contribution_margin'), 'USD').amount,
    ).toBe('30000');
  });

  it('demand statuses: finance roles only, products of the tenant, the author never approves', async () => {
    const draft = {
      productId,
      status: 'demand_constrained',
      evidence: 'Order book exceeds output for March (test data)',
      effectiveFrom: '2027-03-01T00:00:00Z',
      effectiveTo: '2027-04-01T00:00:00Z',
    };
    expect(
      codeOf(await env.post('demand-statuses', draft, env.admin).expect(403)),
    ).toBe('FORBIDDEN_ROLE');
    const [foreign] = await env.rows<{ id: string }>(
      `SELECT id FROM products WHERE tenant_id = $1::uuid LIMIT 1`,
      [env.world.tenantB],
    );
    expect(
      codeOf(
        await env
          .post(
            'demand-statuses',
            { ...draft, productId: foreign.id },
            env.finance,
          )
          .expect(422),
      ),
    ).toBe('INVALID_REFERENCE');
    await env
      .post('demand-statuses', { ...draft, evidence: ' ' }, env.finance)
      .expect(422);
    const created = await env
      .post('demand-statuses', draft, env.financeDual)
      .expect(201);
    const id = (created.body as { id: string }).id;
    expect(
      codeOf(
        await env
          .post(`demand-statuses/${id}/approve`, {}, env.financeDual)
          .expect(403),
      ),
    ).toBe('SEPARATION_OF_DUTIES');
    const approved = await env
      .post(`demand-statuses/${id}/approve`, {}, env.financeApprover)
      .expect(200);
    expect(
      approved.body as { state: string; revaluation: Revaluation },
    ).toMatchObject({
      state: 'approved',
      revaluation: {
        status: 'queued',
        from: '2027-03-01T00:00:00.000Z',
        to: '2027-04-01T00:00:00.000Z',
      },
    });
  });

  it('V7: the approval revalues the period through the worker path; sold out = the lost tonnes are lost sales', async () => {
    await env.settle();
    const body = await env.valued();
    const economic = view(env.stopLine(body), 'economic_impact');
    expect(economic.status).toBe('valued');
    expect(amount(economic, 'USD').amount).toBe('30000');
    expect(amount(economic, 'IRR')).toMatchObject({
      amount: null,
      reason: 'fx_rate_missing',
    });
  });

  it('V5: only the policy rate table converts; a group_reporting rate is ignored, an economic one is used', async () => {
    const fx = (rateType: string, rate: string) => ({
      rateType,
      fromCurrency: 'USD',
      toCurrency: 'IRR',
      rate,
      effectiveFrom: '2027-03-01T00:00:00Z',
      source: 'test data',
    });
    for (const [type, rate] of [
      ['group_reporting', '420000'],
      ['economic', '600000'],
    ]) {
      const created = await env
        .post('fx-rates', fx(type, rate), env.finance)
        .expect(201);
      expect((created.body as { rateType: string }).rateType).toBe(type);
      const approved = await env
        .post(
          `fx-rates/${(created.body as { id: string }).id}/approve`,
          {},
          env.financeApprover,
        )
        .expect(200);
      expect(
        (approved.body as { revaluation: Revaluation }).revaluation,
      ).toMatchObject({
        status: 'queued',
        from: '2027-02-28T00:00:00.000Z',
        to: null,
      });
    }
    await env.settle();
    const body = await env.valued();
    const economic = view(env.stopLine(body), 'economic_impact');
    expect(amount(economic, 'IRR').amount).toBe('18000000000');
    const listed = await env
      .get('fx-rates?rateType=group_reporting')
      .expect(200);
    expect((listed.body as { items: unknown[] }).items).toHaveLength(1);
  });

  it('V8: the loss-value report opens on the policy default view and says the figures are provisional', async () => {
    const window = 'from=2027-03-01T00:00:00Z&to=2027-03-02T00:00:00Z';
    const response = await env
      .get(
        `reports/loss-value?${window}&ledger=capacity&unitIds=${env.world.unitA1}`,
      )
      .expect(200);
    const data = (
      response.body as {
        data: {
          view: string;
          defaultView: boolean;
          valuationStatus: string;
          total: {
            currencies: Array<{ currency: string; amount: string | null }>;
          };
        };
      }
    ).data;
    expect(data).toMatchObject({
      view: 'economic_impact',
      defaultView: true,
      valuationStatus: 'provisional',
    });
    expect(
      data.total.currencies.find((c) => c.currency === 'USD')?.amount,
    ).toBe('30000');
    const margin = await env
      .get(`reports/loss-value?${window}&metric=margin&ledger=capacity`)
      .expect(200);
    expect(
      (margin.body as { data: { defaultView: boolean } }).data.defaultView,
    ).toBe(false);
  });
});
