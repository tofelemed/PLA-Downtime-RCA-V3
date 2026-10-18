/**
 * Master Data E2E tests (v2 screens).
 *
 * The plant hierarchy is a read-and-navigate tree (organisation → plants → units → assets); organisations
 * and plants are created and edited in the Admin panel. Units, assets and products have their own pages.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';

test.describe('Master Data Management', () => {
  let fixture: TestFixture;

  test.beforeAll(async () => {
    fixture = await createTestFixture();
  });

  test.afterAll(async () => {
    await fixture.cleanup();
  });

  test('the overview links every section and Codes & rules, without tabs', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/master-data');
    await expect(page.getByRole('heading', { level: 1, name: 'Master data' })).toBeVisible({ timeout: 30_000 });
    const sections = page.getByRole('navigation', { name: 'Master data sections' });
    for (const name of ['Units', 'Assets', 'Products', 'Plant hierarchy', 'RCA templates', 'Cause library', 'Verification checklists', 'Codes & rules']) {
      await expect(sections.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });

  test('the hierarchy shows the organisation and its plants', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/master-data/hierarchy');
    const tree = page.getByRole('list', { name: 'Plant hierarchy' });
    await expect(tree).toBeVisible({ timeout: 30_000 });
    // each node name carries a screen-reader prefix with its level ("Organization: …", "Plant: …")
    await expect(tree.getByText(`Organization: ${fixture.organization.name}`, { exact: true })).toBeVisible();
    await expect(tree.getByText(`Plant: ${fixture.tenant.name}`, { exact: true })).toBeVisible();
  });

  test('the units list pages at 20 rows and searches by code', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/master-data/units?status=all');
    const table = page.getByRole('table', { name: 'Production units' });
    await expect(table).toBeVisible({ timeout: 30_000 });
    expect(await table.locator('tbody tr').count()).toBeLessThanOrEqual(20);
    await page.getByRole('searchbox', { name: 'Search units' }).fill('no-such-unit-code');
    await expect(page.getByText('No unit matches the search.')).toBeVisible({ timeout: 15_000 });
  });
});
