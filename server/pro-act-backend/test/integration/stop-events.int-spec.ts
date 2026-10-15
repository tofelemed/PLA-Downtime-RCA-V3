import { randomUUID } from 'crypto';
import { SampleStore } from '../../src/signals/sample-store';
import { DerivedStopEngineService } from '../../src/stop-events/derived-stop-engine.service';
import { A, SignalSpec } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

const MINUTE = 60_000;

interface EventRow {
  id: string;
  event_id: string | null;
  source_kind: string;
  physical_state: string;
  schedule_class: string;
  start_time: Date;
  end_time: Date | null;
  failure_mode: string | null;
  occurrence_id: string;
}

interface PairBody {
  id: string;
  state: string;
  mode: string;
  kept: { id: string } | null;
  evidence: { id: string } | null;
  copied: Record<string, string>;
}

/**
 * Plan 1.10 state-derived stops and DT-04 / SME D5 on real Postgres: a 1-minute state heartbeat of unit A1
 * derives one unplanned stop; reprocessing is idempotent and a late sample moves the stop (old key
 * retracted, new one created); a manual entry of the same stop merges into the derived stop automatically
 * (operator cause copied, manual kept as superseded evidence) and the merge can be undone; repeat stops of
 * one asset and reason form one incident that a "new failure" mark breaks.
 */
describe('state-derived stops, duplicate merge and incidents (plan 1.10, DT-04, SME D5)', () => {
  const env = new AccountingWorld();
  let signalId = '';
  const asset = randomUUID();
  let reasonId = '';
  const now = () => new Date(Date.parse(A) + 125 * MINUTE);

  const derived = () =>
    env.rows<EventRow>(
      `SELECT "id", "event_id", "source_kind", "physical_state", "schedule_class", "start_time", "end_time",
              "failure_mode", "occurrence_id"
         FROM "production_events" WHERE "unit_id" = $1 AND "source_kind" = 'derived' ORDER BY "created_at"`,
      [env.world.unitA1],
    );
  const event = async (id: string) =>
    (
      await env.rows<EventRow>(
        `SELECT "id", "event_id", "source_kind", "physical_state", "schedule_class", "start_time", "end_time",
                "failure_mode", "occurrence_id" FROM "production_events" WHERE "id" = $1`,
        [id],
      )
    )[0];
  const engine = () => env.app.get(DerivedStopEngineService);
  const scope = () => ({
    tenantId: env.world.tenantA,
    unitId: env.world.unitA1,
  });

  const manualStop = async (
    fromMin: number,
    toMin: number,
    extra: object = {},
  ) => {
    const response = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, fromMin * MINUTE),
        endTime: plus(A, toMin * MINUTE),
        physicalType: 'downtime',
        scheduleClass: 'unplanned',
        description: 'operator entry',
        ...extra,
      })
      .expect(201);
    return (response.body as { id: string }).id;
  };

  beforeAll(async () => {
    await env.start();
    signalId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'state',
      from: plus(A, -24 * 60 * MINUTE),
      to: null,
    } as unknown as SignalSpec);
    await env
      .post('unit-state-mappings', {
        unitId: env.world.unitA1,
        signalId,
        rules: [
          { match: '1', state: 'running' },
          { match: '0', state: 'internal_stop' },
        ],
        expectedIntervalSeconds: 60,
        effectiveFrom: plus(A, -60 * MINUTE),
      })
      .expect(201);
    const points = Array.from({ length: 125 }, (_, i): [number, string] => [
      i,
      i >= 60 && i < 90 ? '0' : '1',
    ]);
    await env.samples(signalId, A, points);
    await env.rows(
      `INSERT INTO "assets" ("id", "code", "name", "unit_id", "tenant_id", "asset_type")
       VALUES ($1, 'CV-1', 'Conveyor', $2, $3, 'Conveyor')`,
      [asset, env.world.unitA1, env.world.tenantA],
    );
    reasonId = randomUUID();
    await env.rows(
      `INSERT INTO reason_codes (id, code, name, tenant_id, is_active) VALUES ($1, $2, 'Jam', $3, true)`,
      [reasonId, `JAM-${reasonId.slice(0, 6)}`, env.world.tenantA],
    );
  });
  afterAll(() => env.stop());

  it('derives one unplanned downtime event from the first stop sample to the first recovery', async () => {
    const outcome = await engine().processUnit(scope(), now());
    expect(outcome).toEqual({ created: 1, updated: 0, retracted: 0 });
    const [stop] = await derived();
    expect(stop).toMatchObject({
      source_kind: 'derived',
      physical_state: 'closed',
      schedule_class: 'unplanned',
    });
    expect(new Date(stop.start_time).toISOString()).toBe(plus(A, 60 * MINUTE));
    expect(new Date(stop.end_time as Date).toISOString()).toBe(
      plus(A, 90 * MINUTE),
    );
    expect(stop.event_id).toMatch(/^state:/);
    const revisions = await env.rows<{ kind: string }>(
      `SELECT "kind" FROM "event_revisions" WHERE "event_id" = $1`,
      [stop.id],
    );
    expect(revisions.map((r) => r.kind)).toEqual(['source']);
  });

  it('reprocessing the same samples writes nothing (idempotent)', async () => {
    expect(await engine().processUnit(scope(), now())).toEqual({
      created: 0,
      updated: 0,
      retracted: 0,
    });
  });

  it('a late stop sample moves the start: the old key is retracted, the new stop created', async () => {
    // a corrected archive value, stored now for an instant before the stop the first run saw
    await env.app.get(SampleStore).insertSample({
      tenantId: env.world.tenantA,
      signalId,
      observedAt: new Date(Date.parse(A) + 59 * MINUTE),
      value: '0',
      stateName: null,
      stateValue: null,
      quality: 'good',
      qualityFlags: null,
      rawId: randomUUID(),
      rawReceivedAt: new Date(),
      sourceRevision: '2',
    });
    const outcome = await engine().processUnit(
      scope(),
      new Date(now().getTime() + MINUTE),
    );
    expect(outcome).toEqual({ created: 1, updated: 0, retracted: 1 });
    const live = (await derived()).filter((e) => e.physical_state === 'closed');
    expect(live).toHaveLength(1);
    expect(new Date(live[0].start_time).toISOString()).toBe(
      plus(A, 59 * MINUTE),
    );
  });

  it('a manual entry of the same stop merges into the derived stop; its cause is copied', async () => {
    const manual = await manualStop(59, 91, { failureMode: 'Belt jam' });
    await env.relay();
    const [kept] = (await derived()).filter(
      (e) => e.physical_state === 'closed',
    );
    expect(await event(manual)).toMatchObject({
      physical_state: 'superseded',
      occurrence_id: kept.occurrence_id,
    });
    expect(kept.failure_mode).toBe('Belt jam');
    const list = await env
      .get(`stop-reconciliations?eventId=${manual}`)
      .expect(200);
    const [pair] = (list.body as { items: PairBody[] }).items;
    expect(pair).toMatchObject({ state: 'merged', mode: 'auto' });
    expect(pair.kept?.id).toBe(kept.id);
    expect(pair.copied).toEqual({ failureMode: 'Belt jam' });
  });

  it('a re-derived stop (late correction) releases the merged manual entry, which merges into the new stop', async () => {
    const [manual] = await env.rows<{ id: string }>(
      `SELECT "id" FROM "production_events" WHERE "unit_id" = $1 AND "source_kind" = 'manual' AND "physical_state" = 'superseded'`,
      [env.world.unitA1],
    );
    await env.app.get(SampleStore).insertSample({
      tenantId: env.world.tenantA,
      signalId,
      observedAt: new Date(Date.parse(A) + 58 * MINUTE),
      value: '0',
      stateName: null,
      stateValue: null,
      quality: 'good',
      qualityFlags: null,
      rawId: randomUUID(),
      rawReceivedAt: new Date(),
      sourceRevision: '2',
    });
    const outcome = await engine().processUnit(
      scope(),
      new Date(now().getTime() + 2 * MINUTE),
    );
    expect(outcome).toMatchObject({ created: 1, retracted: 1 });
    const [current] = (await derived()).filter(
      (e) => e.physical_state === 'closed',
    );
    expect(new Date(current.start_time).toISOString()).toBe(
      plus(A, 58 * MINUTE),
    );
    expect(await event(manual.id)).toMatchObject({
      physical_state: 'superseded',
      occurrence_id: current.occurrence_id,
    });
    expect(current.failure_mode).toBe('Belt jam');
  });

  it('undo restores the manual stop and clears the copied cause; the pair is not merged again', async () => {
    const [pair] = (
      (await env.get('stop-reconciliations?state=merged').expect(200)).body as {
        items: PairBody[];
      }
    ).items;
    await env
      .post(`stop-reconciliations/${pair.id}/undo`, {
        reason: 'two separate jams',
      })
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    const manual = await event(pair.evidence?.id as string);
    expect(manual.physical_state).toBe('closed');
    expect(manual.occurrence_id).toBe(manual.id);
    expect((await event(pair.kept?.id as string)).failure_mode).toBeNull();
    await env.relay();
    expect((await event(manual.id)).physical_state).toBe('closed');
  });

  it('repeat stops of one asset and reason within 2 min form one incident; a new-failure mark breaks it', async () => {
    const first = await manualStop(300, 303, {
      assetId: asset,
      reasonCodeId: reasonId,
    });
    const second = await manualStop(305, 309, {
      assetId: asset,
      reasonCodeId: reasonId,
    });
    await env.relay();
    const listed = await env
      .get(`stop-incidents?unitId=${env.world.unitA1}`)
      .expect(200);
    const [incident] = (
      listed.body as {
        items: Array<{
          stopCount: number;
          stoppedSeconds: number;
          envelopeSeconds: number;
        }>;
      }
    ).items;
    expect(incident).toMatchObject({
      stopCount: 2,
      stoppedSeconds: 7 * 60,
      envelopeSeconds: 9 * 60,
    });
    const byEvent = await env
      .get(`stop-incidents/by-event/${first}`)
      .expect(200);
    expect(
      (byEvent.body as { stops: Array<{ id: string }> }).stops.map((s) => s.id),
    ).toEqual([first, second]);
    const occurrence = (await event(second)).occurrence_id;
    await env
      .post('stop-incidents/new-failure-marks', {
        occurrenceId: occurrence,
        reason: 'belt replaced at 10:04',
      })
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    const after = await env.get(`stop-incidents/by-event/${first}`).expect(200);
    expect(after.body).toEqual({});
  });
});
