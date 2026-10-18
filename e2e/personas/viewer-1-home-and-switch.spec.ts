import { test, expect } from '@playwright/test';
import { PLANTS } from './support/admin-helpers';
import {
  DEMO, DEMO2, DEMO_HEADER, MINUTE, OPERATOR_HIDDEN, OPERATOR_MENU, VIEWERS, VIEWER_HIDDEN, VIEWER_MENU,
  apiLogin, call, chooseUnit, eventRow, expectMenu, note, openHub, plantLocal, plantTimezoneOf, plantTrigger,
  readOnlyBadge, selectPlant, signOut, tag, trackV2Calls, uiLogin, unitOptionsOf, unitsOf, type ListBody,
  type UnitView, type ViewerSession,
} from './support/viewer-world';
import { backToList, fillPlantTime } from './support/event-hub-ui';

/**
 * VIEWER persona — journeys 1, 2 and 6 (docs/DEMO_PERSONAS.md): a viewer is an Operator in its home plant
 * (Demo Plant 2) and holds exactly a `viewer` scope in Demo Plant.
 * J1 Grace lands in Demo Plant 2 with the operator menu and records one event there (`P-VIEW-`).
 * J2 Grace switches to Demo Plant: the read menus, the "Read-only" badge, and every analytical screen shows
 *    Demo Plant data (unit names verified against the API with `X-Tenant-Id`).
 * J6 The selection survives a re-login; Pedro, a second viewer, sees the same read-only state.
 */
interface EventBody {
  id: string;
  unitId: string;
  description: string | null;
  isOpen: boolean;
  tenantId: string;
}

let grace: ViewerSession;
let demoUnits: UnitView[];
let homeUnits: UnitView[];

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('Viewer — home plant, plant switch, persistence', () => {
  test.beforeAll(async () => {
    grace = await apiLogin(VIEWERS.grace);
    expect(grace.homeTenantId).toBe(DEMO2.id);
    expect(grace.scopes.map((scope) => `${scope.tenantId}:${scope.role}`)).toContain(`${DEMO.id}:viewer`);
    demoUnits = await unitsOf(grace.token, DEMO.id);
    homeUnits = await unitsOf(grace.token, DEMO2.id);
    expect(demoUnits.length).toBeGreaterThan(0);
    expect(homeUnits.map((unit) => unit.code)).toContain('DP2-LINE-1');
  });

  test('J1 Grace: home plant Demo Plant 2, operator menu, no badge, records a P-VIEW- event on Line 1', async ({ page }) => {
    const label = tag('J1');
    const line1 = homeUnits.find((unit) => unit.code === 'DP2-LINE-1') as UnitView;
    await uiLogin(page, VIEWERS.grace);
    await expect(plantTrigger(page)).toContainText('Demo Plant 2');
    await expect(readOnlyBadge(page)).toHaveCount(0);
    await expectMenu(page, OPERATOR_MENU, OPERATOR_HIDDEN);

    await openHub(page, line1.name);
    await page.getByRole('link', { name: 'New event' }).click();
    const form = page.getByTestId('event-form');
    await expect(form.locator('#unitId')).toHaveValue(line1.id);
    const timezone = await plantTimezoneOf(form);
    await fillPlantTime(form, 'Start', plantLocal(new Date(Date.now() - 40 * MINUTE), timezone));
    await fillPlantTime(form, 'End (empty = still ongoing)', plantLocal(new Date(Date.now() - 10 * MINUTE), timezone));
    await form.locator('#description').fill(label);
    const created = page.waitForResponse((r) => r.url().endsWith('/v2/production-events') && r.request().method() === 'POST');
    await form.getByRole('button', { name: 'Save' }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    expect(response.request().headers()['x-tenant-id']).toBe(DEMO2.id);
    const event = (await response.json()) as EventBody;
    await expect(form).toBeHidden();
    await backToList(page);
    await expect(eventRow(page, event.id)).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('viewer-j1-home-event.png'), fullPage: true });

    // the API (home tenant, no header) and a reload agree
    const stored = await call<EventBody>(grace.token, 'GET', `/v2/production-events/${event.id}`);
    expect(stored.status).toBe(200);
    expect(stored.body).toMatchObject({ unitId: line1.id, description: label, isOpen: false, tenantId: DEMO2.id });
    await page.reload();
    await openHub(page, line1.name);
    // the row names the unit and the ended state (the description is shown in the detail drawer, not the row)
    await expect(eventRow(page, event.id)).toContainText(line1.name);
    await expect(eventRow(page, event.id)).toContainText('Ended');
  });

  test('J2 Grace: switch to Demo Plant → read menus, Read-only badge, every screen shows Demo Plant data', async ({ page }) => {
    test.setTimeout(300_000);
    const calls = trackV2Calls(page);
    const demoNames = new Set(demoUnits.map((unit) => unit.name));
    const homeNames = homeUnits.map((unit) => unit.name);
    await uiLogin(page, VIEWERS.grace);
    await selectPlant(page, DEMO);
    const switchedAt = calls.length;
    await expect(readOnlyBadge(page)).toBeVisible();
    await expect(readOnlyBadge(page)).toHaveAttribute('title', /read-only/i);
    await expectMenu(page, VIEWER_MENU, VIEWER_HIDDEN);
    await page.screenshot({ path: test.info().outputPath('viewer-j2-badge-menu.png') });

    const expectDemoUnits = async (filterTestId = 'filter-units') => {
      const offered = await unitOptionsOf(page, filterTestId);
      expect(offered.length).toBeGreaterThan(0);
      // other personas create Demo Plant units while this runs: compare with the list as it is now
      const now = new Set((await unitsOf(grace.token, DEMO.id)).map((unit) => unit.name));
      for (const name of offered) expect(now.has(name) || demoNames.has(name), `${name} must be a Demo Plant unit`).toBe(true);
      for (const name of homeNames) expect(offered, `${name} belongs to Demo Plant 2`).not.toContain(name);
    };

    await page.goto('/dashboard');
    await expect(page.getByTestId('analytics-dashboard')).toBeVisible({ timeout: 60_000 });
    await page.goto('/downtime');
    await expect(page.getByTestId('downtime-analysis')).toBeVisible({ timeout: 60_000 });
    await expectDemoUnits();
    await page.goto('/pla-analytics');
    await expect(page.getByTestId('pla-analytics-v2')).toBeVisible({ timeout: 60_000 });
    await expectDemoUnits();
    await page.goto('/reports');
    await expect(page.getByTestId('reports-v2')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('report-oee')).toBeVisible({ timeout: 60_000 });
    await openHub(page, null);
    await expectDemoUnits();
    // a Demo Plant unit's events list as the server gives them for that plant
    const withEvents = await call<ListBody<EventBody>>(grace.token, 'GET', '/v2/production-events?limit=1', undefined, DEMO_HEADER);
    expect(withEvents.status).toBe(200);
    const sample = withEvents.body.items[0];
    if (sample) {
      const unit = demoUnits.find((entry) => entry.id === sample.unitId);
      expect(unit, 'the sample event belongs to a Demo Plant unit').toBeTruthy();
      const filtered = page.waitForResponse((r) => r.url().includes('/v2/production-events?') && new URL(r.url()).searchParams.getAll('unitIds').includes((unit as UnitView).id));
      await chooseUnit(page, (unit as UnitView).name);
      await filtered; // the previous (unfiltered) list stays on screen until the filtered one answers
      const rows = page.locator('tr', { has: page.getByTestId('event-row') }); // table rows: the unit is its own column
      await expect(rows.first()).toContainText((unit as UnitView).name);
      const count = await rows.count();
      for (let i = 0; i < Math.min(count, 10); i += 1) await expect(rows.nth(i)).toContainText((unit as UnitView).name);
      note(test.info(), 'observation', `Event Hub rows in the default window for ${(unit as UnitView).name}: ${count}`);
    }
    await page.screenshot({ path: test.info().outputPath('viewer-j2-event-hub.png'), fullPage: true });
    // after the switch every v2 request that names a plant names Demo Plant; the ones without a header are listed
    const afterSwitch = calls.slice(switchedAt);
    expect(afterSwitch.length).toBeGreaterThan(0);
    // on every full page load the flag bootstrap first asks for the home plant (before the saved selection is
    // restored); that is a transient of the session tenant, not a data read of another plant: listed, not failed
    // the session bootstrap does the same for the user's own records: the home plant and organisation
    // (AuthContext), the plant directories of the selector and the application-wide branding
    const sessionReads = /^\/api\/v2\/(feature-flags|branding|tenants|organizations)(\/[0-9a-f-]{36})?$/;
    const isOwnRecord = (url: string) => !url.startsWith('/api/v2/tenants/') || url.endsWith(DEMO2.id);
    const bootstrap = afterSwitch.filter((entry) => entry.method === 'GET' && entry.tenant === DEMO2.id && sessionReads.test(entry.url) && isOwnRecord(entry.url));
    if (bootstrap.length > 0) {
      const kinds = [...new Set(bootstrap.map((entry) => entry.url.replace(/[0-9a-f-]{36}/, ':id')))].join(', ');
      note(test.info(), 'observation', `session bootstrap reads sent for the home plant ${bootstrap.length}× after the switch (per full page load, before the stored selection is applied): ${kinds}`);
    }
    const foreign = afterSwitch.filter((entry) => entry.tenant && entry.tenant !== DEMO.id && !bootstrap.includes(entry));
    expect(foreign, 'v2 data requests that named another plant').toEqual([]);
    const headerless = [...new Set(afterSwitch.filter((entry) => !entry.tenant).map((entry) => `${entry.method} ${entry.url}`))];
    if (headerless.length > 0) note(test.info(), 'observation', `v2 requests sent without X-Tenant-Id after the switch: ${headerless.join(', ')}`);
    expect(afterSwitch.some((entry) => entry.tenant === DEMO.id)).toBe(true);
  });

  test('J6 Grace: the Demo Plant selection survives logout and login; Pedro sees the same read-only state', async ({ page }) => {
    await uiLogin(page, VIEWERS.grace);
    await selectPlant(page, DEMO);
    await signOut(page);
    await uiLogin(page, VIEWERS.grace);
    await expect(plantTrigger(page)).toContainText(PLANTS.demo.name);
    await expect(plantTrigger(page)).not.toContainText('Demo Plant 2');
    await expect(readOnlyBadge(page)).toBeVisible();
    await page.reload();
    await expect(readOnlyBadge(page)).toBeVisible();
    await expectMenu(page, VIEWER_MENU, VIEWER_HIDDEN);

    // a second viewer in the same browser starts from his own home plant, then holds the same viewer rights
    await signOut(page);
    await uiLogin(page, VIEWERS.pedro);
    await expect(plantTrigger(page)).toContainText('Demo Plant 2');
    await expect(readOnlyBadge(page)).toHaveCount(0);
    await selectPlant(page, DEMO);
    await expect(readOnlyBadge(page)).toBeVisible();
    await expectMenu(page, VIEWER_MENU, VIEWER_HIDDEN);
    await page.goto('/downtime');
    await expect(page.getByTestId('downtime-analysis')).toBeVisible({ timeout: 60_000 });
    const offered = await unitOptionsOf(page);
    const demoNames = new Set((await unitsOf(grace.token, DEMO.id)).map((unit) => unit.name));
    expect(offered.length).toBeGreaterThan(0);
    for (const name of offered) expect(demoNames.has(name), `${name} must be a Demo Plant unit`).toBe(true);
    await page.screenshot({ path: test.info().outputPath('viewer-j6-pedro.png') });
  });
});
