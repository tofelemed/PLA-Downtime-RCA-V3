/** Demo MQTT snapshot in engineering units: counters in t, rates in t/h, one sample/minute. */
import * as mqtt from 'mqtt';
import { setTimeout as sleep } from 'timers/promises';
import {
  MEASUREMENTS_CONNECTION_NAME,
  SIM_ELEMENT_PATH,
  SIM_TOPICS,
} from '../demo-mqtt/demo-mqtt-plan';
import {
  eventUpsert,
  measurementDigital,
  measurementNumeric,
  SimIdentity,
} from '../mqtt/sim-messages';
import { ShowcaseContext } from './showcase-context';
import { iso } from './showcase-window';

const RATE_KEY = 'DEMO-HDPE-unit200-pellet-rate';
const MINUTE = 60_000;

async function analogSignal(ctx: ShowcaseContext): Promise<string> {
  const manager = ctx.as('managers', 0);
  const unitId = ctx.ids.units.get('EXT2');
  const connections = await manager.listAll<{
    id: string;
    displayName: string;
  }>('/v2/connections');
  const connectionId = connections.find(
    (row) => row.displayName === MEASUREMENTS_CONNECTION_NAME,
  )?.id;
  if (!connectionId || !unitId)
    throw new Error('HDPE telemetry needs the demo MQTT seed first');
  const signals = await manager.listAll<{ id: string; sourceKey: string }>(
    '/v2/signals',
    { unitId },
  );
  const signal =
    signals.find((row) => row.sourceKey === RATE_KEY) ??
    (await manager.post<{ id: string }>(
      '/v2/signals',
      {
        connectionId,
        unitId,
        sourceKey: RATE_KEY,
        name: 'Demo: Extruder2 pellet production rate',
        sourcePath: 'proact/v1/HDPE/Polymer/Line2/Extruder2/measurements/Rate',
        semanticType: 'rate',
        canonicalUom: 't/h',
        rateTimebase: 'h',
        interpolation: 'step',
        expectedMin: '0',
        expectedMax: '30',
        cadenceSeconds: 60,
        maxGapSeconds: 180,
        isAuthority: false,
        effectiveFrom: iso(ctx.window.from),
      },
      'HDPE rate signal',
    ));
  const mappings = await manager.listAll<{ signalId: string }>(
    '/v2/unit-state-mappings',
    { unitId },
  );
  if (!mappings.some((row) => row.signalId === signal.id))
    await manager.post(
      '/v2/unit-state-mappings',
      {
        unitId,
        signalId: signal.id,
        rules: [],
        expectedIntervalSeconds: 60,
        jitterSeconds: 2,
        staleAfterIntervals: 3,
        isHeartbeat: true,
        effectiveFrom: iso(ctx.window.from),
        thresholds: {
          stopBelow: 0.5,
          reducedBelow: 22.4,
          hysteresis: 0.3,
          ratedValue: 28,
        },
        notes:
          'Demo: Extruder2 rate bands; reduced rate below 80% of 28 t/h; stop below 0.5 t/h',
      },
      'HDPE analog mapping',
    );
  return signal.id;
}

async function publishSnapshot(ctx: ShowcaseContext): Promise<void> {
  const ids = new SimIdentity(
    `hdpe-${iso(ctx.window.today)}`,
    'Demo-HDPE-gateway',
  );
  const client = await mqtt.connectAsync(
    process.env.DEMO_MQTT_BROKER_URL ?? 'mqtt://localhost:1884',
  );
  let counter = 12345;
  try {
    for (let minute = 0; minute <= 125; minute += 1) {
      const stopped = minute >= 60 && minute < 80;
      const reduced = minute >= 30 && minute < 60;
      const ts = iso(ctx.window.today + minute * MINUTE);
      const rate = stopped ? 0 : reduced ? 21 : 28;
      // A 28.8 t/h finishing rate adds 0.48 t/min, never tonnes every second.
      if (minute > 0 && !(minute > 60 && minute <= 80)) counter += 0.48;
      await client.publishAsync(
        SIM_TOPICS.measurement('Throughput'),
        JSON.stringify(
          measurementNumeric(
            ids,
            'F1DPwebid-throughput',
            Number(counter.toFixed(3)),
            't',
            ts,
          ),
        ),
        { qos: 1 },
      );
      await client.publishAsync(
        SIM_TOPICS.measurement('RunState'),
        JSON.stringify(
          measurementDigital(
            ids,
            'F1DPwebid-runstate',
            stopped ? { name: 'STOP', value: 0 } : { name: 'RUN', value: 1 },
            ts,
          ),
        ),
        { qos: 1 },
      );
      await client.publishAsync(
        'proact/v1/HDPE/Polymer/Line2/Extruder2/measurements/Rate',
        JSON.stringify(measurementNumeric(ids, RATE_KEY, rate, 't/h', ts)),
        { qos: 1 },
      );
    }
    const end = iso(ctx.window.today + 80 * MINUTE);
    await client.publishAsync(
      SIM_TOPICS.events,
      JSON.stringify(
        eventUpsert(ids, {
          eventId: `DEMO-MQTT-HDPE-${iso(ctx.window.today).slice(0, 10)}`,
          revision: end,
          start: iso(ctx.window.today + 60 * MINUTE),
          end,
          elementPath: SIM_ELEMENT_PATH,
          attributes: {
            ReasonCode: 'MECH-DIE',
            Description:
              'Demo: die pressure trip; screen pack cleaned and line restarted',
            Quantity: 9.6,
          },
        }),
      ),
      { qos: 1 },
    );
  } finally {
    await client.endAsync();
  }
}

export async function seedHdpeTelemetry(ctx: ShowcaseContext): Promise<void> {
  if (ctx.dryRun) return;
  // The completed morning snapshot cannot contain future source timestamps.
  if (ctx.window.now < ctx.window.today + 126 * MINUTE) {
    ctx.logger.warn('Demo telemetry snapshot deferred until 08:06 plant time');
    return;
  }
  const signalId = await analogSignal(ctx);
  await publishSnapshot(ctx);
  const window = {
    from: iso(ctx.window.today),
    to: iso(ctx.window.today + 125 * MINUTE),
  };
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const preview = await ctx.as('managers', 0).post<{
      result: { quantity?: string | null };
      samples: unknown[];
    }>(`/v2/signals/${signalId}/preview`, window, 'HDPE telemetry preview');
    if (
      preview.samples.length >= 125 &&
      Number(preview.result.quantity) === 45.5
    ) {
      ctx.tally.add(
        'HDPE MQTT snapshot',
        378,
        0,
        `unit200 integrated quantity ${preview.result.quantity} t`,
      );
      return;
    }
    await sleep(1000);
  }
  throw new Error(
    'HDPE MQTT snapshot was not visible in the signal preview within 30 seconds',
  );
}
