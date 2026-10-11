import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PLANTS, PREFIX, USERS, apiLogin, call, expectToast, note, selectPlant, signIn, signOut, type ApiErrorBody } from './support/admin-helpers';

/**
 * Admin persona — journeys 5 and 6: Admin panel / application-wide settings and the audit log.
 * Helena changes the branding subtitle (application-wide setting) and sets it back; Isabel (OrgAdmin) is
 * refused both on the screen and on the API; the actions of the earlier journeys show in /audit with
 * their actor; an OrgAdmin cannot edit or delete an audit row (403); a SuperAdmin edit is possible.
 */
interface Branding {
  appName?: string;
  appSubtitle?: string;
}

interface UnitRecord {
  id: string;
  code: string;
  name: string;
  tenantId: string;
}

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
}

const PROBE_SUFFIX = '(P-ADM check)';
const PROBE_SUBTITLE = `Asset Performance Management ${PROBE_SUFFIX}`;

test.describe('ADM-05 admin panel and application-wide settings', () => {
  test('ADM-05a SuperAdmin changes the branding subtitle and sets it back', async ({ page }) => {
    test.setTimeout(180_000);
    const helena = await apiLogin(USERS.helena);
    await signIn(page, USERS.helena);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('tab', { name: 'Branding' }).click();
    const subtitle = page.locator('#appSubtitle');
    await expect(subtitle).toBeVisible();
    // retry-safe: a previous attempt may have left the probe value behind
    const original = (await subtitle.inputValue()).replace(` ${PROBE_SUFFIX}`, '');

    await subtitle.fill(PROBE_SUBTITLE);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToast(page, 'Branding settings saved successfully');
    const saved = await call<Branding>(helena.token, 'GET', '/app-settings/branding/value');
    expect(saved.status).toBe(200);
    expect(saved.body.appSubtitle).toBe(PROBE_SUBTITLE);
    await page.reload();
    await expect(page.locator('header')).toContainText(PROBE_SUBTITLE);
    await page.screenshot({ path: test.info().outputPath('adm-05a-branding-changed.png') });

    await page.getByRole('tab', { name: 'Branding' }).click();
    await page.locator('#appSubtitle').fill(original);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToast(page, 'Branding settings saved successfully');
    const restored = await call<Branding>(helena.token, 'GET', '/app-settings/branding/value');
    expect(restored.body.appSubtitle).toBe(original);
    await page.reload();
    await expect(page.locator('header')).toContainText(original);
  });

  test('ADM-05b OrgAdmin is refused on the admin panel and on application-wide settings', async ({ page }) => {
    await signIn(page, USERS.isabel);
    await page.goto('/admin');
    await expect(page.getByText("You don't have permission to access the admin panel.")).toBeVisible({ timeout: 60_000 });
    const isabel = await apiLogin(USERS.isabel);
    const current = await call<Branding>(isabel.token, 'GET', '/app-settings/branding/value');
    expect(current.status).toBe(200); // readable by every signed-in user
    const tampered = { ...current.body, appSubtitle: 'P-ADM must not apply' };
    const viaPut = await call<ApiErrorBody>(isabel.token, 'PUT', '/app-settings/branding', { value: tampered });
    expect(viaPut.status).toBe(403);
    expect(viaPut.body.code).toBe('SETTING_NOT_WRITABLE');
    const viaSet = await call<ApiErrorBody>(isabel.token, 'POST', '/app-settings/branding/value', { value: tampered });
    expect(viaSet.status).toBe(403);
    expect(viaSet.body.code).toBe('SETTING_NOT_WRITABLE');
    const unchanged = await call<Branding>(isabel.token, 'GET', '/app-settings/branding/value');
    expect(unchanged.body.appSubtitle).toBe(current.body.appSubtitle);
    note(
      test.info(),
      'observation',
      'TenantAdmin is not an admin-persona user; its refusal on application-wide settings is covered by the TenantAdmin persona agent.',
    );
  });
});

test.describe('ADM-06 audit log', () => {
  test('ADM-06a the admin actions appear in /audit with their actor', async ({ page }) => {
    test.setTimeout(180_000);
    const helena = await apiLogin(USERS.helena);
    const units = await call<UnitRecord[]>(helena.token, 'GET', '/units');
    const unit = units.body.find((row) => row.code.startsWith(`${PREFIX}U-`) && row.tenantId === PLANTS.demo2.id);
    expect(unit, 'ADM-03a created a P-ADM unit in Demo Plant 2').toBeTruthy();
    // a fresh v1 write by Helena on the Demo Plant 2 unit, so the row is inside the page's 30-day window
    const touched = await call<UnitRecord>(helena.token, 'PUT', `/units/${unit?.id}`, { description: `audit journey ${new Date().toISOString()}` });
    expect(touched.status).toBe(200);
    const rows = await call<AuditRow[]>(helena.token, 'GET', `/audit-logs?entityType=Unit&entityId=${unit?.id}&limit=20`);
    expect(rows.status).toBe(200);
    expect(rows.body.some((row) => row.action === 'UPDATE' && row.userId === helena.user.id)).toBe(true);

    await signIn(page, USERS.helena);
    await selectPlant(page, PLANTS.demo2);
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({ timeout: 60_000 });
    await page.getByPlaceholder('Search user, action, entity...').fill(unit?.id ?? '');
    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Unit');
    await expect(row).toContainText(/UPDATE|CREATE/);
    await page.screenshot({ path: test.info().outputPath('adm-06a-audit-dp2.png'), fullPage: true });
    // the actor column shows the SuperAdmin who acted on Demo Plant 2
    await expect(row.locator('td').nth(1)).toContainText(/Helena Fischer|helena\.fischer/);
  });

  test('ADM-06b OrgAdmin cannot edit or delete an audit row (403); SuperAdmin edit is possible', async () => {
    const helena = await apiLogin(USERS.helena);
    const probe = await call<AuditRow>(helena.token, 'POST', '/audit-logs', {
      action: 'P-ADM-PROBE',
      entityType: 'P-ADM-Probe',
      entityId: randomUUID(),
      details: JSON.stringify({ userName: helena.user.name, message: 'audit edit/delete probe of the admin persona journey' }),
    });
    expect(probe.status).toBe(201);
    expect(probe.body.userId).toBe(helena.user.id); // identity comes from the token, never from the body

    const isabel = await apiLogin(USERS.isabel);
    const edit = await call<ApiErrorBody>(isabel.token, 'PUT', `/audit-logs/${probe.body.id}`, { action: 'P-ADM-TAMPERED' });
    expect(edit.status).toBe(403);
    expect(edit.body.code).toBe('FORBIDDEN_ROLE');
    const remove = await call<ApiErrorBody>(isabel.token, 'DELETE', `/audit-logs/${probe.body.id}`);
    expect(remove.status).toBe(403);
    expect(remove.body.code).toBe('FORBIDDEN_ROLE');
    const still = await call<AuditRow>(helena.token, 'GET', `/audit-logs/${probe.body.id}`);
    expect(still.status).toBe(200);
    expect(still.body.action).toBe('P-ADM-PROBE');

    // SuperAdmin edit is possible (the value is written back unchanged); the row is never deleted
    const edited = await call<AuditRow>(helena.token, 'PUT', `/audit-logs/${probe.body.id}`, { action: 'P-ADM-PROBE' });
    expect(edited.status).toBe(200);
    expect(edited.body.action).toBe('P-ADM-PROBE');
  });

  test('ADM-06c OrgAdmin reaches /audit of its own plant; the audit menu is hidden from an Operator', async ({ page }) => {
    await signIn(page, USERS.ravi);
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Total Entries')).toBeVisible();
    await signOut(page);
    await signIn(page, USERS.liam);
    await expect(page.getByRole('link', { name: /Audit/ })).toHaveCount(0);
  });
});
