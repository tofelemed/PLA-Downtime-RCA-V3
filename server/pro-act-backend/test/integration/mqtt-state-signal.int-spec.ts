import { DerivedStopEngineService } from '../../src/stop-events/derived-stop-engine.service';
import { MqttAdapterModule } from '../../src/intake/adapters/mqtt/mqtt-adapter.module';
import { IntakeService } from '../../src/intake/intake.service';
import { NormalizationService } from '../../src/intake/normalization/normalization.service';
import {
  exampleDecodeConnection,
  examplePacket,
} from '../../src/intake/adapters/mqtt/mqtt-decode.example';
import { exampleMqttConfig } from '../../src/intake/adapters/mqtt/mqtt-config.example';
import { decodeMqttMessage } from '../../src/intake/adapters/mqtt/profiles';
import { AccountingWorld, plus } from './support/accounting-world';
import { A, MINUTE, SignalSpec } from './support/actuals-world';

/** Isolated proact_test only: real intake → normalizer → samples → derived preview, plus read-only validation. */
describe('MQTT machine state signal workflow', () => {
  class StateWorld extends AccountingWorld {
    protected extraModules() {
      return [MqttAdapterModule];
    }
  }
  const env = new StateWorld();
  const topic = 'proact/v1/HDPE/Polymer/Line1/Extruder1/state';
  const config = () =>
    exampleMqttConfig({
      mqtt: { topics: ['proact/v1/+/+/+/+/state'] },
      payloadProfile: {
        kind: 'state_json',
        topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/state',
        identityStrategy: 'seq_boot',
      },
    });
  let signalId: string;
  const packet = (minute: number, state: string, seq = minute + 1) => {
    const connection = {
      ...exampleDecodeConnection({
        mqtt: { topics: ['proact/v1/+/+/+/+/state'] },
        payloadProfile: {
          kind: 'state_json',
          topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/state',
          identityStrategy: 'seq_boot',
        },
      }),
      tenantId: env.world.tenantA,
      connectionId: env.connections.mqtt,
    };
    return examplePacket(
      {
        topic,
        payload: {
          schema_version: '1.0',
          quality: { good: true },
          state: { name: state, value: state === 'RUN' ? 1 : 0 },
          ts: plus(A, minute * MINUTE),
          seq,
          boot_id: 'state-test',
        },
        receivedAt: plus(A, 30 * MINUTE),
        retained: true,
      },
      connection,
    );
  };
  beforeAll(async () => {
    await env.start();
    signalId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'state',
      connection: 'mqtt',
      from: plus(A, -MINUTE),
      to: null,
    } as unknown as SignalSpec);
    await env.rows(
      'UPDATE signals SET source_key = $1, canonical_uom = NULL WHERE id = $2',
      [topic, signalId],
    );
    await env.rows(
      'UPDATE integration_connections SET endpoint_config = $1::jsonb WHERE id = $2',
      [JSON.stringify(config()), env.connections.mqtt],
    );
    await env
      .post('unit-state-mappings', {
        unitId: env.world.unitA1,
        signalId,
        rules: [
          { match: 'RUN', state: 'running' },
          { match: 'STOP', state: 'internal_stop' },
        ],
        expectedIntervalSeconds: 60,
        staleAfterIntervals: 3,
        jitterSeconds: 0,
        effectiveFrom: plus(A, -MINUTE),
      })
      .expect(201);
  });
  afterAll(() => env.stop());

  it('validates saved-profile binding and rejects bad payloads without storing observations', async () => {
    const body = {
      topic,
      payload: packet(0, 'RUN').payload.toString('utf8'),
      receivedAt: plus(A, MINUTE),
    };
    const before = await env.rows<{ count: string }>(
      'SELECT count(*) FROM raw_observations',
    );
    const response = await env
      .post(`connections/${env.connections.mqtt}/mqtt-preview`, body)
      .expect(200);
    expect(response.body).toMatchObject({
      ok: true,
      kind: 'state',
      sourceKey: topic,
      bindingStatus: 'bound',
      binding: { signalId },
    });
    await env
      .post(`connections/${env.connections.mqtt}/mqtt-preview`, {
        ...body,
        payload: '{}',
      })
      .expect(200)
      .then((result) => expect(result.body).toMatchObject({ ok: false }));
    await env
      .post(
        `connections/${env.connections.mqtt}/mqtt-preview`,
        body,
        env.adminB,
      )
      .expect(404);
    expect(await env.rows('SELECT count(*) FROM raw_observations')).toEqual(
      before,
    );
  });

  it('retains late states, deduplicates delivery, and derives a stop idempotently', async () => {
    const intake = env.app.get(IntakeService);
    const normalizer = env.app.get(NormalizationService);
    for (const minute of [0, 1, 2, 4, 3, 5, 6, 7, 8, 9]) {
      const decoded = decodeMqttMessage(
        packet(minute, minute >= 3 && minute < 6 ? 'STOP' : 'RUN'),
      );
      if (!decoded.ok) throw new Error(decoded.detail);
      const accepted = await intake.accept(
        { tenantId: env.world.tenantA, connectionId: env.connections.mqtt },
        decoded.envelope,
      );
      expect(accepted.ticket).toBeTruthy();
      const result = await normalizer.normalize(accepted.ticket!);
      if (
        result.status === 'processed' &&
        result.result.status === 'quarantined'
      )
        throw new Error(JSON.stringify(result.result));
      expect(result).toMatchObject({
        status: 'processed',
        result: { status: 'applied' },
      });
      const repeated = await intake.accept(
        { tenantId: env.world.tenantA, connectionId: env.connections.mqtt },
        decoded.envelope,
      );
      expect(repeated.status).toBe('duplicate');
    }
    const samples = await env.rows<{ state_name: string; quality: string }>(
      'SELECT state_name, quality FROM measurement_samples WHERE signal_id = $1 ORDER BY observed_at',
      [signalId],
    );
    expect(samples).toHaveLength(10);
    expect(samples.every((row) => row.quality === 'good')).toBe(true);
    expect(samples.slice(3, 6).map((row) => row.state_name)).toEqual([
      'STOP',
      'STOP',
      'STOP',
    ]);
    const preview = await env
      .get(
        `derived-stops/preview?unitId=${env.world.unitA1}&from=${A}&to=${plus(A, 10 * MINUTE)}`,
      )
      .expect(200);
    expect(preview.body).toMatchObject({
      mapped: true,
      stops: [
        {
          state: 'internal_stop',
          startTime: plus(A, 3 * MINUTE),
          endTime: plus(A, 6 * MINUTE),
        },
      ],
    });

    const engine = env.app.get(DerivedStopEngineService);
    const scope = { tenantId: env.world.tenantA, unitId: env.world.unitA1 };
    const now = new Date(plus(A, 10 * MINUTE));
    expect(await engine.processUnit(scope, now)).toMatchObject({ created: 1 });
    expect(await engine.processUnit(scope, now)).toEqual({
      created: 0,
      updated: 0,
      retracted: 0,
    });
    const events = await env.rows<{
      physical_type: string;
      start_time: Date;
      end_time: Date;
    }>(
      "SELECT physical_type, start_time, end_time FROM production_events WHERE unit_id = $1 AND source_kind = 'derived'",
      [env.world.unitA1],
    );
    expect(events).toHaveLength(1);
    expect(events[0].physical_type).toBe('downtime');
    expect(events[0].start_time.toISOString()).toBe(plus(A, 3 * MINUTE));
    expect(events[0].end_time.toISOString()).toBe(plus(A, 6 * MINUTE));
  });
});
