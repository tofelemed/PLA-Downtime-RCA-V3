import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { api, itemsOf } from './support/manager-api';
import { DEMO_PLANT_ID, MDA, NOAH, PREFIX, chooseOption, expectToast, sessionOf, shortId } from './support/masterdata-world';

/**
 * Master data admin persona — journey 1 (/master-data) and journey 8 (user lists):
 * Charlotte (legacy Analyst + master_data_admin) sees Master Data in the menu but none of the admin-only
 * screens; on the v2 sub-pages she creates a unit `P-MDA-U-…` (duplicate code refused first), an asset under it and a
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

async function openSection(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 60_000 });
}

/** Opens a record from its list by searching its code (the list pages 20 rows; search narrows it). */
async function openFromList(page: Page, search: string, code: string, name: string): Promise<void> {
  await page.getByRole('searchbox', { name: search }).fill(code);
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 });
}

test.describe('Master data admin — Master Data screen and user lists', () => {
  test('MDA-01a Charlotte: menu, unit created (duplicate code refused), edited, found, verified, persists', async ({ page }) => {
    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    await expect(page.locator('nav a[href="/master-data"]')).toBeVisible();
    for (const href of ['/master-data', '/planning', '/finance', '/tasks']) await expect(page.locator(`nav a[href="${href}"]`)).toBeVisible();
    for (const href of ['/users', '/permissions', '/connectivity', '/admin?tab=settings', '/audit', '/admin']) await expect(page.locator(`nav a[href="${href}"]`)).toHaveCount(0);

    await openSection(page, '/master-data/units', 'Production units');
    await page.getByRole('link', { name: 'Add unit' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create production unit' })).toBeVisible();
    await expect(page.getByText('Plant: HDPE', { exact: true })).toBeVisible();

    // validation: an existing code is refused on the code field (server check, 409 MASTER_DATA_CODE_EXISTS)
    await page.locator('#name').fill(unit.name);
    await page.locator('#code').fill('unit100');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText(/This code is already used/)).toBeVisible();

    await page.locator('#code').fill(unit.code);
    await page.locator('#description').fill('created by the master data admin persona');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Unit created successfully');
    await expect(page.getByRole('heading', { level: 1, name: unit.name })).toBeVisible();

    const charlotte = await sessionOf(MDA.charlotte);
    const units = await api<UnitRecord[]>(charlotte.token, 'GET', '/units');
    const stored = itemsOf(units.body).find((entry) => entry.code === unit.code);
    expect(stored).toBeTruthy();
    expect(stored?.tenantId).toBe(DEMO_PLANT_ID);
    unit.id = stored?.id ?? '';

    await openSection(page, '/master-data/units', 'Production units');
    await openFromList(page, 'Search units', unit.code, unit.name);
    await page.locator('#description').fill('edited by the master data admin persona');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expectToast(page, 'Unit updated successfully');
    const byId = await api<UnitRecord>(charlotte.token, 'GET', `/units/${unit.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the master data admin persona');
    expect(byId.body.code).toBe(unit.code);

    await page.reload();
    await expect(page.locator('#description')).toHaveValue('edited by the master data admin persona', { timeout: 30_000 });
    await page.screenshot({ path: test.info().outputPath('mda-01a-unit.png'), fullPage: true });
  });

  test('MDA-01b Charlotte: an asset under the new unit, edited and verified', async ({ page }) => {
    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    await openSection(page, '/master-data/assets', 'Assets');
    await page.getByRole('link', { name: 'Add asset' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create asset' })).toBeVisible();
    await page.locator('#name').fill(asset.name);
    await page.locator('#code').fill(asset.code);
    await chooseOption(page, page.getByRole('combobox', { name: /Production unit/ }), `${unit.code} — ${unit.name}`);
    await page.locator('#description').fill('created by the master data admin persona');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Asset created successfully');
    await expect(page.getByRole('heading', { level: 1, name: asset.name })).toBeVisible();

    const charlotte = await sessionOf(MDA.charlotte);
    const assets = await api<AssetRecord[]>(charlotte.token, 'GET', '/assets');
    const stored = itemsOf(assets.body).find((entry) => entry.code === asset.code);
    expect(stored).toBeTruthy();
    expect(stored?.unitId).toBe(unit.id);

    await openSection(page, '/master-data/assets', 'Assets');
    await openFromList(page, 'Search assets', asset.code, asset.name);
    await page.locator('#description').fill('edited by the master data admin persona');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expectToast(page, 'Asset updated successfully');
    const byId = await api<AssetRecord>(charlotte.token, 'GET', `/assets/${stored?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the master data admin persona');
    await page.screenshot({ path: test.info().outputPath('mda-01b-asset.png'), fullPage: true });
  });

  test('MDA-01c Charlotte: a product (duplicate code refused), edited, found, verified', async ({ page }) => {
    const charlotte = await sessionOf(MDA.charlotte);
    const existing = itemsOf((await api<ProductRecord[]>(charlotte.token, 'GET', '/v2/products?includeOrganization=true&limit=5')).body);
    expect(existing.length).toBeGreaterThan(0);
    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    await openSection(page, '/master-data/products', 'Products');
    await page.getByRole('link', { name: 'Add product' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create product' })).toBeVisible();

    await page.locator('#name').fill(product.name);
    await page.locator('#code').fill(existing[0].code);
    await page.locator('#uom').fill('t');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText(/This code is already used/)).toBeVisible();

    await page.locator('#code').fill(product.code);
    await page.locator('#description').fill('created by the master data admin persona');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expectToast(page, 'Product created successfully');
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
    await expect(page.getByText('Available to:')).toBeVisible();

    const products = await api<ProductRecord[]>(charlotte.token, 'GET', '/products');
    const stored = itemsOf(products.body).find((entry) => entry.code === product.code);
    expect(stored).toBeTruthy();
    expect(stored?.organizationId).toBe(charlotte.organizationId);
    test.info().annotations.push({ type: 'observation', description: `By default a product belongs to the organisation (tenantId=${stored?.tenantId ?? 'null'}); the form offers "This plant only".` });

    await openSection(page, '/master-data/products', 'Products');
    await openFromList(page, 'Search products', product.code, product.name);
    await page.locator('#description').fill('edited by the master data admin persona');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expectToast(page, 'Product updated successfully');
    const byId = await api<ProductRecord>(charlotte.token, 'GET', `/products/${stored?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the master data admin persona');

    await openSection(page, '/master-data/products', 'Products');
    await page.getByRole('searchbox', { name: 'Search products' }).fill(product.code);
    await expect(page.getByRole('link', { name: product.name, exact: true })).toBeVisible();
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

  test('MDA-08 Charlotte: GET /users is 403; the task page lists assignees through the user directory', async ({ page }) => {
    const charlotte = await sessionOf(MDA.charlotte);
    const users = await api<{ code: string }>(charlotte.token, 'GET', '/users');
    expect([users.status, users.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    const assignable = await api<Array<{ id: string; name: string }>>(charlotte.token, 'GET', '/users/assignable');
    expect(assignable.status).toBe(200);
    expect(itemsOf(assignable.body).map((user) => user.name)).toContain(MDA.charlotte.name);

    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    // the task page's assignee picker reads the v2 user directory (any member may read it)
    const [directoryRequest] = await Promise.all([page.waitForResponse((r) => r.url().includes('/v2/users/directory')), page.goto('/tasks/new')]);
    expect(directoryRequest.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'New task', level: 1 })).toBeVisible();
    await page.getByLabel('Assignee').click();
    await expect(page.getByRole('option', { name: MDA.charlotte.name, exact: true })).toBeVisible();
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await page.keyboard.press('Escape'); // close the list and leave: no task is created
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/tasks$/);
  });
});
