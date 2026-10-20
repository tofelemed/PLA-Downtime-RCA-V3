import { randomUUID } from 'crypto';
import { Dec } from '../../src/domain/actuals/decimal';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

interface WeightedLine {
  reason_code_id: string | null;
  quantity: string;
  share: string;
  event_id: string;
}

/**
 * Tier 2 item 2.8 / D-T5 on real Postgres: a PATCH splits a stop across two reasons by percent (stored on
 * the event and its coding revision, served as `reasonWeights`); the recalculated run has one availability
 * line per (stop, reason) with evidence share = segment share × weight and the conservation checks pass;
 * broken weights answer 422 with the rule; `null` removes the split.
 */
describe('weighted multi-reason stops (plan 2.8, D-T5)', () => {
  const env = new AccountingWorld();
  const mechanical = randomUUID();
  const electrical = randomUUID();
  let periodId = '';
  let stopId = '';

  const event = async () =>
    (await env.get(`production-events/${stopId}`).expect(200)) as {
      headers: Record<string, string>;
      body: {
        reasonCodeId: string | null;
        reasonWeights: Array<{ reasonCodeId: string; weight: string }> | null;
        states: { coding: string };
      };
    };
  const patch = async (body: object, status: number) =>
    env
      .patch(`production-events/${stopId}`, body, (await event()).headers.etag)
      .expect(status);
  const lines = async (runId: string) =>
    env.rows<WeightedLine>(
      `SELECT l."reason_code_id", l."quantity"::text AS "quantity", e."share"::text AS "share", e."event_id"
         FROM "loss_lines" l JOIN "loss_line_evidence" e ON e."loss_line_id" = l."id"
        WHERE l."run_id" = $1 AND l."ledger" = 'capacity' AND l."kind" = 'availability'
        ORDER BY l."reason_code_id"`,
      [runId],
    );

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodId = await env.periodId(env.world.unitA1, A);
    for (const [id, code] of [
      [mechanical, 'WR-MECH'],
      [electrical, 'WR-ELEC'],
    ]) {
      await env.rows(
        `INSERT INTO "reason_codes" ("id", "code", "name", "tenant_id", "is_active")
         VALUES ($1, $2, $2, $3, true)`,
        [id, code, env.world.tenantA],
      );
    }
    await env.outputEvent(env.world.unitA1, A, B, '300');
    stopId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('stores a percent split on the event and its coding revision; the largest reason is the primary', async () => {
    await patch(
      {
        reasonWeights: [
          { reasonCodeId: electrical, percent: '25' },
          { reasonCodeId: mechanical, percent: '75' },
        ],
      },
      200,
    );
    const { body } = await event();
    expect(body.reasonCodeId).toBe(mechanical);
    expect(body.reasonWeights).toEqual([
      { reasonCodeId: mechanical, weight: '0.75000000' },
      { reasonCodeId: electrical, weight: '0.25000000' },
    ]);
    expect(body.states.coding).toBe('coded');
    const [coding] = await env.rows<{ reason_weights: unknown }>(
      `SELECT "reason_weights" FROM "event_coding" WHERE "event_id" = $1 ORDER BY "revision" DESC LIMIT 1`,
      [stopId],
    );
    expect(coding.reason_weights).toEqual(body.reasonWeights);
  });

  it('recalculates one line per (stop, reason) with evidence share = segment share × weight', async () => {
    await env.settle();
    const accounting = await env.accounting(periodId);
    expect(accounting.data.run).toMatchObject({ status: 'validated' });
    const rows = await lines(accounting.data.run!.id);
    expect(rows).toHaveLength(2);
    const byReason = new Map(rows.map((row) => [row.reason_code_id, row]));
    const mech = byReason.get(mechanical)!;
    const elec = byReason.get(electrical)!;
    expect([mech.event_id, elec.event_id]).toEqual([stopId, stopId]);
    expect(new Dec(mech.share).eq('0.75')).toBe(true);
    expect(new Dec(elec.share).eq('0.25')).toBe(true);
    expect(new Dec(mech.quantity).eq(75)).toBe(true);
    expect(new Dec(elec.quantity).eq(25)).toBe(true);
    expect(env.totals(accounting, 'capacity')).toMatchObject({
      availability: '100',
      residual: '0',
    });
  });

  it.each([
    [
      'percents that do not add up to 100',
      [
        { reasonCodeId: mechanical, percent: '60' },
        { reasonCodeId: electrical, percent: '30' },
      ],
      'REASON_WEIGHTS_SUM',
    ],
    [
      'a repeated reason',
      [
        { reasonCodeId: mechanical, percent: '50' },
        { reasonCodeId: mechanical, percent: '50' },
      ],
      'REASON_WEIGHTS_DUPLICATE',
    ],
    [
      'seconds that miss the stop length',
      [
        { reasonCodeId: mechanical, seconds: 1800 },
        { reasonCodeId: electrical, seconds: 600 },
      ],
      'REASON_WEIGHTS_SUM',
    ],
    [
      'a reason of another library',
      [
        { reasonCodeId: mechanical, percent: '50' },
        { reasonCodeId: randomUUID(), percent: '50' },
      ],
      'INVALID_REFERENCE',
    ],
  ])('answers 422 for %s', async (_label, reasonWeights, code) => {
    const response = await patch({ reasonWeights }, 422);
    expect((response.body as { code: string }).code).toBe(code);
  });

  it('removes the split with null and keeps the primary reason', async () => {
    await patch({ reasonWeights: null }, 200);
    const { body } = await event();
    expect(body.reasonWeights).toBeNull();
    expect(body.reasonCodeId).toBe(mechanical);
  });
});
