import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { call } from '../test-utils/downtime-world';
import { plantLocal } from '../test-utils/planning-world';
import { AISHA, HANNAH, NOAH, SETUP_MANAGER, apiSession } from './support/engineer-users';
import { seedEngineerWorld, type EngineerWorld } from './support/engineer-world';

/**
 * Production engineer persona — journey 1 (PLAN03 draft plan on /planning) and the planning refusals
 * (journey 5): a production engineer creates and previews a v2 production plan and saves it as a draft,
 * sees the server refuse an approval (403 FORBIDDEN_ROLE), and cannot retire an approved rate.
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

  test('J1 Noah: validation errors, draft plan saved with a 300/300/400 preview, approval refused with 403, plan persists after reload', async ({ page }) => {
    const planName = `P-ENG PLAN ${world.suffix}`;
    const dayStart = `${world.planDay}T06:00:00.000Z`;
    const nextDay = new Date(Date.parse(dayStart) + DAY).toISOString();
    await loginViaUI(page, NOAH.email, NOAH.password);
    await expect(page.locator('nav a[href="/planning"]')).toBeVisible();
    await openTab(page, 'plans');
    await page.selectOption('#planUnitFilter', { label: world.unitName });
    await page.getByTestId('plan-new').click();
    await page.fill('#planName', planName);
    await page.selectOption('#planUnit', { label: world.unitName });

    // validation: an empty window and no header target are refused before anything reaches the server
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('field-error-planFrom')).toHaveText('validFrom is required');
    await expect(page.getByTestId('field-error-headerTarget')).toContainText('needs a header target');
    await page.fill('#planFrom', local(nextDay));
    await page.fill('#planTo', local(dayStart));
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('field-error-planTo')).toHaveText('validTo must be after validFrom');
    expect(await findPlan((await apiSession(NOAH)).token, planName)).toBeNull();

    await page.fill('#planFrom', local(dayStart));
    await page.fill('#planTo', local(nextDay));
    await page.fill('#headerTarget', '1000');
    await page.selectOption('#slice-0-product', { label: `${world.productName} (${world.productCode})` });
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-detail')).toBeVisible();
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'draft');
    expect(await previewTargets(page)).toEqual(['300', '300', '400']);
    await expect(page.getByTestId('sum-badge')).toHaveAttribute('data-match', 'true');
    await page.screenshot({ path: test.info().outputPath('engineer-plan-preview.png'), fullPage: true });

    // an engineer may prepare but not approve: the server's refusal is shown as given
    await page.getByTestId('approve-plan-submit').click();
    const refusal = page.getByTestId('approve-plan').getByTestId('refusal');
    await expect(refusal).toHaveAttribute('data-kind', 'role');
    await expect(refusal).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'draft');

    const noah = await apiSession(NOAH);
    const stored = await findPlan(noah.token, planName);
    expect(stored).not.toBeNull();
    expect(stored?.version).toMatchObject({ unitId: world.unitId, approvalState: 'draft', headerTarget: '1000' });

    await page.reload();
    await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
    await page.selectOption('#planUnitFilter', { label: world.unitName });
    const row = page.getByTestId('plan-row').filter({ hasText: planName });
    await expect(row).toHaveCount(1);
    await row.click();
    await expect(page.getByTestId('plan-detail')).toContainText(planName);
    await expect(page.getByTestId('plan-edit')).toBeVisible(); // a draft stays editable by the engineer
  });

  test('refusal Hannah: retiring an approved planning rate is refused with 403 FORBIDDEN_ROLE and the rate stays approved', async ({ page }) => {
    await loginViaUI(page, HANNAH.email, HANNAH.password);
    await openTab(page, 'profiles');
    await page.selectOption('#profileUnitFilter', { label: world.unitName });
    await page.locator(`[data-testid="profile-row"][data-profile-id="${world.profileId}"]`).click();
    const row = page.locator('[data-testid="rate-row"][data-kind="planning"][data-version="1"]');
    await expect(row).toHaveAttribute('data-state', 'approved');
    await row.getByRole('button', { name: 'Retire' }).click();
    await expect(row.getByTestId('refusal')).toHaveAttribute('data-kind', 'role');
    await expect(row.getByTestId('refusal')).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');
    await expect(row).toHaveAttribute('data-state', 'approved');
    const rates = await call<{ items: Array<{ rateKind: string; state: string }> }>((await apiSession(HANNAH)).token, 'GET', `/v2/profiles/${world.profileId}/rates`);
    expect(rates.body.items.find((rate) => rate.rateKind === 'planning')?.state).toBe('approved');
  });
});
