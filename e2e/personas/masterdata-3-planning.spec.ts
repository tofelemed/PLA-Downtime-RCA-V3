import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { fillPlantDateTime, plantLocal } from '../test-utils/planning-world';
import { api, itemsOf, ok, post } from './support/manager-api';
import { expectHidden, expectRefused } from './support/hidden-controls';
import { JONAS, MDA, PREFIX, mdaProduct, mdaUnit, sessionOf, shortId, utcDate, type Session } from './support/masterdata-world';

/**
 * Master data admin persona — journey 4 on `/planning` (profiles and calendars):
 * Felix (CALENDAR_WRITERS, PROFILE_WRITERS) drafts and publishes a unit calendar (the server allows a
 * master_data_admin to publish: calendar-roles.ts), adds a crew with a rotation that includes days off
 * (`-`), drafts a profile (missing product → validation error) with planning and sustained rates; his
 * approve controls are not offered and the server refuses them (403 FORBIDDEN_ROLE); Jonas (manager) approves through the API as setup, and
 * Felix sees the approved versions after a reload. Data: unit `P-MDA-CAL …`, product, calendar, crew
 * `P-MDA-crew …`, profile and rates — kept.
 */
let felix: Session;
let jonas: Session;
let unit: { unitId: string; unitName: string; unitCode: string };
let product: { productId: string; productName: string };
let profileId = '';
let timezone = 'UTC';
const suffix = shortId();
const crewName = `${PREFIX}crew ${suffix}`;
const from = `${utcDate(-10)}T00:00:00Z`;

test.describe.configure({ mode: 'serial', timeout: 240_000 });

async function openTab(page: Page, tab: 'profiles' | 'calendars'): Promise<void> {
  await page.goto(`/planning?tab=${tab}`);
  await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(`${tab}-tab`)).toBeVisible({ timeout: 60_000 });
  const header = (await page.getByTestId('scope-header').textContent()) ?? '';
  timezone = /([A-Za-z_]+\/[A-Za-z_]+|UTC) \(/.exec(header)?.[1] ?? 'UTC';
}

const local = (utc: string) => plantLocal(utc, timezone);
const rateRow = (page: Page, kind: string, version: number) => page.locator(`[data-testid="rate-row"][data-kind="${kind}"][data-version="${version}"]`);

async function openProfile(page: Page): Promise<void> {
  await openTab(page, 'profiles');
  await page.selectOption('#profileUnitFilter', { label: unit.unitName });
  await page.locator(`[data-testid="profile-row"][data-profile-id="${profileId}"]`).click();
  await expect(page.getByTestId('profile-detail')).toHaveAttribute('data-profile-id', profileId);
}

async function addRateDraft(page: Page, kind: string, rate: string): Promise<void> {
  await page.getByTestId('rate-add').click();
  await page.selectOption('#rateKind', kind);
  await page.fill('#rate', rate);
  await fillPlantDateTime(page, 'Effective from', local(from));
  await page.getByTestId('rate-save').click();
}

interface Rotation {
  crewId: string;
  pattern: { anchorDate: string; cycle: Array<string | null> };
}

test.describe('Master data admin — calendars, crews, profiles and rates (/planning)', () => {
  test.beforeAll(async () => {
    felix = await sessionOf(MDA.felix);
    jonas = await sessionOf(JONAS);
    unit = await mdaUnit(felix.token, felix.tenantId, 'CAL', suffix);
    product = await mdaProduct(felix.token, felix.tenantId, 'CAL', suffix);
  });

  test('MDA-04a Felix: calendar draft (no date refused) → published; crew with a rotation including days off', async ({ page }) => {
    await loginViaUI(page, MDA.felix.email, MDA.felix.password);
    await expect(page.locator('nav a[href="/planning"]')).toBeVisible();
    await openTab(page, 'calendars');
    await page.selectOption('#calendarScope', { label: unit.unitName });
    await page.getByTestId('calendar-new').click();
    await page.fill('#calTimezone', 'UTC');
    await page.fill('#calDayStart', '07:00'); // a change enables "Save"; the effective date is still missing
    await page.getByTestId('calendar-save').click();
    await expect(page.getByTestId('calendar-editor').locator('[role="alert"]').first()).toBeVisible();
    expect(itemsOf((await api<{ items: unknown[] }>(felix.token, 'GET', `/v2/calendar-versions?unitId=${unit.unitId}&limit=20`)).body)).toHaveLength(0);
    await page.fill('#calFrom', utcDate(-1));
    await page.getByTestId('calendar-save').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });

    // CALENDAR_WRITERS (master_data_admin, manager_approver) may publish: the server accepts it
    await page.getByTestId('calendar-publish').click();
    await expect(page.getByTestId('calendar-editor')).toHaveAttribute('data-state', 'published', { timeout: 20_000 });
    await expect(page.getByTestId('calendar-immutable')).toBeVisible();
    await expect(page.locator('#calTimezone')).toBeDisabled();
    await expect(page.getByTestId('calendar-save')).toHaveCount(0);
    const versions = await api<{ items: Array<{ state: string; operationalDayStart: string }> }>(felix.token, 'GET', `/v2/calendar-versions?unitId=${unit.unitId}&limit=20`);
    expect(itemsOf(versions.body).map((v) => v.state)).toEqual(['published']);
    expect(itemsOf(versions.body)[0].operationalDayStart).toBe('07:00');

    // a crew and a rotation with two days off per cycle (the field documents "-" = off)
    await openTab(page, 'calendars');
    await page.fill('#crewName', crewName);
    await page.getByRole('button', { name: 'Add crew' }).click();
    await expect(page.locator('#crewSelect')).toHaveValue(/.+/, { timeout: 20_000 });
    await page.fill('#rotationCycle', 'A,A,B,B,C,C,-,-');
    await page.fill('#rotationAnchor', utcDate(0));
    await page.fill('#rotationFrom', utcDate(0));
    await page.getByRole('button', { name: 'Add rotation' }).click();
    await expect(page.getByTestId('crew-rotations').getByTestId('refusal')).toHaveCount(0);
    await expect(page.getByTestId('rotation-row')).toHaveCount(1, { timeout: 60_000 }); // the server re-assigns future shift instances
    await expect(page.getByTestId('rotation-list').locator('tbody tr').first()).toContainText('A,A,B,B,C,C,-,-');
    const crews = await api<{ items: Array<{ id: string; name: string }> }>(felix.token, 'GET', '/v2/crews?limit=200');
    expect(crews.status).toBe(200);
    const crew = itemsOf(crews.body).find((entry) => entry.name === crewName);
    expect(crew).toBeTruthy();
    const rotations = await api<{ items: Rotation[] }>(felix.token, 'GET', `/v2/crew-rotations?crewId=${crew?.id}&limit=20`);
    expect(rotations.status).toBe(200);
    expect(itemsOf(rotations.body).map((r) => r.pattern.cycle)).toEqual([['A', 'A', 'B', 'B', 'C', 'C', null, null]]);
    await page.screenshot({ path: test.info().outputPath('mda-04a-calendar-crew.png'), fullPage: true });
  });

  test('MDA-04b Felix: profile draft (no product refused) with rate drafts; his approvals are refused (403)', async ({ page }) => {
    await loginViaUI(page, MDA.felix.email, MDA.felix.password);
    await openTab(page, 'profiles');
    await page.getByTestId('profile-new').click();
    await page.selectOption('#unitId', unit.unitId);
    await page.fill('#quantityUom', 't');
    await page.selectOption('#rateTimebase', 'h');
    await fillPlantDateTime(page, 'Effective from', local(from));
    await page.getByTestId('profile-save').click(); // no product: validation error shown, nothing stored
    await expect(page.getByTestId('field-error-productId')).toBeVisible();
    expect(itemsOf((await api<{ items: unknown[] }>(felix.token, 'GET', `/v2/profiles?unitId=${unit.unitId}&limit=20`)).body)).toHaveLength(0);
    await page.selectOption('#productId', product.productId);
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('profile-editor')).toBeHidden({ timeout: 20_000 });
    const profiles = await api<{ items: Array<{ id: string; state: string }> }>(felix.token, 'GET', `/v2/profiles?unitId=${unit.unitId}&limit=20`);
    expect(itemsOf(profiles.body)).toHaveLength(1);
    profileId = itemsOf(profiles.body)[0].id;
    expect(itemsOf(profiles.body)[0].state).toBe('draft');

    await openProfile(page);
    // a profile writer is not a PROFILE_APPROVER: Approve is not offered, and the server refuses it (403)
    await expectHidden(page.getByTestId('profile-actions').getByTestId('approve-version'));
    expectRefused(await post(felix.token, `/v2/profiles/${profileId}/approve`, {}), 'FORBIDDEN_ROLE');
    await addRateDraft(page, 'planning', '90');
    await expect(rateRow(page, 'planning', 1)).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
    await addRateDraft(page, 'sustained', '100');
    await expect(rateRow(page, 'sustained', 1)).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
    await expectHidden(rateRow(page, 'planning', 1).getByTestId('approve-version'));
    await expect(rateRow(page, 'planning', 1)).toHaveAttribute('data-state', 'draft');
    await page.screenshot({ path: test.info().outputPath('mda-04b-approve-hidden.png'), fullPage: true });
    const rates = await api<{ items: Array<{ id: string; rateKind: string; state: string }> }>(felix.token, 'GET', `/v2/profiles/${profileId}/rates?limit=20`);
    const planning = itemsOf(rates.body).find((rate) => rate.rateKind === 'planning');
    expectRefused(await post(felix.token, `/v2/rates/${planning?.id}/approve`, {}), 'FORBIDDEN_ROLE');
    const after = await api<{ items: Array<{ rateKind: string; state: string }> }>(felix.token, 'GET', `/v2/profiles/${profileId}/rates?limit=20`);
    expect(itemsOf(after.body).map((rate) => [rate.rateKind, rate.state]).sort()).toEqual([['planning', 'draft'], ['sustained', 'draft']]);
  });

  test('MDA-04c Jonas approves (API setup); Felix sees the approved profile and rates after a reload', async ({ page }) => {
    await ok(post(jonas.token, `/v2/profiles/${profileId}/approve`, {}), 'approve profile');
    const rates = await api<{ items: Array<{ id: string; rateKind: string }> }>(jonas.token, 'GET', `/v2/profiles/${profileId}/rates?limit=20`);
    for (const rate of itemsOf(rates.body)) await ok(post(jonas.token, `/v2/rates/${rate.id}/approve`, {}), `approve ${rate.rateKind}`);

    await loginViaUI(page, MDA.felix.email, MDA.felix.password);
    await openProfile(page);
    await expect(page.getByTestId('profile-actions').getByTestId('approve-version')).toHaveCount(0);
    await expect(rateRow(page, 'planning', 1)).toHaveAttribute('data-state', 'approved');
    await expect(rateRow(page, 'sustained', 1)).toHaveAttribute('data-state', 'approved');
    const resolved = await api<{ items: Array<{ state: string }> }>(felix.token, 'GET', `/v2/profiles?unitId=${unit.unitId}&limit=20`);
    expect(itemsOf(resolved.body).map((p) => p.state)).toEqual(['approved']);
  });
});
