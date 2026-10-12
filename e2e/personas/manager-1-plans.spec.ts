import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { api, itemsOf } from './support/manager-api';
import { fillPlantDateTime } from '../test-utils/planning-world';
import { addRateDraft, local, openPlanOfUnit, openPlanningTab, openProfile, previewPeriods, previewTargets, rateLine, rateRow } from './support/manager-planning';
import { asUser, MANAGERS, PREFIX, sessionOf, utcDate, type Session } from './support/manager-users';
import { seedPlanningUnit, type PlanningUnit } from './support/manager-world';

/**
 * Manager approver persona — journeys 1 and 2 on `/planning` (plan 3.4):
 * 1. plan lifecycle: Jonas (Manager) drafts a plan in the UI (a validation error first), previews and
 *    generates; Fatima (another Manager) approves it; the version is frozen (no edit in the UI, the API
 *    answers 409 VERSION_NOT_DRAFT); verified through GET /v2/production-plans (PLAN03 pattern).
 * 2. calendars and rates: Erik publishes a unit calendar (immutable afterwards) and adds a crew with a
 *    rotation; Erik drafts a profile and a planning rate, Laura approves both; an overlapping planning
 *    version is refused with 409 VERSION_OVERLAP and approved with "supersede", which closes version 1.
 * Data: units `P-MGR-PLAN …` / `P-MGR-CAL …`, product `P-MGR-product …`, plan `P-MGR-PLAN …` — kept.
 * J2c (rotation with days off) runs last so that a failure there never blocks J2b.
 */
const DAY = 86_400_000;

let jonas: Session;
let planUnit: PlanningUnit;
let calUnit: PlanningUnit;
let planId = '';
let planName = '';
let profileId = '';
let crewName = '';
const planDay = utcDate(5);
const dayStart = `${planDay}T06:00:00.000Z`;
const nextDay = new Date(Date.parse(dayStart) + DAY).toISOString();

test.describe.configure({ mode: 'serial', timeout: 180_000 });

async function findPlanId(token: string, unitId: string, name: string): Promise<string> {
  const list = await api<{ items: Array<{ id: string; name: string }> }>(token, 'GET', `/v2/production-plans?unitId=${unitId}&limit=50`);
  expect(list.status).toBe(200);
  return itemsOf(list.body).find((plan) => plan.name === name)?.id ?? '';
}

async function versionState(token: string, id: string): Promise<{ state: string; rowVersion: number; approvedBy: string | null }> {
  const version = await api<{ approvalState: string; rowVersion: number; approvedBy?: string | null }>(token, 'GET', `/v2/production-plans/${id}/versions/1`);
  expect(version.status).toBe(200);
  return { state: version.body.approvalState, rowVersion: version.body.rowVersion, approvedBy: version.body.approvedBy ?? null };
}

async function fillPlanForm(page: Page, to: string): Promise<void> {
  await page.fill('#planName', planName);
  await page.selectOption('#planUnit', { label: planUnit.unitName });
  await fillPlantDateTime(page, 'Window start', local(dayStart));
  await fillPlantDateTime(page, 'Window end (exclusive)', local(to));
  await page.fill('#headerTarget', '2160');
  await page.selectOption('#slice-0-product', { label: `${planUnit.productName} (${planUnit.productCode})` });
}

test.describe('Manager persona — plans, calendars and rates (/planning)', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000);
    jonas = await sessionOf(MANAGERS.jonas);
    planUnit = await seedPlanningUnit(jonas.token, jonas.tenantId, 'PLAN');
    calUnit = await seedPlanningUnit(jonas.token, jonas.tenantId, 'CAL', { bare: true });
    planName = `${PREFIX}PLAN ${planUnit.unitCode.slice(-8)}`;
    crewName = `${PREFIX}crew ${calUnit.unitCode.slice(-8)}`;
  });

  test('J1a Jonas drafts a plan: a window ending before it starts is refused, then preview 720/720/720 and generation', async ({ page }) => {
    if (test.info().retry) planName = `${planName}-r${test.info().retry}`; // a retried draft is a plan of its own
    await loginViaUI(page, MANAGERS.jonas.email, MANAGERS.jonas.password);
    await expect(page.locator('nav a[href="/planning"]')).toBeVisible();
    await openPlanningTab(page, 'plans');
    await page.selectOption('#planUnitFilter', { label: planUnit.unitName });
    await page.getByTestId('plan-new').click();
    await fillPlanForm(page, dayStart); // to == from: validation error, nothing saved
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-form')).toBeVisible();
    await expect(page.getByTestId('field-planTo')).toContainText('after');
    expect(await findPlanId(jonas.token, planUnit.unitId, planName)).toBe('');

    await fillPlantDateTime(page, 'Window end (exclusive)', local(nextDay));
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-detail')).toBeVisible();
    // 3 × 8 h at the approved planning rate of 90 t/h = 720 t per shift, Σ = header
    expect(await previewTargets(page)).toEqual(['720', '720', '720']);
    await expect(page.getByTestId('sum-badge')).toHaveAttribute('data-match', 'true');
    await expect(previewPeriods(page).first()).not.toHaveAttribute('data-excluded', 'true');
    await page.getByTestId('plan-generate').click();
    await expect(page.getByTestId('generation-status')).toHaveAttribute('data-state', 'completed', { timeout: 60_000 });
    await expect(page.getByTestId('periods-generated')).toContainText('Periods generated', { timeout: 15_000 });
    planId = await findPlanId(jonas.token, planUnit.unitId, planName);
    expect(planId).not.toBe('');
    expect((await versionState(jonas.token, planId)).state).not.toBe('approved');
    await page.screenshot({ path: test.info().outputPath('manager-plan-draft.png'), fullPage: true });
  });

  test('J1b Fatima approves: the version is frozen in the UI, the API refuses an edit (409 VERSION_NOT_DRAFT), state persists', async ({ page }) => {
    await loginViaUI(page, MANAGERS.fatima.email, MANAGERS.fatima.password);
    await openPlanOfUnit(page, planUnit.unitName, planName);
    await page.getByTestId('approve-plan-submit').click();
    await expect(page.getByTestId('frozen-version')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'approved');
    await expect(page.getByTestId('plan-edit')).toHaveCount(0);
    await expect(page.getByTestId('plan-new-version')).toBeVisible();
    await expect(page.locator('[data-testid="history-row"][data-version="1"]')).toHaveAttribute('data-state', 'approved');

    // the author's edit is refused by the server, the plan is unchanged
    const version = await versionState(jonas.token, planId);
    expect(version.state).toBe('approved');
    const edit = await api<{ code: string }>(jonas.token, 'PATCH', `/v2/production-plans/${planId}/versions/1`, { headerTarget: '2161' }, { 'If-Match': `"${version.rowVersion}"` });
    expect([edit.status, edit.body.code]).toEqual([409, 'VERSION_NOT_DRAFT']);
    const plan = await api<{ currentVersion: number | null; name: string }>(jonas.token, 'GET', `/v2/production-plans/${planId}`);
    expect([plan.status, plan.body.currentVersion, plan.body.name]).toEqual([200, 1, planName]);

    // persists after a reload
    await page.reload();
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'approved', { timeout: 60_000 });
    await openPlanOfUnit(page, planUnit.unitName, planName);
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'approved');
  });

  test('J2a Erik publishes a unit calendar (immutable afterwards) and adds a crew with a rotation', async ({ page }) => {
    await loginViaUI(page, MANAGERS.erik.email, MANAGERS.erik.password);
    await openPlanningTab(page, 'calendars');
    await page.selectOption('#calendarScope', { label: calUnit.unitName });
    await page.getByTestId('calendar-new').click();
    await page.fill('#calTimezone', 'UTC');
    await page.fill('#calDayStart', '07:00'); // a change enables "Save"; the effective date is still missing
    await page.getByTestId('calendar-save').click(); // no effective date: refused, nothing stored
    await expect(page.getByTestId('calendar-editor').locator('[role="alert"]').first()).toBeVisible();
    await page.fill('#calFrom', utcDate(-1));
    await page.getByTestId('calendar-save').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'draft');
    await page.getByTestId('calendar-publish').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'published', { timeout: 15_000 });
    await expect(page.getByTestId('calendar-immutable')).toBeVisible();
    await expect(page.locator('#calTimezone')).toBeDisabled();
    await expect(page.getByTestId('calendar-save')).toHaveCount(0);
    await expect(page.getByTestId('calendar-new-from')).toBeVisible();
    const versions = await api<{ items: Array<{ state: string }> }>(jonas.token, 'GET', `/v2/calendar-versions?unitId=${calUnit.unitId}&limit=20`);
    expect(itemsOf(versions.body).map((v) => v.state)).toEqual(['published']);

    await openPlanningTab(page, 'calendars');
    await page.fill('#crewName', crewName);
    await page.getByRole('button', { name: 'Add crew' }).click();
    await expect(page.locator('#crewSelect')).toHaveValue(/.+/, { timeout: 15_000 });
    await page.fill('#rotationCycle', 'A,A,B,B,C,C');
    await page.fill('#rotationAnchor', utcDate(0));
    await page.fill('#rotationFrom', utcDate(0));
    await page.getByRole('button', { name: 'Add rotation' }).click();
    await expect(page.getByTestId('rotation-row')).toHaveCount(1, { timeout: 60_000 }); // the server re-assigns future shift instances
    await expect(page.getByTestId('rotation-list').locator('tbody tr').first()).toContainText('A,A,B,B,C,C');
    const crews = await api<{ items: Array<{ name: string }> }>(jonas.token, 'GET', '/v2/crews?limit=200');
    expect(crews.status).toBe(200);
    expect(itemsOf(crews.body).map((crew) => crew.name)).toContain(crewName);

  });

  test('J2b Erik drafts a profile and rate, Laura approves; an overlapping version is a 409 shown; supersede closes it', async ({ browser }) => {
    const from = `${utcDate(-10)}T00:00:00Z`;
    const erik = await asUser(browser, MANAGERS.erik);
    await openPlanningTab(erik, 'profiles');
    await erik.getByTestId('profile-new').click();
    await erik.selectOption('#unitId', calUnit.unitId);
    await erik.fill('#quantityUom', 't');
    await erik.selectOption('#rateTimebase', 'h');
    await fillPlantDateTime(erik, 'Effective from', local(from));
    await erik.getByTestId('profile-save').click(); // no product: validation error shown, nothing stored
    await expect(erik.getByTestId('field-error-productId')).toBeVisible();
    await erik.selectOption('#productId', calUnit.productId);
    await erik.getByTestId('profile-save').click();
    await expect(erik.getByTestId('profile-editor')).toBeHidden({ timeout: 20_000 });
    const profiles = await api<{ items: Array<{ id: string; state: string }> }>(jonas.token, 'GET', `/v2/profiles?unitId=${calUnit.unitId}&limit=20`);
    expect(itemsOf(profiles.body)).toHaveLength(1);
    profileId = itemsOf(profiles.body)[0].id;
    expect(itemsOf(profiles.body)[0].state).toBe('draft');
    await openProfile(erik, calUnit.unitName, profileId);
    await addRateDraft(erik, 'planning', '50', from);
    await expect(rateRow(erik, 'planning', 1)).toHaveAttribute('data-state', 'draft');

    const laura = await asUser(browser, MANAGERS.laura);
    await openProfile(laura, calUnit.unitName, profileId);
    await laura.getByTestId('profile-actions').getByTestId('approve-version').click();
    await expect(laura.getByTestId('profile-actions').getByTestId('approve-version')).toHaveCount(0, { timeout: 20_000 });
    await rateRow(laura, 'planning', 1).getByTestId('approve-version').click();
    await expect(rateRow(laura, 'planning', 1)).toHaveAttribute('data-state', 'approved', { timeout: 20_000 });

    // a second open-ended planning version 30 days later overlaps version 1
    await openProfile(erik, calUnit.unitName, profileId);
    await addRateDraft(erik, 'planning', '55', new Date(Date.parse(dayStart) + 30 * DAY).toISOString());
    await expect(rateRow(erik, 'planning', 2)).toHaveAttribute('data-state', 'draft');
    await openProfile(laura, calUnit.unitName, profileId);
    const draft = rateRow(laura, 'planning', 2);
    await draft.getByTestId('approve-version').click();
    await expect(draft.getByTestId('refusal')).toHaveAttribute('data-code', 'VERSION_OVERLAP', { timeout: 20_000 });
    await expect(draft.getByTestId('refusal').getByTestId('refusal-conflict')).toContainText('Version 1');
    await draft.getByTestId('supersede').click();
    await draft.getByTestId('approve-version').click();
    await expect(draft).toHaveAttribute('data-state', 'approved', { timeout: 20_000 });
    await expect(rateRow(laura, 'planning', 1)).toHaveAttribute('data-state', 'approved');
    await expect(rateLine(laura, 'planning', 1)).not.toContainText('open-ended');
    const rates = await api<{ items: Array<{ version: number; state: string; effectiveTo: string | null }> }>(jonas.token, 'GET', `/v2/profiles/${profileId}/rates?limit=20`);
    const planning = itemsOf(rates.body).filter((rate) => rate.state === 'approved');
    expect(planning.map((rate) => rate.version).sort()).toEqual([1, 2]);
    expect(planning.find((rate) => rate.version === 1)?.effectiveTo).not.toBeNull();
    await erik.context().close();
    await laura.context().close();
  });

  test('J2c a crew rotation with days off ("-" = off, as the field says) can be saved', async ({ page }) => {
    await loginViaUI(page, MANAGERS.erik.email, MANAGERS.erik.password);
    await openPlanningTab(page, 'calendars');
    await page.selectOption('#calendarScope', { label: calUnit.unitName });
    await page.selectOption('#crewSelect', { label: crewName });
    await expect(page.getByTestId('rotation-row')).toHaveCount(1, { timeout: 20_000 });
    await page.fill('#rotationCycle', 'A,A,B,B,C,C,-,-');
    await page.fill('#rotationAnchor', utcDate(30));
    await page.fill('#rotationFrom', utcDate(30));
    await page.getByRole('button', { name: 'Add rotation' }).click();
    // POST /v2/crew-rotations accepts `cycle: Array<string | null>` (null = day off, what the screen sends for "-")
    await expect(page.getByTestId('rotation-row')).toHaveCount(2, { timeout: 60_000 });
  });
});
