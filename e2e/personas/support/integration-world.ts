import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { authenticate } from '../../test-utils/api-helpers';
import { loginViaUI } from '../../test-utils/auth-helpers';
import { call, command } from '../../test-utils/downtime-world';

/**
 * Shared world of the INTEGRATION ADMIN persona journeys (docs/DEMO_PERSONAS.md): the four
 * `integration_admin` users of Demo Plant (Diego also in Demo Plant 2), the plain Engineer used for the
 * negative cases, the Compose broker's authenticated listeners (docs/DOCKER.md, docs/MQTT_LAB_TESTING.md),
 * API helpers, the console UI steps every journey repeats, the publisher simulator (`npm run mqtt:sim`)
 * and a state file handing the MQTT connection from the wizard spec to the later specs. Everything
 * created is prefixed `P-INT-` and is never deleted, deactivated or stopped (owner requirement).
 */
export const PASSWORD = 'Persona-2026!demo';
export const INT_USERS = {
  elena: 'elena.marchetti@demo.acme.com',
  omar: 'omar.siddiqui@demo.acme.com',
  freya: 'freya.nilsson@demo.acme.com',
  diego: 'diego.herrera@demo.acme.com',
} as const;
/** plain Engineer (production_engineer only): sees no console menu, every console write is refused */
export const NOAH = 'noah.schmidt@demo.acme.com';
export const DEMO_PLANT = '5f011848-1cb5-4b7c-b75a-8938b46260a9';
export const DEMO_PLANT_2 = '1c19bda6-1c5e-42ac-af59-e1bda46b804f';
export const PREFIX = 'P-INT-';
/** the demo MQTT placement (`db:seed-demo-mqtt`): `\\PIAF\HDPE\Polymer\Line1\Extruder1` → this unit */
export const DEMO_UNIT_CODE = 'unit100';
export const DEMO_EVENTS_CONNECTION = 'Demo: MQTT events (simulator)';
export const MINUTE = 60_000;

/**
 * Compose broker `proact-mqtt-1` (docker/mosquitto): dev-only users and CA, overridable by env. `plain` /
 * `tls` are what the API and worker connect to; `simUrl` is where the publisher simulator on this machine
 * connects. They differ when the API runs in Docker: e.g. E2E_MQTT_PASSWORD_URL=mqtt://host.docker.internal:1885,
 * E2E_MQTT_TLS_URL=mqtts://host.docker.internal:8885 (both in the dev certificate), E2E_MQTT_SIM_URL=mqtt://localhost:1885.
 */
export const BROKER = {
  plain: process.env.E2E_MQTT_PASSWORD_URL ?? 'mqtt://localhost:1885',
  tls: process.env.E2E_MQTT_TLS_URL ?? 'mqtts://localhost:8885',
  simUrl: process.env.E2E_MQTT_SIM_URL ?? process.env.E2E_MQTT_PASSWORD_URL ?? 'mqtt://localhost:1885',
  username: process.env.E2E_MQTT_SIM_USER ?? 'proact-sim',
  password: process.env.E2E_MQTT_SIM_PASSWORD ?? 'proact-sim-dev',
  caPath: join(process.cwd(), 'docker', 'mosquitto', 'certs', 'dev-ca.crt'),
} as const;
export const caPem = (): string => readFileSync(BROKER.caPath, 'utf8');

const BACKEND = join(process.cwd(), 'server', 'pro-act-backend');

export interface IntSession {
  email: string;
  token: string;
  userId: string;
  tenantId: string;
}

export async function apiLogin(email: string): Promise<IntSession> {
  const session = await authenticate(email, PASSWORD);
  const user = session.user as { id: string; tenantId: string };
  return { email, token: session.accessToken, userId: user.id, tenantId: user.tenantId };
}

/** Real-UI login; a late header on a busy dev server is waited for instead of failing the journey. */
export async function uiLogin(page: Page, email: string): Promise<void> {
  try {
    await loginViaUI(page, email, PASSWORD);
  } catch (error) {
    if (!page.url().includes('/dashboard')) throw error;
    await expect(page.locator('header')).toBeVisible({ timeout: 30_000 });
  }
}

export { call, command };
export const newSuffix = () => randomUUID().slice(0, 8);

export async function openConsole(page: Page): Promise<void> {
  await page.goto('/connectivity');
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
}

/** Finds `locator` on a paged table (20 rows per page), pressing "Next page" until it shows. */
export async function findOnPages(page: Page, locator: Locator): Promise<void> {
  await expect(async () => {
    const next = page.getByRole('button', { name: 'Next page' }).first();
    if ((await locator.count()) === 0 && (await next.count()) > 0 && await next.isEnabled()) await next.click();
    await expect(locator.first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

/** Opens a connection's own page from the paged connections table. */
export async function selectConnection(page: Page, name: string): Promise<void> {
  const item = page.getByTestId('connection-item').filter({ hasText: name });
  await findOnPages(page, item);
  await item.first().click();
  await expect(page.getByTestId('connection-detail')).toBeVisible({ timeout: 30_000 });
}

/** pause / resume / stop of the subscribe job through the audited command dialog. */
export async function jobCommand(page: Page, action: 'pause' | 'resume', reason: string): Promise<void> {
  await page.getByTestId(`job-${action}`).click();
  await page.fill('#job-reason', reason);
  await page.getByTestId('job-command-confirm').click();
}

export interface ConnectionRow {
  id: string;
  displayName: string;
  sourceType: string;
  rowVersion: number;
  configVersion: number;
  isActive: boolean;
  hasSecret: boolean;
  endpointConfig: { mqtt?: { topics: string[]; brokerUrl: string; tls?: { mode: string } }; payloadProfile?: { valueMaps?: { state?: Record<string, string> } } };
}

export async function connections(token: string, tenantId?: string): Promise<ConnectionRow[]> {
  const headers = tenantId ? { 'X-Tenant-Id': tenantId } : {};
  const list = await call<{ items: ConnectionRow[] }>(token, 'GET', '/v2/connections?includeInactive=true&limit=500', undefined, headers);
  if (list.status !== 200) throw new Error(`connections: ${list.status} ${JSON.stringify(list.body)}`);
  return list.body.items;
}

export async function findConnection(token: string, name: string, tenantId?: string): Promise<ConnectionRow | null> {
  return (await connections(token, tenantId)).find((item) => item.displayName === name) ?? null;
}

export interface JobHealth {
  connected: boolean;
  sessionPresent: boolean | null;
  counters: Record<string, number>;
  subscribedTopics?: string[];
}

export interface JobRow {
  id: string;
  state: string;
  scope: { mode?: string; purpose?: string };
  health: JobHealth;
  committedCursor: Record<string, unknown> | null;
  lastSuccessAt: string | null;
}

/** A failed list read (expired token, 429 of the per-user budget, ...) must surface, never read as "nothing there". */
function itemsOf<T>(what: string, result: { status: number; body: { items?: T[]; code?: string } | undefined }): T[] {
  if (result.status !== 200 || !result.body?.items) throw new Error(`${what}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body.items;
}

export async function jobsOf(token: string, connectionId: string): Promise<JobRow[]> {
  return itemsOf('ingestion jobs', await call<{ items: JobRow[] }>(token, 'GET', `/v2/ingestion-jobs?connectionId=${connectionId}&limit=100`));
}

export const subscribeJob = async (token: string, connectionId: string): Promise<JobRow | null> =>
  (await jobsOf(token, connectionId)).find((job) => job.scope.mode === 'subscribe' && job.state !== 'stopped') ?? null;

export interface ExceptionRow {
  id: string;
  errorCode: string;
  state: string;
  sourceObjectId: string;
  connectionId: string;
}

export async function exceptionsOf(token: string, connectionId: string, state = 'open'): Promise<ExceptionRow[]> {
  return itemsOf('ingestion exceptions', await call<{ items: ExceptionRow[] }>(token, 'GET', `/v2/ingestion-exceptions?connectionId=${connectionId}&state=${state}&limit=200`));
}

export interface EventRow {
  id: string;
  eventId: string | null;
  unitId: string;
  source: string | null;
  reasonCodeId: string | null;
  durationSeconds: number | null;
  states: { physical: string };
}

/** Canonical events of a unit in the last 10 days (the backfill frame is 3 days old), every physical state, by source event id. */
export async function eventsByEventId(token: string, unitId: string, eventId: string): Promise<EventRow[]> {
  const from = new Date(Date.now() - 10 * 1440 * MINUTE).toISOString();
  const to = new Date(Date.now() + 60 * MINUTE).toISOString();
  const states = ['open', 'closed', 'superseded', 'retracted'].map((state) => `physicalStates=${state}`).join('&');
  const list = await call<{ items: EventRow[] }>(token, 'GET', `/v2/production-events?unitIds=${unitId}&from=${from}&to=${to}&${states}&limit=500`);
  return itemsOf('production events', list).filter((item) => item.eventId === eventId);
}

export async function unitByCode(token: string, code: string): Promise<{ id: string; name: string }> {
  const units = await call<{ items: Array<{ id: string; code: string; name: string }> }>(token, 'GET', '/v2/units?limit=500');
  const unit = units.body.items.find((item) => item.code === code);
  if (!unit) throw new Error(`unit ${code} not found in the tenant`);
  return unit;
}

/**
 * Runs `npm run mqtt:sim` (scripts/mqtt/publish-sim.ts) against the password listener as the simulated
 * gateway `proact-sim` (read-write on `test/#` by the dev ACL), inside the journey's own namespace so the
 * topics match only the connection under test. Resolves with the simulator's log once it exited cleanly.
 */
export function runSim(scenario: string, namespace: string, extra: string[] = []): Promise<string> {
  const args = ['-T', 'scripts/mqtt/publish-sim.ts', scenario, '--url', BROKER.simUrl, '--username', BROKER.username, '--namespace', namespace, ...extra];
  const child = spawn('npx', ['ts-node', ...args], {
    cwd: BACKEND,
    env: { ...process.env, MQTT_SIM_PASSWORD: BROKER.password },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`simulator ${scenario} did not finish: ${output}`));
    }, 180_000);
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`simulator ${scenario} exited ${code}: ${output}`));
    });
  });
}

/**
 * The event ids a seeded scenario produces: publish-sim seeds `SimIdentity` with `<seed>:<scenario>` and
 * `nextEventId` is `EF-sim-` + the first 12 hex of sha256(`<seed>:<scenario>:event:<n>`).
 */
export function seededEventIds(seed: string, scenario: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `EF-sim-${createHash('sha256').update(`${seed}:${scenario}:event:${index + 1}`).digest('hex').slice(0, 12)}`);
}

/** The distinct seeded event ids a scenario printed (`EF-sim-…`), in order of appearance. */
export function simEventIds(log: string): string[] {
  return [...new Set(log.match(/EF-sim-[0-9a-f]{12}/g) ?? [])];
}

/** The source event id the open-close scenario printed. */
export function simEventId(log: string): string {
  const [first] = simEventIds(log);
  if (!first) throw new Error(`no event id in the simulator log: ${log}`);
  return first;
}

/**
 * State handed from the wizard journey to the subscription / quarantine specs. It lives in the OS
 * temp dir: `test-results/` is wiped by every Playwright run, including other personas' runs.
 */
export interface IntState {
  suffix: string;
  namespace: string;
  connectionId: string;
  connectionName: string;
  /** the open → closed → changed → deleted lifecycle published while the subscription was paused (INT-04b) */
  lifecycleEventId?: string;
}

const stateScope = process.env.HDPE_UI_RUN?.replace(/[^a-z0-9-]/gi, '');
const STATE_FILE = join(tmpdir(), 'proact-personas', stateScope ? `integration-state-${stateScope}.json` : 'integration-state.json');

export function saveState(state: IntState): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadState(): IntState {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as IntState;
}
