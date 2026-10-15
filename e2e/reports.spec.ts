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

  test('all report views render and the chosen view is kept in the URL', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByTestId('reports-v2')).toBeVisible({ timeout: 15000 });
    for (const tab of ['Reconciliation', 'Loss value', 'Work summary', 'Exports', 'OEE and downtime']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('data-state', 'active');
    }
    await page.getByRole('tab', { name: 'Work summary' }).click();
    await expect(page).toHaveURL(/view=activity/);
    await expect(page.getByTestId('report-work-summary')).toBeVisible();
  });

  test('audit page loads as dedicated page', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole('heading', { name: 'Audit log', level: 1 })).toBeVisible({ timeout: 15000 });
  });
});
