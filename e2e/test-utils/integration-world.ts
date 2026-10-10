import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { call, command } from './downtime-world';

/**
 * Plan 3.7 UX06 world: the backend's PI Web API test simulator (fake account, never a real PI server)
 * run as a child process (`server/pro-act-backend/test/simulators/pi-web-api/run-simulator.ts`) on an
 * ephemeral 127.0.0.1 port that the local API on :4004 reaches, with one AF element and two Production
 * Loss frames of 15 min ("00:15:00"): one 90 min ago (limited job) and one 3 days ago (only the 7-day
 * backfill reads it). A new unit "E2E INT …" is the binding target. Nothing existing is changed;
 * `cleanup` stops the E2E jobs, deactivates the E2E connection and stops the simulator.
 */
const MINUTE = 60_000;
const BACKEND = join(process.cwd(), 'server', 'pro-act-backend');

export interface IntegrationWorld {
  suffix: string;
  simulator: ChildProcess;
  baseUrl: string;
  username: string;
  password: string;
  unitId: string;
  unitName: string;
  connectionName: string;
  elementPath: string;
  recentFrame: string;
  oldFrame: string;
}

interface Ready {
  baseUrl: string;
  username: string;
  password: string;
}

function startSimulator(scenario: unknown): Promise<{ child: ChildProcess; ready: Ready }> {
  // one fixed command line (no user input); the scenario travels in the environment
  const child = spawn('npx ts-node -T test/simulators/pi-web-api/run-simulator.ts', {
    cwd: BACKEND,
    env: { ...process.env, PI_SIM_SCENARIO: JSON.stringify(scenario) },
    shell: true,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`simulator did not start: ${output}`)), 60_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const line = output.split('\n').find((entry) => entry.startsWith('READY '));
      if (!line) return;
      clearTimeout(timer);
      resolve({ child, ready: JSON.parse(line.slice('READY '.length)) as Ready });
    });
    child.on('exit', (code) => reject(new Error(`simulator exited (${code}): ${output}`)));
  });
}

export async function seedIntegrationWorld(token: string, tenantId: string): Promise<IntegrationWorld> {
  const suffix = randomUUID().slice(0, 8);
  const elementPath = `\\\\SIM-AF\\HDPE\\E2E\\Line-${suffix}`;
  const elementWebId = `EL-E2E-${suffix}`;
  const recentFrame = `EF-E2E-${suffix}-recent`;
  const oldFrame = `EF-E2E-${suffix}-old`;
  const attributes = { Duration: '00:15:00', Quantity: 3, Description: `E2E INT stop ${suffix}` };
  const { child, ready } = await startSimulator({
    elements: [{ path: elementPath, webId: elementWebId }],
    frames: [
      { webId: recentFrame, startMinutesAgo: 90, endMinutesAgo: 75, elementWebId, attributes },
      { webId: oldFrame, startMinutesAgo: 3 * 1440, endMinutesAgo: 3 * 1440 - 15, elementWebId, attributes },
    ],
  });
  const unitName = `E2E INT ${suffix}`;
  const unit = await call<{ id: string }>(token, 'POST', '/units', { name: unitName, code: `E2E-INT-${suffix}`, tenantId });
  if (unit.status !== 201 && unit.status !== 200) throw new Error(`unit: ${unit.status} ${JSON.stringify(unit.body)}`);
  return { suffix, simulator: child, ...ready, unitId: unit.body.id, unitName, connectionName: `E2E INT PI ${suffix}`, elementPath, recentFrame, oldFrame };
}

interface ConnectionRow {
  id: string;
  displayName: string;
  rowVersion: number;
  isActive: boolean;
}

/** The E2E connection created in the UI (by name). */
export async function findConnection(token: string, name: string): Promise<ConnectionRow | null> {
  const list = await call<{ items: ConnectionRow[] }>(token, 'GET', '/v2/connections?includeInactive=true&limit=500');
  return list.body.items.find((item) => item.displayName === name) ?? null;
}

export interface JobRow {
  id: string;
  state: string;
  committedCursor: Record<string, unknown> | null;
  scope: Record<string, unknown>;
  lastSuccessAt: string | null;
}

export async function jobsOf(token: string, connectionId: string): Promise<JobRow[]> {
  return (await call<{ items: JobRow[] }>(token, 'GET', `/v2/ingestion-jobs?connectionId=${connectionId}&limit=100`)).body.items;
}

/** Canonical events of the E2E unit with the frame's id (T06: exactly one per frame). */
export async function eventsOf(token: string, unitId: string, eventId: string): Promise<Array<{ id: string; durationSeconds: number | null }>> {
  const from = new Date(Date.now() - 10 * 1440 * MINUTE).toISOString();
  const to = new Date(Date.now() + MINUTE).toISOString();
  const list = await call<{ items: Array<{ id: string; eventId: string | null; durationSeconds: number | null }> }>(
    token,
    'GET',
    `/v2/production-events?unitIds=${unitId}&from=${from}&to=${to}&limit=500`,
  );
  return (list.body.items ?? []).filter((item) => item.eventId === eventId);
}

/** Stops every E2E job, deactivates the E2E connection, stops the simulator. */
export async function cleanupIntegrationWorld(token: string, world: IntegrationWorld): Promise<void> {
  const connection = await findConnection(token, world.connectionName);
  if (connection) {
    for (const job of await jobsOf(token, connection.id)) {
      if (job.state !== 'stopped') await command(token, `/v2/ingestion-jobs/${job.id}/stop`, { reason: 'e2e cleanup' });
    }
    const fresh = await findConnection(token, world.connectionName);
    if (fresh?.isActive) await call(token, 'PATCH', `/v2/connections/${fresh.id}`, { isActive: false }, { 'If-Match': `"${fresh.rowVersion}"` });
  }
  world.simulator.stdin?.end();
  world.simulator.kill();
}
