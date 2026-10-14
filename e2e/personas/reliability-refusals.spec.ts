import { test, expect } from '@playwright/test';
import { expectHidden, expectRefused } from './support/hidden-controls';
import { apiLogin, call, command, day, DEMO_PLANT, newSuffix, openCase, PREFIX, REL_USERS, uiLogin, type RelSession } from './support/reliability-world';

/**
 * RELIABILITY ENGINEER persona — journey 6 (refusals) plus the validation and persistence checks the
 * brief asks for. A reliability engineer (legacy Engineer + `reliability_engineer`) may open RCA cases
 * but is neither `manager_approver` nor `master_data_admin`: approving plans / periods, switching
 * feature flags and authoring codes are refused with 403 FORBIDDEN_ROLE; where a screen exists (Codes &
 * Rules) the write control is not offered at all. Users: Sebastian (refusals), Leila (validation + persistence).
 */
const suffix = newSuffix();
let sebastian: RelSession;

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('Reliability engineer — refusals, validation, persistence', () => {
  test.beforeAll(async () => {
    sebastian = await apiLogin(REL_USERS.sebastian);
    expect(sebastian.tenantId).toBe(DEMO_PLANT);
  });

  test('R1 (sebastian): Codes & Rules shows the codes without New code, and the server refuses a create with 403', async ({ page }) => {
    await uiLogin(page, REL_USERS.sebastian);
    await page.goto('/codes-admin');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('code-row').first()).toBeVisible({ timeout: 30_000 }); // reads are allowed
    await expectHidden(page.getByTestId('code-new'));
    await page.screenshot({ path: test.info().outputPath('r1-codes-read-only.png'), fullPage: true });
    expectRefused(await command(sebastian.token, '/v2/reason-codes', { code: `${PREFIX}CODE-${suffix}`, name: `${PREFIX}reliability engineer attempt` }), 'FORBIDDEN_ROLE');
    const codes = await call<{ items: Array<{ code: string }> }>(sebastian.token, 'GET', '/v2/reason-codes?limit=500');
    expect(codes.status).toBe(200);
    expect(codes.body.items.map((item) => item.code)).not.toContain(`${PREFIX}CODE-${suffix}`);
  });

  test('R2 (sebastian): approving a plan or a period, editing a code and switching a feature flag answer 403 FORBIDDEN_ROLE', async () => {
    const plans = await call<{ items: Array<{ id: string }> }>(sebastian.token, 'GET', '/v2/production-plans?limit=1');
    expect(plans.status).toBe(200);
    expect(plans.body.items.length, 'Demo Plant has at least one plan to try approving').toBeGreaterThan(0);
    const plan = await command<{ code: string }>(sebastian.token, `/v2/production-plans/${plans.body.items[0].id}/approve`, {});
    expect(plan.status).toBe(403);
    expect(plan.body.code).toBe('FORBIDDEN_ROLE');

    const periods = await call<{ items: Array<{ id: string }> }>(sebastian.token, 'GET', '/v2/production-periods?limit=1');
    expect(periods.status).toBe(200);
    expect(periods.body.items.length).toBeGreaterThan(0);
    const period = await command<{ code: string }>(sebastian.token, `/v2/production-periods/${periods.body.items[0].id}/approve`, {});
    expect(period.status).toBe(403);
    expect(period.body.code).toBe('FORBIDDEN_ROLE');

    const code = await command<{ code: string }>(sebastian.token, '/v2/reason-codes', { code: `${PREFIX}API-${suffix}`, name: 'refused' });
    expect(code.status).toBe(403);
    expect(code.body.code).toBe('FORBIDDEN_ROLE');

    // the flag is already on; a refused PUT of the same value can never switch anything off
    const flag = await call<{ code: string }>(sebastian.token, 'PUT', '/v2/feature-flags/v2.rca', { enabled: true });
    expect(flag.status).toBe(403);
    expect(flag.body.code).toBe('FORBIDDEN_ROLE');
    const flags = await call<{ items: Array<{ key: string; enabled: boolean }> }>(sebastian.token, 'GET', '/v2/feature-flags');
    expect(flags.body.items.find((item) => item.key === 'v2.rca')?.enabled).toBe(true);
  });

  test('R3 (sebastian): the Engineer menu offers no feature-flag, master-data or user-management screen', async ({ page }) => {
    await uiLogin(page, REL_USERS.sebastian);
    const nav = page.locator('nav').first();
    // collapsed, the sidebar's icon-only links carry no accessible name (UX observation); expand it first
    await nav.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(nav.getByRole('link', { name: 'RCA Analysis' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Knowledge Base' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Event Hub' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Master Data|User Management|Admin Panel|Settings/ })).toHaveCount(0);
  });

  test('V1 (leila): a new case needs a title; an action whose verification window ends before it starts is refused with the field error', async ({ page }) => {
    await uiLogin(page, REL_USERS.leila);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('new-case').click();
    // a new case is its own page (/rca/new)
    const fields = page.getByTestId('new-case-fields');
    const create = page.getByTestId('create-case');
    await expect(create).toBeDisabled();
    await fields.locator('#case-title').fill(`${PREFIX}validation-${suffix}`);
    await fields.locator('#case-description').fill('Case opened to exercise the validation errors of the action form');
    await create.click();
    await expect(page.getByRole('heading', { name: `${PREFIX}validation-${suffix}`, level: 1 })).toBeVisible({ timeout: 30_000 }); // the case title is the page heading
    await expect(page.getByTestId('case-status')).toHaveText('Draft');

    await page.getByTestId('tab-actions').click();
    const form = page.getByTestId('action-form');
    await form.locator('#action-title').fill(`${PREFIX}bad-window-${suffix}`);
    await form.locator('#action-window-start').fill(day(-5));
    await form.locator('#action-window-end').fill(day(-20));
    await page.getByTestId('add-action').click();
    const error = page.getByTestId('rca-refusal');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/verification ?window/i);
    await page.screenshot({ path: test.info().outputPath('v1-action-validation.png'), fullPage: true });

    await form.locator('#action-claim').fill('500');
    await form.locator('#action-window-end').fill('');
    await form.locator('#action-window-start').fill('');
    await page.getByTestId('add-action').click();
    await expect(page.getByTestId('rca-refusal')).toBeVisible();
    await expect(page.getByTestId('rca-refusal')).toContainText(/claimedCurrency|currency/i);
  });

  test('P1 (leila): the case survives a fresh login and matches the API', async ({ page }) => {
    const leila = await apiLogin(REL_USERS.leila);
    const found = await call<{ items: Array<{ id: string; title: string; status: string }> }>(leila.token, 'GET', `/v2/rcas?q=${encodeURIComponent(`${PREFIX}validation-${suffix}`)}`);
    expect(found.body.items).toHaveLength(1);
    expect(found.body.items[0].status).toBe('Draft');
    await uiLogin(page, REL_USERS.leila);
    await openCase(page, found.body.items[0].id);
    await expect(page.getByRole('heading', { name: `${PREFIX}validation-${suffix}`, level: 1 })).toBeVisible({ timeout: 30_000 }); // the case title is the page heading
    await expect(page.locator('#edit-description')).toHaveValue('Case opened to exercise the validation errors of the action form');
    await page.getByTestId('tab-actions').click();
    await expect(page.getByTestId('action-row')).toHaveCount(0); // the refused actions were never stored
  });
});
