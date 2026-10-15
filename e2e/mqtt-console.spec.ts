import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';

/**
 * Plan 1.8 WP3 step 5 journey on the integration console MQTT panel (`/connectivity`, flag
 * `v2.integrationConsole`): create an MQTT connection through the four-step wizard against the Compose
 * broker (the API and worker reach it as `mqtt://mqtt:1883` from inside the Compose network; a local
 * API uses `E2E_MQTT_BROKER_URL=mqtt://localhost:1884`), run the CONNACK test, watch the worker create
 * the subscribe job and connect, pause and resume it, save a value map through the merge patch (the
 * topics survive), and see the quarantine tab filtered to the connection. The topic family carries a
 * unique suffix so the duplicate-feed guard never trips on an existing lab connection; cleanup stops
 * the job and deactivates the connection. The password never appears in an API response.
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const FLAG = 'v2.integrationConsole';
const BROKER_URL = process.env.E2E_MQTT_BROKER_URL ?? 'mqtt://mqtt:1883';
const BASE_URL = process.env.E2E_BASE_URL;

interface ConnectionRow {
  id: string;
  displayName: string;
  rowVersion: number;
  endpointConfig: { mqtt: { topics: string[] }; payloadProfile: { valueMaps?: { state?: Record<string, string> } } };
}
interface JobRow {
  id: string;
  state: string;
  scope: { mode?: string };
  health: Record<string, unknown>;
}

let manager = '';
let suffix = '';
let connectionName = '';
const password = `e2e-mqtt-${randomUUID().slice(0, 8)}`;

test.describe.configure({ mode: 'serial', timeout: 240_000 });
if (BASE_URL) test.use({ baseURL: BASE_URL });

const connections = async (): Promise<ConnectionRow[]> =>
  (await call<{ items: ConnectionRow[] }>(manager, 'GET', '/v2/connections?limit=100&includeInactive=true')).body.items;
const jobsOf = async (connectionId: string): Promise<JobRow[]> =>
  (await call<{ items: JobRow[] }>(manager, 'GET', `/v2/ingestion-jobs?connectionId=${connectionId}&limit=100`)).body.items;
const subscribeJob = async (connectionId: string) => (await jobsOf(connectionId)).find((job) => job.scope.mode === 'subscribe') ?? null;

async function openConsole(page: Page): Promise<void> {
  await page.goto('/connectivity');
  await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
}

async function jobCommand(page: Page, action: 'pause' | 'resume', reason: string): Promise<void> {
  await page.getByTestId(`job-${action}`).click();
  await page.fill('#job-reason', reason);
  await page.getByTestId('job-command-confirm').click();
}

test.describe('Integration console — MQTT panel (plan 1.8 step 5)', () => {
  test.beforeAll(async () => {
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    expect((await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true })).status).toBe(200);
    suffix = randomUUID().slice(0, 8);
    connectionName = `E2E MQTT ${suffix}`;
  });

  test.afterAll(async () => {
    const connection = (await connections()).find((row) => row.displayName === connectionName);
    if (!connection) return;
    const job = await subscribeJob(connection.id);
    if (job && job.state !== 'stopped') await command(manager, `/v2/ingestion-jobs/${job.id}/stop`, { reason: 'E2E MQTT cleanup' });
    const latest = (await connections()).find((row) => row.id === connection.id);
    await call(manager, 'PATCH', `/v2/connections/${connection.id}`, { isActive: false }, { 'If-Match': `"${latest?.rowVersion ?? connection.rowVersion}"` });
  });

  test('wizard → test → subscribe job running → pause / resume → merge-patched value map → quarantine tab', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/api/')) return;
      bodies.push(await response.text().catch(() => ''));
    });
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openConsole(page);

    // 1. wizard: profile preset → basics (unique topic family) → connection (write-only password) → advanced
    await page.getByTestId('new-connection').click();
    await page.getByTestId('source-type-mqtt').click();
    await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'profile');
    await page.getByTestId('mqtt-kind').selectOption('interval_event_json');
    await page.fill('#mqtt-template', `e2e/${suffix}/{site}/{unit}/events`);
    await page.getByTestId('mqtt-next').click();
    await page.fill('#mqtt-name', connectionName);
    await page.fill('#mqtt-broker', 'http://not-a-broker');
    await page.fill('#mqtt-topics', `e2e/${suffix}/+/+/events`);
    await page.getByTestId('mqtt-next').click();
    await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'basics');
    await expect(page.locator('#mqtt-broker-error')).toContainText('mqtt://host');
    await page.fill('#mqtt-broker', BROKER_URL);
    await page.getByTestId('mqtt-next').click();
    await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'connection');
    await expect(page.getByTestId('mqtt-tls-off')).toBeVisible();
    await page.fill('#mqtt-user', 'lab');
    await page.fill('#mqtt-secret', password);
    await page.getByTestId('mqtt-next').click();
    await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'advanced');
    await page.getByTestId('connection-save').click();
    await expect(page.getByTestId('connection-detail')).toHaveAttribute('data-source-type', 'mqtt');
    await expect(page.getByTestId('connection-secret')).toHaveText('Credential stored (write-only)');
    const connection = (await connections()).find((row) => row.displayName === connectionName);
    expect(connection).not.toBeUndefined();
    const connectionId = connection?.id ?? '';
    await expect(page.getByTestId('connection-endpoint')).toContainText(`client id proact-${connectionId}`);

    // 2. CONNACK test with a throwaway client id
    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('mqtt-test')).toHaveAttribute('data-health', 'connected', { timeout: 60_000 });
    await expect(page.locator('[data-testid="diagnostic-step"][data-step="connect"]')).toContainText('ok');
    await expect(page.locator('[data-testid="diagnostic-step"][data-step="clientId"]')).toContainText('test-');

    // 3. the worker creates the subscribe job and connects (reconcile every 10 s, heartbeat every 20 s)
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    await page.getByTestId('mqtt-technical-details').locator('summary').click();
    await expect(page.getByTestId('mqtt-client-id')).toHaveText(`proact-${connectionId}`);
    const running = await subscribeJob(connectionId);
    expect(running?.state).toBe('running');
    expect(running?.health.connected).toBe(true);

    // 4. pause really disconnects (session kept), resume reconnects; both audited
    await jobCommand(page, 'pause', 'E2E: pause the subscription');
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-job-state', 'paused', { timeout: 20_000 });
    await expect.poll(async () => (await subscribeJob(connectionId))?.health.connected ?? null, { timeout: 60_000 }).toBe(false);
    await jobCommand(page, 'resume', 'E2E: resume the subscription');
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    await page.getByTestId('job-trail-toggle').click();
    await expect(page.locator('[data-testid="job-transition"][data-action="pause"]')).toBeVisible();
    await expect(page.locator('[data-testid="job-transition"][data-action="resume"]')).toBeVisible();

    // 5. payload profile: a state map saved as a merge patch; topics survive; config version bumps
    await page.getByTestId('tab-profile').click();
    await page.getByRole('button', { name: /Value maps/ }).click();
    await page.getByTestId('state-map-add').click();
    const row = page.getByTestId('state-map-row').first();
    await row.getByLabel('Raw token').fill('RUN');
    await row.getByLabel('DT01 state').fill('idle');
    await expect(page.getByTestId('state-map-error')).toContainText('running or stopped');
    await expect(page.getByTestId('profile-save')).toBeDisabled();
    await row.getByLabel('DT01 state').fill('running');
    await page.locator('#state-probe-input').fill('run');
    await expect(page.getByTestId('state-probe-result')).toContainText('"run" → running');
    await page.locator('#state-probe-input').fill('STOP');
    await expect(page.getByTestId('state-probe-result')).toContainText('unmapped_value');
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('profile-saved')).toBeVisible({ timeout: 20_000 });
    const patched = (await connections()).find((row) => row.id === connectionId);
    expect(patched?.endpointConfig.mqtt.topics).toEqual([`e2e/${suffix}/+/+/events`]);
    expect(patched?.endpointConfig.payloadProfile.valueMaps?.state).toEqual({ RUN: 'running' });
    // the connection page still shows this connection after the patch (its name is the page heading)
    await expect(page.getByTestId('connection-detail')).toHaveAttribute('data-connection-id', connectionId);
    await expect(page.getByRole('heading', { name: connectionName })).toBeVisible();

    // 6. quarantine tab is filtered to this connection (empty for a fresh topic family)
    await page.getByTestId('tab-mqtt-quarantine').click();
    await expect(page.getByTestId('q-connection')).toHaveValue(connectionId);
    await expect(page.getByTestId('quarantine-inbox')).toContainText('Nothing is waiting for these filters.');
    await page.screenshot({ path: test.info().outputPath('mqtt-console.png'), fullPage: true });

    // the password never travels back
    expect(bodies.length).toBeGreaterThan(5);
    expect(bodies.filter((body) => body.includes(password))).toEqual([]);
  });
});
