import { ValuationWorld } from './support/valuation-world';

interface PolicyBody {
  id: string;
  version: number;
  effectiveFrom: string;
  backdateReason: string | null;
  restateApproved: boolean;
  revaluation?: { status: string; from: string; to: string | null } | null;
}

interface Refusal {
  code: string;
  details?: { total: number; periods: Array<{ periodId: string }> };
}

const REASON = 'Commissioning: test baseline is contribution margin';
const CONTENT = {
  defaultBasis: 'contribution_margin',
  timeBasisRule: 'exclusive',
  reportingCurrencies: ['IRR', 'USD'],
  fxPolicy: 'snapshot',
};

/**
 * Commissioning backdate of a valuation policy version (owner, 18 Oct 2026, DECISIONS "Marun E2E follow-up
 * decisions" → Valuation basis) on real Postgres: a past effectiveFrom needs a reason; it is refused over a
 * period with approved figures unless the author chooses the restatement path (change proposals); approval
 * checks again; it never starts before the latest approved version. The test days are in 2027, so the
 * approved period is moved into the past (test data only).
 */
describe('valuation policy commissioning backdate', () => {
  const env = new ValuationWorld();

  const draft = (body: Record<string, unknown>) =>
    env.post('valuation-policies', { ...CONTENT, ...body }, env.finance);
  const approve = (id: string) =>
    env.post(`valuation-policies/${id}/approve`, {}, env.financeApprover);
  /** Moves the approved period A1 to start at `start` (keeping its length). */
  const movePeriodA1 = (start: string) =>
    env.rows(
      `UPDATE production_periods SET utc_end = $2::timestamptz + (utc_end - utc_start), utc_start = $2::timestamptz WHERE id = $1`,
      [env.periodA1, start],
    );

  beforeAll(async () => {
    await env.start();
    await env.approvePeriod(env.periodA1, env.reasonId);
    await movePeriodA1('2026-01-10T00:00:00Z');
  });
  afterAll(() => env.stop());

  it('refuses a past effectiveFrom without a reason, and a reason without a past instant', async () => {
    const missing = await draft({
      effectiveFrom: '2026-02-01T00:00:00Z',
    }).expect(422);
    expect((missing.body as Refusal).code).toBe('BACKDATE_REASON_REQUIRED');
    const future = await draft({
      effectiveFrom: '2099-01-01T00:00:00Z',
      backdateReason: REASON,
    }).expect(422);
    expect((future.body as Refusal).code).toBe(
      'BACKDATE_REASON_WITHOUT_EFFECTIVE_FROM',
    );
  });

  it('refuses a backdate over a period with approved figures, naming it', async () => {
    const refused = await draft({
      effectiveFrom: '2026-01-01T00:00:00Z',
      backdateReason: REASON,
    }).expect(409);
    const body = refused.body as Refusal;
    expect(body.code).toBe('BACKDATE_OVERLAPS_APPROVED_VALUE');
    expect(body.details?.total).toBe(1);
    expect(body.details?.periods.map((p) => p.periodId)).toEqual([
      env.periodA1,
    ]);
  });

  it('accepts a backdate after the approved figures, and refuses it at approval once approved figures fall in range', async () => {
    const created = await draft({
      effectiveFrom: '2026-02-01T00:00:00Z',
      backdateReason: ` ${REASON} `,
    }).expect(201);
    const policy = created.body as PolicyBody;
    expect(policy).toMatchObject({
      effectiveFrom: '2026-02-01T00:00:00.000Z',
      backdateReason: REASON,
      restateApproved: false,
    });
    await movePeriodA1('2026-03-01T00:00:00Z');
    const refused = await approve(policy.id).expect(409);
    expect((refused.body as Refusal).code).toBe(
      'BACKDATE_OVERLAPS_APPROVED_VALUE',
    );
    const [row] = await env.rows<{ approved_at: Date | null }>(
      `SELECT approved_at FROM accounting_policies WHERE id = $1`,
      [policy.id],
    );
    expect(row.approved_at).toBeNull();
  });

  it('accepts the restatement path: approval queues the revaluation (approved periods get change proposals)', async () => {
    const created = await draft({
      effectiveFrom: '2026-01-01T00:00:00Z',
      backdateReason: REASON,
      restateApproved: true,
    }).expect(201);
    const policy = created.body as PolicyBody;
    expect(policy.restateApproved).toBe(true);
    const approved = await approve(policy.id).expect(200);
    expect((approved.body as PolicyBody).revaluation).toEqual({
      status: 'queued',
      scope: 'tenant',
      from: '2026-01-01T00:00:00.000Z',
      to: null,
    });
    const [revision] = await env.rows<{ lifecycle: string }>(
      `SELECT lifecycle FROM accounting_revisions WHERE period_id = $1 AND approved_at IS NOT NULL`,
      [env.periodA1],
    );
    expect(revision.lifecycle).toBe('approved');
  });

  it('never starts before the latest approved version', async () => {
    const refused = await draft({
      effectiveFrom: '2025-12-01T00:00:00Z',
      backdateReason: REASON,
      restateApproved: true,
    }).expect(409);
    expect((refused.body as Refusal).code).toBe('BACKDATE_REWRITES_HISTORY');
  });
});
