import { test, expect, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';
import { cleanupIntegrationWorld, eventsOf, findConnection, jobsOf, seedIntegrationWorld, type IntegrationWorld } from './test-utils/integration-world';

/**
 * Plan 3.7 exit test — UX06 integration journey on the v2 integration console (`/connectivity` with the
 * `v2.integrationConsole` flag, switched on for the demo tenant by the manager and left on):
 * create a PI connection → staged diagnostics all green → discover → sample → typed mapping preview
 * (TimeSpan "00:15:00" → 900 s) → limited job → quarantine "unknown unit" → bind via discovery → dry
 * run → replay → the event exists once → 7-day backfill (drained) → production job healthy; every stage
 * recorded. The PI endpoint is the backend's test simulator on an ephemeral port (loopback by default) started by
 * this spec (never a real PI server). Also: job stop really stops (cursor unchanged, audit row), the
 * password never appears in an API response or browser storage, a non-writer has no diagnostics controls and gets API 403
 * and does not see raw payloads. Data: new "E2E INT …" unit / connection; nothing existing changes.
 *
 * API in Docker (`docker-compose.devdb.yml`): run with `E2E_PI_SIM_HOST=host.docker.internal` so the
 * simulator listens on all interfaces and the connection URL names the host (`test-utils/pi-simulator.ts`).
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const ENGINEER = { email: 'engineer@acme.com', password: 'demo123' };
const FLAG = 'v2.integrationConsole';

let manager = '';
let world: IntegrationWorld;

test.describe.configure({ mode: 'serial', timeout: 300_000 });

const jobRow = (page: Page, purpose: string) => page.locator(`[data-testid="job-row"][data-purpose="${purpose}"]`);

async function openConsole(page: Page): Promise<void> {
  await page.goto('/connectivity');
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
}

async function createJob(page: Page, purpose: string, amount?: string): Promise<void> {
  await page.getByTestId('job-purpose').selectOption(purpose);
  if (amount) await page.fill('#job-amount', amount);
  await expect(page.getByTestId('job-create-submit')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('job-create-submit').click();
  await expect(jobRow(page, purpose)).toBeVisible({ timeout: 20_000 });
}

test.describe('Integration console — UX06 journey (plan 3.7)', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    expect((await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true })).status).toBe(200);
    world = await seedIntegrationWorld(manager, (session.user as { tenantId: string }).tenantId);
  });

  test.afterAll(async () => {
    if (world) await cleanupIntegrationWorld(manager, world);
    // decision for the owner's demo: the integration console stays switched on for Demo Plant
    await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
  });

  test('UX06 manager: configure → diagnose → discover → map → limited job → quarantine → bind → replay → backfill → production', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 }); // tablet (UX07)
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/api/')) return;
      bodies.push(await response.text().catch(() => ''));
    });
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openConsole(page);
    await expect(page.getByRole('tab', { name: 'Quarantine' })).toBeVisible();

    // 1. configure: Kafka is shown as not available, MQTT is selectable (plan 1.8); PI with a write-only password
    await page.getByTestId('new-connection').click();
    await expect(page.getByTestId('source-type-mqtt')).toBeEnabled();
    await expect(page.getByTestId('source-type-kafka')).toBeDisabled();
    await page.getByTestId('source-type-pi_web_api').click();
    await page.fill('#pi-name', world.connectionName);
    await page.fill('#pi-url', world.baseUrl);
    await page.fill('#pi-user', world.username);
    await page.fill('#pi-secret', world.password);
    await page.getByTestId('connection-save').click();
    await expect(page.getByTestId('connection-detail')).toBeVisible();
    await expect(page.getByTestId('connection-secret')).toHaveText('Credential stored (write-only)');

    // 2. validate permissions and capabilities: every PI01 step passes
    await page.getByTestId('tab-diagnostics').click();
    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('diagnostics-panel')).toHaveAttribute('data-health', 'connected', { timeout: 30_000 });
    for (const step of ['dns', 'auth', 'version', 'authz', 'read']) {
      await expect(page.locator(`[data-testid="diagnostic-step"][data-step="${step}"]`)).toHaveAttribute('data-status', 'ok');
    }
    await expect(page.locator('[data-testid="diagnostic-step"][data-step="tls"]')).toHaveAttribute('data-status', 'not_applicable');
    await expect(page.getByTestId('detected-capabilities')).toContainText('batch: yes');

    // 3. discover and sample; 4. map with a typed preview (TimeSpan → 900 s), saved as a connection override
    await page.getByTestId('tab-discovery').click();
    await page.getByTestId('discover').click();
    await page.getByTestId('af-database').selectOption('DB-HDPE');
    await page.fill('#scope-template', 'Production Loss');
    await page.getByTestId('sample-run').click();
    const record = page.locator(`[data-testid="sample-record"][data-source-id="${world.recentFrame}"]`);
    await expect(record).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`[data-testid="sample-record"][data-source-id="${world.oldFrame}"]`)).toHaveCount(0);
    await record.getByTestId('sample-map').click();
    await expect(page.getByTestId('mapping-editor')).toHaveAttribute('data-template', 'Production Loss');
    await page.getByTestId('mapping-preview-run').click();
    await expect(page.getByTestId('preview-diagnostics')).toContainText('Duration is not a duration in minutes: 00:15:00');
    await page.getByTestId('unit-suppliedDurationSeconds').selectOption('timespan');
    await page.getByTestId('mapping-preview-run').click();
    await expect(page.locator('[data-testid="mapped-value"][data-field="suppliedDurationSeconds"]')).toHaveAttribute('data-value', '900');
    await expect(page.getByTestId('mapping-preview')).toHaveAttribute('data-diagnostics', '0');
    await page.getByTestId('mapping-save').click();
    await expect(page.getByTestId('mapping-saved')).toBeVisible();

    // 5. limited ingestion; stop really stops (cursor unchanged, audit row)
    const connection = await findConnection(manager, world.connectionName);
    expect(connection).not.toBeNull();
    const connectionId = connection?.id ?? '';
    await page.getByTestId('tab-jobs').click();
    await createJob(page, 'limited', '120');
    await expect.poll(async () => (await jobsOf(manager, connectionId)).find((job) => job.scope.purpose === 'limited')?.lastSuccessAt ?? null, { timeout: 60_000 }).not.toBeNull();
    await jobRow(page, 'limited').getByTestId('job-stop').click();
    await page.fill('#job-reason', 'E2E: limited check done');
    await page.getByTestId('job-command-confirm').click();
    await expect(jobRow(page, 'limited')).toHaveAttribute('data-state', 'stopped', { timeout: 20_000 });
    const stoppedCursor = (await jobsOf(manager, connectionId)).find((job) => job.scope.purpose === 'limited')?.committedCursor;
    await page.waitForTimeout(7_000); // longer than the 5 s runner tick
    expect((await jobsOf(manager, connectionId)).find((job) => job.scope.purpose === 'limited')?.committedCursor).toEqual(stoppedCursor);
    await jobRow(page, 'limited').getByTestId('job-trail-toggle').click();
    await expect(jobRow(page, 'limited').locator('[data-testid="job-transition"][data-action="stop"]')).toBeVisible();

    // 6. quarantine shows the unknown unit; bind via discovery; dry run; replay → the event exists once
    await page.goto('/connectivity?tab=quarantine'); // the quarantine is a tab of the console, the connection has its own page
    await page.getByTestId('q-connection').selectOption({ label: world.connectionName });
    const item = page.locator(`[data-testid="exception-row"][data-source-id="${world.recentFrame}"]`);
    await expect(async () => {
      await page.getByTestId('quarantine-refresh').click();
      await expect(item).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    await expect(item).toHaveAttribute('data-code', 'unknown_unit');
    await item.click();
    await expect(page.getByTestId('exception-detail')).toHaveAttribute('data-code', 'unknown_unit');
    await expect(page.getByTestId('raw-payload')).toBeVisible();
    await page.getByTestId('exception-bind').click();
    await page.getByTestId('bind-unit').selectOption(world.unitId);
    await page.getByTestId('bind-preview').click();
    await expect(page.getByTestId('resolution-preview').locator('li').first()).toHaveAttribute('data-status', 'unmapped');
    await page.getByTestId('bind-confirm').click();
    await expect(page.getByTestId('exception-bound')).toBeVisible();
    await page.fill('#resolve-reason', 'E2E: element bound to its unit');
    await page.getByTestId('exception-dry-run').click();
    await expect(page.getByTestId('replay-run')).toHaveAttribute('data-state', 'completed', { timeout: 30_000 });
    await expect(page.getByTestId('replay-run')).toHaveAttribute('data-objects', '1');
    await page.getByTestId('exception-replay').click();
    await expect(page.getByTestId('exception-detail')).toHaveAttribute('data-state', 'resolved', { timeout: 60_000 });
    await expect.poll(async () => (await eventsOf(manager, world.unitId, world.recentFrame)).length, { timeout: 30_000 }).toBe(1);
    expect((await eventsOf(manager, world.unitId, world.recentFrame))[0].durationSeconds).toBe(900);

    // 7. bounded backfill of 7 days (drained: stops once caught up) brings the 3-day-old frame, no duplicates
    await page.goto(`/connectivity/connections/${connectionId}?tab=discovery`);
    // Scope, diagnostics and sampling describe this visit; persisted jobs and mappings remain server records.
    await page.getByTestId('tab-diagnostics').click();
    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('diagnostics-panel')).toHaveAttribute('data-health', 'connected', { timeout: 30_000 });
    await page.getByTestId('tab-discovery').click();
    await page.getByTestId('discover').click();
    await page.getByTestId('af-database').selectOption('DB-HDPE');
    await page.fill('#scope-template', 'Production Loss');
    await page.getByTestId('sample-run').click();
    await expect(page.locator(`[data-testid="sample-record"][data-source-id="${world.recentFrame}"]`)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('tab-jobs').click();
    await createJob(page, 'backfill', '7');
    await expect(jobRow(page, 'backfill')).toHaveAttribute('data-state', 'stopped', { timeout: 90_000 });
    await expect.poll(async () => (await eventsOf(manager, world.unitId, world.oldFrame)).length, { timeout: 30_000 }).toBe(1);
    expect(await eventsOf(manager, world.unitId, world.recentFrame)).toHaveLength(1);

    // 8. production cadence with health; every UX06 stage recorded with its result
    await createJob(page, 'production');
    await expect.poll(async () => (await jobsOf(manager, connectionId)).find((job) => job.scope.purpose === 'production')?.lastSuccessAt ?? null, { timeout: 60_000 }).not.toBeNull();
    await expect(jobRow(page, 'production').getByTestId('job-health').first()).toHaveText('Healthy', { timeout: 20_000 });
    await page.getByRole('tab', { name: 'Stages' }).click();
    for (const stage of ['configure', 'validate', 'discover', 'map', 'limited', 'quarantine', 'backfill', 'production']) {
      await expect(page.locator(`[data-testid="stage"][data-stage="${stage}"]`)).toHaveAttribute('data-status', 'done', { timeout: 30_000 });
    }
    await page.screenshot({ path: test.info().outputPath('integration-console-ux06.png'), fullPage: true });

    // secrets: never in an API response or browser storage
    expect(bodies.length).toBeGreaterThan(10);
    expect(bodies.filter((body) => body.includes(world.password))).toEqual([]);
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(storage).not.toContain(world.password);
  });

  test('a non-writer cannot run diagnostics (hidden, API 403) and sees no raw payload', async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, ENGINEER.email, ENGINEER.password);
    await openConsole(page);
    // the connection has its own page (the list is paged)
    const connection = await findConnection(manager, world.connectionName);
    expect(connection).toBeTruthy();
    await page.goto(`/connectivity/connections/${connection!.id}`);
    await expect(page.getByRole('heading', { name: world.connectionName, exact: true })).toBeVisible();
    await expect(page.getByTestId('tab-diagnostics')).toHaveCount(0);
    await expect(page.getByTestId('run-diagnostics')).toHaveCount(0);
    const engineer = await authenticate(ENGINEER.email, ENGINEER.password);
    const refused = await command<{ code: string }>(engineer.accessToken, `/v2/connections/${connection!.id}/test`, {});
    expect([refused.status, refused.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    await page.goto('/connectivity?tab=quarantine'); // the quarantine is a tab of the console, the connection has its own page
    await page.locator('#q-state').selectOption('resolved');
    await page.getByTestId('q-connection').selectOption({ label: world.connectionName });
    await page.locator(`[data-testid="exception-row"][data-source-id="${world.recentFrame}"]`).click();
    await expect(page.getByTestId('raw-payload-hidden')).toBeVisible();
    await expect(page.getByTestId('raw-payload')).toHaveCount(0);
  });
});
