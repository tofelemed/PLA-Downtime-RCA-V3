import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PLANTS, USERS, apiLogin, call, note, signIn, type ApiErrorBody, type SessionUser } from './support/admin-helpers';

/**
 * Admin persona — journeys 9 and 10 (report-only checks).
 * 9: migration / cutover tooling is read-only and no legacy write freeze is active on any plant.
 * 10: security spot-checks as the Operator demo user: v1 GET/POST /api/users and POST /api/tenants are
 *     refused (403); GET /api/tenants lists only the operator's member plants. Probes never create
 *     anything: the POST bodies are invalid and would be 400 even past the role guard.
 */
interface Probe {
  route: string;
  status: number;
  code: string | undefined;
}

async function probe(token: string, method: string, path: string, body?: unknown): Promise<Probe> {
  const result = await call<ApiErrorBody | unknown[]>(token, method, path, body);
  const code = Array.isArray(result.body) ? `array(${result.body.length})` : (result.body as ApiErrorBody | undefined)?.code;
  return { route: `${method} ${path}`, status: result.status, code };
}

test.describe('ADM-09 cutover tooling and write freeze', () => {
  test('ADM-09a no migration report endpoint is exposed; no legacy write freeze is active', async ({ page }) => {
    const helena = await apiLogin(USERS.helena);
    for (const path of ['/migration/compare', '/migration-reports', '/v2/migration/reports', '/legacy-write-freezes']) {
      const result = await call<ApiErrorBody>(helena.token, 'GET', path);
      expect([404, 405]).toContain(result.status);
    }
    note(test.info(), 'observation', 'The v1 → v2 cutover is complete and its tooling (comparison, remediation, write freeze) is retired (2026-10-20); no HTTP endpoint and no UI shows a freeze or a report.');

    // a v1 write on every plant is accepted (a frozen plant answers 423 LEGACY_WRITES_FROZEN)
    const lucas = await apiLogin(USERS.lucas);
    const writes = [
      { who: helena.token, plant: PLANTS.demo, headers: {} },
      { who: helena.token, plant: PLANTS.demo2, headers: { 'X-Tenant-Id': PLANTS.demo2.id } },
      { who: lucas.token, plant: PLANTS.partner, headers: {} },
    ];
    for (const write of writes) {
      const result = await call<ApiErrorBody>(
        write.who,
        'POST',
        '/audit-logs',
        { action: 'P-ADM-FREEZE-CHECK', entityType: 'P-ADM-Probe', entityId: randomUUID(), details: `write-freeze check on ${write.plant.name}` },
        write.headers,
      );
      expect(result.status, write.plant.name).not.toBe(423);
      expect(result.body.code, write.plant.name).not.toBe('LEGACY_WRITES_FROZEN');
      expect(result.status, write.plant.name).toBe(201);
    }
    await signIn(page, USERS.helena);
    await expect(page.getByText(/frozen|write freeze/i)).toHaveCount(0);
  });
});

test.describe('ADM-10 security spot-checks as an Operator', () => {
  test('ADM-10a v1 /users refuses an Operator; /tenants lists only the member plants; writes are 403', async () => {
    const liam = await apiLogin(USERS.liam);
    expect(liam.user.role).toBe('Operator');
    const scopes = (liam.user as SessionUser & { scopes?: Array<{ tenantId: string }> }).scopes ?? [];
    const memberTenantIds = new Set([liam.user.tenantId, ...scopes.map((scope) => scope.tenantId)].filter(Boolean));
    const probes = [
      await probe(liam.token, 'GET', '/users'),
      await probe(liam.token, 'GET', '/tenants'),
      await probe(liam.token, 'POST', '/users', {}),
      await probe(liam.token, 'POST', '/tenants', {}),
    ];
    for (const result of probes) note(test.info(), 'security-probe', `${result.route} → ${result.status} ${result.code ?? ''}`);
    // the user list is for administrators and approvers; the writes are refused by the role guard before validation
    expect(probes[0].status, probes[0].route).toBe(403);
    expect(probes[0].code, probes[0].route).toBe('FORBIDDEN_ROLE');
    expect(probes[2].status, probes[2].route).toBe(403);
    expect(probes[3].status, probes[3].route).toBe(403);
    // the tenant list answers, but only with the plants the operator is a member of
    expect(probes[1].status, probes[1].route).toBe(200);
    const tenants = await call<Array<{ id: string; name: string }>>(liam.token, 'GET', '/tenants');
    const names = tenants.body.map((tenant) => tenant.name);
    expect(names).toContain(PLANTS.demo.name);
    expect(names).not.toContain(PLANTS.demo2.name);
    expect(names).not.toContain(PLANTS.partner.name);
    expect(tenants.body.every((tenant) => memberTenantIds.has(tenant.id)), `visible: ${names.join(', ')}`).toBe(true);
    // the invalid bodies created nothing
    const helena = await apiLogin(USERS.helena);
    const users = await call<Array<{ name: string | null; email: string | null }>>(helena.token, 'GET', '/users');
    expect(users.body.every((user) => user.email)).toBe(true);
  });

  test('ADM-10b an Operator is refused on the admin screens and cannot read the audit list', async ({ page }) => {
    test.setTimeout(120_000); // first visit compiles the lazy admin chunks on the dev server
    const liam = await apiLogin(USERS.liam);
    const adminApi = [
      await probe(liam.token, 'PUT', `/v2/feature-flags/v2.eventHub`, { enabled: true }),
      await probe(liam.token, 'POST', '/app-settings/branding/value', { value: { appSubtitle: 'P-ADM must not apply' } }),
    ];
    for (const result of adminApi) note(test.info(), 'security-probe', `${result.route} → ${result.status} ${result.code ?? ''}`);
    expect(adminApi[0].status).toBe(403);
    expect(adminApi[0].code).toBe('FORBIDDEN_ROLE');
    expect(adminApi[1].status).toBe(403);
    expect(adminApi[1].code).toBe('SETTING_NOT_WRITABLE');
    await signIn(page, USERS.liam);
    await page.goto('/admin');
    await expect(page.getByText("You don't have permission to access the admin panel.")).toBeVisible({ timeout: 60_000 });
    await page.goto('/master-data');
    await expect(page.getByRole('region', { name: 'Your pages' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Master data sections' }).getByRole('link', { name: 'Standby equipment' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Master data sections' }).getByRole('link', { name: 'Units', exact: true })).toHaveCount(0);
  });
});
