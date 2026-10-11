import { test, expect, type Page } from '@playwright/test';
import { PLANTS, PREFIX, USERS, apiLogin, call, chooseOption, expectToast, note, openDialog, selectPlant, signIn, suffix } from './support/admin-helpers';

/**
 * Admin persona — journey 3: Master Data (/master-data). Helena (SuperAdmin) creates a unit and a
 * product for Demo Plant 2 with the `P-ADM-` prefix, hits the duplicate-code validation first, edits
 * both, finds them through the search box, and verifies each through the v1 GET. Nothing is deleted.
 */
interface UnitRecord {
  id: string;
  name: string;
  code: string;
  description?: string;
  tenantId: string;
}

interface ProductRecord {
  id: string;
  name: string;
  code: string;
  description?: string;
  unitOfMeasure?: string;
  organizationId?: string | null;
  tenantId?: string | null;
}

async function openTab(page: Page, name: string): Promise<void> {
  await page.goto('/master-data');
  await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('tab', { name, exact: true }).click();
}

test.describe('ADM-03 Master data for Demo Plant 2', () => {
  test('ADM-03a create, edit, search and verify a unit', async ({ page }) => {
    test.setTimeout(180_000);
    const id = suffix();
    const name = `${PREFIX}Unit ${id}`;
    const code = `${PREFIX}U-${id}`;
    await signIn(page, USERS.helena);
    await selectPlant(page, PLANTS.demo2);
    await openTab(page, 'Units');
    await expect(page.getByRole('heading', { name: 'Production Units' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Unit' }).click();
    const dialog = openDialog(page);
    await expect(dialog.getByText('Create Production Unit', { exact: true })).toBeVisible();

    // validation: a code that already exists is refused before any request leaves the browser
    await dialog.locator('#name').fill(name);
    await dialog.locator('#code').fill('DP2-LINE-1');
    await chooseOption(page, dialog.getByRole('combobox'), 'Demo Plant 2');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByText('Code must be unique')).toBeVisible();

    await dialog.locator('#code').fill(code);
    await dialog.locator('#description').fill('created by the admin persona journey');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Unit created successfully');
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder('Search units...').fill(code);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText(`Code: ${code}`)).toContainText('Demo Plant 2');

    const helena = await apiLogin(USERS.helena);
    const units = await call<UnitRecord[]>(helena.token, 'GET', '/units');
    const created = units.body.find((unit) => unit.code === code);
    expect(created).toBeTruthy();
    expect(created?.tenantId).toBe(PLANTS.demo2.id);
    expect(created?.name).toBe(name);

    // edit: description changes, code and plant stay
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(dialog.getByText('Edit Production Unit', { exact: true })).toBeVisible();
    await dialog.locator('#description').fill('edited by the admin persona journey');
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    await expectToast(page, 'Unit updated successfully');
    const byId = await call<UnitRecord>(helena.token, 'GET', `/units/${created?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the admin persona journey');
    expect(byId.body.code).toBe(code);

    // persists after reload
    await page.reload();
    await page.getByRole('tab', { name: 'Units', exact: true }).click();
    await page.getByPlaceholder('Search units...').fill(code);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('adm-03a-unit.png'), fullPage: true });
  });

  test('ADM-03b create, edit, search and verify a product', async ({ page }) => {
    test.setTimeout(180_000);
    const id = suffix();
    const name = `${PREFIX}Product ${id}`;
    const code = `${PREFIX}P-${id}`;
    await signIn(page, USERS.helena);
    await selectPlant(page, PLANTS.demo2);
    await openTab(page, 'Products');
    await page.getByRole('button', { name: 'Add Product' }).click();
    const dialog = openDialog(page);
    await expect(dialog.getByText('Add Product', { exact: true })).toBeVisible();
    const inputs = dialog.locator('form input');

    // validation: duplicate code (a product of Demo Plant 2 seeded by the persona seeder)
    await inputs.nth(0).fill(name);
    await inputs.nth(1).fill('DP2-PROD-A');
    await inputs.nth(2).fill('t');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByText('Code must be unique')).toBeVisible();

    await inputs.nth(1).fill(code);
    await inputs.nth(4).fill('created by the admin persona journey');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Product created successfully');
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder('Search products...').fill(code);
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    const helena = await apiLogin(USERS.helena);
    const products = await call<ProductRecord[]>(helena.token, 'GET', '/products');
    const created = products.body.find((product) => product.code === code);
    expect(created).toBeTruthy();
    expect(created?.organizationId).toBe(helena.user.organizationId);
    note(
      test.info(),
      'observation',
      `The product form has no plant field: the product is created for the organisation (organizationId=${created?.organizationId}, tenantId=${created?.tenantId ?? 'null'}), not for the selected Demo Plant 2.`,
    );

    const card = page.locator('div', { hasText: name }).filter({ has: page.getByRole('button') }).last();
    await card.getByRole('button').first().click();
    await expect(dialog.getByText('Edit Product', { exact: true })).toBeVisible();
    await dialog.locator('form input').nth(4).fill('edited by the admin persona journey');
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    await expectToast(page, 'Product updated successfully');
    const byId = await call<ProductRecord>(helena.token, 'GET', `/products/${created?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the admin persona journey');
    expect(byId.body.name).toBe(name);

    await page.reload();
    await page.getByRole('tab', { name: 'Products', exact: true }).click();
    await page.getByPlaceholder('Search products...').fill(code);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('adm-03b-product.png'), fullPage: true });
  });

  test('ADM-03c OrgAdmin of Partner Org reaches Master Data but only its own hierarchy', async ({ page }) => {
    await signIn(page, USERS.lucas);
    await openTab(page, 'Units');
    await expect(page.getByRole('heading', { name: 'Production Units' })).toBeVisible();
    await expect(page.getByText('Partner Line 1', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Code: DP2-LINE-1/)).toHaveCount(0);
    const lucas = await apiLogin(USERS.lucas);
    const units = await call<UnitRecord[]>(lucas.token, 'GET', '/units');
    expect(units.status).toBe(200);
    expect(units.body.every((unit) => unit.tenantId === PLANTS.partner.id)).toBe(true);
  });
});
