import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { call, command } from '../test-utils/downtime-world';
import { fillPlantDateTime, plantLocal } from '../test-utils/planning-world';
import { AISHA, HANNAH, NOAH, SETUP_MANAGER, apiSession } from './support/engineer-users';
import { seedEngineerWorld, type EngineerWorld } from './support/engineer-world';
import { expectHidden, expectRefused } from './support/hidden-controls';

/**
 * Production engineer persona — journey 1 (PLAN03 draft plan on /planning) and the planning refusals
 * (journey 5): a production engineer creates and previews a v2 production plan and saves it as a draft,
 * is not offered the approve control (the server still refuses it: 403 FORBIDDEN_ROLE), and is not
 * offered Retire on an approved rate (server: 403 FORBIDDEN_ROLE).
 * Data: unit "P-ENG PLAN …", product "P-ENG product …", approved profile and rates (setup manager);
 * plan "P-ENG PLAN …" created by the engineer in the UI. Nothing is deleted.
 */
const DAY = 86_400_000;

let world: EngineerWorld;
let timezone = 'UTC';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

async function openTab(page: Page, tab: 'plans' | 'profiles' | 'calendars'): Promise<void> {
  await page.goto(`/planning?tab=${tab}`);
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

interface PlanRow {
  id: string;
  name: string;
  version: { unitId: string; approvalState: string; headerTarget: string };
}

async function findPlan(token: string, name: string): Promise<PlanRow | null> {
  const list = await call<{ items: PlanRow[] }>(token, 'GET', `/v2/production-plans?limit=200&unitId=${world.unitId}`);
  expect(list.status).toBe(200);
  return list.body.items.find((item) => item.name === name) ?? null;
}

test.describe('Engineer — plans, profiles & calendars (journey 1 and planning refusals)', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    const setup = await apiSession(SETUP_MANAGER);
    const aisha = await apiSession(AISHA);
    world = await seedEngineerWorld(setup.token, aisha.token, aisha.tenantId, 'PLAN');
  });

  test('J1 Noah: validation errors, draft plan saved with a 300/300/400 preview, no approve control and the server refuses approval with 403, plan persists after reload', async ({ page }) => {
    const planName = `P-ENG PLAN ${world.suffix}`;
    const dayStart = `${world.planDay}T06:00:00.000Z`;
    const nextDay = new Date(Date.parse(dayStart) + DAY).toISOString();
    await loginViaUI(page, NOAH.email, NOAH.password);
    await expect(page.locator('nav a[href="/planning"]')).toBeVisible();
    await openTab(page, 'plans');
    await page.selectOption('#planUnitFilter', { label: world.unitName });
    await page.getByTestId('plan-new').click();
    await expect(page).toHaveURL(/\/planning\/plans\/new$/);
    await page.fill('#planName', planName);
    await page.selectOption('#planUnit', { label: world.unitName });

    // validation: an empty window and no header target are refused before anything reaches the server
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('field-planFrom')).toContainText('Enter the window start');
    await expect(page.getByTestId('field-error-headerTarget')).toContainText('needs a header target');
    await fillPlantDateTime(page, 'Window start', local(nextDay));
    await fillPlantDateTime(page, 'Window end (exclusive)', local(dayStart));
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('field-planTo')).toContainText('The window end must be after the start');
    expect(await findPlan((await apiSession(NOAH)).token, planName)).toBeNull();

    await fillPlantDateTime(page, 'Window start', local(dayStart));
    await fillPlantDateTime(page, 'Window end (exclusive)', local(nextDay));
    await page.fill('#headerTarget', '1000');
    await page.selectOption('#slice-0-product', { label: `${world.productName} (${world.productCode})` });
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-detail')).toBeVisible();
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'draft');
    expect(await previewTargets(page)).toEqual(['300', '300', '400']);
    await expect(page.getByTestId('sum-badge')).toHaveAttribute('data-match', 'true');
    await page.screenshot({ path: test.info().outputPath('engineer-plan-preview.png'), fullPage: true });

    // an engineer may prepare but not approve: the approve control is not offered, and the server still refuses
    await expectHidden(page.getByTestId('approve-plan-submit'));
    await expectHidden(page.getByTestId('approve-plan'));
    const noah = await apiSession(NOAH);
    const stored = await findPlan(noah.token, planName);
    expect(stored).not.toBeNull();
    const approve = await command(noah.token, `/v2/production-plans/${stored?.id}/approve`, { expectedVersion: 1 });
    expectRefused(approve, 'FORBIDDEN_ROLE');
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'draft');
    expect(stored?.version).toMatchObject({ unitId: world.unitId, approvalState: 'draft', headerTarget: '1000' });

    await openTab(page, 'plans');
    await page.selectOption('#planUnitFilter', { label: world.unitName });
    const row = page.getByTestId('plan-row').filter({ hasText: planName });
    await expect(row).toHaveCount(1);
    await row.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(planName);
    await expect(page.getByTestId('plan-detail')).toBeVisible();
    await expect(page.getByTestId('plan-edit')).toBeVisible(); // a draft stays editable by the engineer
  });

  test('refusal Hannah: Retire is not offered on an approved planning rate, the server refuses it with 403 FORBIDDEN_ROLE, the rate stays approved', async ({ page }) => {
    await loginViaUI(page, HANNAH.email, HANNAH.password);
    await openTab(page, 'profiles');
    await page.selectOption('#profileUnitFilter', { label: world.unitName });
    await page.locator(`[data-testid="profile-row"][data-profile-id="${world.profileId}"]`).click();
    const row = page.locator('[data-testid="rate-row"][data-kind="planning"][data-version="1"]');
    await expect(row).toHaveAttribute('data-state', 'approved');
    // Retire is a manager-approver control: not offered to an engineer, and the server still refuses it
    await expectHidden(row.getByRole('button', { name: 'Retire' }));
    const hannah = await apiSession(HANNAH);
    const rates = await call<{ items: Array<{ id: string; rateKind: string; state: string }> }>(hannah.token, 'GET', `/v2/profiles/${world.profileId}/rates`);
    const planning = rates.body.items.find((rate) => rate.rateKind === 'planning');
    expectRefused(await command(hannah.token, `/v2/rates/${planning?.id}/retire`, {}), 'FORBIDDEN_ROLE');
    await expect(row).toHaveAttribute('data-state', 'approved');
    const after = await call<{ items: Array<{ rateKind: string; state: string }> }>(hannah.token, 'GET', `/v2/profiles/${world.profileId}/rates`);
    expect(after.body.items.find((rate) => rate.rateKind === 'planning')?.state).toBe('approved');
  });
});
