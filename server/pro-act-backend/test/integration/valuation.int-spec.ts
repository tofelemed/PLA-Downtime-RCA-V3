import { domainEventViolations } from '../../src/common/domain-events/domain-event-validator';
import { ExportWorld } from './support/export-world';
import {
  AccountingWithValuation,
  amountOf as amount,
  ValuationWorld,
  viewOf as view,
} from './support/valuation-world';

/**
 * Plan 2.6 valuation on real Postgres (VAL01–VAL03, D08 IRR / USD): valuation runs inside the calculation
 * run from a frozen context (policy, rate and FX versions), nothing values before the policy is approved,
 * a missing price keeps the quantity with a null amount (T38), the other currency is null without an
 * approved FX rate and filled with its version recorded once one exists (T45), views stay separate
 * (VAL02), the approved figures carry their valuation into the snapshot, PeriodApproved and the export,
 * and a later revaluation of an approved period opens a change proposal instead of overwriting it.
 * Authorization: tenant-wide writes need a tenant-wide grant, body ids of another tenant are 422, path ids
 * 404. Test data only; all dates are the fixed 2027 test days.
 */
describe('valuation (plan 2.6)', () => {
  const env = new ValuationWorld();
  let reason = '';
  let impact = '';
  let profileId = '';
  let unitUser = '';
  let fxId = '';

  const accounting = () => env.valued();
  const recompute = () => env.recomputeA1();
  const stopLine = (body: AccountingWithValuation) => env.stopLine(body);
  const total = (body: AccountingWithValuation, name: string, ccy: string) =>
    env.total(body, name, ccy);
  const valuationRate = (body: Record<string, unknown>) =>
    env.valuationRate(body);

  beforeAll(async () => {
    await env.start();
    reason = env.reasonId;
    impact = env.impactId;
    unitUser = env.unitUserToken;
    profileId = env.profileId;
  });
  afterAll(() => env.stop());

  it('before finance approval every line is unvalued (policy_unapproved) and the run records the policy version', async () => {
    const body = await accounting();
    expect(body.data.run.policyVersions).toContainEqual(
      expect.objectContaining({ kind: 'valuation_basis', version: 1 }),
    );
    const margin = view(stopLine(body), 'contribution_margin');
    expect(margin).toMatchObject({
      status: 'unvalued',
      reason: 'policy_unapproved',
    });
    expect(margin.amounts.map((a) => a.amount)).toEqual([null, null]);
    expect(total(body, 'contribution_margin', 'IRR')).toMatchObject({
      amount: null,
      status: 'unvalued',
      unvaluedQuantity: '100',
    });
  });

  it('valuation rates are entered in a reporting currency only (IRR or USD)', async () => {
    const response = await env
      .post(
        'valuation-rates',
        {
          profileId,
          basis: 'contribution_margin',
          value: '10',
          currency: 'EUR',
          effectiveFrom: '2027-03-01T00:00:00Z',
        },
        env.finance,
      )
      .expect(422);
    expect((response.body as { code: string }).code).toBe(
      'CURRENCY_NOT_REPORTED',
    );
  });

  it('policy writes: tenant-wide grant (403 for a unit-limited user), foreign ids 404 / 422, author ≠ approver', async () => {
    const list = await env.get('valuation-policies').expect(200);
    const [seeded] = (
      list.body as {
        items: Array<{ id: string; reportingCurrencies: string[] }>;
      }
    ).items;
    expect(seeded.reportingCurrencies).toEqual(['IRR', 'USD']);
    const limited = await env
      .post(`valuation-policies/${seeded.id}/approve`, {}, unitUser)
      .expect(403);
    expect((limited.body as { code: string }).code).toBe(
      'TENANT_SCOPE_REQUIRED',
    );
    await env
      .post(`valuation-policies/${seeded.id}/approve`, {}, env.financeApproverB)
      .expect(404);
    await env.get(`valuation-policies/${seeded.id}`, env.adminB).expect(404);
    const manager = await env
      .post(`valuation-policies/${seeded.id}/approve`, {}, env.approver)
      .expect(403);
    expect((manager.body as { code: string }).code).toBe('FORBIDDEN_ROLE');
    await env
      .post(`valuation-policies/${seeded.id}/approve`, {}, env.financeApprover)
      .expect(200);
    await env
      .post(`valuation-policies/${seeded.id}/approve`, {}, env.financeApprover)
      .expect(409);
    const content = {
      defaultBasis: 'contribution_margin',
      timeBasisRule: 'independent_components',
      reportingCurrencies: ['IRR', 'USD'],
      fxPolicy: 'snapshot',
      effectiveFrom: '2020-01-01T00:00:00Z',
    };
    const [foreignCode] = await env.rows<{ id: string }>(
      `INSERT INTO impact_codes (code, name, tenant_id, is_active) VALUES ('IMP-B-VAL', 'B', $1, true) RETURNING id`,
      [env.world.tenantB],
    );
    const foreign = await env
      .post(
        'valuation-policies',
        { ...content, independentImpactCodeIds: [foreignCode.id] },
        env.finance,
      )
      .expect(422);
    expect((foreign.body as { code: string }).code).toBe('INVALID_REFERENCE');
    await env.post('valuation-policies', content, unitUser).expect(403);
    await env.post('valuation-policies', content, env.admin).expect(403);
    const created = await env
      .post(
        'valuation-policies',
        { ...content, independentImpactCodeIds: [impact] },
        env.financeDual,
      )
      .expect(201);
    const id = (created.body as { id: string; version: number }).id;
    expect((created.body as { version: number }).version).toBe(2);
    const self = await env
      .post(`valuation-policies/${id}/approve`, {}, env.financeDual)
      .expect(403);
    expect((self.body as { code: string }).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`valuation-policies/${id}/approve`, {}, env.financeApprover)
      .expect(200);
  });

  it('T38: an approved policy without a margin keeps the quantity, amount null, unvalued rate_missing', async () => {
    const body = await recompute();
    expect(body.data.run.policyVersions).toContainEqual(
      expect.objectContaining({ kind: 'valuation_basis', version: 2 }),
    );
    const line = stopLine(body);
    expect(line.quantity).toBe('100');
    expect(view(line, 'contribution_margin')).toMatchObject({
      status: 'unvalued',
      reason: 'rate_missing',
    });
    expect(total(body, 'contribution_margin', 'IRR')).toMatchObject({
      amount: null,
      status: 'unvalued',
      unvaluedQuantity: '100',
      reasons: ['rate_missing'],
    });
  });

  it('T45: an IRR margin and a USD cost per hour without FX — native amounts, the other currency null (fx_rate_missing), views never summed', async () => {
    await valuationRate({
      profileId,
      basis: 'contribution_margin',
      value: '1000000',
      currency: 'IRR',
    });
    await valuationRate({
      impactCodeId: impact,
      basis: 'cost_per_hour',
      value: '120',
      currency: 'USD',
    });
    const body = await recompute();
    const line = stopLine(body);
    const margin = view(line, 'contribution_margin');
    expect(amount(margin, 'IRR').amount).toBe('100000000');
    expect(amount(margin, 'USD')).toMatchObject({
      amount: null,
      reason: 'fx_rate_missing',
    });
    const time = view(line, 'cost_per_hour');
    expect(amount(time, 'USD').amount).toBe('120');
    expect(amount(time, 'IRR').amount).toBeNull();
    expect(total(body, 'contribution_margin', 'USD')).toMatchObject({
      amount: null,
      nativeAmount: '0',
      status: 'mixed',
      reasons: ['fx_rate_missing'],
    });
    expect(total(body, 'independent_components', 'IRR')?.amount).toBeNull();
  });

  it('T45: with an approved FX rate both currencies are filled and the FX version is recorded', async () => {
    const limited = await env
      .post(
        'fx-rates',
        {
          fromCurrency: 'USD',
          toCurrency: 'IRR',
          rate: '500000',
          effectiveFrom: '2027-01-01T00:00:00Z',
        },
        unitUser,
      )
      .expect(403);
    expect((limited.body as { code: string }).code).toBe(
      'TENANT_SCOPE_REQUIRED',
    );
    const fx = {
      fromCurrency: 'USD',
      toCurrency: 'IRR',
      rate: '500000',
      effectiveFrom: '2027-01-01T00:00:00Z',
      source: 'treasury',
    };
    await env.post('fx-rates', fx, env.admin).expect(403);
    const created = await env.post('fx-rates', fx, env.financeDual).expect(201);
    fxId = (created.body as { id: string }).id;
    await env.post(`fx-rates/${fxId}/approve`, {}, unitUser).expect(403);
    await env.get(`fx-rates/${fxId}`, env.adminB).expect(404);
    const own = await env
      .post(`fx-rates/${fxId}/approve`, {}, env.financeDual)
      .expect(403);
    expect((own.body as { code: string }).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`fx-rates/${fxId}/approve`, {}, env.financeApprover)
      .expect(200);
    await env.get('fx-rates', unitUser).expect(200);
    const body = await recompute();
    const line = stopLine(body);
    expect(amount(view(line, 'contribution_margin'), 'USD')).toMatchObject({
      amount: '200',
      fxRateIds: [fxId],
    });
    expect(amount(view(line, 'cost_per_hour'), 'IRR').amount).toBe('60000000');
    expect(total(body, 'contribution_margin', 'IRR')?.amount).toBe('100000000');
    expect(total(body, 'cost_per_hour', 'IRR')?.amount).toBe('60000000');
    expect(total(body, 'independent_components', 'IRR')).toMatchObject({
      amount: '160000000',
      fxRateIds: [fxId],
    });
  });

  it('GET /reports/loss-value sums stored totals per view and currency; unit-limited callers stay in scope', async () => {
    const window = 'from=2027-03-01T00:00:00Z&to=2027-03-02T00:00:00Z';
    const response = await env
      .get(
        `reports/loss-value?${window}&metric=margin&ledger=capacity&groupBy=unit`,
      )
      .expect(200);
    const report = response.body as {
      data: {
        view: string;
        total: {
          currencies: Array<{ currency: string; amount: string | null }>;
        };
      };
      policyVersion: string | null;
    };
    expect(report.data.view).toBe('contribution_margin');
    expect(report.data.total.currencies).toEqual([
      expect.objectContaining({ currency: 'IRR', amount: '100000000' }),
      expect.objectContaining({ currency: 'USD', amount: '200' }),
    ]);
    expect(report.policyVersion).toContain('valuation_basis@2');
    const operational = await env
      .get(
        `reports/loss-value?${window}&metric=operational_cost&ledger=capacity`,
      )
      .expect(200);
    const opTotal = (operational.body as typeof report).data.total.currencies;
    expect(opTotal.find((c) => c.currency === 'USD')?.amount).toBe('120');
    const other = await env
      .get(`reports/loss-value?${window}&unitIds=${env.world.unitA2}`, unitUser)
      .expect(422);
    expect((other.body as { code: string }).code).toBe('INVALID_REFERENCE');
  });

  it('approval carries the reconciled valuation into the snapshot, PeriodApproved and the export (both currencies)', async () => {
    const approved = await env.approvePeriod(env.periodA1, reason);
    const [snapshot] = await env.rows<{
      content: {
        reviewed: {
          valuation: {
            slices: Array<{
              view: string;
              currency: string;
              amount: string | null;
            }>;
          };
        };
      };
    }>(`SELECT content FROM approval_snapshots WHERE revision_id = $1`, [
      approved.revision.id,
    ]);
    const sliceTotals = snapshot.content.reviewed.valuation.slices.filter(
      (s) => s.view === 'contribution_margin',
    );
    expect(sliceTotals.map((s) => [s.currency, s.amount])).toEqual([
      ['IRR', '150000000'],
      ['USD', '300'],
    ]);
    const reported = await env
      .get(
        `reports/loss-value?from=2027-03-01T00:00:00Z&to=2027-03-02T00:00:00Z&metric=margin&ledger=plan&unitIds=${env.world.unitA1}`,
      )
      .expect(200);
    const totals = (
      reported.body as {
        data: {
          total: {
            currencies: Array<{ currency: string; amount: string | null }>;
          };
        };
      }
    ).data.total.currencies;
    expect(totals.map((c) => [c.currency, c.amount])).toEqual([
      ['IRR', '150000000'],
      ['USD', '300'],
    ]);
    const [message] = await env.rows<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM outbox WHERE aggregate_id = $1 AND type = 'PeriodApproved'`,
      [env.periodA1],
    );
    expect(domainEventViolations('PeriodApproved', message.payload)).toBeNull();
    expect(message.payload.valuation).toMatchObject({
      status: 'valued',
      currency: null,
      defaultView: 'contribution_margin',
      currencies: ['IRR', 'USD'],
      policyVersion: { version: 2 },
    });
    const jobId = await env.exportDay();
    await env.runExports();
    const [row] = ExportWorld.records((await env.download(jobId)).text).filter(
      (r) => r.period_id === env.periodA1,
    );
    expect(row).toMatchObject({
      valuation_view: 'contribution_margin',
      value_1: '150000000',
      currency_1: 'IRR',
      value_2: '300.00',
      currency_2: 'USD',
      valuation_status: 'valued',
    });
  });

  it('revaluing an approved period opens a change proposal; the approved revision and snapshot are untouched', async () => {
    const approved = await env.view(env.periodA1, env.admin, '?view=approved');
    const [before] = await env.rows<{ content_hash: string }>(
      `SELECT content_hash FROM approval_snapshots WHERE revision_id = $1`,
      [approved.revision.id],
    );
    const next = await env
      .post(
        'fx-rates',
        {
          fromCurrency: 'USD',
          toCurrency: 'IRR',
          rate: '600000',
          effectiveFrom: '2027-02-01T00:00:00Z',
        },
        env.finance,
      )
      .expect(201);
    await env
      .post(`fx-rates/${fxId}/retire`, {}, env.financeApprover)
      .expect(200);
    await env
      .post(
        `fx-rates/${(next.body as { id: string }).id}/approve`,
        {},
        env.financeApprover,
      )
      .expect(200);
    await env
      .post(`production-periods/${env.periodA1}/recompute`, {})
      .expect(202);
    await env.runActuals();
    const after = await env.view(env.periodA1, env.admin, '?view=approved');
    expect(after.contentHash).toBe(approved.contentHash);
    const [snapshot] = await env.rows<{ content_hash: string }>(
      `SELECT content_hash FROM approval_snapshots WHERE revision_id = $1`,
      [approved.revision.id],
    );
    expect(snapshot).toEqual(before);
    const proposals = await env.rows<{ state: string }>(
      `SELECT state::text FROM period_change_proposals WHERE period_id = $1`,
      [env.periodA1],
    );
    expect(proposals.map((p) => p.state)).toEqual(['open']);
  });
});
