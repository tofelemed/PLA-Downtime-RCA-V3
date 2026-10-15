import { randomUUID } from 'crypto';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

interface RuleBody {
  id: string;
  state: string;
  version: number;
  mode: string;
  fraction: string | null;
}

interface EventBody {
  classification: {
    impactMode: string;
    impactFraction: string | null;
    impactBasis: string;
  };
}

/**
 * Plan 1.10 step 4 on real Postgres (SME Q5 + D9): feed pump P-101 of unit A1 is one of two trains — an
 * approved rule makes its stops a 50 % derate (`unit_impact_rules` maker-checker, `event_impacts`
 * evidence); a stop whose impact a person stated keeps it; retiring the rule returns its stops to a full
 * stop. Pump P-102 has the installed spare P-102B: a logged standby run that starts within the takeover
 * window holds the output (`none`, standby takeover).
 */
describe('unit impact rules (plan 1.10 step 4)', () => {
  const env = new AccountingWorld();
  const p101 = randomUUID();
  const p102 = randomUUID();
  const p102b = randomUUID();
  let ruleId = '';
  let derived = '';
  let stated = '';

  const event = async (id: string) =>
    (await env.get(`production-events/${id}`).expect(200)).body as EventBody;
  const asset = (id: string, code: string) =>
    env.rows(
      `INSERT INTO "assets" ("id", "code", "name", "unit_id", "tenant_id") VALUES ($1, $2, $2, $3, $4)`,
      [id, code, env.world.unitA1, env.world.tenantA],
    );
  const rule = async (body: Record<string, unknown>) => {
    const draft = (
      await env
        .post('unit-impact-rules', {
          unitId: env.world.unitA1,
          effectiveFrom: '2027-01-01T00:00:00Z',
          ...body,
        })
        .expect(201)
    ).body as RuleBody;
    await env
      .post(`unit-impact-rules/${draft.id}/approve`, {}, env.approver)
      .expect(200);
    return draft.id;
  };

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    await env.outputEvent(env.world.unitA1, A, B, '300');
    await asset(p101, 'P-101');
    await asset(p102, 'P-102');
    await asset(p102b, 'P-102B');
  });
  afterAll(() => env.stop());

  it('validates a draft and refuses its author as approver', async () => {
    const bad = await env
      .post('unit-impact-rules', {
        unitId: env.world.unitA1,
        assetId: p101,
        mode: 'fractional',
        reason: 'two trains',
        effectiveFrom: '2027-01-01T00:00:00Z',
      })
      .expect(422);
    expect((bad.body as ApiError).code).toBe('INVALID_FRACTION');
    const draft = (
      await env
        .post('unit-impact-rules', {
          unitId: env.world.unitA1,
          assetId: p101,
          mode: 'fractional',
          fraction: '0.5',
          reason: 'one of two feed trains',
          effectiveFrom: '2027-01-01T00:00:00Z',
        })
        .expect(201)
    ).body as RuleBody;
    expect(draft).toMatchObject({
      state: 'draft',
      version: 1,
      fraction: '0.5',
    });
    const own = await env
      .post(`unit-impact-rules/${draft.id}/approve`, {})
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`unit-impact-rules/${draft.id}/approve`, {}, env.approver)
      .expect(200);
    ruleId = draft.id;
  });

  it('a stop of P-101 becomes a 50 % derate; a stated impact stays the manual override', async () => {
    derived = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      assetId: p101,
    });
    stated = await env.lossEvent(env.world.unitA1, plus(A, 3 * HOUR), 1, {
      assetId: p101,
      impactMode: 'full_stop',
    });
    await env.settle();
    expect((await event(derived)).classification).toMatchObject({
      impactMode: 'fractional',
      impactFraction: '0.50000000',
      impactBasis: 'unit_rule',
    });
    expect((await event(stated)).classification).toMatchObject({
      impactMode: 'full_stop',
      impactBasis: 'stated',
    });
    const evidence = await env.rows<{
      event_id: string;
      basis: string;
      rule_id: string | null;
    }>(
      `SELECT "event_id", "basis", "rule_id" FROM "event_impacts" WHERE "event_id" = ANY($1::uuid[])`,
      [[derived, stated]],
    );
    expect(evidence).toEqual(
      expect.arrayContaining([
        { event_id: derived, basis: 'unit_rule', rule_id: ruleId },
        { event_id: stated, basis: 'stated', rule_id: null },
      ]),
    );
  });

  it('retiring the rule returns its stops to a full stop', async () => {
    await env
      .post(`unit-impact-rules/${ruleId}/retire`, {}, env.approver)
      .expect(200);
    await env.settle();
    expect((await event(derived)).classification).toMatchObject({
      impactMode: 'full_stop',
      impactBasis: 'default',
    });
  });

  it('a logged standby run within the takeover window holds the output (none, standby takeover)', async () => {
    await rule({
      assetId: p102,
      mode: 'full_stop',
      standbyAssetId: p102b,
      takeoverSeconds: 60,
      reason: 'installed spare P-102B',
    });
    const stop = await env.lossEvent(env.world.unitA1, plus(A, 5 * HOUR), 1, {
      assetId: p102,
    });
    await env.settle();
    expect((await event(stop)).classification.impactBasis).toBe('unit_rule');
    await env
      .post('standby-records/import', {
        records: [
          {
            assetId: p102b,
            kind: 'run',
            startedAt: plus(A, 5 * HOUR + 30_000),
            endedAt: plus(A, 7 * HOUR),
            outcome: 'success',
          },
        ],
      })
      .expect(200);
    await env.settle();
    expect((await event(stop)).classification).toMatchObject({
      impactMode: 'none',
      impactBasis: 'standby_takeover',
    });
  });
});
