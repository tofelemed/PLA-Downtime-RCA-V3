import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { selectConnection } from './support/integration-world';
import { api, itemsOf } from './support/manager-api';
import { ADMINS, MANAGERS, PASSWORD, PREFIX, sessionOf, shortId, utcDate, type Session } from './support/manager-users';

/**
 * Manager approver persona — journeys 8 and 9:
 * 8. User management (`/users`, TenantAdmin): Anna registers an Operator `P-MGR-operator …` of Demo
 *    Plant through the screen (the role picker offers no Super Admin), the operator signs in through the
 *    login form; a duplicate e-mail is refused; granting SuperAdmin through either write route is
 *    refused by the server. Anna sees Grace (home plant Demo Plant 2, viewer in Demo Plant) by name with a
 *    "From Demo Plant 2" badge; her profile is read-only here (owner decision 2026-10-12).
 * 9. Integration console (`/connectivity`, TenantAdmin): Benjamin opens the MQTT demo connection card,
 *    sees the subscription health, pauses and resumes the subscription (left running), views the
 *    quarantine of the connection. A Manager has no Connectivity entry in the menu.
 * Data: user `P-MGR-operator …` (`p-mgr-operator-….@demo.acme.com`) — kept; two audited job commands.
 * The SuperAdmin-grant check (J8c) runs last so that a failure there never blocks J9.
 */
const MQTT_DEMO = 'Demo: MQTT events (simulator)';
let anna: Session;
const suffix = shortId();
const operator = { email: `p-mgr-operator-${suffix}@demo.acme.com`, password: PASSWORD, name: `${PREFIX}operator ${suffix}` };

test.describe.configure({ mode: 'serial', timeout: 240_000 });

async function openUsers(page: Page): Promise<void> {
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible({ timeout: 60_000 });
}

async function fillUserDialog(page: Page, user: { name: string; email: string; password: string }): Promise<void> {
  await page.getByRole('link', { name: 'Add user' }).click();
  await expect(page.getByRole('heading', { name: 'Add user', level: 1 })).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Name', { exact: true }).fill(user.name);
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
}

async function jobCommand(page: Page, action: 'pause' | 'resume', reason: string): Promise<void> {
  await page.getByTestId(`job-${action}`).click();
  await page.fill('#job-reason', reason);
  await page.getByTestId('job-command-confirm').click();
}

test.describe('Manager persona — users and the MQTT demo connection', () => {
  test.beforeAll(async () => {
    anna = await sessionOf(ADMINS.anna);
  });

  test('J8a Anna registers an Operator of Demo Plant (no Super Admin offered); a duplicate e-mail is refused; it persists', async ({ page }) => {
    await loginViaUI(page, ADMINS.anna.email, ADMINS.anna.password);
    await expect(page.locator('nav a[href="/users"]')).toBeVisible();
    await openUsers(page);
    await fillUserDialog(page, operator);
    await page.getByLabel('Role').click();
    const options = page.getByRole('option');
    await expect(options.filter({ hasText: /^Operator$/ })).toHaveCount(1);
    // the server offers roles up to the caller's own (Plant administrator), never above it
    await expect(options.filter({ hasText: 'Super administrator' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'Organization administrator' })).toHaveCount(0);
    await options.filter({ hasText: /^Operator$/ }).click();
    await page.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByText('User created').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: operator.name, level: 1 })).toBeVisible({ timeout: 20_000 });
    const users = await api<Array<{ email: string; role: string; tenantId: string | null }>>(anna.token, 'GET', `/users?tenantId=${anna.tenantId}`);
    const stored = itemsOf(users.body).find((user) => user.email === operator.email);
    expect(stored).toMatchObject({ role: 'Operator', tenantId: anna.tenantId });

    await openUsers(page);
    await fillUserDialog(page, operator); // same e-mail again: refused, shown as an error
    await page.getByLabel('Role').click();
    await page.getByRole('option').filter({ hasText: /^Operator$/ }).click();
    await page.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByText(/already exists/i).first()).toBeVisible({ timeout: 20_000 });
    expect(itemsOf((await api<Array<{ email: string }>>(anna.token, 'GET', `/users?tenantId=${anna.tenantId}`)).body).filter((user) => user.email === operator.email)).toHaveLength(1);

    await openUsers(page);
    await page.getByLabel('Search users by name or e-mail').fill(operator.email);
    await expect(page.getByText(operator.email).first()).toBeVisible({ timeout: 60_000 });
  });

  test('J8b the new operator signs in through the login form and sees the operator menu', async ({ page }) => {
    await loginViaUI(page, operator.email, operator.password);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('nav a[href="/events"]')).toBeVisible();
    await expect(page.locator('nav a[href="/users"]')).toHaveCount(0);
    await expect(page.locator('nav a[href="/planning"]')).toHaveCount(0);
  });

  test('J9a Benjamin opens the MQTT demo card: health shown, pause and resume audited, subscription left running, quarantine', async ({ page }) => {
    await loginViaUI(page, ADMINS.benjamin.email, ADMINS.benjamin.password);
    await expect(page.locator('nav a[href="/connectivity"]')).toBeVisible();
    await page.goto('/connectivity');
    await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
    // the connections table is paged; the name opens the connection's own page
    await selectConnection(page, MQTT_DEMO);
    await expect(page.getByTestId('connection-detail')).toHaveAttribute('data-source-type', 'mqtt');
    const connectionId = (await page.getByTestId('connection-detail').getAttribute('data-connection-id')) ?? '';
    expect(connectionId).not.toBe('');
    await expect(page.getByTestId('mqtt-status')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-job-state', 'running', { timeout: 30_000 });
    await expect(page.getByTestId('mqtt-counters')).toBeVisible();
    test.info().annotations.push({ type: 'health', description: `status=${await page.getByTestId('mqtt-status').getAttribute('data-status')}` });
    await page.screenshot({ path: test.info().outputPath('manager-mqtt-card.png'), fullPage: true });

    await jobCommand(page, 'pause', `${PREFIX}persona check: pause the demo subscription`);
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-job-state', 'paused', { timeout: 30_000 });
    await jobCommand(page, 'resume', `${PREFIX}persona check: resume the demo subscription`);
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-job-state', 'running', { timeout: 30_000 });
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    await page.getByTestId('job-trail-toggle').click();
    await expect(page.locator('[data-testid="job-transition"][data-action="pause"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="job-transition"][data-action="resume"]').first()).toBeVisible();
    const benjamin = await sessionOf(ADMINS.benjamin);
    const jobs = await api<{ items: Array<{ state: string; scope: { mode?: string } }> }>(benjamin.token, 'GET', `/v2/ingestion-jobs?connectionId=${connectionId}&limit=100`);
    expect(itemsOf(jobs.body).find((job) => job.scope.mode === 'subscribe')?.state).toBe('running');

    await page.getByTestId('tab-mqtt-quarantine').click();
    await expect(page.getByTestId('q-connection')).toHaveValue(connectionId);
    await expect(page.getByTestId('quarantine-inbox')).toBeVisible();
  });

  test('J9b a Manager has no Connectivity entry; opening the route directly does not crash', async ({ page }) => {
    await loginViaUI(page, MANAGERS.jonas.email, MANAGERS.jonas.password);
    await expect(page.locator('nav a[href="/connectivity"]')).toHaveCount(0);
    await expect(page.locator('nav a[href="/users"]')).toHaveCount(0);
    await page.goto('/connectivity');
    await expect(page.locator('header')).toBeVisible({ timeout: 60_000 });
    const console = page.getByTestId('integration-console');
    const opened = await console.isVisible().catch(() => false);
    test.info().annotations.push({ type: 'observation', description: opened ? 'Manager can open /connectivity directly (menu hides it)' : 'Manager is refused on /connectivity' });
    await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);
  });

  test('J8d Anna sees Grace (home Demo Plant 2, viewer here) by name with her home plant; her profile stays read-only', async ({ page }) => {
    // owner decision 2026-10-12: plant admins see and manage the access of users granted into their plant
    const graceEmail = 'grace.whitfield@demo.acme.com';
    type Listed = { id: string; email: string; name: string; tenantName: string | null; manageable: boolean; accessManageable: boolean };
    const listed = itemsOf((await api<{ items: Listed[] }>(anna.token, 'GET', `/v2/users?q=${encodeURIComponent(graceEmail)}`)).body);
    const grace = listed.find((user) => user.email === graceEmail);
    expect(grace, 'Grace is listed in Demo Plant').toBeTruthy();
    expect(grace).toMatchObject({ tenantName: 'Demo Plant 2', manageable: false, accessManageable: true });
    const names = await api<{ items: Array<{ id: string; name: string }> }>(anna.token, 'GET', `/v2/users/directory?ids=${grace?.id ?? ''}`);
    expect(names.body.items.map((user) => user.name)).toEqual([grace?.name]);
    const refused = await api<{ code?: string }>(anna.token, 'PATCH', `/v2/users/${grace?.id ?? ''}`, { name: 'P-MGR renamed' });
    expect([refused.status, refused.body.code]).toEqual([403, 'HOME_PLANT_ONLY']);

    await loginViaUI(page, ADMINS.anna.email, ADMINS.anna.password);
    await openUsers(page);
    await page.getByLabel('Search users by name or e-mail').fill('grace');
    const row = page.getByRole('row', { name: new RegExp(graceEmail, 'i') });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText('From Demo Plant 2')).toBeVisible();
    await row.click();
    await expect(page.getByText(/Home plant: Demo Plant 2/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Grant access' })).toBeVisible();
  });

  test('J8c granting SuperAdmin is refused by the server (both write routes)', async () => {
    // one fixed e-mail per day and route: should a regression mint an account, a rerun answers 409 (e-mail in use)
    // instead of minting more privileged accounts. The `p-rv-` local part is new: the round-1 attempts
    // (`p-mgr-superadmin-*`) were minted before the fix and still exist, so their e-mails would answer 409.
    const attempt = (route: string) => ({ name: `P-RV-superadmin attempt ${route}`, email: `p-rv-superadmin-${route}-${utcDate(0)}@demo.acme.com`, password: PASSWORD, role: 'SuperAdmin' });
    const viaRegister = attempt('register');
    const register = await api<{ code?: string }>(anna.token, 'POST', '/auth/register', { ...viaRegister, tenantId: anna.tenantId, organizationId: anna.organizationId });
    // a bearer token makes registration an authenticated grant: at most the caller's own rank (ROLE_GRANT_NOT_ALLOWED)
    expect.soft([register.status, register.body.code], `POST /auth/register answered ${register.status} ${JSON.stringify(register.body)}`).toEqual([403, 'ROLE_GRANT_NOT_ALLOWED']);
    const viaUsers = attempt('users');
    const users = await api<{ code?: string; role?: string }>(anna.token, 'POST', '/users', { ...viaUsers, isActive: true, tenantId: anna.tenantId, organizationId: anna.organizationId });
    // the screen's own route applies the same grant policy
    expect.soft([users.status, users.body.code], `POST /users answered ${users.status} ${JSON.stringify(users.body)}`).toEqual([403, 'ROLE_GRANT_NOT_ALLOWED']);
    const list = await api<Array<{ email: string; role: string }>>(anna.token, 'GET', `/users?tenantId=${anna.tenantId}`);
    const minted = itemsOf(list.body).filter((user) => [viaRegister.email, viaUsers.email].includes(user.email));
    expect(minted.map((user) => `${user.email}: ${user.role}`), 'no SuperAdmin may have been created by a TenantAdmin').toEqual([]);
  });
});
