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

  it('a late stop sample older than the 24 h lookback but inside the late-sample horizon derives its stop', async () => {
    // a corrected archive value delivered late: observed 110 min after A, stored when the engine runs 30 h after A
    await env.app.get(SampleStore).insertSample({
      tenantId: env.world.tenantA,
      signalId,
      observedAt: new Date(Date.parse(A) + 110 * MINUTE),
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
      new Date(Date.parse(A) + 30 * 60 * MINUTE),
    );
    expect(outcome).toEqual({ created: 1, updated: 0, retracted: 0 });
    const late = (await derived()).filter(
      (e) =>
        e.physical_state === 'closed' &&
        new Date(e.start_time).toISOString() === plus(A, 110 * MINUTE),
    );
    expect(late).toHaveLength(1);
    expect(new Date(late[0].end_time as Date).toISOString()).toBe(
      plus(A, 111 * MINUTE),
    );
  });

  it('coding a derived stop keeps it derived, so the engine still owns it', async () => {
    const [stop] = (await derived()).filter(
      (e) =>
        e.physical_state === 'closed' &&
        new Date(e.start_time).toISOString() === plus(A, 110 * MINUTE),
    );
    const current = await env.get(`production-events/${stop.id}`).expect(200);
    const { rowVersion } = current.body as { rowVersion: number };
    await env
      .patch(
        `production-events/${stop.id}`,
        { reasonCodeId: reasonId },
        `"${rowVersion}"`,
      )
      .expect(200);
    const [row] = await env.rows<{ source_kind: string; coding_state: string }>(
      `SELECT "source_kind", "coding_state" FROM "production_events" WHERE "id" = $1`,
      [stop.id],
    );
    expect(row).toEqual({ source_kind: 'derived', coding_state: 'coded' });
  });

  it('clearing the reason of a coded stop uncodes it and gives back the classification its code filled (Marun E2E A–C)', async () => {
    const speedLoss = randomUUID();
    await env.rows(
      `INSERT INTO reason_codes (id, code, name, tenant_id, is_active, default_oee_component)
       VALUES ($1, $2, 'Reduced rate', $3, true, 'performance')`,
      [speedLoss, `SPEED-${speedLoss.slice(0, 6)}`, env.world.tenantA],
    );
    const [stop] = (await derived()).filter(
      (e) =>
        e.physical_state === 'closed' &&
        new Date(e.start_time).toISOString() === plus(A, 110 * MINUTE),
    );
    const read = async () =>
      (
        (await env.get(`production-events/${stop.id}`).expect(200)).body as {
          rowVersion: number;
        }
      ).rowVersion;
    await env
      .patch(
        `production-events/${stop.id}`,
        { reasonCodeId: speedLoss },
        `"${await read()}"`,
      )
      .expect(200);
    const state = () =>
      env.rows<{
        coding_state: string;
        oee_component: string;
        basis: unknown;
        overrides: Record<string, number> | null;
      }>(
        `SELECT "coding_state", "oee_component", "classification_basis" AS basis, "user_overrides" AS overrides
           FROM "production_events" WHERE "id" = $1`,
        [stop.id],
      );
    expect((await state())[0]).toMatchObject({
      coding_state: 'coded',
      oee_component: 'performance',
    });
    await env
      .patch(
        `production-events/${stop.id}`,
        {
          reasonCodeId: null,
          changeReason: 'Coded by mistake: the owner keeps this stop uncoded',
        },
        `"${await read()}"`,
      )
      .expect(200);
    const [after] = await state();
    expect(after).toMatchObject({
      coding_state: 'uncoded',
      oee_component: 'availability',
      basis: null,
    });
    expect(after.overrides ?? {}).not.toHaveProperty('oeeComponent');
    const [revision] = await env.rows<{ change_reason: string | null }>(
      `SELECT "change_reason" FROM "event_revisions" WHERE "event_id" = $1 AND "kind" = 'user' ORDER BY "revision" DESC LIMIT 1`,
      [stop.id],
    );
    expect(revision.change_reason).toBe(
      'Coded by mistake: the owner keeps this stop uncoded',
    );
    await env
      .patch(
        `production-events/${stop.id}`,
        { changeReason: 'x'.repeat(1001) },
        `"${await read()}"`,
      )
      .expect(422);
  });

  describe('a reasonless stop left coded (Marun regression R1)', () => {
    const stopId = async () =>
      (await derived()).filter(
        (e) =>
          e.physical_state === 'closed' &&
          new Date(e.start_time).toISOString() === plus(A, 110 * MINUTE),
      )[0].id;
    const leaveCoded = (id: string, pending = false) =>
      env.rows(
        `UPDATE "production_events" SET "reason_code_id" = NULL, "coding_state" = 'coded', "status" = 'Coded',
                "investigation_pending" = $2, "verified_by" = $3, "verified_at" = now() WHERE "id" = $1`,
        [id, pending, randomUUID()],
      );
    const codingOf = async (id: string) =>
      (
        await env.rows<{
          coding_state: string;
          status: string;
          verified_by: string | null;
        }>(
          `SELECT "coding_state", "status", "verified_by" FROM "production_events" WHERE "id" = $1`,
          [id],
        )
      )[0];

    it('an OEE-only edit on a reasonless coded stop makes it uncoded and clears its verification', async () => {
      const id = await stopId();
      await leaveCoded(id);
      const current = await env.get(`production-events/${id}`).expect(200);
      const { rowVersion } = current.body as { rowVersion: number };
      await env
        .patch(
          `production-events/${id}`,
          { oeeComponent: 'performance' },
          `"${rowVersion}"`,
        )
        .expect(200);
      expect(await codingOf(id)).toEqual({
        coding_state: 'uncoded',
        status: 'Open',
        verified_by: null,
      });
    });

    it('the repair migration uncodes reasonless coded stops, except those under investigation', async () => {
      const { UncodeReasonlessCodedStops1794221600000 } = await import(
        '../../src/database/migrations/1794221600000-UncodeReasonlessCodedStops'
      );
      const migration = new UncodeReasonlessCodedStops1794221600000();
      const runner = env.harness.dataSource.createQueryRunner();
      await runner.connect();
      try {
        const id = await stopId();
        await leaveCoded(id);
        await migration.up(runner);
        expect(await codingOf(id)).toEqual({
          coding_state: 'uncoded',
          status: 'Open',
          verified_by: null,
        });
        await leaveCoded(id, true);
        await migration.up(runner);
        expect(await codingOf(id)).toMatchObject({
          coding_state: 'coded',
          status: 'Coded',
        });
        await migration.down();
      } finally {
        await runner.release();
      }
    });

    it('the repair is recorded as a System revision so the latest revision matches the row (O1)', async () => {
      const { UncodeReasonlessCodedStops1794221600000 } = await import(
        '../../src/database/migrations/1794221600000-UncodeReasonlessCodedStops'
      );
      const { RecordUncodedStopRepairRevision1794222400000 } = await import(
        '../../src/database/migrations/1794222400000-RecordUncodedStopRepairRevision'
      );
      const record = new RecordUncodedStopRepairRevision1794222400000();
      const runner = env.harness.dataSource.createQueryRunner();
      await runner.connect();
      const latestOf = async (id: string) =>
        (
          await env.rows<{
            revision: number;
            kind: string;
            actor_kind: string;
            actor_id: string | null;
            change_reason: string | null;
            coding_state: string;
            status: string;
          }>(
            `SELECT "revision", "kind", "actor_kind", "actor_id", "change_reason",
                    "effective_facts"->>'codingState' AS "coding_state", "effective_facts"->>'status' AS "status"
               FROM "event_revisions" WHERE "event_id" = $1 ORDER BY "revision" DESC LIMIT 1`,
            [id],
          )
        )[0];
      try {
        const id = await stopId();
        await leaveCoded(id, false);
        await env.rows(
          `UPDATE "event_revisions" r SET "effective_facts" = r."effective_facts"
                  || '{"codingState": "coded", "status": "Coded", "reasonCodeId": null}'::jsonb
            WHERE r."event_id" = $1
              AND r."revision" = (SELECT max("revision") FROM "event_revisions" WHERE "event_id" = $1)`,
          [id],
        );
        const before = await latestOf(id);
        await new UncodeReasonlessCodedStops1794221600000().up(runner);
        await record.up(runner);
        const after = await latestOf(id);
        expect(after).toEqual({
          revision: before.revision + 1,
          kind: 'system',
          actor_kind: 'system',
          actor_id: null,
          change_reason: 'Repair: reasonless stop marked uncoded',
          coding_state: 'uncoded',
          status: 'Open',
        });
        await record.up(runner);
        expect((await latestOf(id)).revision).toBe(after.revision);
        const history = await env
          .get(`production-events/${id}/revisions`)
          .expect(200);
        const { revisions } = history.body as {
          revisions: Array<{ revision: number; actorSource: string | null }>;
        };
        expect(
          revisions.find((r) => r.revision === after.revision),
        ).toMatchObject({
          actorSource: 'data-repair',
        });
        await record.down(runner);
        expect((await latestOf(id)).revision).toBe(before.revision);
      } finally {
        await runner.release();
      }
    });
  });
});
