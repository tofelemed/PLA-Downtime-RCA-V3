import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';

test.describe('Reports Module', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('reports page loads with the OEE and downtime view', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('reports-v2')).toBeVisible();
    await expect(page.getByTestId('report-oee')).toBeVisible({ timeout: 15000 });
  });

  test('the report type and report dropdowns open each view and keep it in the URL', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByTestId('reports-v2')).toBeVisible({ timeout: 15000 });
    const views = [['pla', 'reconciliation'], ['pla', 'value'], ['management', 'exports'], ['downtime', 'production']] as const;
    for (const [type, view] of views) {
      await page.getByTestId('report-type').selectOption(type);
      await page.getByTestId('report-view').selectOption(view);
      await expect(page).toHaveURL(new RegExp(`view=${view}`));
    }
    await page.goto('/reports?view=rca');
    await expect(page.getByTestId('report-type')).toHaveValue('reliability');
  });

  test('audit page loads as dedicated page', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole('heading', { name: 'Audit log', level: 1 })).toBeVisible({ timeout: 15000 });
  });
});
