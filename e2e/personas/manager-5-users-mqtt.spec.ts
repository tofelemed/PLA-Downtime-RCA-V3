import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { api, itemsOf } from './support/manager-api';
import { ADMINS, MANAGERS, PASSWORD, PREFIX, sessionOf, shortId, utcDate, type Session } from './support/manager-users';

/**
 * Manager approver persona — journeys 8 and 9:
 * 8. User management (`/users`, TenantAdmin): Anna registers an Operator `P-MGR-operator …` of Demo
 *    Plant through the screen (the role picker offers no Super Admin), the operator signs in through the
 *    login form; a duplicate e-mail is refused; granting SuperAdmin through either write route is
 *    refused by the server.
 * 9. Integration console (`/connectivity`, TenantAdmin): Benjamin opens the MQTT demo connection card,
 *    sees the subscription health, pauses and resumes the subscription (left running), views the
 *    quarantine of the connection. A Manager has no Connectivity entry in the menu.
 * Data: user `P-MGR-operator …` (`p-mgr-operator-….@demo.acme.com`) — kept; two audited job commands.
 * The SuperAdmin-grant check (J8c) runs last: it is a known failing assertion (DEFECT) and must not block J9.
 */
const MQTT_DEMO = 'Demo: MQTT events (simulator)';
let anna: Session;
const suffix = shortId();
const operator = { email: `p-mgr-operator-${suffix}@demo.acme.com`, password: PASSWORD, name: `${PREFIX}operator ${suffix}` };

test.describe.configure({ mode: 'serial', timeout: 240_000 });

async function openUsers(page: Page): Promise<void> {
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 60_000 });
}

async function fillUserDialog(page: Page, user: { name: string; email: string; password: string }): Promise<void> {
  await page.getByRole('button', { name: 'Add User' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.fill('#name', user.name);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
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
    await page.getByRole('dialog').getByRole('combobox').click();
    const options = page.getByRole('option');
    await expect(options.filter({ hasText: 'Operator' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Super Admin' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'Tenant Admin' })).toHaveCount(0);
    await options.filter({ hasText: 'Operator' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('User created successfully').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(operator.email).first()).toBeVisible();
    const users = await api<Array<{ email: string; role: string; tenantId: string | null }>>(anna.token, 'GET', `/users?tenantId=${anna.tenantId}`);
    const stored = itemsOf(users.body).find((user) => user.email === operator.email);
    expect(stored).toMatchObject({ role: 'Operator', tenantId: anna.tenantId });

    await fillUserDialog(page, operator); // same e-mail again: refused, shown as an error
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(/already|exists|failed|error/i).first()).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('Escape');
    expect(itemsOf((await api<Array<{ email: string }>>(anna.token, 'GET', `/users?tenantId=${anna.tenantId}`)).body).filter((user) => user.email === operator.email)).toHaveLength(1);

    await page.reload();
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
    await page.getByTestId('connection-item').filter({ hasText: MQTT_DEMO }).click();
    await expect(page.getByTestId('connection-detail')).toHaveAttribute('data-source-type', 'mqtt');
    const connectionId = (await page.getByTestId('connection-item').filter({ hasText: MQTT_DEMO }).getAttribute('data-connection-id')) ?? '';
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

  test('J8c granting SuperAdmin is refused by the server (both write routes)', async () => {
    // one fixed e-mail per day and route: a rerun answers 409 (e-mail in use) instead of minting more privileged accounts
    const attempt = (route: string) => ({ name: `${PREFIX}superadmin attempt ${route}`, email: `p-mgr-superadmin-${route}-${utcDate(0)}@demo.acme.com`, password: PASSWORD, role: 'SuperAdmin' });
    const viaRegister = attempt('register');
    const register = await api<{ code?: string }>(anna.token, 'POST', '/auth/register', { ...viaRegister, tenantId: anna.tenantId, organizationId: anna.organizationId });
    // DEFECT: with AUTH_ALLOW_PUBLIC_REGISTRATION=true the route is public, the bearer token is ignored and the rank check
    // (ROLE_GRANT_NOT_ALLOWED) is skipped: a TenantAdmin (or an anonymous caller) creates a SuperAdmin — answered 201
    expect.soft([register.status, register.body.code], `POST /auth/register answered ${register.status} ${JSON.stringify(register.body)}`).toEqual([403, 'ROLE_GRANT_NOT_ALLOWED']);
    const viaUsers = attempt('users');
    const users = await api<{ code?: string; role?: string }>(anna.token, 'POST', '/users', { ...viaUsers, isActive: true, tenantId: anna.tenantId, organizationId: anna.organizationId });
    // DEFECT candidate: the screen's own route (POST /users) has no rank check at all (users.controller.ts / users.service.ts)
    expect.soft(users.status, `POST /users answered ${users.status} ${JSON.stringify(users.body)}`).toBe(403);
    const list = await api<Array<{ email: string; role: string }>>(anna.token, 'GET', `/users?tenantId=${anna.tenantId}`);
    const minted = itemsOf(list.body).filter((user) => [viaRegister.email, viaUsers.email].includes(user.email));
    expect(minted.map((user) => `${user.email}: ${user.role}`), 'no SuperAdmin may have been created by a TenantAdmin').toEqual([]);
  });
});
