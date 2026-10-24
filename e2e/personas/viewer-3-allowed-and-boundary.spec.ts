import { test, expect } from '@playwright/test';
import { PLANTS } from './support/admin-helpers';
import { readFile } from 'node:fs/promises';
import {
  DEMO, DEMO2, DEMO_HEADER, PARTNER, VIEWERS, apiLogin, call, command, loginAsViewerInDemoPlant, note, plantTrigger,
  readOnlyBadge, tag, uiLogin, unitsOf, type ApiErrorBody, type ListBody, type UnitView, type ViewerSession,
} from './support/viewer-world';
import { expandTreeNode, openPlantTree } from './support/admin-helpers';

/**
 * VIEWER persona — journeys 4, 5 and 7.
 * J4 Kenji: the `@ReadOnlyAllowed` routes work for a viewer — a report export (POST /v2/exports) requested
 *    from Reports and downloaded as CSV; a calendar preview and a rule validation (nothing stored); a
 *    client-side audit entry with `X-Client-Audited`.
 * J5 Nadia: the scope boundary — Partner Plant is not offered; a stored foreign selection is dropped on
 *    reload (with and without organizationId); the API refuses Partner Plant with TENANT_NOT_ALLOWED.
 * J7 Kenji: `GET /users` is admin-only (403); `GET /users/assignable` is {id, name} only.
 */
interface ExportJob {
  id: string;
  reportType: string;
  state: string;
  status: string;
  filters: { from: string | null; to: string | null; unitIds: string[] | null };
}

interface CalendarVersion {
  id: string;
  unitId: string | null;
  state: string;
}

let kenji: ViewerSession;
let nadia: ViewerSession;
let demoUnits: UnitView[];

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const SELECTION_KEY = (userId: string) => `proact.plantSelection.${userId}`;

test.describe('Viewer — read-only-allowed routes, scope boundary, user lists', () => {
  test.beforeAll(async () => {
    kenji = await apiLogin(VIEWERS.kenji);
    nadia = await apiLogin(VIEWERS.nadia);
    demoUnits = await unitsOf(kenji.token, DEMO.id);
  });

  test('A1 Kenji: requests a period-summary export from Reports (202) and downloads the CSV', async ({ page }) => {
    test.setTimeout(240_000);
    const jobs = await call<ListBody<ExportJob>>(kenji.token, 'GET', '/v2/exports?limit=50', undefined, DEMO_HEADER);
    expect(jobs.status).toBe(200);
    const sample = jobs.body.items.find(
      (job) => job.reportType === 'period_summary' && job.state === 'completed' && job.status === 'approved' && job.filters.from && job.filters.to && job.filters.unitIds?.length,
    );
    expect(sample, 'Demo Plant has a completed approved period-summary export whose scope the viewer can reuse').toBeTruthy();
    const scope = (sample as ExportJob).filters;
    const unit = (scope.unitIds as string[])[0];
    await loginAsViewerInDemoPlant(page, VIEWERS.kenji);
    const url = `/reports?from=${encodeURIComponent(scope.from as string)}&to=${encodeURIComponent(scope.to as string)}&window=P-VIEW&units=${unit}&approved=1`;
    await page.goto(url);
    await expect(page.getByTestId('reports-v2')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('report-oee')).toHaveAttribute('data-unit-ids', unit, { timeout: 60_000 });
    await page.getByTestId('report-type').selectOption('management');
    await page.getByTestId('report-view').selectOption('exports');
    const start = page.getByTestId('export-period-summary-start');
    await expect(start).toBeEnabled({ timeout: 60_000 });
    const accepted = page.waitForResponse((r) => r.url().endsWith('/v2/exports') && r.request().method() === 'POST');
    await start.click();
    const response = await accepted;
    expect(response.status()).toBe(202);
    expect(response.request().headers()['x-tenant-id']).toBe(DEMO.id);
    const job = page.getByTestId('export-period-summary-job');
    await expect(job).toHaveAttribute('data-state', 'completed', { timeout: 90_000 });
    const download = page.waitForEvent('download');
    await page.getByTestId('export-period-summary-download').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^traverse-forge-period_summary-.+\.csv$/);
    const csv = await readFile(await file.path(), 'utf8');
    expect(csv).toMatch(/status,approved/);
    expect(csv).toContain(unit);
    await page.screenshot({ path: test.info().outputPath('viewer-a1-export.png'), fullPage: true });
    // the job is the viewer's own and readable afterwards
    const jobId = ((await response.json()) as { jobId: string }).jobId;
    const stored = await call<ExportJob>(kenji.token, 'GET', `/v2/exports/${jobId}`, undefined, DEMO_HEADER);
    expect(stored.status).toBe(200);
    expect(stored.body.state).toBe('completed');
  });

  test('A2 Kenji (API): calendar preview, rule validation and a client audit entry are allowed for a viewer', async () => {
    const versions = await call<ListBody<CalendarVersion>>(kenji.token, 'GET', '/v2/calendar-versions?limit=50', undefined, DEMO_HEADER);
    expect(versions.status).toBe(200);
    const published = versions.body.items.find((version) => version.state === 'published' && version.unitId);
    if (published) {
      const preview = await call<Record<string, unknown>>(kenji.token, 'POST', '/v2/calendars/preview', {
        unitId: published.unitId, localFrom: '2026-10-12', localTo: '2026-10-14', candidateVersionId: published.id,
      }, DEMO_HEADER);
      expect(preview.status, JSON.stringify(preview.body)).toBe(200);
      expect(preview.body).toHaveProperty('instances');
    } else {
      note(test.info(), 'observation', 'No published unit calendar in Demo Plant: the calendar preview was not exercised.');
    }
    const validate = await call<{ valid?: boolean } & ApiErrorBody>(kenji.token, 'POST', '/v2/rules/validate', {
      kind: 'coding_default', definition: {},
    }, DEMO_HEADER);
    expect(validate.status, JSON.stringify(validate.body)).toBe(200);
    expect(validate.body).toHaveProperty('valid');

    const entry = await call<{ id: string; userId: string; tenantId: string | null; action: string }>(kenji.token, 'POST', '/audit-logs', {
      action: 'VIEW', entityType: 'Report', entityId: DEMO.id, details: `${tag('A2')} viewer opened Reports`, userName: 'Kenji Nakamura',
    }, { ...DEMO_HEADER, 'X-Client-Audited': 'true' });
    expect(entry.status, JSON.stringify(entry.body)).toBe(201);
    expect(entry.body.userId).toBe(kenji.userId);
    expect(entry.body.tenantId).toBe(DEMO.id);
    expect(entry.body.action).toBe('VIEW');
  });

  test('B1 Nadia: Partner Plant is not offered; a stored foreign selection is dropped on reload; the API refuses it', async ({ page }) => {
    await uiLogin(page, VIEWERS.nadia);
    const tree = await openPlantTree(page);
    await expect(tree.getByText('Demo Org', { exact: true })).toBeVisible();
    await expandTreeNode(tree, 'Demo Org');
    await expect(tree.getByText(PLANTS.demo.name, { exact: true })).toBeVisible();
    await expect(tree.getByText('Demo Plant 2', { exact: true })).toBeVisible();
    await expect(tree.getByText('Partner Org', { exact: true })).toHaveCount(0);
    await expect(tree.getByText('Partner Plant', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('viewer-b1-selector.png') });
    await page.keyboard.press('Escape');

    const key = SELECTION_KEY(nadia.userId);
    const foreign = (organizationId: string | null) => ({
      organization: organizationId ? { id: organizationId, name: 'Partner Org', code: 'partner-org' } : undefined,
      tenant: { id: PARTNER.id, name: PARTNER.name, code: 'partner-plant', organizationId: organizationId ?? undefined, isActive: true },
    });
    for (const organizationId of ['00000000-0000-4000-8000-00000000aaaa', null]) {
      await page.evaluate(([storageKey, value]) => window.localStorage.setItem(storageKey, value), [key, JSON.stringify(foreign(organizationId))]);
      await page.reload();
      await expect(page.getByRole('banner')).toBeVisible({ timeout: 30_000 }); // the dashboard adds a second <header>
      await expect(plantTrigger(page)).toContainText('Demo Plant 2', { timeout: 30_000 });
      await expect(page.getByTestId('plant-access-refused')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('Partner Plant');
      await expect(readOnlyBadge(page)).toHaveCount(0);
      const stored = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key);
      expect(stored ?? '').not.toContain(PARTNER.id);
      note(test.info(), 'observation', `stored Partner Plant selection ${organizationId ? 'with' : 'without'} organizationId: dropped on reload, home plant restored`);
    }
    await page.screenshot({ path: test.info().outputPath('viewer-b1-after-foreign-selection.png') });

    for (const path of ['/v2/feature-flags', '/v2/units?limit=1', '/v2/production-events?limit=1']) {
      const refused = await call<ApiErrorBody>(nadia.token, 'GET', path, undefined, { 'X-Tenant-Id': PARTNER.id });
      expect(refused.status, path).toBe(403);
      expect(refused.body.code, path).toBe('TENANT_NOT_ALLOWED');
    }
    const write = await command<ApiErrorBody & { id?: string }>(nadia.token, '/v2/production-events', {
      unitId: demoUnits[0].id, startTime: '2026-10-05T06:00:00.000Z', durationSeconds: 60, physicalType: 'downtime', description: tag('B1'),
    }, { 'X-Tenant-Id': PARTNER.id });
    expect(write.status).toBe(403);
    expect(write.body.code).toBe('TENANT_NOT_ALLOWED');
    expect(write.body).not.toHaveProperty('id');
  });

  test('U1 Kenji (API): GET /users is refused; GET /users/assignable lists {id, name} only', async () => {
    const asViewer = await call<ApiErrorBody>(kenji.token, 'GET', '/users', undefined, DEMO_HEADER);
    expect(asViewer.status).toBe(403);
    expect(asViewer.body).not.toBeInstanceOf(Array);
    const asOperator = await call<ApiErrorBody>(kenji.token, 'GET', '/users');
    expect(asOperator.status).toBe(403);
    note(test.info(), 'observation', `GET /users refusal codes: viewer=${asViewer.body.code ?? '-'}, home operator=${asOperator.body.code ?? '-'}`);

    for (const headers of [DEMO_HEADER, {}]) {
      const assignable = await call<Array<Record<string, unknown>>>(kenji.token, 'GET', '/users/assignable', undefined, headers);
      expect(assignable.status).toBe(200);
      expect(Array.isArray(assignable.body)).toBe(true);
      expect(assignable.body.length).toBeGreaterThan(0);
      for (const user of assignable.body) {
        expect(Object.keys(user).sort()).toEqual(['id', 'name']);
        expect(JSON.stringify(user)).not.toMatch(/@|passwordHash|\$2[aby]\$/);
      }
    }
    // the list is the acting plant's: the home plant lists Kenji himself, Demo Plant does not have to
    const home = await call<Array<{ id: string }>>(kenji.token, 'GET', '/users/assignable', undefined, { 'X-Tenant-Id': DEMO2.id });
    expect(home.body.some((user) => user.id === kenji.userId)).toBe(true);
  });
});
