/**
 * Integration console activity: checks that the two demo MQTT connections (scripts/demo-mqtt) have running
 * subscribe jobs, runs the publisher simulator for a short burst of closed events and a series of
 * measurement samples (console counters, signal samples, MQTT-sourced events on Extruder Line 1) and,
 * when the events connection has no quarantined message yet, publishes one malformed message for the
 * Quarantine tab. Nothing is started or reconfigured here.
 */
import { spawnSync } from 'child_process';
import * as mqtt from 'mqtt';
import * as path from 'path';
import {
  DEFAULT_BROKER_URL,
  EVENTS_CONNECTION_NAME,
  MEASUREMENTS_CONNECTION_NAME,
  SIM_TOPICS,
} from '../demo-mqtt/demo-mqtt-plan';
import { ShowcaseContext } from './showcase-context';

interface ConnectionRow {
  id: string;
  displayName: string;
}

interface JobRow {
  id: string;
  state: string;
}

const BACKEND_DIR = path.resolve(__dirname, '..', '..');

function runSimulator(ctx: ShowcaseContext, args: string[]): void {
  // fixed arguments only (no user input): the shell resolves npm on Windows
  const result = spawnSync(`npm run mqtt:sim -- ${args.join(' ')}`, {
    cwd: BACKEND_DIR,
    shell: true,
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `mqtt:sim ${args.join(' ')} failed (${result.status}): ${(result.stderr || result.stdout).slice(-800)}`,
    );
  }
  ctx.tally.add('mqtt simulator runs', 1, 0, args.join(' '));
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
    ctx.tally.add(
      'mqtt connections',
      0,
      1,
      `${connection?.displayName}: ${running ? 'running' : 'NOT running'}`,
    );
  }
  if (ctx.dryRun) return;
  runSimulator(ctx, ['burst', '--count', '20', '--rate', '10']);
  runSimulator(ctx, ['measurements', '--count', '30', '--every', '1']);
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
  ctx.tally.created('quarantined messages');
}
