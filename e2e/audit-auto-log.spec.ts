import { test, expect } from '@playwright/test';

const API = 'http://localhost:4004/api';

test.describe('Audit auto-log interceptor', () => {
  test('POST /tasks creates audit log entry', async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: 'test@example.com', password: 'Test123!@#' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { access_token, user } = await loginRes.json();
    const headers = { Authorization: `Bearer ${access_token}` };

    const tenantsRes = await request.get(`${API}/tenants`, { headers });
    expect(tenantsRes.ok()).toBeTruthy();
    const tenants = await tenantsRes.json();
    const tenantId = tenants[0]?.id;
    expect(tenantId).toBeTruthy();

    const uniqueTitle = `Auto-audit E2E ${Date.now()}`;
    const createRes = await request.post(`${API}/tasks`, {
      headers,
      data: {
        title: uniqueTitle,
        description: 'Verify interceptor writes audit log',
        assignedTo: user.id,
        assignedBy: user.id,
        priority: 'Low',
        status: 'Open',
        organizationId: tenants[0]?.organizationId || tenantId,
        tenantId,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.id).toBeTruthy();

    const auditRes = await request.get(
      `${API}/audit-logs?entityType=Task&entityId=${created.id}&action=CREATE&limit=10`,
      // the trail is read in the acting tenant: select the task's plant
      { headers: { ...headers, 'X-Tenant-Id': tenantId } },
    );
    expect(auditRes.ok()).toBeTruthy();
    const logs = await auditRes.json();
    expect(Array.isArray(logs)).toBeTruthy();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l: { entityId: string; action: string }) => l.entityId === created.id && l.action === 'CREATE')).toBeTruthy();

    await request.delete(`${API}/tasks/${created.id}`, { headers });
  });

  // settings audit 21 Oct 2026: the header counts only on routes that declare a client audit (@ClientAudited),
  // so a caller cannot switch the server audit off for an ordinary write
  test('X-Client-Audited header does not skip the audit of an ordinary write', async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: 'test@example.com', password: 'Test123!@#' },
    });
    const { access_token, user } = await loginRes.json();
    const headers = {
      Authorization: `Bearer ${access_token}`,
      'X-Client-Audited': 'true',
    };

    const tenantsRes = await request.get(`${API}/tenants`, { headers });
    const tenants = await tenantsRes.json();
    const tenantId = tenants[0]?.id;

    const createRes = await request.post(`${API}/tasks`, {
      headers,
      data: {
        title: `Skip-audit E2E ${Date.now()}`,
        assignedTo: user.id,
        assignedBy: user.id,
        priority: 'Low',
        status: 'Open',
        organizationId: tenants[0]?.organizationId || tenantId,
        tenantId,
      },
    });
    const created = await createRes.json();

    const auditRes = await request.get(
      `${API}/audit-logs?entityType=Task&entityId=${created.id}&action=CREATE`,
      { headers: { Authorization: `Bearer ${access_token}`, 'X-Tenant-Id': tenantId } },
    );
    const logs = await auditRes.json();
    expect(logs.length).toBe(1);

    await request.delete(`${API}/tasks/${created.id}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
  });
});
