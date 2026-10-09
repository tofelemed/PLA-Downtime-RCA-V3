import { test, expect, type Browser, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';
import { ensureApprover, reconciliation, saveLines, seedDashboardWorld, type DashboardWorld } from './test-utils/dashboard-world';

/**
 * Plan 3.5 exit tests — UX05 engineer and manager journeys on the v2 Plan Dashboard, T36 (separation of
 * duties) and T33 (atomic save) in the UI, RUN_CHANGED rebase, waterfall closure, no writes on open.
 * Flag `v2.planDashboard` is switched on for the demo tenant by the manager (it stays on). Users: the demo
 * users engineer@acme.com (production engineer) and manager@acme.com (manager approver), plus a second
 * manager approver `e2e-pd-approver@acme.com` registered once by the manager. Data: a new "E2E PD …"
 * unit, product, reason code and plan per run (dashboard-world.ts), one operational day three days ago.
 */
const ENGINEER = { email: 'engineer@acme.com', password: 'demo123' };
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const APPROVER = { email: 'e2e-pd-approver@acme.com', password: 'E2e-approver-1!' };
const FLAG = 'v2.planDashboard';

let manager = '';
let world: DashboardWorld;

test.describe.configure({ mode: 'serial', timeout: 120_000 });

const row = (page: Page, periodId: string) => page.locator(`[data-testid="period-row"][data-period-id="${periodId}"]`);
const figure = (page: Page, key: string) => page.getByTestId('reconciliation-summary').getByTestId(`figure-${key}`);

async function openPeriod(page: Page, periodId: string): Promise<void> {
  await page.goto(`/plans/${world.planId}/periods/${periodId}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('plan-dashboard-v2')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', /.+/, { timeout: 60_000 });
}

async function asUser(browser: Browser, user: { email: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await loginViaUI(page, user.email, user.password);
  return page;
}

test.describe('Plan Dashboard — UX05 period accounting journeys (plan 3.5)', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000);
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    const user = session.user as { tenantId: string; organizationId: string };
    expect((await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true })).status).toBe(200);
    world = await seedDashboardWorld(manager, user.tenantId);
    const engineer = (await authenticate(ENGINEER.email, ENGINEER.password)).accessToken;
    await saveLines(engineer, world.periods.a, world.reasonCodeId, ['50']);
    await ensureApprover(manager, user.tenantId, user.organizationId, APPROVER.email, APPROVER.password);
  });

  test.afterAll(async () => {
    // decision for the owner's demo: the period accounting workspace stays switched on for Demo Plant
    await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
  });

  test('UX05 engineer: opens the period without writes, sees T15, links a 10 t line to the stop, closes the residual and submits', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 }); // tablet (UX07)
    await loginViaUI(page, ENGINEER.email, ENGINEER.password);
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
    });
    await openPeriod(page, world.periods.a);
    await expect(row(page, world.periods.a)).toHaveAttribute('data-residual-state', 'unaccounted');
    await expect(row(page, world.periods.a).getByTestId('cell-gap')).toHaveText('150.00 t');
    await expect(row(page, world.periods.a).getByTestId('cell-attributed')).toHaveText('140.00 t');
    await expect(figure(page, 'residual')).toHaveAttribute('data-value', '10');
    await expect(page.getByTestId('waterfall')).toHaveAttribute('data-closes', 'true');
    const bars = page.getByTestId('waterfall').getByTestId('waterfall-bar');
    await expect(bars.last()).toHaveAttribute('data-end', '850');
    await expect(page.locator('[data-testid="waterfall-bar"][data-key="unaccounted"]')).toHaveAttribute('data-delta', '-10');
    await expect(page.getByTestId('waterfall')).not.toContainText('MT');
    await page.getByTestId('actuals-provenance').locator('summary').click();
    await expect(page.getByTestId('provenance-slice')).toContainText('coverage');
    expect(writes).toEqual([]); // KPI03: opening the dashboard writes nothing

    await page.getByTestId('ledger-capacity').click();
    await expect(page.getByTestId('waterfall')).toHaveAttribute('data-ledger', 'capacity');
    await expect(page.getByTestId('waterfall')).toHaveAttribute('data-closes', 'true');
    await page.getByTestId('ledger-plan').click();

    await page.getByTestId('add-manual-line').click();
    await page.fill('#manualQuantity', '10');
    await page.locator(`[data-testid="evidence-event"][data-event-id="${world.stops.a}"]`).click();
    await page.getByTestId('manual-line-add').click();
    await page.getByTestId('save-lines').click();
    await expect(figure(page, 'residual')).toHaveAttribute('data-value', '0');
    await expect(row(page, world.periods.a)).toHaveAttribute('data-residual-state', 'balanced');
    await page.getByTestId('wf-submit').click();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await expect(row(page, world.periods.a)).toHaveAttribute('data-workflow', 'in_review');
    await page.screenshot({ path: test.info().outputPath('plan-dashboard-engineer.png') });
  });

  test('UX05 manager: a different user approves the snapshot and exports it; the download hash is shown', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openPeriod(page, world.periods.a);
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await expect(page.getByTestId('approve-gate')).toHaveCount(0);
    await page.getByTestId('wf-approve').click();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved');
    await expect(page.getByTestId('revision-history').locator('[data-action="approve"]')).toBeVisible();
    await page.getByTestId('export-start').click();
    await expect(page.getByTestId('export-job')).toHaveAttribute('data-state', 'completed', { timeout: 60_000 });
    await expect(page.getByTestId('export-hash')).toHaveText(/sha256 [0-9a-f]{64}/);
    const download = page.waitForEvent('download');
    await page.getByTestId('export-download').click();
    expect((await download).suggestedFilename()).toMatch(/^proact-loss-lines-.+\.csv$/);
    await expect(row(page, world.periods.a)).toHaveAttribute('data-workflow', 'approved');
  });

  test('T36: the submitter cannot approve (SEPARATION_OF_DUTIES); another manager approver can', async ({ browser }) => {
    await saveLines(manager, world.periods.b, world.reasonCodeId, ['60']);
    const submitter = await asUser(browser, MANAGER);
    await openPeriod(submitter, world.periods.b);
    await expect(figure(submitter, 'residual')).toHaveAttribute('data-value', '0');
    await submitter.getByTestId('wf-submit').click();
    await expect(submitter.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await expect(submitter.getByTestId('wf-approve')).toBeDisabled();
    await expect(submitter.getByTestId('approve-gate')).toHaveAttribute('data-code', 'SEPARATION_OF_DUTIES');
    const view = await call<{ revision: { submittedHash: string } }>(manager, 'GET', `/v2/production-periods/${world.periods.b}/reconciliation`);
    const refused = await command<{ code: string }>(manager, `/v2/production-periods/${world.periods.b}/approve`, { revision: 1, submittedHash: view.body.revision.submittedHash });
    expect([refused.status, refused.body.code]).toEqual([403, 'SEPARATION_OF_DUTIES']);

    const approver = await asUser(browser, APPROVER);
    await openPeriod(approver, world.periods.b);
    await approver.getByTestId('wf-approve').click();
    await expect(approver.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved');
  });

  test('T33: a failed save shows the error and changes nothing; RUN_CHANGED shows the diff and rebases', async ({ page }) => {
    // no realtime in this session: the editor keeps the run it read, as a user whose notice is late would
    await page.routeWebSocket(/socket\.io/, () => undefined);
    await page.route(/socket\.io/, (route) => route.abort());
    await loginViaUI(page, ENGINEER.email, ENGINEER.password);
    await openPeriod(page, world.periods.c);
    await expect(row(page, world.periods.c).getByTestId('cell-attributed')).toHaveText('0.00 t');
    await page.getByTestId('add-manual-line').click();
    await page.fill('#manualQuantity', '20');
    await page.locator('#manualNoEvent').click();
    await page.selectOption('#manualReason', world.reasonCodeId);
    await page.getByTestId('manual-line-add').click();
    await page.route('**/draft-lines', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'injected failure', correlationId: 'e2e', retryable: false }) }));
    await page.getByTestId('save-lines').click();
    await expect(page.getByTestId('workflow-problem')).toHaveAttribute('data-code', 'INTERNAL_ERROR');
    await expect(page.getByTestId('loss-line-editor')).toHaveAttribute('data-dirty', 'true');
    expect((await reconciliation(manager, world.periods.c)).candidates).toHaveLength(0);
    const saved = await call<{ lines: unknown[] }>(manager, 'GET', `/v2/production-periods/${world.periods.c}/reconciliation`);
    expect(saved.body.lines).toEqual([]); // nothing applied partially
    await expect(row(page, world.periods.c).getByTestId('cell-attributed')).toHaveText('0.00 t');
    await page.unroute('**/draft-lines');

    // another session changes an input and recomputes: the run the editor read is no longer current
    const start = world.dayStart + 18 * 3_600_000;
    await command(manager, '/v2/production-events', { unitId: world.unitId, startTime: new Date(start).toISOString(), endTime: new Date(start + 3_600_000).toISOString(), physicalType: 'downtime', scheduleClass: 'unplanned' });
    await command(manager, `/v2/production-periods/${world.periods.c}/recompute`, { reason: 'e2e: late stop' });
    await expect.poll(async () => (await reconciliation(manager, world.periods.c)).candidates.length, { timeout: 60_000 }).toBe(1);
    await page.getByTestId('save-lines').click();
    await expect(page.getByTestId('conflict-dialog')).toHaveAttribute('data-code', 'RUN_CHANGED');
    await expect(page.getByTestId('candidate-diff')).toContainText('Added candidates');
    await page.getByTestId('rebase').click();
    await expect(page.getByTestId('candidate-row')).toHaveCount(1);
    await page.getByTestId('save-lines').click();
    await expect(figure(page, 'attributed')).toHaveAttribute('data-value', '110');
    await expect(page.getByTestId('loss-line-editor')).toHaveAttribute('data-dirty', 'false');
  });
});
