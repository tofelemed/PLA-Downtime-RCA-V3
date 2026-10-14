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

  test('reporting API endpoints return 200', async ({ request }) => {
    const loginRes = await request.post('http://localhost:4004/api/auth/login', {
      data: { email: 'test@example.com', password: 'Test123!@#' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { access_token } = await loginRes.json();

    const tenantsRes = await request.get('http://localhost:4004/api/tenants', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const tenants = await tenantsRes.json();
    const tenantId = tenants[0]?.id;
    expect(tenantId).toBeTruthy();

    const endpoints = ['dashboard', 'oee-summary', 'production-loss', 'rca-summary', 'audit-trail', 'task-summary'];
    for (const ep of endpoints) {
      const res = await request.get(`http://localhost:4004/api/reports/${ep}?tenantId=${tenantId}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      expect(res.ok(), `Expected 200 for /reports/${ep}`).toBeTruthy();
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });
});
