import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { call, command } from '../test-utils/downtime-world';
import { scopeUrl } from '../test-utils/pla-world';
import { AISHA, HANNAH, SAMUEL, SETUP_MANAGER, apiSession, type Session } from './support/engineer-users';
import { approvePeriod, event, seedEngineerWorld, submitManualLine, until, type EngineerWorld } from './support/engineer-world';
import { backToList, eventRowOf, openEventRow, pickReasonCode } from './support/event-hub-ui';

/**
 * Production engineer persona — event coding on the v2 Event Hub (journey 4) and the analytics screens
 * (journey 6): PLA analytics, Downtime Analysis with drill-through and Reports with an accepted export.
 * Data: a "P-ENG PD …" world (engineer-world.ts) plus a third stop in shift B; stops coded by the analyst
 * in the UI (feed interruption / motor trip); shift C accounted and submitted by Aisha and approved by the
 * setup manager so that an approved-only export exists. Nothing is deleted.
 */
const HOUR = 3_600_000;
const DAY = 86_400_000;

let world: EngineerWorld;
let aisha: Session;
let stopC = '';

test.describe.configure({ mode: 'serial', timeout: 150_000 });

const row = (page: Page, id: string) => eventRowOf(page, id);
const tile = (page: Page, metric: string) => page.getByTestId('kpi-summary').getByTestId(`kpi-${metric}`);
const bar = (page: Page, key: string) => page.locator(`[data-testid="pareto-bar"][data-key="${key}"]`);

async function openHub(page: Page): Promise<void> {
  await page.goto('/events');
  await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('filter-units').click();
  await page.getByRole('checkbox', { name: world.unitName }).click();
  await page.keyboard.press('Escape');
  // the day under analysis is three days back: pick "Last 7 days" explicitly (the remembered window may differ)
  await page.getByTestId('event-window').selectOption('preset:168');
  await expect(row(page, world.stops.a)).toBeVisible({ timeout: 30_000 });
}

function trackWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
  });
  return writes;
}

const window = () => ({ from: new Date(world.dayStart).toISOString(), to: new Date(world.dayStart + DAY).toISOString() });

async function reasonOf(token: string, eventId: string): Promise<string | null> {
  const stored = await call<{ reasonCodeId: string | null }>(token, 'GET', `/v2/production-events/${eventId}`);
  return stored.body.reasonCodeId;
}

test.describe('Engineer — event coding and analytics (journeys 4 and 6)', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000);
    const setup = await apiSession(SETUP_MANAGER);
    aisha = await apiSession(AISHA);
    world = await seedEngineerWorld(setup.token, aisha.token, aisha.tenantId, 'PD');
    stopC = await event(aisha.token, world.unitId, world.dayStart + 12 * HOUR, world.dayStart + 12.5 * HOUR, { physicalType: 'downtime', scheduleClass: 'unplanned', description: `P-ENG motor stop C ${world.suffix}` });
  });

  test('J4 Hannah codes a stop (reason + schedule class) in the drawer, then bulk-codes two stops after a preview; the codes persist', async ({ page }) => {
    await loginViaUI(page, HANNAH.email, HANNAH.password);
    await openHub(page);
    await openEventRow(page, world.stops.a);
    const detail = page.getByTestId('event-detail');
    await detail.getByRole('button', { name: 'Edit / code' }).click();
    const form = page.getByTestId('event-form');
    await pickReasonCode(form.locator('#reasonCodeId'), world.reasons.feed);
    await form.locator('#scheduleClass').selectOption('unplanned');
    await expect(form.getByTestId('impacted-periods')).toBeVisible();
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form).toBeHidden();
    await expect(detail.getByLabel('Coding state: Coded')).toBeVisible();
    await backToList(page);
    await expect(row(page, world.stops.a).getByTestId('event-reason')).toContainText('feed interruption');

    // DT10 bulk coding: select two stops → preview (nothing changes) → apply
    await row(page, world.stops.b).getByRole('checkbox').click();
    await row(page, stopC).getByRole('checkbox').click();
    await expect(page.getByTestId('selection-count')).toHaveText('2 selected');
    await page.getByRole('button', { name: 'Bulk code' }).click();
    const dialog = page.getByTestId('bulk-code-dialog');
    await pickReasonCode(dialog.locator('#bulk-reason-code'), world.reasons.motor);
    await dialog.locator('#bulk-oee').selectOption('availability');
    await dialog.locator('#bulk-why').fill(`P-ENG motor trips of the day ${world.suffix}`);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog.getByTestId('bulk-preview-count')).toHaveText('2');
    expect(await reasonOf(aisha.token, world.stops.b)).toBeNull(); // a preview changes nothing
    await dialog.getByRole('button', { name: 'Apply to 2' }).click();
    await expect(dialog.getByTestId('bulk-applied')).toHaveText('2 events coded.');
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(dialog).toBeHidden();
    for (const id of [world.stops.b, stopC]) expect(await reasonOf(aisha.token, id)).toBe(world.reasons.motor);
    expect(await reasonOf(aisha.token, world.stops.a)).toBe(world.reasons.feed);

    await page.reload();
    await openHub(page);
    await expect(row(page, world.stops.b).getByTestId('event-reason')).toContainText('motor trip');
    await expect(row(page, stopC).getByTestId('event-reason')).toContainText('motor trip');
    await page.screenshot({ path: test.info().outputPath('engineer-event-hub-coded.png'), fullPage: true });
  });

  test('J6 Samuel: PLA analytics loads the plant data, the ledger and trend filters are server queries, no writes on open', async ({ page }) => {
    await loginViaUI(page, SAMUEL.email, SAMUEL.password);
    const writes = trackWrites(page);
    await page.goto(scopeUrl('/pla-analytics', [world.unitId], window()));
    await expect(page.getByTestId('pla-analytics-v2')).toBeVisible({ timeout: 60_000 });
    const waterfall = page.getByTestId('waterfall');
    await expect(waterfall).toHaveAttribute('data-closes', 'true', { timeout: 60_000 });
    await expect(waterfall).toHaveAttribute('data-opening', '2160');
    await expect(waterfall).toHaveAttribute('data-closing', '1710');
    const capacity = page.waitForRequest((request) => request.url().includes('/v2/reports/scope-waterfall') && new URL(request.url()).searchParams.get('ledger') === 'capacity');
    await page.getByTestId('ledger-capacity').check();
    await capacity;
    await expect(waterfall).toHaveAttribute('data-ledger', 'capacity');
    await expect(waterfall).toHaveAttribute('data-closes', 'true');
    await page.getByTestId('tab-trends').click();
    const shiftTrend = page.waitForRequest((request) => request.url().includes('/v2/reports/reconciliation-trend') && new URL(request.url()).searchParams.get('groupBy') === 'shift');
    await page.getByTestId('trend-by').selectOption('shift');
    await shiftTrend;
    await expect(page.getByTestId('residual-bucket')).toHaveCount(3);
    await page.getByTestId('tab-losses').click();
    await expect(page.getByTestId('loss-tree')).toBeVisible();
    expect(writes).toEqual([]); // KPI03: reading analytics writes nothing
    await page.screenshot({ path: test.info().outputPath('engineer-pla-analytics.png') });
  });

  test('J6 Samuel: Downtime Analysis shows the coded day; the Pareto drills through to the events of a reason', async ({ page }) => {
    // the coded stops reach the report through a recalculation an engineer may request
    await command(aisha.token, '/v2/production-periods/recalculate', { unitIds: [world.unitId], ...window() });
    const query = `from=${encodeURIComponent(window().from)}&to=${encodeURIComponent(window().to)}&unitIds=${world.unitId}&groupBy=reasonLevel1`;
    await until('downtime report with both reasons', async () => {
      const report = await call<{ data: { groups: Array<{ key: string | null; value: string }> } }>(aisha.token, 'GET', `/v2/reports/downtime?${query}`);
      const motor = report.body.data?.groups.find((group) => group.key === world.reasons.motor);
      return motor?.value === '5400' ? true : null;
    });
    await loginViaUI(page, SAMUEL.email, SAMUEL.password);
    const params = new URLSearchParams({ ...window(), window: 'P-ENG day', units: world.unitId });
    await page.goto(`/downtime?${params.toString()}`);
    await expect(page.getByTestId('downtime-analysis')).toBeVisible({ timeout: 60_000 });
    await expect(tile(page, 'downtime_total')).toHaveAttribute('data-value', '9000', { timeout: 60_000 });
    await expect(tile(page, 'downtime_total').getByTestId('kpi-value')).toHaveText('2:30');
    await expect(tile(page, 'stop_count').getByTestId('kpi-value')).toHaveText('3');
    await expect(bar(page, world.reasons.motor)).toHaveAttribute('data-value', '5400');
    await expect(bar(page, world.reasons.feed)).toHaveAttribute('data-value', '3600');
    await bar(page, world.reasons.motor).click();
    const drill = page.getByTestId('drill-events');
    await expect(drill).toHaveAttribute('data-reason-id', world.reasons.motor);
    await expect(drill.getByTestId('event-row')).toHaveCount(2);
    await page.locator('#downtime-trend').selectOption('shift');
    await expect.poll(() => new URL(page.url()).searchParams.get('trend')).toBe('shift');
    await page.screenshot({ path: test.info().outputPath('engineer-downtime-drill.png') });
  });

  test('J6 Samuel: Reports on the approved shift; the export request is accepted (202) and the CSV downloads', async ({ page }) => {
    // setup: shift C accounted and submitted by an engineer, approved by the manager approver
    await submitManualLine(aisha.token, world.periods.c, world.reasons.feed, '150');
    await approvePeriod((await apiSession(SETUP_MANAGER)).token, world.periods.c);
    const shiftC = { from: new Date(world.dayStart + 16 * HOUR).toISOString(), to: new Date(world.dayStart + 24 * HOUR).toISOString() };
    await loginViaUI(page, SAMUEL.email, SAMUEL.password);
    await page.goto(scopeUrl('/reports', [world.unitId], shiftC, '&approved=1'));
    await expect(page.getByTestId('reports-v2')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('report-snapshot')).toHaveAttribute('data-unit-ids', world.unitId);
    await expect(page.getByTestId('report-snapshot')).toHaveAttribute('data-run-ids', /^[0-9a-f-]{36}$/);
    await page.getByTestId('report-tab-exports').click();
    await expect(page.getByTestId('export-period-summary-start')).toBeEnabled({ timeout: 30_000 });
    const accepted = page.waitForResponse((response) => response.url().endsWith('/v2/exports') && response.request().method() === 'POST');
    await page.getByTestId('export-period-summary-start').click();
    const response = await accepted;
    expect(response.status()).toBe(202);
    const { jobId } = (await response.json()) as { jobId: string };
    await expect(page.getByTestId('export-period-summary-job')).toHaveAttribute('data-state', 'completed', { timeout: 60_000 });
    const download = page.waitForEvent('download');
    await page.getByTestId('export-period-summary-download').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^traverse-forge-period_summary-.+\.csv$/);
    const csv = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8');
    expect(csv).toContain(world.periods.c);
    const job = await call<{ state: string }>((await apiSession(SAMUEL)).token, 'GET', `/v2/exports/${jobId}`);
    expect(job.body.state).toBe('completed');
  });
});
