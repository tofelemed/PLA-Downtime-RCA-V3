/**
 * Integration console activity: checks that the two demo MQTT connections (scripts/demo-mqtt) have running
 * subscribe jobs, runs the publisher simulator for a short burst of closed events and a series of
 * measurement samples (console counters, signal samples, MQTT-sourced events on Extruder Line 1) and,
 * when the events connection has no quarantined message yet, publishes one malformed message for the
 * Quarantine tab. Nothing is started or reconfigured here.
 */
import * as mqtt from 'mqtt';
import { setTimeout as sleep } from 'timers/promises';
import {
  DEFAULT_BROKER_URL,
  EVENTS_CONNECTION_NAME,
  MEASUREMENTS_CONNECTION_NAME,
  SIM_TOPICS,
} from '../demo-mqtt/demo-mqtt-plan';
import { ShowcaseContext } from './showcase-context';
import { seedHdpeTelemetry } from './seed-hdpe-telemetry';

interface ConnectionRow {
  id: string;
  displayName: string;
}

interface JobRow {
  id: string;
  state: string;
}

async function publishPoison(): Promise<void> {
  const url = process.env.DEMO_MQTT_BROKER_URL ?? DEFAULT_BROKER_URL;
  const client = await mqtt.connectAsync(url, { connectTimeout: 10_000 });
  try {
    await client.publishAsync(
      SIM_TOPICS.events,
      '{"contract":"proact/v1","event_id": <truncated by gateway',
      { qos: 1 },
    );
  } finally {
    await client.endAsync();
  }
}

export async function seedIntegration(ctx: ShowcaseContext): Promise<void> {
  const admin = ctx.as('managers', 0);
  const connections = await admin.listAll<ConnectionRow>('/v2/connections');
  const wanted = [EVENTS_CONNECTION_NAME, MEASUREMENTS_CONNECTION_NAME];
  const found = wanted.map((name) =>
    connections.find((c) => c.displayName === name),
  );
  if (found.some((c) => !c)) {
    if (!ctx.dryRun)
      throw new Error(
        'Demo MQTT connections missing: run db:seed-demo-mqtt -- --demo-plant --unit unit100 before the integration step',
      );
    ctx.tally.add(
      'mqtt connections',
      0,
      0,
      'demo MQTT connections missing: run npm run db:seed-demo-mqtt -- --demo-plant first',
    );
    return;
  }
  for (const connection of found) {
    const jobs = await admin.listAll<JobRow>('/v2/ingestion-jobs', {
      connectionId: connection?.id ?? '',
    });
    const running = jobs.some((j) => j.state === 'running');
    if (!running && !ctx.dryRun)
      throw new Error(
        `Demo MQTT subscriber is not running: ${connection?.displayName}`,
      );
    ctx.tally.add(
      'mqtt connections',
      0,
      1,
      `${connection?.displayName}: ${running ? 'running' : 'NOT running'}`,
    );
  }
  if (ctx.dryRun) return;
  await seedHdpeTelemetry(ctx);
  const quarantined = await admin.listAll<{ sourceObjectId: string | null }>(
    '/v2/ingestion-exceptions',
    {
      connectionId: found[0]?.id ?? '',
      errorCode: 'not_json',
    },
  );
  if (quarantined.some((q) => q.sourceObjectId === SIM_TOPICS.events)) {
    ctx.tally.kept('quarantined messages');
    return;
  }
  await publishPoison();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = await admin.listAll<{ sourceObjectId: string | null }>(
      '/v2/ingestion-exceptions',
      {
        connectionId: found[0]?.id ?? '',
        errorCode: 'not_json',
      },
    );
    if (rows.some((row) => row.sourceObjectId === SIM_TOPICS.events)) {
      ctx.tally.created('quarantined messages');
      return;
    }
    await sleep(1000);
  }
  throw new Error('Demo malformed MQTT message did not reach quarantine');
}
