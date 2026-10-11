import { test, expect, type Page } from '@playwright/test';
import { PLANTS, USERS, apiLogin, call, expectToast, note, openDialog, signIn, signOut } from './support/admin-helpers';

/**
 * Admin persona — journey 4: User management (/users) and permissions (/permissions).
 * Helena lists users, opens a Demo Plant 2 user and changes the display name (then restores it so other
 * personas keep their names); OrgAdmins see only their organisation; an Operator is refused; the
 * permissions matrix is read-only and says so (no Save, disabled switches, link to User Management).
 */
interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string | null;
  organizationId: string | null;
}

const TARGET_EMAIL = 'kenji.nakamura@demo.acme.com'; // viewer persona, home plant Demo Plant 2
const userRow = (page: Page, email: string) => page.locator('div.p-4.border.rounded-lg', { hasText: email });

async function renameViaUi(page: Page, email: string, name: string): Promise<void> {
  await userRow(page, email).getByRole('button').first().click();
  const dialog = openDialog(page);
  await expect(dialog.getByText('Edit User', { exact: true })).toBeVisible();
  await dialog.locator('#name').fill(name);
  await dialog.getByRole('button', { name: 'Update', exact: true }).click();
  await expectToast(page, 'User updated successfully');
  await expect(dialog).toBeHidden();
}

test.describe('ADM-04 users and permissions', () => {
  test('ADM-04a SuperAdmin lists users, changes a Demo Plant 2 display name and restores it', async ({ page }) => {
    test.setTimeout(180_000);
    const helena = await apiLogin(USERS.helena);
    const before = await call<UserRecord[]>(helena.token, 'GET', `/users?tenantId=${PLANTS.demo2.id}`);
    const target = before.body.find((user) => user.email === TARGET_EMAIL);
    expect(target).toBeTruthy();
    // retry-safe: an aborted earlier attempt may have left the suffix behind
    const original = (target?.name ?? 'Kenji Nakamura').replace(/( \(P-ADM\))+$/, '');
    const changed = `${original} (P-ADM)`;

    await signIn(page, USERS.helena);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/\d+ users in your scope/)).toBeVisible();
    await expect(userRow(page, TARGET_EMAIL)).toBeVisible();
    await expect(userRow(page, USERS.lucas)).toBeVisible(); // SuperAdmin sees every organisation

    await renameViaUi(page, TARGET_EMAIL, changed);
    const after = await call<UserRecord>(helena.token, 'GET', `/users/${target?.id}`);
    expect(after.status).toBe(200);
    expect(after.body.name).toBe(changed);
    await page.reload();
    await expect(userRow(page, TARGET_EMAIL)).toContainText(changed);
    await page.screenshot({ path: test.info().outputPath('adm-04a-renamed.png') });

    await renameViaUi(page, TARGET_EMAIL, original);
    const restored = await call<UserRecord>(helena.token, 'GET', `/users/${target?.id}`);
    expect(restored.body.name).toBe(original);
  });

  test('ADM-04b OrgAdmins see only their organisation; an Operator is refused', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, USERS.daniel);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 60_000 });
    await expect(userRow(page, TARGET_EMAIL)).toBeVisible();
    await expect(userRow(page, USERS.lucas)).toHaveCount(0);
    // the edit form of an OrgAdmin offers no SuperAdmin role
    await userRow(page, TARGET_EMAIL).getByRole('button').first().click();
    await openDialog(page).getByRole('combobox').click();
    await expect(page.getByRole('option', { name: 'Super Admin' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'Tenant Admin' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await signOut(page);
    await signIn(page, USERS.lucas);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 60_000 });
    await expect(userRow(page, USERS.lucas)).toBeVisible();
    await expect(userRow(page, USERS.helena)).toHaveCount(0);
    await expect(userRow(page, TARGET_EMAIL)).toHaveCount(0);

    await signOut(page);
    await signIn(page, USERS.liam);
    await page.goto('/users');
    await expect(page.getByText("You don't have permission to access user management.")).toBeVisible({ timeout: 60_000 });
    await page.goto('/permissions');
    await expect(page.getByText("You don't have permission to manage user permissions.")).toBeVisible({ timeout: 60_000 });
  });

  test('ADM-04c validation: a new user needs a valid e-mail', async ({ page }) => {
    await signIn(page, USERS.sofia);
    await page.goto('/users');
    await page.getByRole('button', { name: 'Add User' }).click();
    const dialog = openDialog(page);
    await dialog.locator('#name').fill('P-ADM should not be created');
    await dialog.locator('#email').fill('not-an-email');
    await dialog.locator('#password').fill('x');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    // the browser's e-mail validation keeps the dialog open; nothing was sent
    await expect(dialog).toBeVisible();
    const invalid = await dialog.locator('#email').evaluate((element) => !(element as HTMLInputElement).checkValidity());
    expect(invalid).toBe(true);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    const sofia = await apiLogin(USERS.sofia);
    const users = await call<UserRecord[]>(sofia.token, 'GET', '/users');
    expect(users.body.some((user) => user.name === 'P-ADM should not be created')).toBe(false);
    // server-side: the same payload is 400 at the DTO boundary
    const rejected = await call<{ message?: string[] }>(sofia.token, 'POST', '/users', {
      name: 'P-ADM invalid',
      email: 'not-an-email',
      password: 'x',
      role: 'Operator',
    });
    expect(rejected.status).toBe(400);
  });

  test('ADM-04d permissions: the matrix is honest — read-only switches, no Save, a link to User Management', async ({ page }) => {
    await signIn(page, USERS.helena);
    await page.goto('/permissions');
    await expect(page.getByRole('heading', { name: 'Permissions Management' })).toBeVisible({ timeout: 60_000 });
    const item = page.locator('div.p-3.border.rounded-lg', { hasText: TARGET_EMAIL });
    await item.click();
    await expect(page.getByText('Managing permissions for')).toBeVisible();
    // nothing can be saved: no Save button, every module switch is disabled (the role default is shown)
    await expect(page.getByRole('button', { name: 'Save Permissions' })).toHaveCount(0);
    const auditSwitch = page.locator('#audit');
    await expect(auditSwitch).toBeVisible();
    await expect(auditSwitch).toBeDisabled();
    await expect(auditSwitch).not.toBeChecked();
    const switches = page.getByRole('switch');
    expect(await switches.count()).toBeGreaterThan(1);
    for (const module of await switches.all()) await expect(module).toBeDisabled();
    await auditSwitch.click({ force: true });
    await expect(auditSwitch).not.toBeChecked();
    await expect(page.getByText('User permissions updated successfully')).toHaveCount(0);
    // the note says why, and sends the administrator where roles are really managed
    const readOnlyNote = page.getByTestId('permissions-read-only-note');
    await expect(readOnlyNote).toBeVisible();
    await expect(readOnlyNote).toContainText('Per-user permission overrides are not stored yet');
    await expect(readOnlyNote).toContainText('Roles are managed in User Management');
    const link = readOnlyNote.getByRole('link', { name: 'Open User Management' });
    await expect(link).toHaveAttribute('href', '/users');
    await page.screenshot({ path: test.info().outputPath('adm-04d-read-only-matrix.png'), fullPage: true });
    await link.click();
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 60_000 });
    note(test.info(), 'observation', 'The permissions matrix is read-only by design; per-user overrides are not a stored concept.');
  });
});
