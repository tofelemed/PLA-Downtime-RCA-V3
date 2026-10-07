import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';

test.describe('Reports Module', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('reports page loads with overview tab and charts', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15000 });

    // Overview tab is default
    await expect(page.getByRole('tab', { name: /Overview/i })).toBeVisible();
    await expect(page.getByText('Avg OEE')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Loss Cost Trend')).toBeVisible();
  });

  test('all report tabs render', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15000 });

    for (const tab of ['OEE', 'Loss', 'RCA', 'Audit', 'Tasks']) {
      await page.getByRole('tab', { name: new RegExp(tab, 'i') }).click();
      await page.waitForTimeout(500);
    }
  });

  test('audit page loads as dedicated page', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({ timeout: 15000 });
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
