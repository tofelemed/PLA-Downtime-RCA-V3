import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { catalogueCause } from './support/rca-causes';
import { RcaWorld } from './support/rca-world';

interface PortfolioRow {
  key: string;
  causeCode: { id: string; code: string } | null;
  cases: { total: number; sample: Array<{ id: string }> };
  approvedLoss: {
    lines: number;
    values?: Array<{ currency: string; amount: string | null }>;
  };
  actions: Record<string, number>;
  effectiveness: Record<string, number>;
  claimedAvoided?: Array<{ currency: string; amount: string; actions: number }>;
  claimsInOtherCurrencies: number;
  realized: Array<{ metric: string; difference: string; cases: number }>;
}

interface Portfolio {
  items: PortfolioRow[];
  nextCursor: string | null;
  currency: string;
}

const DAY_MS = 86_400_000;

/**
 * Item 2.1 on real Postgres: the loss → cause → action → outcome portfolio groups the cases opened in the
 * window by the catalogue code of their causes of one kind (an Uncoded row for the rest), keyset-paged by
 * number of cases; approved loss from the approved ledger only, in the asked currency only; actions with
 * the overdue rule of `GET /v2/rca-actions`; verdicts, claims and realised differences kept apart; the
 * caller's units and tenant only.
 */
describe('RCA loss → cause → action → outcome portfolio (item 2.1)', () => {
  const env = new RcaWorld();
  const from = new Date(Date.now() - DAY_MS).toISOString();
  const to = new Date(Date.now() + DAY_MS).toISOString();
  let codeX = '';
  let codeY = '';
  const cases: Record<string, string> = {};

  const portfolio = async (query: string, token = env.admin) =>
    (
      await env
        .get(
          `reports/rca-portfolio?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${query}`,
          token,
        )
        .expect(200)
    ).body as Portfolio;

  const cause = (caseId: string, kind: string, causeCodeId: string) =>
    env
      .post(`rcas/${caseId}/causes`, {
        kind,
        causeCodeId,
        statement: `${kind} cause`,
      })
      .expect(201);

  const action = (caseId: string, values: string, params: unknown[]) =>
    env.rows(
      `INSERT INTO rca_actions (tenant_id, row_version, rca_id, title, ${values})
       VALUES ($1, 1, $2, 'action', ${params.map((_, i) => `$${i + 3}`).join(', ')})`,
      [env.world.tenantA, caseId, ...params],
    );

  beforeAll(async () => {
    await env.start();
    const reason = await env.reasonCode('BRG');
    const stop = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      assetId: env.world.assetA1,
      reasonCodeId: reason,
    });
    await env.approvePeriodA1(reason);
    await env.rows(
      `INSERT INTO approved_loss_line_valuations (tenant_id, row_version, approved_line_id, view, currency, amount, status)
       SELECT a.tenant_id, 1, a.id, 'contribution_margin', c.currency, c.amount, 'valued'
         FROM approved_loss_lines a
        CROSS JOIN (VALUES ('USD', 100::numeric), ('IRR', 4200000::numeric)) AS c(currency, amount)
        WHERE a.tenant_id = $1 AND a.cause_event_id = $2
       ON CONFLICT DO NOTHING`,
      [env.world.tenantA, stop],
    );
    codeX = await catalogueCause(env, env.world.tenantA);
    codeY = await catalogueCause(env, env.world.tenantA);
    for (const [name, unitId] of [
      ['c1', env.world.unitA1],
      ['c2', env.world.unitA1],
      ['c3', env.world.unitA1],
      ['c4', env.world.unitA2],
      ['c5', env.world.unitA1],
    ] as const)
      cases[name] = (
        await env.createCase(env.example({ unitId, teamMemberIds: [] }))
      ).id;
    for (const name of ['c1', 'c2', 'c4'])
      await cause(cases[name], 'root', codeX);
    await cause(cases.c3, 'root', codeY);
    await cause(cases.c3, 'direct', codeX);
    await env.linkEvent(stop, { rcaId: cases.c1 }).expect(201);
    const past = new Date(Date.now() - 3 * DAY_MS).toISOString();
    await action(
      cases.c1,
      'due_date, status, claimed_avoided_loss, claimed_currency',
      [past, 'open', '1500', 'USD'],
    );
    await action(cases.c2, 'status, claimed_avoided_loss, claimed_currency', [
      'in_progress',
      '63000000',
      'IRR',
    ]);
    await action(cases.c2, 'status, post_action', [
      'done',
      JSON.stringify({
        evaluatedAt: '2026-10-01T00:00:00.000Z',
        realized: {
          metric: 'recurrences',
          expected: '4',
          observed: '1',
          difference: '3',
        },
        effectiveness: { verdict: 'effective', reasons: [] },
      }),
    ]);
  });
  afterAll(() => env.stop());

  it('groups root causes by code, codes before Uncoded, with keyset pages', async () => {
    const first = await portfolio('&limit=2');
    expect(first.items.map((row) => row.key)).toEqual([codeX, codeY]);
    expect(first.items[0].cases.total).toBe(3);
    expect(first.nextCursor).not.toBeNull();
    const second = await portfolio(
      `&limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    expect(second.items.map((row) => row.key)).toEqual(['uncoded']);
    expect(second.items[0].causeCode).toBeNull();
    expect(second.items[0].cases.sample.map((c) => c.id)).toEqual([cases.c5]);
    expect(second.nextCursor).toBeNull();
    await env
      .get(`reports/rca-portfolio?from=${from}&to=${to}&cursor=bogus`)
      .expect(400);
  });

  it('another cause kind regroups the same cases', async () => {
    const direct = await portfolio('&causeKind=direct');
    expect(direct.items.map((row) => [row.key, row.cases.total])).toEqual([
      ['uncoded', 4],
      [codeX, 1],
    ]);
  });

  it('keeps approved loss, claims and realised differences apart, in the asked currency only', async () => {
    const [x] = (await portfolio('&limit=1')).items;
    expect(x.actions).toEqual({
      total: 3,
      open: 2,
      overdue: 1,
      done: 1,
      cancelled: 0,
    });
    expect(x.effectiveness).toEqual({
      effective: 1,
      notEffective: 0,
      insufficientEvidence: 0,
      pending: 2,
    });
    expect(x.claimedAvoided).toEqual([
      { currency: 'USD', amount: '1500', actions: 1 },
    ]);
    expect(x.claimsInOtherCurrencies).toBe(1);
    expect(x.realized).toEqual([
      { metric: 'recurrences', difference: '3', cases: 1 },
    ]);
    expect(x.approvedLoss.lines).toBeGreaterThan(0);
    expect(x.approvedLoss.values?.map((v) => v.currency)).toEqual(['USD']);
    const [irr] = (await portfolio('&limit=1&currency=IRR')).items;
    expect(irr.approvedLoss.values?.map((v) => v.currency)).toEqual(['IRR']);
    expect(irr.claimedAvoided).toEqual([
      { currency: 'IRR', amount: '63000000', actions: 1 },
    ]);
    const [y] = (await portfolio('&causeKind=root')).items.filter(
      (r) => r.key === codeY,
    );
    expect(y.approvedLoss).toEqual({ lines: 0, values: [] });
  });

  it('is scoped to the caller units and tenant; the window counts a case by its opening', async () => {
    const own = await portfolio('', env.reliability);
    expect(own.items.find((row) => row.key === codeX)?.cases.total).toBe(2);
    const foreign = await env
      .get(
        `reports/rca-portfolio?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&unitIds=${env.world.unitA2}`,
        env.reliability,
      )
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
    expect((await portfolio('', env.adminB)).items).toEqual([]);
    const earlier = new Date(Date.now() - 10 * DAY_MS).toISOString();
    const before = await env
      .get(
        `reports/rca-portfolio?from=${encodeURIComponent(earlier)}&to=${encodeURIComponent(from)}`,
      )
      .expect(200);
    expect((before.body as Portfolio).items).toEqual([]);
    await env
      .get(
        `reports/rca-portfolio?from=${encodeURIComponent(to)}&to=${encodeURIComponent(from)}`,
      )
      .expect(422);
    await env
      .get(
        `reports/rca-portfolio?from=${from}&to=${to}&tenantId=${env.world.tenantA}`,
      )
      .expect(400);
  });
});
