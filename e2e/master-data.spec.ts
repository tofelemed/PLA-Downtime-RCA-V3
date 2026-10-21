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

  // owner 21 Oct 2026: master data is listed under Setup; each entry's pages link to each other
  test('Setup lists the plant-data entries, and Plant & equipment links its pages, without tabs', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/master-data/assets');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    // the collapsed sidebar's links have no accessible name: find them by address
    for (const href of ['/master-data/units', '/master-data/codes-rules', '/master-data/stop-policy', '/master-data/rca/templates']) {
      await expect(menu.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    const pages = page.getByRole('navigation', { name: 'Pages of this setup area' });
    for (const name of ['Production units', 'Assets', 'Products', 'Plant hierarchy', 'Plant flow']) {
      await expect(pages.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 30_000 });
    }
    await expect(pages.getByRole('link', { name: 'RCA templates' })).toHaveCount(0);
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
