import { test, expect, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call } from './test-utils/downtime-world';
import { plantLocal, seedPlanningWorld, type PlanningWorld } from './test-utils/planning-world';

/**
 * Plan 3.4 exit tests — PLAN03 preview and CAL preview on the v2 Plans, profiles & calendars screen
 * (flag `v2.plansProfilesCalendars` switched on for the demo tenant through the API; it stays on so the
 * owner can use the screens). Data: new "E2E PLAN / CAL …" units and an "E2E PLAN …" product seeded
 * through the API (planning-world.ts); the plan day is five days ahead.
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const FLAG = 'v2.plansProfilesCalendars';
const DST_DAY = '2026-10-24'; // Europe/Berlin falls back on 25 Oct 2026 03:00: the night shift of the 24th lasts 9 h

let manager = '';
let world: PlanningWorld;
let timezone = 'UTC';

test.describe.configure({ mode: 'serial' });

async function openTab(page: Page, tab: 'plans' | 'profiles' | 'calendars'): Promise<void> {
  await page.goto(`/planning?tab=${tab}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(`${tab}-tab`)).toBeVisible({ timeout: 60_000 });
  const header = (await page.getByTestId('scope-header').textContent()) ?? '';
  timezone = /([A-Za-z_]+\/[A-Za-z_]+|UTC) \(/.exec(header)?.[1] ?? 'UTC';
}

const local = (utc: string) => plantLocal(utc, timezone);
const periods = (page: Page) => page.getByTestId('period-preview').getByTestId('preview-period');

async function previewTargets(page: Page): Promise<string[]> {
  await page.getByTestId('plan-preview').click();
  await expect(periods(page)).toHaveCount(3);
  return periods(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-target') ?? ''));
}

async function openPlan(page: Page): Promise<void> {
  await openTab(page, 'plans');
  await page.selectOption('#planUnitFilter', { label: world.planUnitName });
  await page.getByTestId('plan-row').first().click();
  await expect(page.getByTestId('plan-detail')).toBeVisible();
}

async function editWindow(page: Page, from: string, to: string): Promise<void> {
  await page.getByTestId('plan-edit').click();
  await page.fill('#planFrom', local(from));
  await page.fill('#planTo', local(to));
  await page.getByTestId('plan-save').click();
  await expect(page.getByTestId('plan-form')).toBeHidden();
}

test.describe('Plans, profiles & calendars — PLAN03 / CAL preview (plan 3.4)', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    const flag = await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
    expect(flag.status).toBe(200);
    world = await seedPlanningWorld(manager, (session.user as { tenantId: string }).tenantId);
  });

  test.afterAll(async () => {
    // decision for the owner's demo: the screens stay switched on for Demo Plant
    await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
  });

  test('CAL: a fall-back day previews 25 h with a DST warning row; publish makes the version immutable', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 }); // tablet (UX07)
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openTab(page, 'calendars');
    await expect(page.locator('nav a[href="/planning"]')).toBeVisible();
    await expect(page.getByTestId('decision-banner')).toHaveAttribute('data-decision', 'D03');
    await page.selectOption('#calendarScope', { label: world.calUnitName });
    await page.getByTestId('calendar-new').click();
    await page.fill('#calTimezone', 'Europe/Berlin');
    await page.fill('#calFrom', '2026-10-01');
    await page.getByTestId('calendar-preview-run').click();
    await page.selectOption('#previewUnit', { label: world.calUnitName });
    await page.fill('#previewFrom', DST_DAY);
    await page.fill('#previewTo', DST_DAY);
    await page.getByTestId('calendar-preview-submit').click();
    await expect(page.getByTestId('preview-scheduled')).toHaveAttribute('data-seconds', '90000');
    await expect(page.getByTestId('preview-scheduled')).toContainText('25 h');
    await expect(page.getByTestId('dst-warning')).toHaveAttribute('data-code', 'dst_repeat');
    const dstRow = page.locator('[data-testid="preview-instance"][data-dst="true"]');
    await expect(dstRow).toHaveCount(1);
    await expect(dstRow).toHaveAttribute('data-duration', '32400');
    await expect(dstRow).toContainText('+02:00 → +01:00');

    await page.getByTestId('calendar-save').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'draft');
    await page.getByTestId('calendar-publish').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'published', { timeout: 15_000 });
    await expect(page.getByTestId('calendar-immutable')).toBeVisible();
    await expect(page.locator('#calTimezone')).toBeDisabled();
    await expect(page.getByTestId('calendar-save')).toHaveCount(0);
    await expect(page.getByTestId('calendar-new-from')).toBeVisible();
  });

  test('rates: an overlapping sustained version is refused with the conflicting version; supersede closes it', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openTab(page, 'profiles');
    await expect(page.getByTestId('decision-banner')).toHaveAttribute('data-decision', 'D08');
    await page.selectOption('#profileUnitFilter', { label: world.planUnitName });
    await page.locator(`[data-testid="profile-row"][data-profile-id="${world.profileId}"]`).click();
    await expect(page.getByTestId('rate-row')).toHaveCount(2);
    await page.getByTestId('rate-add').click();
    await page.selectOption('#rateKind', 'sustained');
    await page.fill('#rate', '70');
    const from = new Date(Date.parse(`${world.planDay}T00:00:00Z`) + 30 * 86_400_000).toISOString();
    await page.fill('#rateEffectiveFrom', local(from));
    await page.getByTestId('rate-save').click();
    const draft = page.locator('[data-testid="rate-row"][data-kind="sustained"][data-version="2"]');
    await expect(draft).toHaveAttribute('data-state', 'draft');
    await draft.getByTestId('approve-version').click();
    const refusal = draft.getByTestId('refusal');
    await expect(refusal).toHaveAttribute('data-code', 'VERSION_OVERLAP');
    await expect(refusal.getByTestId('refusal-conflict')).toContainText('Version 1');
    await draft.getByTestId('supersede').click();
    await draft.getByTestId('approve-version').click();
    await expect(draft).toHaveAttribute('data-state', 'approved');
    const first = page.locator('[data-testid="rate-row"][data-kind="sustained"][data-version="1"]');
    await expect(first).toHaveAttribute('data-state', 'approved');
    await expect(first).not.toContainText('open');
  });

  test('roles: an engineer asking to retire an approved rate sees the server refusal (403 FORBIDDEN_ROLE)', async ({ page }) => {
    await loginViaUI(page, 'engineer@acme.com', 'demo123');
    await openTab(page, 'profiles');
    await page.selectOption('#profileUnitFilter', { label: world.planUnitName });
    await page.locator(`[data-testid="profile-row"][data-profile-id="${world.profileId}"]`).click();
    const row = page.locator('[data-testid="rate-row"][data-kind="planning"][data-version="1"]');
    await row.getByRole('button', { name: 'Retire' }).click();
    await expect(row.getByTestId('refusal')).toHaveAttribute('data-kind', 'role');
    await expect(row.getByTestId('refusal')).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');
    await expect(row).toHaveAttribute('data-state', 'approved');
  });

  test('PLAN03: preview 300/300/400 with Σ = header; an excluded shift redistributes; no eligible time is a 422; approval freezes', async ({ page }) => {
    test.setTimeout(180_000);
    const dayStart = `${world.planDay}T06:00:00.000Z`;
    const nextDay = new Date(Date.parse(dayStart) + 86_400_000).toISOString();
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openTab(page, 'plans');
    await page.selectOption('#planUnitFilter', { label: world.planUnitName });
    await page.getByTestId('plan-new').click();
    await page.fill('#planName', `E2E PLAN ${world.suffix}`);
    await page.selectOption('#planUnit', { label: world.planUnitName });
    await page.fill('#planFrom', local(dayStart));
    await page.fill('#planTo', local(nextDay));
    await page.fill('#headerTarget', '1000');
    await page.selectOption('#slice-0-product', { label: `${world.productName} (E2E-PP-${world.suffix})` });
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-detail')).toBeVisible();
    expect(await previewTargets(page)).toEqual(['300', '300', '400']);
    await expect(page.getByTestId('sum-badge')).toHaveAttribute('data-match', 'true');
    await test.info().attach('plan-preview.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // exclude shift B through a new calendar version (published versions are immutable)
    await openTab(page, 'calendars');
    await page.selectOption('#calendarScope', { label: world.planUnitName });
    await page.locator('[data-testid="calendar-version-row"][data-version="1"]').click();
    await page.getByTestId('calendar-new-from').click();
    await page.fill('#calFrom', world.planDay);
    await page.getByRole('button', { name: 'Add exclusion' }).click();
    await page.getByLabel('Start of exclusion 1').fill(`${world.planDay}T12:00`);
    await page.getByLabel('End of exclusion 1').fill(`${world.planDay}T18:00`);
    await page.getByLabel('Reason of exclusion 1').fill('E2E no demand');
    await page.selectOption('#exclusion-0-kind', 'no_demand');
    await page.getByTestId('calendar-save').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'draft');
    await page.getByTestId('calendar-publish').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'published', { timeout: 15_000 });

    await openPlan(page);
    expect(await previewTargets(page)).toEqual(['428.57142857', '0', '571.42857143']);
    await expect(periods(page).nth(1)).toHaveAttribute('data-excluded', 'true');
    await expect(page.getByTestId('sum-badge')).toHaveAttribute('data-match', 'true');

    // only the excluded shift in the window: the server refuses a positive target without eligible time
    await editWindow(page, `${world.planDay}T12:00:00.000Z`, `${world.planDay}T18:00:00.000Z`);
    await page.getByTestId('plan-preview').click();
    await expect(page.getByTestId('open-version-actions').getByTestId('refusal').first()).toHaveAttribute('data-code', 'NO_ELIGIBLE_TIME');

    await editWindow(page, dayStart, nextDay);
    await page.getByTestId('plan-generate').click();
    await expect(page.getByTestId('generation-status')).toHaveAttribute('data-state', 'completed', { timeout: 60_000 });
    await expect(page.getByTestId('periods-generated')).toContainText('Periods generated', { timeout: 15_000 });
    await page.getByTestId('approve-plan-submit').click();
    await expect(page.getByTestId('frozen-version')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'approved');
    await expect(page.getByTestId('plan-edit')).toHaveCount(0);
    await expect(page.getByTestId('plan-new-version')).toBeVisible();
    await expect(page.locator('[data-testid="history-row"][data-version="1"]')).toHaveAttribute('data-state', 'approved');
  });
});
