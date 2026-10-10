import { test, expect, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';
import { seedRcaWorld, waitForRecommendation, type RcaWorld } from './test-utils/rca-world';

/**
 * Plan 3.9 journey on `/events` and `/rca` (flag `v2.rca`, switched on for the demo tenant by the manager
 * and left on):
 * - RCA01: a running unplanned stop past 60 min shows one provisional recommendation badge in the event
 *   detail (recommend-only, D13); no case is opened automatically.
 * - §16.2 / RCA02: "Create / link RCA" with the evidence preview creates a case and links the event; a
 *   repeated link is idempotent (200); the case shows the link with its evidence package.
 * - Step 1 (the verified save bug): the case form saves nested recommendations / evidence / logic tree
 *   and they survive a reload.
 * - RCA03: an action with a declared baseline and a past verification window is verified; the outcome
 *   shows approved, claimed and realized separately; closing completes the event's RCA state.
 * - §13.2: a production engineer cannot open cases (403).
 * Users: manager@acme.com, engineer@acme.com. Data: unit "E2E RCA …", its stop, case "E2E RCA case …".
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const ENGINEER = { email: 'engineer@acme.com', password: 'demo123' };
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
  await page.getByRole('checkbox', { name: world.unitName }).click();
  await page.keyboard.press('Escape');
  await page.locator(`[data-testid="current-stop"][data-event-id="${world.stopId}"]`).getByRole('button', { name: 'Open' }).click();
  await expect(page.getByTestId('event-detail')).toBeVisible();
}

async function openCase(page: Page, tab?: string): Promise<void> {
  await page.goto(`/rca?case=${caseId}`);
  await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('case-title')).toBeVisible();
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
    const dialog = page.getByTestId('link-rca-dialog');
    await expect(dialog.getByTestId('evidence-package')).toBeVisible();
    await dialog.getByRole('tab', { name: 'New case' }).click();
    await dialog.locator('#new-case-title').fill(`E2E RCA case ${world.suffix}`);
    await dialog.getByTestId('link-rca-submit').click();
    await expect(panel.getByRole('status')).toContainText(`Linked to E2E RCA case ${world.suffix}`);
    await expect(panel.getByTestId('rca-recommendations')).toHaveCount(0); // accepted by the link
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
    const recs = page.getByTestId('rec');
    await recs.getByLabel('Recommendations title').fill('Realign the coupling');
    await recs.getByRole('button', { name: 'Add' }).click();
    const evidence = page.getByTestId('ev');
    await evidence.getByLabel('Evidence title').fill('Vibration trend');
    await evidence.getByLabel('Evidence Source (tag, document, photo)').fill('P101.VIB');
    await evidence.getByRole('button', { name: 'Add' }).click();
    await page.getByLabel('Logic tree node').fill('Pump trips');
    await page.getByRole('button', { name: 'Add node' }).click();
    await page.locator('#edit-root-cause').fill('Coupling misalignment');
    await page.getByTestId('save-case').click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

    await openCase(page);
    await expect(page.getByTestId('rec')).toContainText('Realign the coupling');
    await expect(page.getByTestId('ev')).toContainText('P101.VIB');
    await expect(page.getByTestId('logic-tree')).toContainText('Pump trips');
    await page.getByTestId('tab-links').click();
    const link = page.getByTestId('link-row').first();
    await expect(link).toContainText(world.stopId);
    await link.getByRole('button', { name: 'Evidence' }).click();
    await expect(link.getByTestId('evidence-package')).toContainText('Approved impact');
  });

  test('RCA03: action verified against its baseline; outcome keeps the three figures apart; close completes the event', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openCase(page, 'actions');
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const form = page.getByTestId('action-form');
    await form.locator('#action-title').fill('Realign coupling');
    await form.locator('#action-window-start').fill(day(-20));
    await form.locator('#action-window-end').fill(day(-5));
    await form.locator('#action-baseline').selectOption('recurrences');
    await form.locator('#action-baseline-value').fill('6');
    await form.locator('#action-claim').fill('1000');
    await form.locator('#action-claim-currency').selectOption('USD');
    await page.getByTestId('add-action').click();
    const action = page.getByTestId('action-row').first();
    await expect(action.getByTestId('verification-status')).toHaveText('Verification due');
    await action.getByTestId('verify-action').click();
    await expect(action.getByTestId('realized')).toContainText('difference 3');

    await page.getByTestId('tab-outcome').click();
    await expect(page.getByTestId('outcome-claimed')).toContainText('1,000.00');
    await expect(page.getByTestId('outcome-realized')).toContainText('Realign coupling: 3');
    await expect(page.getByTestId('outcome-panel')).toContainText('Approved historical loss');

    await page.getByRole('tab', { name: 'Analysis' }).click();
    // open the Radix select from the keyboard: a pointer-opened select can swallow an option click made
    // within the same gesture window, leaving the status unchanged (seen once in a repeated run)
    await page.locator('#edit-status').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: 'Closed' }).click();
    await expect(page.locator('#edit-status')).toHaveText('Closed');
    await page.getByTestId('save-case').click();
    await expect(page.getByTestId('case-status')).toHaveText('Closed');
    const event = await call<{ states: { rca: string } }>(manager, 'GET', `/v2/production-events/${world.stopId}`);
    expect(event.body.states.rca).toBe('completed');
  });

  test('§13.2: a production engineer cannot open RCA cases', async () => {
    const engineer = (await authenticate(ENGINEER.email, ENGINEER.password)).accessToken;
    const refused = await command<{ code: string }>(engineer, '/v2/rcas', { title: `E2E RCA refused ${world.suffix}` });
    expect(refused.status).toBe(403);
  });
});
