import { test, expect, type Page, type Response } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, seedDowntimeWorld, type DowntimeWorld } from './test-utils/downtime-world';

/**
 * Plan 3.3 exit tests — AN01 and T24 on the Downtime Analysis page (flag `v2.downtimeAnalysis` switched
 * on for the demo tenant through the API; it stays on afterwards so the owner can use the page).
 * Fixture (seeded through the API, see downtime-world.ts): one operational day with two overlapping
 * asset stops (60 min each, 30 min overlap → 90 min of unit downtime) coded Bearing / Seal under
 * Mechanical, a 30 min Electrical stop and a 15 min stop of unknown schedule class.
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const FLAG = 'v2.downtimeAnalysis';

interface ReportCall {
  url: URL;
  body: { data: { calculationRunIds: string[] } };
}

let manager = '';
let world: DowntimeWorld;

async function openPage(page: Page, reports: ReportCall[]): Promise<void> {
  page.on('response', async (response: Response) => {
    if (!response.url().includes('/v2/reports/') || response.status() !== 200) return;
    // The browser discards bodies of superseded loads (e.g. the re-render after a viewport resize);
    // reading one throws "No data found", so those calls are skipped instead of failing the test.
    const body = await response.json().catch(() => null);
    if (body) reports.push({ url: new URL(response.url()), body });
  });
  await loginViaUI(page, MANAGER.email, MANAGER.password);
  const params = new URLSearchParams({ from: world.from, to: world.to, window: 'E2E day', units: world.unitId });
  await page.goto(`/downtime?${params.toString()}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('downtime-analysis')).toBeVisible({ timeout: 60_000 });
}

const tile = (page: Page, metric: string) => page.getByTestId('kpi-summary').getByTestId(`kpi-${metric}`);
const bars = (page: Page) => page.getByTestId('reason-pareto').getByTestId('pareto-bar');
const bar = (page: Page, key: string) => page.locator(`[data-testid="pareto-bar"][data-key="${key}"]`);

test.describe('Downtime Analysis — AN01 / T24 (plan 3.3)', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    const flag = await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
    expect(flag.status).toBe(200);
    world = await seedDowntimeWorld(manager, (session.user as { tenantId: string }).tenantId);
  });

  test.afterAll(async () => {
    // decision for the owner's demo: the page stays switched on for Demo Plant
    await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
  });

  test('tiles, Pareto with cumulative share, bad actors, reliability labels and drill-through', async ({ page }) => {
    const reports: ReportCall[] = [];
    await openPage(page, reports);
    await expect(page.locator('nav a[href="/downtime"]')).toBeVisible();

    // KPI tiles: the unit's union downtime (90 + 30 + 15 min) and occurrences; unknown → lower-bound note
    await expect(tile(page, 'downtime_total')).toHaveAttribute('data-value', '8100');
    await expect(tile(page, 'downtime_total').getByTestId('kpi-value')).toHaveText('2:15');
    await expect(tile(page, 'unknown_time').getByTestId('kpi-value')).toHaveText('0:15');
    await expect(tile(page, 'stop_count').getByTestId('kpi-value')).toHaveText('4');
    await expect(page.getByTestId('unknown-lower-bound')).toBeVisible();
    await expect(page.getByTestId('kpi-summary').getByTestId('report-meta')).toContainText('Provisional');

    // Pareto level 1 with the server's cumulative share reaching 100 %
    await expect(bars(page)).toHaveCount(3);
    await expect(bars(page).first()).toHaveAttribute('data-key', world.reasons.mechanical);
    await expect(bars(page).first()).toHaveAttribute('data-value', '5400');
    await expect(bars(page).last()).toHaveAttribute('data-cumulative', '1');
    await expect(bars(page).last().getByTestId('pareto-cumulative')).toHaveText('Σ 100.0 %');

    // bad actors: 60 + 60 min stops overlapping 30 min → allocated 45 + 45 min, labelled
    const actors = page.getByTestId('bad-actors');
    await expect(actors).toContainText('Allocated');
    await expect(actors.locator(`[data-testid="bad-actor"][data-key="${world.assets.pump}"]`)).toHaveAttribute('data-value', '2700');
    await expect(actors.locator(`[data-testid="bad-actor"][data-key="${world.assets.valve}"]`)).toHaveAttribute('data-value', '2700');

    // reliability: no failure-coded stops → MTBF null with exposure; no repair evidence → labelled restore column
    const reliability = page.getByTestId('reliability');
    await expect(reliability.getByTestId('restore-title')).toHaveText('Mean downtime to restore');
    await expect(reliability.getByTestId('mtbf')).toContainText('No failures in the window · exposure');

    // drill: Mechanical → its children; frequency; Bearing → exactly its events (count = bar frequency)
    await bar(page, world.reasons.mechanical).click();
    await expect(page.getByTestId('pareto-breadcrumb')).toContainText('Mechanical');
    await expect(bars(page)).toHaveCount(2);
    await expect(bar(page, world.reasons.bearing)).toHaveAttribute('data-value', '2700');
    await page.getByRole('radio', { name: 'Frequency' }).click();
    await expect(bar(page, world.reasons.bearing)).toHaveAttribute('data-value', '1');
    expect(new URL(page.url()).searchParams.get('reasons')).toBe(world.reasons.mechanical);
    await bar(page, world.reasons.bearing).focus();
    await page.keyboard.press('Enter');
    const drill = page.getByTestId('drill-events');
    await expect(drill).toHaveAttribute('data-reason-id', world.reasons.bearing);
    await expect(drill.getByTestId('event-row')).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath('downtime-analysis.png') });
  });

  test('T24: every widget asks with the same filters and shows the same calculation runs', async ({ page }) => {
    const reports: ReportCall[] = [];
    await openPage(page, reports);
    await expect(page.getByTestId('snapshot-runs')).toBeVisible();
    await expect(page.getByTestId('crew-comparison').getByTestId('report-meta')).toBeVisible();
    const current = reports.filter((r) => r.url.searchParams.get('from') === world.from);
    expect(current.length).toBeGreaterThanOrEqual(6);
    for (const report of current) {
      expect(report.url.searchParams.get('to')).toBe(world.to);
      expect(report.url.searchParams.getAll('unitIds')).toEqual([world.unitId]);
      expect(report.url.searchParams.has('approvedOnly')).toBe(false);
      expect(report.url.searchParams.has('tenantId')).toBe(false);
    }
    const runIds = [...current[0].body.data.calculationRunIds].sort();
    expect(runIds).toHaveLength(3);
    for (const report of current) expect([...report.body.data.calculationRunIds].sort()).toEqual(runIds);
    const shown = await page.getByTestId('snapshot-runs').getAttribute('data-run-ids');
    expect(shown?.split(',').sort()).toEqual(runIds);
    const metaCounts = await page.getByTestId('report-meta').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-run-count')));
    expect(new Set(metaCounts.filter((count) => count !== '0'))).toEqual(new Set(['3']));
    // export carries approved figures only: disabled for this provisional snapshot, with the reason
    await expect(page.getByTestId('downtime-export')).toBeDisabled();
    await expect(page.getByTestId('downtime-export')).toHaveAttribute('title', /approved figures only/);
  });

  test('tablet viewport and keyboard: filters reach the URL, timeline opens the event page', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openPage(page, []);
    await page.locator('#downtime-trend').selectOption('shift');
    await expect.poll(() => new URL(page.url()).searchParams.get('trend')).toBe('shift');
    await expect(page.getByTestId('downtime-trend')).toContainText('Trend by shift');
    const segments = page.getByTestId('state-timeline').getByTestId('timeline-segment');
    await expect(segments).toHaveCount(4);
    await segments.first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('event-detail')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('downtime-analysis')).toBeVisible();
    const width = await page.evaluate(() => document.querySelector('[data-testid="downtime-analysis"]')?.scrollWidth ?? 0);
    expect(width).toBeLessThanOrEqual(1024);
  });
});
