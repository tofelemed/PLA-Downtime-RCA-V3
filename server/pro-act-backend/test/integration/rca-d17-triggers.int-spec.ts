import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { RcaWorld } from './support/rca-world';

interface Evaluation {
  trigger: string;
  outcome: string;
  fired_on: string;
  rca_id: string | null;
  detail: Record<string, unknown>;
}

/**
 * SME D17 / CA8 triggers on real Postgres with the seeded pilot policy (2 h, 1 % of the daily plan,
 * 3 same-mode incidents in 30 days, critical assets halved, Safety override): repeats per asset and
 * failure mode, a same-mode repeat linked to the open case while another mode still fires on its own,
 * the halved duration of a critical asset, the safety override at zero loss, and the lost-quantity
 * trigger on period approval from the approved ledger lines.
 */
describe('RCA triggers per SME D17 / CA8', () => {
  const env = new RcaWorld();
  const evaluations = (eventId: string) =>
    env.rows<Evaluation>(
      `SELECT "trigger", outcome::text AS outcome, fired_on::text AS fired_on, rca_id, detail
         FROM rca_trigger_evaluations WHERE event_id = $1 ORDER BY fired_at`,
      [eventId],
    );
  const failure = (startMinutesAgo: number, mode: string) =>
    env.stopEvent(env.world.unitA1, startMinutesAgo, startMinutesAgo - 15, {
      assetId: env.world.assetA1,
      failureMode: mode,
    });
  const seal: string[] = [];

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  it('D17 example: three 15-minute seal leaks in 30 days fire a repeat; another mode does not count', async () => {
    for (const start of [400, 300, 200])
      seal.push(await failure(start, 'Seal leak'));
    const motor = await failure(350, 'Motor insulation');
    await env.relay();
    expect(await evaluations(seal[1])).toEqual([]);
    expect(await evaluations(seal[2])).toEqual([
      expect.objectContaining({
        trigger: 'repeat',
        outcome: 'recommended',
        fired_on: 'closed',
      }),
    ]);
    expect((await evaluations(seal[2]))[0].detail).toMatchObject({
      failures: 3,
      repeatMatch: 'asset_and_mode',
    });
    expect(await evaluations(motor)).toEqual([]);
  });

  it('CA8 example: a new seal leak links to the open seal case; motor failures still fire on their own', async () => {
    const created = await env.createCase({
      title: 'Seal leaks on the extruder',
      unitId: env.world.unitA1,
    });
    await env.linkEvent(seal[0], { rcaId: created.id }).expect(201);
    const repeat = await failure(150, ' SEAL   leak ');
    for (const start of [140, 130]) await failure(start, 'Motor insulation');
    const motor = await failure(120, 'Motor insulation');
    await env.relay();
    expect(await evaluations(repeat)).toEqual([
      expect.objectContaining({
        trigger: 'repeat',
        outcome: 'linked_to_case',
        rca_id: created.id,
      }),
    ]);
    const links = await env.rows<{ target_id: string }>(
      `SELECT target_id FROM rca_case_links WHERE rca_id = $1 AND link_type = 'event'`,
      [created.id],
    );
    expect(links.map((link) => link.target_id)).toContain(repeat);
    const readiness = (
      await env.get(`rcas/${created.id}/readiness`).expect(200)
    ).body as {
      linkedRecurrences: number;
    };
    expect(readiness.linkedRecurrences).toBe(1);
    expect(await evaluations(motor)).toEqual([
      expect.objectContaining({
        trigger: 'repeat',
        outcome: 'recommended',
        rca_id: null,
      }),
    ]);
  });

  it('D17: a critical asset fires on half the duration (1 h instead of 2 h)', async () => {
    const plain = await env.stopEvent(env.world.unitA2, 70, 4);
    await env.rows(`UPDATE assets SET criticality = 'Critical' WHERE id = $1`, [
      env.world.assetA1,
    ]);
    const critical = await env.stopEvent(env.world.unitA1, 70, 4, {
      assetId: env.world.assetA1,
      failureMode: 'Gearbox bearing',
    });
    await env.relay();
    expect(await evaluations(plain)).toEqual([]);
    expect(await evaluations(critical)).toEqual([
      expect.objectContaining({ trigger: 'duration', outcome: 'recommended' }),
    ]);
    expect((await evaluations(critical))[0].detail).toMatchObject({
      thresholdSeconds: 3600,
      criticalAsset: true,
    });
  });

  it('D17 example: a safety marker fires at zero loss (override)', async () => {
    const nearMiss = await env.stopEvent(env.world.unitA2, 20, 18);
    await env.rows(
      `UPDATE production_events SET sol_type = 'Safety' WHERE id = $1`,
      [nearMiss],
    );
    const results = await env.triggers().evaluate(env.world.tenantA, nearMiss);
    expect(results.map((result) => [result.trigger, result.outcome])).toEqual([
      ['consequence', 'recommended'],
    ]);
  });

  it('D17: lost quantity over 1 % of the daily plan fires when the period is approved', async () => {
    const reason = await env.reasonCode('EXT');
    const loss = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: reason,
    });
    await env.approvePeriodA1(reason);
    await env.relay();
    const fired = (await evaluations(loss)).filter(
      (row) => row.trigger === 'quantity',
    );
    expect(fired).toEqual([
      expect.objectContaining({ fired_on: 'approved', outcome: 'recommended' }),
    ]);
    expect(fired[0].detail).toMatchObject({ share: 0.01 });
  });
});
