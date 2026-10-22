import { test, expect, type Page } from '@playwright/test';
import { PLANTS, PREFIX, USERS, apiLogin, call, expectToast, note, selectPlant, signIn, suffix } from './support/admin-helpers';

/**
 * Admin persona — journey 3: Master Data (/master-data/units, /master-data/products). Helena (SuperAdmin) creates a unit and a
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

test.describe('ADM-03 Master data for Demo Plant 2', () => {
  test('ADM-03a create, edit, search and verify a unit', async ({ page }) => {
    test.setTimeout(180_000);
    const id = suffix();
    const name = `${PREFIX}Unit ${id}`;
    const code = `${PREFIX}U-${id}`;
    await signIn(page, USERS.helena);
    await selectPlant(page, PLANTS.demo2);
    await openSection(page, '/master-data/units', 'Production units');
    await page.getByRole('link', { name: 'Add unit' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create production unit' })).toBeVisible();
    await expect(page.getByText('Plant: Demo Plant 2', { exact: true })).toBeVisible();

    // validation: a code that already exists in the plant is refused on the code field
    await page.locator('#name').fill(name);
    await page.locator('#code').fill('DP2-LINE-1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText(/This code is already used/)).toBeVisible();

    await page.locator('#code').fill(code);
    await page.locator('#description').fill('created by the admin persona journey');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('dialog', { name: 'Unit created' }).getByRole('link', { name: 'View unit' }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

    const helena = await apiLogin(USERS.helena);
    const units = await call<UnitRecord[]>(helena.token, 'GET', '/units');
    const created = units.body.find((unit) => unit.code === code);
    expect(created).toBeTruthy();
    expect(created?.tenantId).toBe(PLANTS.demo2.id);
    expect(created?.name).toBe(name);

    // edit: description changes, code and plant stay
    await openSection(page, '/master-data/units', 'Production units');
    await openFromList(page, 'Search units', code, name);
    await page.locator('#description').fill('edited by the admin persona journey');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expectToast(page, 'Unit updated successfully');
    const byId = await call<UnitRecord>(helena.token, 'GET', `/units/${created?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the admin persona journey');
    expect(byId.body.code).toBe(code);

    // persists after reload
    await page.reload();
    await expect(page.locator('#description')).toHaveValue('edited by the admin persona journey', { timeout: 30_000 });
    await page.screenshot({ path: test.info().outputPath('adm-03a-unit.png'), fullPage: true });
  });

  test('ADM-03b create, edit, search and verify a product', async ({ page }) => {
    test.setTimeout(180_000);
    const id = suffix();
    const name = `${PREFIX}Product ${id}`;
    const code = `${PREFIX}P-${id}`;
    await signIn(page, USERS.helena);
    await selectPlant(page, PLANTS.demo2);
    await openSection(page, '/master-data/products', 'Products');
    await page.getByRole('link', { name: 'Add product' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create product' })).toBeVisible();

    // validation: duplicate code (a product of Demo Plant 2 seeded by the persona seeder)
    await page.locator('#name').fill(name);
    await page.locator('#code').fill('DP2-PROD-A');
    await page.locator('#uom').fill('t');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText(/This code is already used/)).toBeVisible();

    await page.locator('#code').fill(code);
    await page.locator('#description').fill('created by the admin persona journey');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('dialog', { name: 'Product created' }).getByRole('link', { name: 'View product' }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

    const helena = await apiLogin(USERS.helena);
    const products = await call<ProductRecord[]>(helena.token, 'GET', '/products');
    const created = products.body.find((product) => product.code === code);
    expect(created).toBeTruthy();
    expect(created?.organizationId).toBeTruthy();
    note(
      test.info(),
      'observation',
      `By default a product belongs to the organisation of the selected plant (organizationId=${created?.organizationId}, tenantId=${created?.tenantId ?? 'null'}); "This plant only" keeps it to Demo Plant 2.`,
    );

    await openSection(page, '/master-data/products', 'Products');
    await openFromList(page, 'Search products', code, name);
    await page.locator('#description').fill('edited by the admin persona journey');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expectToast(page, 'Product updated successfully');
    const byId = await call<ProductRecord>(helena.token, 'GET', `/products/${created?.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.description).toBe('edited by the admin persona journey');
    expect(byId.body.name).toBe(name);

    await page.reload();
    await expect(page.locator('#description')).toHaveValue('edited by the admin persona journey', { timeout: 30_000 });
    await page.screenshot({ path: test.info().outputPath('adm-03b-product.png'), fullPage: true });
  });

  test('ADM-03c OrgAdmin of Partner Org reaches Master Data but only its own hierarchy', async ({ page }) => {
    await signIn(page, USERS.lucas);
    await openSection(page, '/master-data/units', 'Production units');
    await expect(page.getByRole('link', { name: 'Partner Line 1', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'DP2-LINE-1', exact: true })).toHaveCount(0);
    const lucas = await apiLogin(USERS.lucas);
    const units = await call<UnitRecord[]>(lucas.token, 'GET', '/units');
    expect(units.status).toBe(200);
    expect(units.body.every((unit) => unit.tenantId === PLANTS.partner.id)).toBe(true);
  });
});
