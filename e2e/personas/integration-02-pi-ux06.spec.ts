import { test, expect, type Page } from '@playwright/test';
import { seedPiWorld, stopSimulator, type PiWorld } from './support/integration-pi-world';
import { apiLogin, eventsByEventId, findConnection, INT_USERS, findOnPages, jobsOf, newSuffix, openConsole, selectConnection, uiLogin, type IntSession } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — journey 2, the UX06 PI journey (plan 3.7) as Elena: configure a PI
 * connection with a write-only password → staged diagnostics all green → discover → sample → typed
 * mapping preview (TimeSpan "00:15:00" → 900 s) saved as a connection override → limited job (whose
 * audited stop really stops) → quarantine "unknown unit" → bind via discovery → dry run → replay → the
 * event exists once → 7-day backfill (drained) → production job healthy; every stage recorded. The PI
 * endpoint is the backend's simulator on an ephemeral port. Everything created (unit, connection,
 * mapping, jobs, events) is kept; the password never appears in a response or in browser storage.
 *
 * API in Docker (`docker-compose.devdb.yml`): run with `E2E_PI_SIM_HOST=host.docker.internal` so the
 * simulator listens on all interfaces and the connection URL names the host (`test-utils/pi-simulator.ts`).
 */
const suffix = newSuffix();
let elena: IntSession;
let world: PiWorld;

test.describe.configure({ mode: 'serial', timeout: 300_000 });

const jobRow = (page: Page, purpose: string) => page.locator(`[data-testid="job-row"][data-purpose="${purpose}"]`);

async function createJob(page: Page, purpose: string, amount?: string): Promise<void> {
  await page.getByTestId('job-purpose').selectOption(purpose);
  if (amount) await page.fill('#job-amount', amount);
  await page.getByTestId('job-create-submit').click();
  await expect(jobRow(page, purpose)).toBeVisible({ timeout: 20_000 });
}

test.describe('Integration admin — UX06 PI journey', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    elena = await apiLogin(INT_USERS.elena);
    world = await seedPiWorld(elena.token, elena.tenantId, suffix);
  });

  test.afterAll(() => stopSimulator(world));

  test('INT-02 (elena): configure → diagnose → discover → map → limited job → quarantine → bind → replay → backfill → production', async ({ page }) => {
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/api/')) return;
      bodies.push(await response.text().catch(() => ''));
    });
    await uiLogin(page, INT_USERS.elena);
    await openConsole(page);

    // 1. configure: Kafka is not available (D10), MQTT is selectable; PI with a write-only password
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
    await expect(page.getByTestId('preview-diagnostics')).toContainText('DURATION_UNPARSEABLE');
    await page.getByTestId('unit-suppliedDurationSeconds').selectOption('timespan');
    await page.getByTestId('mapping-preview-run').click();
    await expect(page.locator('[data-testid="mapped-value"][data-field="suppliedDurationSeconds"]')).toHaveAttribute('data-value', '900');
    await expect(page.getByTestId('mapping-preview')).toHaveAttribute('data-diagnostics', '0');
    await page.getByTestId('mapping-save').click();
    await expect(page.getByTestId('mapping-saved')).toBeVisible();

    // 5. limited ingestion; the audited stop really stops (cursor unchanged, audit row) — a job state, not a delete
    const connection = await findConnection(elena.token, world.connectionName);
    expect(connection).not.toBeNull();
    const connectionId = connection?.id ?? '';
    await page.getByTestId('tab-jobs').click();
    await createJob(page, 'limited', '120');
    await expect.poll(async () => (await jobsOf(elena.token, connectionId)).find((job) => job.scope.purpose === 'limited')?.lastSuccessAt ?? null, { intervals: [2_000], timeout: 60_000 }).not.toBeNull();
    await jobRow(page, 'limited').getByTestId('job-stop').click();
    await page.fill('#job-reason', 'P-INT: limited check done');
    await page.getByTestId('job-command-confirm').click();
    await expect(jobRow(page, 'limited')).toHaveAttribute('data-state', 'stopped', { timeout: 20_000 });
    const stoppedCursor = (await jobsOf(elena.token, connectionId)).find((job) => job.scope.purpose === 'limited')?.committedCursor;
    await page.waitForTimeout(7_000); // longer than the 5 s runner tick
    expect((await jobsOf(elena.token, connectionId)).find((job) => job.scope.purpose === 'limited')?.committedCursor).toEqual(stoppedCursor);
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
    await page.fill('#resolve-reason', 'P-INT: element bound to its unit');
    await page.getByTestId('exception-dry-run').click();
    await expect(page.getByTestId('replay-run')).toHaveAttribute('data-state', 'completed', { timeout: 30_000 });
    await expect(page.getByTestId('replay-run')).toHaveAttribute('data-objects', '1');
    await page.getByTestId('exception-replay').click();
    await expect(page.getByTestId('exception-detail')).toHaveAttribute('data-state', 'resolved', { timeout: 60_000 });
    await expect.poll(async () => (await eventsByEventId(elena.token, world.unitId, world.recentFrame)).length, { intervals: [2_000], timeout: 30_000 }).toBe(1);
    expect((await eventsByEventId(elena.token, world.unitId, world.recentFrame))[0].durationSeconds).toBe(900);

    // 7. bounded backfill of 7 days (drained: stops once caught up) brings the 3-day-old frame, no duplicates
    await page.goto(`/connectivity/connections/${connectionId}?tab=jobs`);
    await createJob(page, 'backfill', '7');
    await expect(jobRow(page, 'backfill')).toHaveAttribute('data-state', 'stopped', { timeout: 90_000 });
    await expect.poll(async () => (await eventsByEventId(elena.token, world.unitId, world.oldFrame)).length, { intervals: [2_000], timeout: 30_000 }).toBe(1);
    expect(await eventsByEventId(elena.token, world.unitId, world.recentFrame)).toHaveLength(1);

    // 8. production cadence with health; every UX06 stage recorded with its result (the job is left running)
    await createJob(page, 'production');
    await expect.poll(async () => (await jobsOf(elena.token, connectionId)).find((job) => job.scope.purpose === 'production')?.lastSuccessAt ?? null, { intervals: [2_000], timeout: 60_000 }).not.toBeNull();
    await expect(jobRow(page, 'production').getByTestId('job-health').first()).toHaveText('Healthy', { timeout: 20_000 });
    await page.getByRole('tab', { name: 'Stages' }).click();
    for (const stage of ['configure', 'validate', 'discover', 'map', 'limited', 'quarantine', 'backfill', 'production']) {
      await expect(page.locator(`[data-testid="stage"][data-stage="${stage}"]`)).toHaveAttribute('data-status', 'done', { timeout: 30_000 });
    }
    await page.screenshot({ path: test.info().outputPath('int-02-ux06.png'), fullPage: true });

    // secrets: never in an API response or browser storage
    expect(bodies.length).toBeGreaterThan(10);
    expect(bodies.filter((body) => body.includes(world.password))).toEqual([]);
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(storage).not.toContain(world.password);
  });

  test('INT-02p (elena): the connection, its mapping and both events are still there after a fresh login', async ({ page }) => {
    const fresh = await apiLogin(INT_USERS.elena);
    const connection = await findConnection(fresh.token, world.connectionName);
    expect(connection?.isActive).toBe(true);
    expect(connection?.hasSecret).toBe(true);
    expect(await eventsByEventId(fresh.token, world.unitId, world.recentFrame)).toHaveLength(1);
    expect(await eventsByEventId(fresh.token, world.unitId, world.oldFrame)).toHaveLength(1);
    await uiLogin(page, INT_USERS.elena);
    await openConsole(page);
    await selectConnection(page, world.connectionName);
    await page.getByTestId('tab-jobs').click();
    await expect(jobRow(page, 'production')).toBeVisible({ timeout: 20_000 });
    await page.goto('/connectivity?tab=mappings');
    // the bound rule carries the discovered path or element id; both contain the journey suffix
    await findOnPages(page, page.locator('[data-testid="source-mapping"]').filter({ hasText: suffix }));
  });
});
