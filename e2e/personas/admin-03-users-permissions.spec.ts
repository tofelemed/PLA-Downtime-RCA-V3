import { test, expect, type Page } from '@playwright/test';
import { PLANTS, USERS, apiLogin, call, expectToast, note, signIn, signOut } from './support/admin-helpers';

/**
 * Admin persona — journey 4: User management (/users) and permissions (/permissions).
 * Helena lists users, opens a Demo Plant 2 user and changes the display name (then restores it so other
 * personas keep their names) on the user's own page; OrgAdmins grant at most their rank; an Operator is
 * refused; the permissions matrix is read-only and says so (no Save, disabled switches, link to the user).
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
/** A row of the users / permissions tables (v2 DataTable rows carry the user's name and e-mail). */
const userRow = (page: Page, text: string) => page.getByRole('row', { name: new RegExp(text, 'i') });

/** The user's own page (`/users/:userId`, was the "Edit User" dialog): rename and save. */
async function renameViaUi(page: Page, userId: string, name: string): Promise<void> {
  await page.goto(`/users/${userId}`);
  const field = page.getByLabel('Name', { exact: true });
  await expect(field).toBeVisible({ timeout: 60_000 });
  await field.fill(name);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expectToast(page, 'User updated');
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
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Search users by name or e-mail').fill('Kenji');
    await expect(userRow(page, TARGET_EMAIL)).toBeVisible({ timeout: 30_000 });

    await renameViaUi(page, target?.id ?? '', changed);
    const after = await call<UserRecord>(helena.token, 'GET', `/users/${target?.id}`);
    expect(after.status).toBe(200);
    expect(after.body.name).toBe(changed);
    await page.reload();
    await expect(page.getByRole('heading', { name: changed, level: 1 })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: test.info().outputPath('adm-04a-renamed.png') });

    await renameViaUi(page, target?.id ?? '', original);
    const restored = await call<UserRecord>(helena.token, 'GET', `/users/${target?.id}`);
    expect(restored.body.name).toBe(original);
  });

  test('ADM-04b OrgAdmins grant at most their rank and see only their organisation; an Operator is refused', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, USERS.daniel);
    await page.goto('/users/new');
    await expect(page.getByRole('heading', { name: 'Add user', level: 1 })).toBeVisible({ timeout: 60_000 });
    // the role choices come from the server: an OrgAdmin is offered no SuperAdmin role
    await page.getByLabel('Role').click();
    await expect(page.getByRole('option', { name: 'Plant administrator' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Super administrator' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await signOut(page);
    await signIn(page, USERS.lucas);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Search users by name or e-mail').fill('Helena');
    await expect(page.getByText('No user matches the filters.')).toBeVisible({ timeout: 30_000 });

    await signOut(page);
    await signIn(page, USERS.liam);
    await page.goto('/users');
    await expect(page.getByText("You don't have permission to access user management.")).toBeVisible({ timeout: 60_000 });
    await page.goto('/permissions');
    await expect(page.getByText("You don't have permission to manage user permissions.")).toBeVisible({ timeout: 60_000 });
  });

  test('ADM-04c validation: a new user needs a valid e-mail', async ({ page }) => {
    await signIn(page, USERS.sofia);
    await page.goto('/users/new');
    await page.getByLabel('Name', { exact: true }).fill('P-ADM should not be created');
    await page.getByLabel('E-mail').fill('not-an-email');
    await page.getByLabel('Password').fill('x');
    await page.getByRole('button', { name: 'Create user' }).click();
    // the form stays on the page and explains; nothing was sent
    await expect(page.getByText('Enter a valid e-mail address.')).toBeVisible();
    await expect(page).toHaveURL(/\/users\/new$/);
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

  test('ADM-04d permissions: the matrix is honest — read-only switches, no Save, a link to the user', async ({ page }) => {
    await signIn(page, USERS.helena);
    await page.goto('/permissions');
    await expect(page.getByRole('heading', { name: 'Permissions', level: 1 })).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Search users').fill('Kenji');
    await page.getByRole('row', { name: /Kenji/ }).first().click();
    await expect(page.getByText(/What the role of .* reaches by default/)).toBeVisible({ timeout: 30_000 });
    // nothing can be saved: no Save button, every module switch is disabled (the role default is shown)
    await expect(page.getByRole('button', { name: 'Save Permissions' })).toHaveCount(0);
    const auditSwitch = page.locator('#module-audit');
    await expect(auditSwitch).toBeVisible();
    await expect(auditSwitch).toBeDisabled();
    const switches = page.getByRole('switch');
    expect(await switches.count()).toBeGreaterThan(1);
    for (const module of await switches.all()) await expect(module).toBeDisabled();
    // the note says why, and sends the administrator to the user's role and access grants
    const readOnlyNote = page.getByTestId('permissions-read-only-note');
    await expect(readOnlyNote).toBeVisible();
    await expect(readOnlyNote).toContainText('Per-user permission overrides are not stored');
    const link = readOnlyNote.getByRole('link', { name: 'Open user and access' });
    await expect(link).toHaveAttribute('href', /^\/users\/[0-9a-f-]+$/);
    await page.screenshot({ path: test.info().outputPath('adm-04d-read-only-matrix.png'), fullPage: true });
    await link.click();
    await expect(page.getByRole('heading', { name: 'Access in this plant' })).toBeVisible({ timeout: 60_000 });
    note(test.info(), 'observation', 'The permissions matrix is read-only by design; access changes through the role and the access grants.');
  });
});
