import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';

test.describe('Tasks Module', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('tasks page loads', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Task Management' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /New Task/i })).toBeVisible();
  });

  test('task API CRUD', async ({ request }) => {
    const loginRes = await request.post('http://localhost:4004/api/auth/login', {
      data: { email: 'test@example.com', password: 'Test123!@#' },
    });
    const { access_token, user } = await loginRes.json();
    const headers = { Authorization: `Bearer ${access_token}` };

    const tenantsRes = await request.get('http://localhost:4004/api/tenants', { headers });
    const tenants = await tenantsRes.json();
    const tenantId = tenants[0]?.id;
    expect(tenantId).toBeTruthy();

    const createRes = await request.post('http://localhost:4004/api/tasks', {
      headers,
      data: {
        title: `E2E Task ${Date.now()}`,
        description: 'Automated test task',
        assignedTo: user.id,
        assignedBy: user.id,
        priority: 'Medium',
        status: 'Open',
        organizationId: tenants[0]?.organizationId || tenantId,
        tenantId,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.id).toBeTruthy();

    const listRes = await request.get(`http://localhost:4004/api/tasks?tenantId=${tenantId}`, { headers });
    expect(listRes.ok()).toBeTruthy();

    const updateRes = await request.put(`http://localhost:4004/api/tasks/${created.id}`, {
      headers,
      data: { status: 'Completed' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.status).toBe('Completed');

    const deleteRes = await request.delete(`http://localhost:4004/api/tasks/${created.id}`, { headers });
    expect(deleteRes.ok()).toBeTruthy();
  });
});
