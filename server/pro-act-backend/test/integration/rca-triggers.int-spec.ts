import { B, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { RcaWorld } from './support/rca-world';

/**
 * Plan 3.9 RCA01 / T42 on real Postgres through the outbox consumer: a running unplanned stop past the
 * pilot 2 h threshold (SME D17) is recommended once (provisional), its closure confirms the same evaluation,
 * replays and sweeps are suppressed duplicates, no case is opened under the recommend-only default; a
 * unit policy `autoCreate: create` opens one case with the event linked; an IOW advisory without
 * impact evidence can be recommended by a hint rule but gets no loss line and no downtime (T42).
 */
describe('RCA triggers (plan 3.9, RCA01, T42)', () => {
  const env = new RcaWorld();

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  const evaluations = (eventId: string) =>
    env.rows<{
      provisional: boolean;
      outcome: string;
      state: string;
      rca_id: string | null;
    }>(
      `SELECT provisional, outcome::text AS outcome, state, rca_id FROM rca_trigger_evaluations WHERE event_id = $1`,
      [eventId],
    );

  it('RCA01: open stop past the threshold → one provisional recommendation; closure confirms it', async () => {
    const stopId = await env.stopEvent(env.world.unitA2, 121, null);
    await env.relay();
    const [open] = await env.recommendations(stopId);
    expect(open).toMatchObject({
      trigger: 'duration',
      provisional: true,
      outcome: 'recommended',
      state: 'open',
      rcaId: null,
    });

    const event = (await env.get(`production-events/${stopId}`).expect(200))
      .body as { rowVersion: number };
    await env
      .http()
      .post(`/api/v2/production-events/${stopId}/close`)
      .set('Authorization', `Bearer ${env.admin}`)
      .set('Idempotency-Key', `close-${stopId}`)
      .set('If-Match', `"${event.rowVersion}"`)
      .send({
        endTime: new Date(Date.now() - 60_000).toISOString(),
        reason: 'restarted',
      })
      .expect(200);
    await env.relay();
    expect(await evaluations(stopId)).toEqual([
      {
        provisional: false,
        outcome: 'recommended',
        state: 'open',
        rca_id: null,
      },
    ]);

    const replay = await env.triggers().evaluate(env.world.tenantA, stopId);
    expect(replay.map((r) => r.outcome)).toEqual(['suppressed_duplicate']);
    await env.sweep();
    expect(await env.sweep()).toBe(0);
    expect(await evaluations(stopId)).toHaveLength(1);
    const cases = await env.rows(
      `SELECT 1 FROM rca_case_links WHERE target_id = $1`,
      [stopId],
    );
    expect(cases).toHaveLength(0);
  });

  it('below the threshold and planned stops never fire; with v2.rca off nothing is evaluated', async () => {
    const short = await env.stopEvent(env.world.unitA2, 300, 250);
    const planned = await env.stopEvent(env.world.unitA2, 240, 100, {
      scheduleClass: 'planned',
    });
    await env.relay();
    expect(await evaluations(short)).toHaveLength(0);
    expect(await evaluations(planned)).toHaveLength(0);
    await env.rows(
      `UPDATE feature_flags SET enabled = false WHERE tenant_id = $1 AND key = 'v2.rca'`,
      [env.world.tenantA],
    );
    const off = await env.stopEvent(env.world.unitA2, 600, 400);
    await env.relay();
    expect(await evaluations(off)).toHaveLength(0);
    await env.rows(
      `UPDATE feature_flags SET enabled = true WHERE tenant_id = $1 AND key = 'v2.rca'`,
      [env.world.tenantA],
    );
  });

  it('policy autoCreate=create opens one case with the event linked (provisional marker in the case)', async () => {
    await env.unitRcaPolicy(env.world.unitA3, {
      durationThresholdSeconds: 3600,
      costThreshold: null,
      repeatCount: 3,
      repeatWindowDays: 30,
      autoCreate: 'create',
    });
    const stopId = await env.stopEvent(env.world.unitA3, 180, 60);
    await env.relay();
    const [row] = await evaluations(stopId);
    expect(row).toMatchObject({ outcome: 'case_created', state: 'accepted' });
    const links = await env.rows<{ rca_id: string; source: string }>(
      `SELECT rca_id, source FROM rca_case_links WHERE target_id = $1`,
      [stopId],
    );
    expect(links).toEqual([{ rca_id: row.rca_id, source: 'trigger' }]);
    const [rca] = await env.rows<{
      root_cause: string | null;
      status: string;
      unit_id: string;
    }>(`SELECT root_cause, status, unit_id FROM rcas WHERE id = $1`, [
      row.rca_id,
    ]);
    expect(rca).toEqual({
      root_cause: null,
      status: 'Draft',
      unit_id: env.world.unitA3,
    });
    await env.triggers().evaluate(env.world.tenantA, stopId);
    expect(
      await env.rows(`SELECT 1 FROM rcas WHERE unit_id = $1`, [
        env.world.unitA3,
      ]),
    ).toHaveLength(1);
  });

  it('T42: an IOW advisory without impact evidence may be recommended but attributes no loss', async () => {
    await env.hintRule('IOW breach', {
      when: {
        all: [
          { field: 'eventType', op: 'eq', value: 'IOW' },
          { field: 'unitId', op: 'eq', value: env.world.unitA1 },
        ],
      },
      then: [{ flag: 'rca_recommended' }],
    });
    const iow = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        eventType: 'IOW',
        startTime: plus(B, HOUR),
        endTime: plus(B, 2 * HOUR),
        description: 'pressure above IOW limit',
      })
      .expect(201);
    const iowId = (iow.body as { id: string }).id;
    await env.settle();
    const [hint] = await env.recommendations(iowId);
    expect(hint).toMatchObject({
      trigger: 'rule',
      outcome: 'recommended',
      detail: { recommendOnly: true },
    });
    const [event] = await env.rows<{
      physical_type: string;
      impact_mode: string;
      rca_state: string;
    }>(
      `SELECT physical_type::text, impact_mode::text, rca_state::text FROM production_events WHERE id = $1`,
      [iowId],
    );
    expect(event).toEqual({
      physical_type: 'advisory',
      impact_mode: 'none',
      rca_state: 'none',
    });
    expect(
      await env.rows(`SELECT 1 FROM loss_lines WHERE cause_event_id = $1`, [
        iowId,
      ]),
    ).toHaveLength(0);
    const accounting = await env.accounting(env.periodB1);
    expect(env.totals(accounting, 'capacity').availability).toBe('0');
  });

  it('a recommendation is dismissed by a person with a reason, never automatically', async () => {
    const stopId = await env.stopEvent(env.world.unitA2, 900, 760);
    await env.relay();
    const [hint] = await env.recommendations(stopId);
    await env
      .post(
        `rca-recommendations/${hint.id}/dismiss`,
        { reason: 'known cause' },
        env.operator,
      )
      .expect(403);
    await env
      .post(`rca-recommendations/${hint.id}/dismiss`, { reason: 'known cause' })
      .expect(200);
    expect(await env.recommendations(stopId)).toHaveLength(0);
    const [dismissed] = await env.recommendations(stopId, 'dismissed');
    expect(dismissed.detail).toMatchObject({ dismissReason: 'known cause' });
  });
});
