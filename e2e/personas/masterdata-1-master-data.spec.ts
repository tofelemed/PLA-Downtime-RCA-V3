import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { api, itemsOf } from './support/manager-api';
import { DEMO_PLANT_ID, MDA, NOAH, PREFIX, chooseOption, expectToast, openDialog, sessionOf, shortId } from './support/masterdata-world';

/**
 * Master data admin persona — journey 1 (/master-data) and journey 8 (user lists):
 * Charlotte (legacy Analyst + master_data_admin) sees Master Data in the menu but none of the admin-only
 * screens; she creates a unit `P-MDA-U-…` (duplicate code refused first), an asset under it and a
 * product `P-MDA-P-…`, edits and finds each and verifies them through the v1 GETs. Noah (Engineer) has
 * no Master Data menu, the page refuses him and POST /units answers 403. `GET /users` is 403 for the
 * persona while the Tasks page still lists assignees through /users/assignable. Nothing is deleted.
 */
interface UnitRecord {
  id: string;
  name: string;
  code: string;
  description?: string;
  tenantId: string;
}

interface AssetRecord {
  id: string;
  name: string;
  code: string;
  description?: string;
  unitId?: string | null;
}

interface ProductRecord {
  id: string;
  name: string;
  code: string;
  description?: string;
  organizationId?: string | null;
  tenantId?: string | null;
}

const suffix = shortId();
const unit = { name: `${PREFIX}Unit ${suffix}`, code: `${PREFIX}U-${suffix}`, id: '' };
const asset = { name: `${PREFIX}Asset ${suffix}`, code: `${PREFIX}A-${suffix}` };
const product = { name: `${PREFIX}Product ${suffix}`, code: `${PREFIX}P-${suffix}` };

test.describe.configure({ mode: 'serial', timeout: 180_000 });

async function openTab(page: Page, name: string): Promise<void> {
  await page.goto('/master-data');
  await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('tab', { name, exact: true }).click();
}

test.describe('Master data admin — Master Data screen and user lists', () => {
  test('MDA-01a Charlotte: menu, unit created (duplicate code refused), edited, found, verified, persists', async ({ page }) => {
    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    await expect(page.locator('nav a[href="/master-data"]')).toBeVisible();
    for (const href of ['/codes-admin', '/planning', '/finance', '/tasks']) await expect(page.locator(`nav a[href="${href}"]`)).toBeVisible();
    for (const href of ['/users', '/permissions', '/connectivity', '/settings', '/audit', '/admin']) await expect(page.locator(`nav a[href="${href}"]`)).toHaveCount(0);

    await openTab(page, 'Units');
    await expect(page.getByRole('heading', { name: 'Production Units' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Unit' }).click();
    const dialog = openDialog(page);
    await expect(dialog.getByText('Create Production Unit', { exact: true })).toBeVisible();

    // validation: an existing code is refused before any request leaves the browser
    await dialog.locator('#name').fill(unit.name);
    await dialog.locator('#code').fill('DEMO-LINE-1');
    await chooseOption(page, dialog.getByRole('combobox'), 'Demo Plant');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByText('Code must be unique')).toBeVisible();

    await dialog.locator('#code').fill(unit.code);
    await dialog.locator('#description').fill('created by the master data admin persona');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Unit created successfully');
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder('Search units...').fill(unit.code);
    await expect(page.getByText(unit.name, { exact: true })).toBeVisible();
    await expect(page.getByText(`Code: ${unit.code}`)).toContainText('Demo Plant');

    const charlotte = await sessionOf(MDA.charlotte);
    const units = await api<UnitRecord[]>(charlotte.token, 'GET', '/units');
    const stored = itemsOf(units.body).find((entry) => entry.code === unit.code);
    expect(stored).toBeTruthy();
    expect(stored?.tenantId).toBe(DEMO_PLANT_ID);
    unit.id = stored?.id ?? '';

    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(dialog.getByText('Edit Production Unit', { exact: true })).toBeVisible();
    await dialog.locator('#description').fill('edited by the master data admin persona');
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    await expectToast(page, 'Unit updated successfully');
    const byId = await api<UnitRecord>(charlotte.token, 'GET', `/units/${unit.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the master data admin persona');
    expect(byId.body.code).toBe(unit.code);

    await page.reload();
    await page.getByRole('tab', { name: 'Units', exact: true }).click();
    await page.getByPlaceholder('Search units...').fill(unit.code);
    await expect(page.getByText(unit.name, { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('mda-01a-unit.png'), fullPage: true });
  });

  test('MDA-01b Charlotte: an asset under the new unit, edited and verified', async ({ page }) => {
    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    await openTab(page, 'Assets');
    await page.getByRole('button', { name: 'Add Asset' }).first().click();
    const dialog = openDialog(page);
    await expect(dialog.getByText('Create Asset', { exact: true })).toBeVisible();
    await dialog.locator('#name').fill(asset.name);
    await dialog.locator('#code').fill(asset.code);
    await chooseOption(page, dialog.getByRole('combobox').first(), unit.name);
    await dialog.locator('#description').fill('created by the master data admin persona');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Asset created successfully');
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder('Search assets...').fill(asset.code);
    await expect(page.getByText(asset.name, { exact: true })).toBeVisible();

    const charlotte = await sessionOf(MDA.charlotte);
    const assets = await api<AssetRecord[]>(charlotte.token, 'GET', '/assets');
    const stored = itemsOf(assets.body).find((entry) => entry.code === asset.code);
    expect(stored).toBeTruthy();
    expect(stored?.unitId).toBe(unit.id);

    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(dialog.getByText('Edit Asset', { exact: true })).toBeVisible();
    await dialog.locator('#description').fill('edited by the master data admin persona');
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    await expectToast(page, 'Asset updated successfully');
    const byId = await api<AssetRecord>(charlotte.token, 'GET', `/assets/${stored?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the master data admin persona');
    await page.screenshot({ path: test.info().outputPath('mda-01b-asset.png'), fullPage: true });
  });

  test('MDA-01c Charlotte: a product (duplicate code refused), edited, found, verified', async ({ page }) => {
    const charlotte = await sessionOf(MDA.charlotte);
    const existing = itemsOf((await api<ProductRecord[]>(charlotte.token, 'GET', '/products')).body);
    expect(existing.length).toBeGreaterThan(0);
    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    await openTab(page, 'Products');
    await page.getByRole('button', { name: 'Add Product' }).click();
    const dialog = openDialog(page);
    await expect(dialog.getByText('Add Product', { exact: true })).toBeVisible();
    const inputs = dialog.locator('form input');

    await inputs.nth(0).fill(product.name);
    await inputs.nth(1).fill(existing[0].code);
    await inputs.nth(2).fill('t');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByText('Code must be unique')).toBeVisible();

    await inputs.nth(1).fill(product.code);
    await inputs.nth(4).fill('created by the master data admin persona');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Product created successfully');
    await expect(dialog).toBeHidden();
    await page.getByPlaceholder('Search products...').fill(product.code);
    await expect(page.getByText(product.name, { exact: true })).toBeVisible();

    const products = await api<ProductRecord[]>(charlotte.token, 'GET', '/products');
    const stored = itemsOf(products.body).find((entry) => entry.code === product.code);
    expect(stored).toBeTruthy();
    expect(stored?.organizationId).toBe(charlotte.organizationId);
    test.info().annotations.push({ type: 'observation', description: `The product form has no plant field: the product belongs to the organisation (tenantId=${stored?.tenantId ?? 'null'}).` });

    const card = page.locator('div', { hasText: product.name }).filter({ has: page.getByRole('button') }).last();
    await card.getByRole('button').first().click();
    await expect(dialog.getByText('Edit Product', { exact: true })).toBeVisible();
    await dialog.locator('form input').nth(4).fill('edited by the master data admin persona');
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    await expectToast(page, 'Product updated successfully');
    const byId = await api<ProductRecord>(charlotte.token, 'GET', `/products/${stored?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the master data admin persona');

    await page.reload();
    await page.getByRole('tab', { name: 'Products', exact: true }).click();
    await page.getByPlaceholder('Search products...').fill(product.code);
    await expect(page.getByText(product.name, { exact: true })).toBeVisible();
  });

  test('MDA-01d Noah (Engineer): no Master Data menu, the page refuses, POST /units is 403, reads still work', async ({ page }) => {
    await loginViaUI(page, NOAH.email, NOAH.password);
    await expect(page.locator('nav a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('nav a[href="/master-data"]')).toHaveCount(0);
    await page.goto('/master-data');
    await expect(page.getByText("You don't have permission to access master data management.")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: test.info().outputPath('mda-01d-engineer-refused.png') });
    const noah = await sessionOf(NOAH);
    const refused = await api<{ code: string }>(noah.token, 'POST', '/units', { name: `${PREFIX}refused ${suffix}`, code: `${PREFIX}REFUSED-${suffix}`, tenantId: noah.tenantId });
    expect([refused.status, refused.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    const units = await api<UnitRecord[]>(noah.token, 'GET', '/units');
    expect(units.status).toBe(200);
    expect(itemsOf(units.body).some((entry) => entry.code === unit.code)).toBe(true);
    expect(itemsOf(units.body).some((entry) => entry.code === `${PREFIX}REFUSED-${suffix}`)).toBe(false);
  });

  test('MDA-08 Charlotte: GET /users is 403; the Tasks page lists assignees through /users/assignable', async ({ page }) => {
    const charlotte = await sessionOf(MDA.charlotte);
    const users = await api<{ code: string }>(charlotte.token, 'GET', '/users');
    expect([users.status, users.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    const assignable = await api<Array<{ id: string; name: string }>>(charlotte.token, 'GET', '/users/assignable');
    expect(assignable.status).toBe(200);
    expect(itemsOf(assignable.body).map((user) => user.name)).toContain(MDA.charlotte.name);

    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    const [assignableRequest] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/users/assignable')), page.goto('/tasks')]);
    expect(assignableRequest.status()).toBe(200);
    await page.getByRole('button', { name: 'New Task' }).click();
    const dialog = openDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Create Task' })).toBeVisible();
    await dialog.getByRole('combobox').first().click();
    await expect(page.getByRole('option', { name: MDA.charlotte.name, exact: true })).toBeVisible();
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await page.keyboard.press('Escape'); // close the list, then the dialog: no task is created
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
