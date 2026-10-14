import { test, expect, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';
import { seedRcaWorld, waitForRecommendation, type RcaWorld } from './test-utils/rca-world';
import { acceptInvestigation, finishActions, moveCase, prepareInvestigation } from './personas/support/rca-workflow';

/**
 * Plan 3.9 journey on `/events` and `/rca` (flag `v2.rca`, switched on for the demo tenant by the manager
 * and left on):
 * - RCA01: a running unplanned stop past 60 min shows one provisional recommendation badge in the event
 *   detail (recommend-only, D13); no case is opened automatically.
 * - §16.2 / RCA02: "Create / link RCA" with the evidence preview creates a case and links the event; a
 *   repeated link is idempotent (200); the case shows the link with its evidence package.
 * - Step 1 (the verified save bug): the case form saves nested recommendations / evidence / logic tree
 *   and they survive a reload.
 * - RCA03: an action with a server-counted baseline and a past verification window is verified; the outcome
 *   shows approved, claimed and realized separately; closing completes the event's RCA state.
 * - §13.2: a production engineer cannot open cases (403).
 * Users: manager@acme.com, engineer@acme.com. Data: unit "E2E RCA …", its stop, case "E2E RCA case …".
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const ENGINEER = { email: 'engineer@acme.com', password: 'demo123' };
/** a second approver, independent of the manager's investigation (SME CA1) */
const APPROVER = { email: 'admin@acme.com', password: 'demo123' };
const FLAG = 'v2.rca';
/** the journey starts in the v2 Event Hub; its flag is restored to what it was after the run */
const HUB_FLAG = 'v2.eventHub';
let hubWasOn = true;

let manager = '';
let world: RcaWorld;
let caseId = '';

test.describe.configure({ mode: 'serial', timeout: 240_000 });

async function openStop(page: Page): Promise<void> {
  await page.goto('/events');
  await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('filter-units').click();
  await page.getByRole('checkbox', { name: world.unitName, exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator(`[data-testid="current-stop"][data-event-id="${world.stopId}"]`).getByRole('link', { name: 'Open' }).click();
  await expect(page.getByTestId('event-detail')).toBeVisible();
}

async function openCase(page: Page, tab?: string): Promise<void> {
  await page.goto(`/rca/${caseId}`);
  await expect(page.getByTestId('case-detail')).toBeVisible({ timeout: 60_000 });
  if (tab) await page.getByTestId(`tab-${tab}`).click();
}

test.describe('RCA integration — RCA01–03 (plan 3.9)', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    const user = session.user as { tenantId: string };
    expect((await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true })).status).toBe(200);
    const flags = await call<{ items: Array<{ key: string; enabled: boolean }> }>(manager, 'GET', '/v2/feature-flags');
    hubWasOn = flags.body.items.find((flag) => flag.key === HUB_FLAG)?.enabled === true;
    if (!hubWasOn) expect((await call(manager, 'PUT', `/v2/feature-flags/${HUB_FLAG}`, { enabled: true })).status).toBe(200);
    world = await seedRcaWorld(manager, user.tenantId);
  });

  test.afterAll(async () => {
    // decision for the owner's demo: the v2 RCA screen stays switched on for Demo Plant
    await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
    if (!hubWasOn) await call(manager, 'PUT', `/v2/feature-flags/${HUB_FLAG}`, { enabled: false });
  });

  test('RCA01 badge, create / link RCA with evidence preview, idempotent repeat', async ({ page }) => {
    const recommendation = await waitForRecommendation(manager, world.stopId);
    expect(recommendation).toMatchObject({ trigger: 'duration', provisional: true, state: 'open' });
    const cases = await call<{ items: unknown[] }>(manager, 'GET', `/v2/rcas?q=${encodeURIComponent(world.suffix)}`);
    expect(cases.body.items).toHaveLength(0); // recommend-only: nothing opened automatically

    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openStop(page);
    const panel = page.getByTestId('event-rca-panel');
    await expect(panel.getByTestId('rca-recommendations')).toContainText('Long unplanned stop · RCA policy v');
    await expect(panel.getByTestId('rca-recommendations')).toContainText('provisional');
    await panel.getByTestId('open-link-rca').click();
    await expect(page).toHaveURL(/\/rca\/new\?eventId=/);
    await expect(page.getByTestId('evidence-package')).toBeVisible({ timeout: 60_000 });
    await page.locator('#case-title').fill(`E2E RCA case ${world.suffix}`);
    await page.getByTestId('link-rca-submit').click();
    await expect(page.getByRole('heading', { name: `E2E RCA case ${world.suffix}`, level: 1 })).toBeVisible({ timeout: 60_000 });
    await openStop(page);
    await expect(page.getByTestId('event-rca-panel').getByTestId('rca-recommendations')).toHaveCount(0); // accepted by the link
    await page.screenshot({ path: test.info().outputPath('event-rca-linked.png'), fullPage: true });

    const found = await call<{ items: Array<{ id: string }> }>(manager, 'GET', `/v2/rcas?q=${encodeURIComponent(world.suffix)}`);
    caseId = found.body.items[0].id;
    const again = await command<{ created: boolean }>(manager, `/v2/production-events/${world.stopId}/rca-link`, { rcaId: caseId });
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
  });

  test('step 1: the case form saves nested content that survives a reload; links show the evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 }); // tablet (UX07)
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openCase(page);
    await page.locator('#edit-root-cause').fill('Coupling misalignment');
    await page.getByTestId('save-case').click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    await page.goto(`/rca/${caseId}/actions/recommendations/new`);
    await page.locator('#rec-title').fill('Realign the coupling');
    await page.getByTestId('save-recommendation').click();
    await expect(page.getByTestId('rec')).toContainText('Realign the coupling');
    await page.goto(`/rca/${caseId}/evidence/new`);
    await page.locator('#ev-title').fill('Vibration trend');
    await page.locator('#ev-source').fill('P101.VIB');
    await page.getByTestId('save-evidence').click();
    await expect(page.getByTestId('evidence-detail')).toContainText('P101.VIB');
    await page.goto(`/rca/${caseId}/analysis/logic-tree`);
    await page.getByTestId('add-root-node').click();
    await page.locator('#node-label').fill('Pump trips');
    await page.getByTestId('save-node').click();

    await openCase(page, 'actions');
    await expect(page.getByTestId('rec')).toContainText('Realign the coupling');
    await page.getByTestId('tab-evidence').click();
    await expect(page.getByTestId('evidence-list')).toContainText('Vibration trend');
    await page.goto(`/rca/${caseId}/analysis/logic-tree`);
    await expect(page.getByTestId('logic-tree')).toContainText('Pump trips');
    await page.getByTestId('tab-links').click();
    const link = page.locator(`[data-testid="link-row"][data-target-id="${world.stopId}"]`);
    await link.getByRole('button', { name: 'Evidence' }).click();
    await expect(link.getByTestId('evidence-package')).toContainText('Approved impact');
  });

  test('RCA03: action verified against its baseline; outcome keeps the three figures apart; independent closure completes the event', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openCase(page, 'actions');
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const form = page.getByTestId('action-form');
    await form.locator('#action-title').fill('Realign coupling');
    await form.locator('#action-window-start').fill(day(-20));
    await form.locator('#action-window-end').fill(day(-5));
    // CA3: the baseline is counted by the server from history; no value is typed
    await form.locator('#action-baseline').selectOption('recurrences');
    await form.locator('#action-claim').fill('1000');
    await form.locator('#action-claim-currency').selectOption('USD');
    await page.getByTestId('add-action').click();
    const action = page.getByTestId('action-row').first();
    await expect(action.getByTestId('verification-status')).toHaveText('Verification due');
    await action.getByTestId('verify-action').click();
    await expect(action.getByTestId('realized')).toBeVisible();
    await expect(action.getByTestId('verdict-badge')).toBeVisible();

    await page.getByTestId('tab-links').click(); // the outcome sits under "Links & outcome"
    await expect(page.getByTestId('outcome-claimed')).toContainText('1,000.00');
    await expect(page.getByTestId('outcome-realized')).toContainText('Realign coupling');
    await expect(page.getByTestId('outcome-panel')).toContainText('Approved historical loss');

    // RCA-01 / CA1: no status edit; the investigation is accepted, the action done by someone other
    // than its owner (the manager owns it: the approver marks it done), closure requested on screen and
    // approved by the independent approver
    const approver = (await authenticate(APPROVER.email, APPROVER.password)).accessToken;
    await prepareInvestigation(manager, caseId, 'Coupling misalignment');
    await finishActions(manager, approver, caseId);
    await acceptInvestigation(manager, caseId);
    await page.reload();
    await page.getByTestId('tab-overview').click();
    await page.locator('#workflow-residual-risk').fill('Alignment checked at every PM');
    await page.getByTestId('workflow-move-closure-review').click();
    await expect(page.getByTestId('case-status')).toHaveText('Closure Review');
    await expect(page.getByTestId('workflow-move-closed')).toHaveCount(0);
    const closed = await moveCase(approver, caseId, { to: 'Closed' });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const event = await call<{ states: { rca: string } }>(manager, 'GET', `/v2/production-events/${world.stopId}`);
    expect(event.body.states.rca).toBe('completed');
  });

  test('§13.2: a production engineer cannot open RCA cases', async () => {
    const engineer = (await authenticate(ENGINEER.email, ENGINEER.password)).accessToken;
    const refused = await command<{ code: string }>(engineer, '/v2/rcas', { title: `E2E RCA refused ${world.suffix}` });
    expect(refused.status).toBe(403);
  });
});
