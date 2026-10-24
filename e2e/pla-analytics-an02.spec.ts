import { test, expect, type Page, type Request } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call } from './test-utils/downtime-world';
import { scopeUrl, seedPlaWorld, type PlaWorld } from './test-utils/pla-world';

/**
 * Plan 3.6 exit tests — AN02 PLA views, AN03 reports and exports, T24 shared snapshot and T41 null OEE on
 * the v2 PLA Analytics, Reports and Dashboard. Flag `v2.plaAnalytics` is switched on for the demo tenant
 * by the manager (it stays on). Data: the 3.5 "E2E PD …" world (one operational day three days ago, shift
 * A approved) and an "E2E PLA T41 …" unit whose calendar excludes that day (pla-world.ts).
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const ENGINEER = { email: 'engineer@acme.com', password: 'demo123' };
const FLAG = 'v2.plaAnalytics';

let manager = '';
let world: PlaWorld;

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const reportRequest = (page: Page, kind: string, check: (url: URL) => boolean = () => true) =>
  page.waitForRequest((request: Request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith(`/v2/reports/${kind}`) && check(url);
  });

async function openAnalytics(page: Page, url: string): Promise<void> {
  await page.goto(url);
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('pla-analytics-v2')).toBeVisible({ timeout: 60_000 });
}

function trackWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
  });
  return writes;
}

const decimalSum = (values: string[]) => values.reduce((acc, v) => acc + Math.round(Number(v) * 1e6), 0) / 1e6;

test.describe('PLA Analytics and Reports — AN02 / AN03 on server snapshots (plan 3.6)', () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000);
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    const tenantId = (session.user as { tenantId: string }).tenantId;
    expect((await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true })).status).toBe(200);
    const engineer = (await authenticate(ENGINEER.email, ENGINEER.password)).accessToken;
    world = await seedPlaWorld(manager, engineer, tenantId);
  });

  test.afterAll(async () => {
    // decision for the owner's demo: the v2 analytics stay switched on for Demo Plant
    await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
  });

  test('AN02 + T24: waterfall closes on both ledgers, header / chart / loss tree share the scope, no writes on open', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 }); // tablet (UX07)
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    const writes = trackWrites(page);
    const unit = world.dashboard.unitId;
    await openAnalytics(page, scopeUrl('/pla-analytics', [unit], world.day));
    const waterfall = page.getByTestId('waterfall');
    await expect(waterfall).toHaveAttribute('data-closes', 'true', { timeout: 60_000 });
    await expect(waterfall).toHaveAttribute('data-opening', '2160');
    await expect(waterfall).toHaveAttribute('data-closing', '1710');
    await expect(page.locator('[data-testid="waterfall-bar"][data-key="unaccounted"]')).toHaveAttribute('data-delta', '-210');
    await expect(page.getByTestId('snapshot-runs')).toHaveAttribute('data-run-ids', /^[0-9a-f-]{36}(,[0-9a-f-]{36}){2}$/);
    await expect(page.getByTestId('scope-export')).toHaveAttribute('data-request', ''); // provisional scope: no export

    const capacityRequest = reportRequest(page, 'scope-waterfall', (url) => url.searchParams.get('ledger') === 'capacity' && url.searchParams.getAll('unitIds').includes(unit));
    await page.getByTestId('ledger-capacity').click();
    await capacityRequest;
    await expect(waterfall).toHaveAttribute('data-ledger', 'capacity');
    await expect(waterfall).toHaveAttribute('data-closes', 'true');
    const lossDeltas = await page.locator('[data-testid="waterfall-bar"]').evaluateAll((rows) =>
      rows.filter((row) => ['schedule_exclusion', 'availability', 'performance', 'quality'].includes(row.getAttribute('data-key') ?? '')).map((row) => row.getAttribute('data-delta') ?? '0'),
    );

    const treeRequest = reportRequest(page, 'loss-tree', (url) => url.searchParams.get('ledger') === 'capacity' && url.searchParams.get('groupBy') === 'kind');
    await page.getByTestId('tab-losses').click();
    await page.getByTestId('loss-group-by').selectOption('kind');
    await treeRequest;
    await expect(page.getByTestId('loss-tree')).toHaveAttribute('data-group-by', 'kind');
    const total = await page.getByTestId('loss-total').getAttribute('data-amount');
    expect(Number(total)).toBeCloseTo(-decimalSum(lossDeltas), 6); // loss tree total = waterfall losses
    await expect(page.getByTestId('loss-group').last()).toHaveAttribute('data-cumulative', '1');
    expect(writes).toEqual([]); // KPI03: reading analytics writes nothing
    await page.screenshot({ path: test.info().outputPath('pla-waterfall-loss-tree.png') });
  });

  test('AN02: trend selector is a server groupBy; residual buckets add up; reconciliation status, quality, repeat causes, value, OEE', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    const unit = world.dashboard.unitId;
    await openAnalytics(page, scopeUrl('/pla-analytics', [unit], world.day, '&tab=trends'));
    const shiftTrend = reportRequest(page, 'reconciliation-trend', (url) => url.searchParams.get('groupBy') === 'shift');
    const shiftOee = reportRequest(page, 'oee', (url) => url.searchParams.get('groupBy') === 'shift');
    await page.getByTestId('trend-by').selectOption('shift');
    await Promise.all([shiftTrend, shiftOee]);
    await expect(page.getByTestId('residual-bucket')).toHaveCount(3);
    const residuals = await page.getByTestId('residual-bucket').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-unaccounted') ?? ''));
    expect(residuals).toEqual(['0', '60', '150']);
    await expect(page.getByTestId('oee-by-unit').getByTestId('oee-group')).toContainText(world.dashboard.unitName);

    await page.getByTestId('tab-reconciliation').click();
    const status = page.getByTestId('reconciliation-status');
    await expect(status.locator('[data-testid="workflow-count"][data-key="approved"]')).toHaveAttribute('data-count', '1');
    await expect(status.locator('[data-testid="workflow-count"][data-key="draft"]')).toHaveAttribute('data-count', '2');
    const overdueB = page.locator(`[data-testid="overdue-link"][data-period-id="${world.dashboard.periods.b}"]`);
    await expect(overdueB).toHaveAttribute('href', `/plans/${world.dashboard.planId}/periods/${world.dashboard.periods.b}`);
    await status.locator('[data-testid="workflow-count-link"][data-key="draft"]').click(); // UX D-6: a count opens its periods
    await expect(page.getByTestId('pla-period-list').getByTestId('period-list-row')).toHaveCount(2);
    await page.getByTestId('period-list-back').click();
    await expect(page.getByTestId('reconciliation-status')).toBeVisible();

    await page.getByRole('button', { name: 'Actuals quality coverage' }).click(); // a section of Reconciliation
    await expect(page.getByTestId('quality-coverage')).toHaveAttribute('data-slices', '3');
    await page.getByTestId('tab-losses').click();
    await page.getByRole('button', { name: 'Repeat causes' }).click(); // sections of Losses
    await expect(page.getByTestId('repeat-reasons').getByTestId('repeat-row').first()).toHaveAttribute('data-periods', '2');

    await page.getByRole('button', { name: 'Top opportunities' }).click();
    await expect(page.getByTestId('opportunities')).toBeVisible();
    for (const section of await page.getByTestId('opportunity-currency').all()) {
      if ((await section.getAttribute('data-status')) === 'unvalued') await expect(section.getByTestId('loss-total')).toContainText('Not valued');
    }

    await page.getByTestId('tab-oee').click();
    await expect(page.getByTestId('pla-oee-operational')).toContainText('Operational OEE (ISO 22400)');
    await expect(page.getByTestId('pla-oee-reconciled')).toContainText('Reconciled PLA OEE');
    await expect(page.getByTestId('oee-operational-oee').getByTestId('oee-tile-value')).toHaveText(/%|^Not available: /);
    await expect(page.getByRole('tab')).toHaveCount(5); // at most 5 views (UI guidelines §2)
  });

  test('T41: a unit with no scheduled time shows "Not available: no scheduled time", never 87 % or 100 %', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openAnalytics(page, scopeUrl('/pla-analytics', [world.t41.unitId], world.day, '&tab=oee'));
    const tile = page.getByTestId('oee-operational-oee');
    await expect(tile).toHaveAttribute('data-reason', 'no_scheduled_time', { timeout: 60_000 });
    await expect(tile.getByTestId('oee-tile-value')).toHaveText('Not available: no scheduled time');
    const values = await page.getByTestId('pla-oee-operational').getByTestId('oee-tile-value').allTextContents();
    expect(values).toEqual(Array(4).fill('Not available: no scheduled time')); // OEE, A, P, Q: never 87 % / 100 %
    await expect(page.getByTestId('oee-operational-units').getByTestId('oee-group')).not.toContainText('%');
  });

  test('AN03 Reports: named units always sent, approved revisions, async CSV export carries scope, status and run ids', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    const unit = world.dashboard.unitId;
    const firstOee = reportRequest(page, 'oee');
    await page.goto('/reports');
    await expect(page.getByTestId('reports-v2')).toBeVisible({ timeout: 60_000 });
    // "all units" is sent as the named list (§16.2) up to 100 units; a bigger plant (the demo plant
    // collects E2E units run after run) leaves the scope to the server rather than send a huge URL
    const sent = new URL((await firstOee).url()).searchParams.getAll('unitIds');
    const units = await call<{ items: unknown[]; nextCursor: string | null }>(manager, 'GET', '/v2/units?limit=100');
    if (units.body.nextCursor === null) expect(sent).toHaveLength(units.body.items.length);
    else expect(sent).toEqual([]);

    const scoped = reportRequest(page, 'oee', (url) => url.searchParams.getAll('unitIds').join() === unit && url.searchParams.get('approvedOnly') === 'true');
    await page.goto(scopeUrl('/reports', [unit], world.shiftA, '&approved=1'));
    await scoped;
    await expect(page.getByTestId('report-oee')).toHaveAttribute('data-unit-ids', unit);
    await expect(page.getByTestId('report-oee')).toHaveAttribute('data-run-ids', /^[0-9a-f-]{36}$/);
    await expect(page.getByTestId('report-oee-days').getByTestId('oee-group')).toHaveCount(1);
    await page.getByTestId('report-type').selectOption('management');
    await page.getByTestId('report-view').selectOption('exports');
    await page.getByTestId('export-period-summary-start').click();
    await expect(page.getByTestId('export-period-summary-job')).toHaveAttribute('data-state', 'completed', { timeout: 60_000 });
    const download = page.waitForEvent('download');
    await page.getByTestId('export-period-summary-download').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^traverse-forge-period_summary-.+\.csv$/);
    const csv = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8');
    expect(csv).toMatch(/status,approved/);
    expect(csv).toContain(unit);
    expect(csv).toContain('calculation_run_id');
  });

  test('Dashboard on v2: labelled OEE tiles and reconciliation counts from the server, no writes', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    const writes = trackWrites(page);
    await page.goto('/dashboard');
    await expect(page.getByTestId('analytics-dashboard')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('dashboard-oee-operational-tile')).toContainText('Operational OEE');
    await expect(page.getByTestId('dashboard-oee-reconciled-tile')).toContainText('Reconciled PLA OEE');
    // rendered once the reconciliation summary answers (a heavy read on the big demo plant)
    await expect(page.getByTestId('dashboard-overdue')).toHaveAttribute('data-count', /^\d+$/, { timeout: 30_000 });
    await expect(page.getByTestId('dashboard-oee-operational-tile').getByTestId('oee-tile-value')).toHaveText(/%|^—$/);
    expect(writes).toEqual([]);
  });
});
