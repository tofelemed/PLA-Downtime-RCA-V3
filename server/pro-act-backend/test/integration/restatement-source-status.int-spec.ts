import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface RestatementBody {
  revision: number;
  supersededRevision: number;
  operationalEffectiveDate: string;
  posting: {
    postingDate: string;
    treatment: string;
    decidedByName: string | null;
  } | null;
  values: unknown;
  totals: Array<{
    uom: string | null;
    figures: Record<string, { delta: string | null }>;
  }>;
  lines: Array<{
    kind: string;
    old: string | null;
    new: string | null;
    delta: string | null;
  }>;
}

interface ReportBody {
  certifiedEligible: boolean;
  sourceSystem: string;
  statusMappingId: string | null;
}

interface MappingBody {
  id: string;
  version: number;
  state: string;
}

/**
 * SME R5 / R13 (phase R-D) on real Postgres. A late stop after approval opens a restatement (revision 2
 * via the change proposal): the delta view shows old vs new against revision 1, the operational date is
 * the period's, and finance (only) sets a posting date and treatment. External records are released by the
 * per-source status mapping in the database: the API `import` source keeps the former default on first
 * use; a LIMS mapping drafted by one user and approved by its source owner releases AUTHORIZED, not
 * COMPLETED.
 */
describe('restatement delta, posting date and source status mapping (SME R5 / R13)', () => {
  const env = new ReconciliationWorld();
  let reason = '';

  const report = (id: string, overrides: Record<string, unknown> = {}) => ({
    externalReportId: id,
    externalRevision: '1',
    localProductionDate: '2027-03-01',
    utcStart: A,
    utcEnd: NEXT_DAY,
    basis: 'gross',
    sourceStatus: 'COMPLETED',
    lines: [
      {
        unitId: env.world.unitA2,
        productId: env.products.p1,
        gross: '1000',
        reject: '10',
        uom: 't',
      },
    ],
    ...overrides,
  });

  const importReport = async (body: object) =>
    (await env.post('external-production-reports', body).expect(201))
      .body as ReportBody;

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    const view = await env.view();
    await env
      .saveLines(
        view,
        env.rejectAllPlus(view, view.slices[0].gap as string, reason),
      )
      .expect(200);
    await env.submit(await env.view()).expect(200);
    await env.approve(await env.view()).expect(200);
  });
  afterAll(() => env.stop());

  it('a revision without an approved predecessor is not a restatement (422)', async () => {
    const refused = await env
      .get(`production-periods/${env.periodA1}/restatement?revision=1`)
      .expect(422);
    expect((refused.body as ApiError).code).toBe('NOT_A_RESTATEMENT');
  });

  it('the restatement shows old vs new per unit of measure and the changed lines', async () => {
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    const proposals = (
      await env.get(`production-periods/${env.periodA1}/change-proposals`)
    ).body as { items: Array<{ id: string; state: string }> };
    const open = proposals.items.find((p) => p.state === 'open');
    await env
      .post(
        `period-change-proposals/${open?.id}/accept`,
        { reason: 'late stop' },
        env.approver,
      )
      .expect(200);
    await env.runActuals();
    // QA audit P-1: an accepted proposal names the revision it opened (its value, once valued)
    const accepted = (
      await env.get(`production-periods/${env.periodA1}/change-proposals`)
    ).body as {
      items: Array<{
        state: string;
        valueAfter: { revision: number; lifecycle: string } | null;
      }>;
    };
    expect(
      accepted.items.find((p) => p.state === 'accepted')?.valueAfter,
    ).toMatchObject({ revision: 2, lifecycle: 'draft' });
    const body = (
      await env
        .get(`production-periods/${env.periodA1}/restatement`)
        .expect(200)
    ).body as RestatementBody;
    expect(body).toMatchObject({
      revision: 2,
      supersededRevision: 1,
      operationalEffectiveDate: '2027-03-01',
      posting: null,
    });
    expect(body).toHaveProperty('values');
    expect(body.totals.map((t) => t.uom)).toEqual(['t']);
    const availability = body.lines.find((l) => l.kind === 'availability');
    expect(typeof availability?.old).toBe('string');
    expect(typeof availability?.new).toBe('string');
    expect(
      body.lines.some((l) => l.kind === 'availability' && l.delta !== '0'),
    ).toBe(true);
  });

  it('finance — not plant management — sets the posting date and treatment once; a decided posting is read-only', async () => {
    const path = `production-periods/${env.periodA1}/revisions/2/posting`;
    await env
      .post(
        path,
        { postingDate: '2027-04-02', treatment: 'correction' },
        env.approver,
      )
      .expect(403);
    const bad = await env
      .post(
        path,
        { postingDate: '2027-04-05', treatment: 'write_off' },
        env.financeApprover,
      )
      .expect(422);
    expect((bad.body as ApiError).code).toBeDefined();
    const decided = (
      await env
        .post(
          path,
          { postingDate: '2027-04-02', treatment: 'correction' },
          env.financeApprover,
        )
        .expect(200)
    ).body as RestatementBody;
    expect(decided.posting).toMatchObject({
      postingDate: '2027-04-02',
      treatment: 'correction',
    });
    // the test token's user has no users row: the name is null, never the id
    expect(decided.posting).toHaveProperty('decidedByName', null);
    expect(decided.operationalEffectiveDate).toBe('2027-03-01');
    // owner decision 2026-10-19: closed records are frozen — no second decision overwrites the first
    const refused = await env
      .post(
        path,
        {
          postingDate: '2027-04-05',
          treatment: 'estimate_change',
          note: 'lab revision',
        },
        env.financeApprover,
      )
      .expect(409);
    expect((refused.body as ApiError).code).toBe('POSTING_DECIDED');
    const after = (
      await env
        .get(`production-periods/${env.periodA1}/restatement`)
        .expect(200)
    ).body as RestatementBody;
    expect(after.posting).toMatchObject({
      postingDate: '2027-04-02',
      treatment: 'correction',
    });
    const [row] = await env.rows<{ row_version: number }>(
      `SELECT row_version FROM restatement_postings WHERE period_id = $1`,
      [env.periodA1],
    );
    expect(Number(row.row_version)).toBe(1);
  });

  it('the import source keeps the former default on first use; the mapping version is kept on the record', async () => {
    const created = await importReport(report('MX-1'));
    expect(created).toMatchObject({
      certifiedEligible: true,
      sourceSystem: 'import',
    });
    expect(created.statusMappingId).not.toBeNull();
  });

  it('a LIMS mapping approved by its source owner releases AUTHORIZED, not COMPLETED', async () => {
    const author = await env.scopedUser('production_accountant');
    const owner = await env.scopedUser('production_accountant');
    const before = await importReport(
      report('LIMS-0', { sourceSystem: 'lims', sourceStatus: 'AUTHORIZED' }),
    );
    expect(before.certifiedEligible).toBe(false);
    const draft = (
      await env
        .post(
          'source-status-mappings',
          {
            sourceSystem: 'lims',
            effectiveFrom: '2026-01-01T00:00:00Z',
            statuses: [
              { status: 'COMPLETED', released: false },
              { status: 'authorized', released: true },
            ],
            notes: 'Demo: LIMS workflow — AUTHORIZED is the quality release',
          },
          author,
        )
        .expect(201)
    ).body as MappingBody;
    expect(draft).toMatchObject({ version: 1, state: 'draft' });
    const self = await env
      .post(`source-status-mappings/${draft.id}/approve`, {}, author)
      .expect(403);
    expect((self.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`source-status-mappings/${draft.id}/approve`, {}, owner)
      .expect(200);
    const completed = await importReport(
      report('LIMS-1', { sourceSystem: 'lims', sourceStatus: 'COMPLETED' }),
    );
    const authorized = await importReport(
      report('LIMS-2', { sourceSystem: 'lims', sourceStatus: 'AUTHORIZED' }),
    );
    expect(completed.certifiedEligible).toBe(false);
    expect(authorized).toMatchObject({
      certifiedEligible: true,
      sourceSystem: 'lims',
    });
    const list = (
      await env.get('source-status-mappings?sourceSystem=lims').expect(200)
    ).body as { items: MappingBody[] };
    // the screen's "in force" and the author / approver names come from the server
    expect(list.items[0]).toMatchObject({
      version: 1,
      state: 'approved',
      inForce: true,
      createdByName: expect.any(String) as string,
      approvedByName: expect.any(String) as string,
    });
  });
});
