import { test, expect, type Page, type Request, type Response } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { scopeUrl } from '../test-utils/pla-world';
import { api } from './support/manager-api';
import { MANAGERS, sessionOf, type Session } from './support/manager-users';
import { ensureDowntimeWorld, ensurePeriodWorld, type DowntimeWorld, type PeriodWorld } from './support/manager-world';

/**
 * Manager approver persona — journey 10: analytics as a manager (plans 3.3 and 3.6).
 * AN01 on `/downtime` (Erik): KPI tiles, Pareto with cumulative share, bad actors, reliability labels,
 * drill-through; T24: every widget asks with the same filters and shows the same calculation runs.
 * AN02 / AN03 on `/pla-analytics`, `/reports` and `/dashboard` (Laura): the waterfall closes on both
 * ledgers, the loss tree shares the scope, reconciliation status counts match the API, reports with
 * approved revisions only and an async CSV export, no writes on open.
 * Data: unit `P-MGR-DT …` with its calendar, profile, assets, codes and stops; the `P-MGR-PD …` world
 * of the periods spec (approved shift A) — kept.
 */
const HOUR = 3_600_000;

interface ReportCall {
  url: URL;
  body: { data: { calculationRunIds: string[] } };
}

let erik: Session;
let laura: Session;
let downtimeWorld: DowntimeWorld;
let periodWorld: PeriodWorld;

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const tile = (page: Page, metric: string) => page.getByTestId('kpi-summary').getByTestId(`kpi-${metric}`);
const bars = (page: Page) => page.getByTestId('reason-pareto').getByTestId('pareto-bar');
const bar = (page: Page, key: string) => page.locator(`[data-testid="pareto-bar"][data-key="${key}"]`);

async function openDowntime(page: Page, reports: ReportCall[]): Promise<void> {
  page.on('response', async (response: Response) => {
    if (!response.url().includes('/v2/reports/') || response.status() !== 200) return;
    const body = await response.json().catch(() => null);
    if (body) reports.push({ url: new URL(response.url()), body });
  });
  await loginViaUI(page, MANAGERS.erik.email, MANAGERS.erik.password);
  const params = new URLSearchParams({ from: downtimeWorld.from, to: downtimeWorld.to, window: 'P-MGR day', units: downtimeWorld.unitId });
  await page.goto(`/downtime?${params.toString()}`);
  await expect(page.getByTestId('downtime-analysis')).toBeVisible({ timeout: 60_000 });
}

const reportRequest = (page: Page, kind: string, check: (url: URL) => boolean = () => true) =>
  page.waitForRequest((request: Request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith(`/v2/reports/${kind}`) && check(url);
  });

function trackWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
  });
  return writes;
}

test.describe('Manager persona — Downtime Analysis and PLA analytics', () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000);
    [erik, laura] = await Promise.all([sessionOf(MANAGERS.erik), sessionOf(MANAGERS.laura)]);
    downtimeWorld = await ensureDowntimeWorld(erik.token, erik.tenantId);
    periodWorld = await ensurePeriodWorld(laura.token, laura.tenantId);
  });

  test('AN01 Erik: tiles, Pareto with cumulative share, bad actors, reliability labels and drill-through', async ({ page }) => {
    await openDowntime(page, []);
    await expect(page.locator('nav a[href="/downtime"]')).toBeVisible();
    await expect(tile(page, 'downtime_total')).toHaveAttribute('data-value', '8100');
    await expect(tile(page, 'downtime_total').getByTestId('kpi-value')).toHaveText('2:15');
    await expect(tile(page, 'unknown_time').getByTestId('kpi-value')).toHaveText('0:15');
    await expect(tile(page, 'stop_count').getByTestId('kpi-value')).toHaveText('4');
    await expect(page.getByTestId('unknown-lower-bound')).toBeVisible();
    await expect(bars(page)).toHaveCount(3);
    await expect(bars(page).first()).toHaveAttribute('data-key', downtimeWorld.reasons.mechanical);
    await expect(bars(page).first()).toHaveAttribute('data-value', '5400');
    await expect(bars(page).last()).toHaveAttribute('data-cumulative', '1');
    const actors = page.getByTestId('bad-actors');
    await expect(actors.locator(`[data-testid="bad-actor"][data-key="${downtimeWorld.assets.pump}"]`)).toHaveAttribute('data-value', '2700');
    await expect(page.getByTestId('reliability').getByTestId('restore-title')).toHaveText('Mean time to restore production');
    await bar(page, downtimeWorld.reasons.mechanical).click();
    await expect(bars(page)).toHaveCount(2);
    await expect(bar(page, downtimeWorld.reasons.bearing)).toHaveAttribute('data-value', '2700');
    await page.getByRole('radio', { name: 'Frequency' }).click();
    await expect(bar(page, downtimeWorld.reasons.bearing)).toHaveAttribute('data-value', '1');
    await bar(page, downtimeWorld.reasons.bearing).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('drill-events').getByTestId('event-row')).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath('manager-downtime.png') });
  });

  test('T24 Erik: every widget asks with the same filters and shows the same calculation runs; export needs approved figures', async ({ page }) => {
    const reports: ReportCall[] = [];
    await openDowntime(page, reports);
    await expect(page.getByTestId('snapshot-runs')).toBeVisible();
    await expect(page.getByTestId('crew-comparison')).toBeVisible(); // snapshot widgets state runs and approval once, in the page header (snapshot-runs)
    const current = reports.filter((r) => r.url.searchParams.get('from') === downtimeWorld.from);
    expect(current.length).toBeGreaterThan(0); // the widgets read one bundle report plus the page's own reports
    for (const report of current) {
      expect(report.url.searchParams.get('to')).toBe(downtimeWorld.to);
      expect(report.url.searchParams.getAll('unitIds')).toEqual([downtimeWorld.unitId]);
      expect(report.url.searchParams.has('tenantId')).toBe(false);
    }
    const runIds = [...current[0].body.data.calculationRunIds].sort();
    expect(runIds).toHaveLength(3);
    for (const report of current) expect([...report.body.data.calculationRunIds].sort()).toEqual(runIds);
    expect((await page.getByTestId('snapshot-runs').getAttribute('data-run-ids'))?.split(',').sort()).toEqual(runIds);
    await expect(page.getByTestId('downtime-export')).toBeDisabled();
    await expect(page.getByTestId('downtime-export')).toHaveAttribute('title', /approved figures only/);
  });

  test('AN02 Laura: waterfall closes on both ledgers, loss tree shares the scope, reconciliation counts match the API, no writes', async ({ page }) => {
    await loginViaUI(page, MANAGERS.laura.email, MANAGERS.laura.password);
    const writes = trackWrites(page);
    const unit = periodWorld.unitId;
    await page.goto(scopeUrl('/pla-analytics', [unit], periodWorld.day));
    await expect(page.getByTestId('pla-analytics-v2')).toBeVisible({ timeout: 60_000 });
    const waterfall = page.getByTestId('waterfall');
    await expect(waterfall).toHaveAttribute('data-closes', 'true', { timeout: 60_000 });
    await expect(waterfall).toHaveAttribute('data-opening', '2160');
    await expect(page.getByTestId('snapshot-runs')).toHaveAttribute('data-run-ids', /^[0-9a-f-]{36}(,[0-9a-f-]{36}){2}$/);
    const capacityRequest = reportRequest(page, 'scope-waterfall', (url) => url.searchParams.get('ledger') === 'capacity' && url.searchParams.getAll('unitIds').includes(unit));
    await page.getByTestId('ledger-capacity').check();
    await capacityRequest;
    await expect(waterfall).toHaveAttribute('data-ledger', 'capacity');
    await expect(waterfall).toHaveAttribute('data-closes', 'true');
    const treeRequest = reportRequest(page, 'loss-tree', (url) => url.searchParams.get('ledger') === 'capacity' && url.searchParams.getAll('unitIds').includes(unit));
    await page.getByTestId('tab-losses').click();
    await treeRequest;
    await expect(page.getByTestId('loss-tree')).toBeVisible();

    await page.getByTestId('tab-reconciliation').click();
    const status = page.getByTestId('reconciliation-status');
    await expect(status).toBeVisible({ timeout: 60_000 });
    const query = `unitIds=${unit}&from=${encodeURIComponent(periodWorld.day.from)}&to=${encodeURIComponent(periodWorld.day.to)}`;
    const server = await api<{ data: { workflow: Array<{ state: string; periods: number }> } }>(laura.token, 'GET', `/v2/reports/reconciliation-status?${query}`);
    expect(server.status).toBe(200);
    const approved = String(server.body.data.workflow.find((entry) => entry.state === 'approved')?.periods ?? 0);
    await expect(status.locator('[data-testid="workflow-count"][data-key="approved"]')).toHaveAttribute('data-count', approved);
    expect(Number(approved)).toBeGreaterThanOrEqual(1); // shift A, approved by the persona in the periods spec
    await page.getByTestId('tab-oee').click();
    await expect(page.getByTestId('pla-oee-operational')).toContainText('Operational OEE (ISO 22400)');
    await expect(page.getByTestId('pla-oee-reconciled')).toContainText('Reconciled PLA OEE');
    await expect(page.getByRole('tab')).toHaveCount(5); // at most 5 views (UI guidelines §2)
    expect(writes).toEqual([]); // KPI03: reading analytics writes nothing
    await page.screenshot({ path: test.info().outputPath('manager-pla-analytics.png') });
  });

  test('AN03 Laura: Reports with approved revisions only, async CSV export carries status and run ids; dashboard tiles without writes', async ({ page }) => {
    await loginViaUI(page, MANAGERS.laura.email, MANAGERS.laura.password);
    const unit = periodWorld.unitId;
    const shiftA = { from: periodWorld.day.from, to: new Date(periodWorld.dayStart + 8 * HOUR).toISOString() };
    const scoped = reportRequest(page, 'oee', (url) => url.searchParams.getAll('unitIds').join() === unit && url.searchParams.get('approvedOnly') === 'true');
    await page.goto(scopeUrl('/reports', [unit], shiftA, '&approved=1'));
    await expect(page.getByTestId('reports-v2')).toBeVisible({ timeout: 60_000 });
    await scoped;
    await expect(page.getByTestId('report-snapshot')).toHaveAttribute('data-unit-ids', unit);
    await expect(page.getByTestId('report-snapshot')).toHaveAttribute('data-run-ids', /^[0-9a-f-]{36}$/);
    await page.getByTestId('report-tab-exports').click();
    await page.getByTestId('export-period-summary-start').click();
    await expect(page.getByTestId('export-period-summary-job')).toHaveAttribute('data-state', 'completed', { timeout: 60_000 });
    const download = page.waitForEvent('download');
    await page.getByTestId('export-period-summary-download').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^proact-period_summary-.+\.csv$/);
    const csv = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8');
    expect(csv).toMatch(/status,approved/);
    expect(csv).toContain(unit);

    const writes = trackWrites(page);
    await page.goto('/dashboard');
    await expect(page.getByTestId('analytics-dashboard')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('dashboard-oee-operational')).toContainText('Operational OEE (ISO 22400)');
    await expect(page.getByTestId('dashboard-overdue')).toHaveAttribute('data-count', /^\d+$/);
    expect(writes).toEqual([]);
  });
});
