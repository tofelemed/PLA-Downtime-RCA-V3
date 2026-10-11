import { test, expect } from '@playwright/test';
import {
  PLANTS,
  USERS,
  apiLogin,
  call,
  flagOn,
  note,
  openDialog,
  openPlantTree,
  plantTrigger,
  selectPlant,
  signIn,
  signOut,
  v2UnitNames,
  type ApiErrorBody,
  type Plant,
} from './support/admin-helpers';

/**
 * Admin persona — journeys 1 and 2: plant switching and tenant isolation.
 * SuperAdmin (Helena, Marcus, Priya, Tomasz) switches between Demo Plant, Demo Plant 2 and Partner
 * Plant; every plant shows only its own units and events; the selection survives a re-login and is
 * kept per user. OrgAdmin (Isabel, Demo Org) can switch to Demo Plant 2, is never offered Partner Plant,
 * and a stale stored Partner selection ends in the access notice with a way home; the Partner OrgAdmin
 * (Lucas) sees only Partner Org / Partner Plant and gets the scoped not-found for Demo Plant data.
 */
const ORDER: Plant[] = [PLANTS.demo, PLANTS.demo2, PLANTS.partner];
/** a unit of another plant that must never be listed for the plant under test */
const FOREIGN_UNIT: Record<string, string> = {
  [PLANTS.demo.id]: 'Partner Line 1',
  [PLANTS.demo2.id]: 'Partner Line 1',
  [PLANTS.partner.id]: 'Line 1',
};

interface UnitRow {
  id: string;
  name: string;
  tenantId: string;
}

test.describe('ADM-01 SuperAdmin plant switching', () => {
  test('ADM-01a each plant shows only its own units and events on /events', async ({ page }) => {
    test.setTimeout(240_000);
    const helena = await apiLogin(USERS.helena);
    const v2Tenants: string[] = [];
    const v1EventQueries: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/v2/production-events')) v2Tenants.push(request.headers()['x-tenant-id'] ?? '');
      if (/\/api\/production-events\?/.test(url)) v1EventQueries.push(url);
    });
    await signIn(page, USERS.helena);
    for (const plant of ORDER) {
      const ownUnits = await v2UnitNames(helena.token, plant.id);
      expect(ownUnits.length).toBeGreaterThan(0);
      await selectPlant(page, plant);
      await page.goto('/events');
      if (await flagOn(helena.token, plant.id, 'v2.eventHub')) {
        await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
        await page.getByTestId('filter-units').click();
        const options = openDialog(page);
        for (const name of ownUnits.slice(0, 3)) await expect(options.getByText(name, { exact: true })).toBeVisible();
        await expect(options.getByText(FOREIGN_UNIT[plant.id], { exact: true })).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect.poll(() => v2Tenants.at(-1)).toBe(plant.id);
      } else {
        // flags off: the v1 Event Hub, which reads the selected plant's events by tenantId
        await expect(page.getByRole('heading', { name: 'Event Hub' })).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('event-hub-v2')).toHaveCount(0);
        await expect
          .poll(() => v1EventQueries.some((url) => new URL(url).searchParams.get('tenantId') === plant.id))
          .toBe(true);
        note(test.info(), 'observation', `${plant.name}: v1 Event Hub shown (v2.eventHub off); its unit dropdown is not filtered by plant.`);
      }
    }
    await page.screenshot({ path: test.info().outputPath('adm-01a-partner-plant.png'), fullPage: true });
  });

  test('ADM-01b the plant selector tree lists each plant with only its own units', async ({ page }) => {
    await signIn(page, USERS.priya);
    const tree = await openPlantTree(page);
    await tree.getByText('Demo Org', { exact: true }).locator('xpath=..').locator('svg').first().click();
    const demo2Row = tree.getByText('Demo Plant 2', { exact: true }).locator('xpath=..');
    await demo2Row.locator('svg').first().click();
    await expect(tree.getByText('Line 1', { exact: true })).toBeVisible();
    await expect(tree.getByText('Line 2', { exact: true })).toBeVisible();
    await expect(tree.getByText('Partner Line 1', { exact: true })).toHaveCount(0);
    await tree.getByText('Partner Org', { exact: true }).locator('xpath=..').locator('svg').first().click();
    await tree.getByText('Partner Plant', { exact: true }).locator('xpath=..').locator('svg').first().click();
    await expect(tree.getByText('Partner Line 1', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('ADM-01c the selection persists after re-login and is kept per user', async ({ page }) => {
    await signIn(page, USERS.helena);
    await selectPlant(page, PLANTS.demo2);
    await signOut(page);
    await signIn(page, USERS.helena);
    await expect(plantTrigger(page)).toContainText('Demo Plant 2');
    await page.reload();
    await expect(plantTrigger(page)).toContainText('Demo Plant 2');
    // another SuperAdmin in the same browser starts from his own home plant, not from Helena's choice
    await signOut(page);
    await signIn(page, USERS.marcus);
    await expect(plantTrigger(page)).toContainText('Demo Plant');
    await expect(plantTrigger(page)).not.toContainText('Demo Plant 2');
  });

  test('ADM-01d selecting a plant that does not exist is refused by the API (TENANT_NOT_ALLOWED)', async () => {
    const tomasz = await apiLogin(USERS.tomasz);
    const missing = await call<ApiErrorBody>(tomasz.token, 'GET', '/v2/feature-flags', undefined, {
      'X-Tenant-Id': '00000000-0000-4000-8000-000000000000',
    });
    expect(missing.status).toBe(403);
    expect(missing.body.code).toBe('TENANT_NOT_ALLOWED');
  });
});

test.describe('ADM-02 OrgAdmin plant isolation', () => {
  test('ADM-02a Demo Org OrgAdmin switches to Demo Plant 2; Partner Plant is refused', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, USERS.isabel);
    await selectPlant(page, PLANTS.demo2);
    await page.goto('/events');
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('filter-units').click();
    await expect(openDialog(page).getByText('Line 1', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // API: acting on Partner Plant is refused, and the v1 unit list never shows Partner Plant's units
    const isabel = await apiLogin(USERS.isabel);
    const refused = await call<ApiErrorBody>(isabel.token, 'GET', '/v2/feature-flags', undefined, { 'X-Tenant-Id': PLANTS.partner.id });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('TENANT_NOT_ALLOWED');
    const units = await call<UnitRow[]>(isabel.token, 'GET', '/units');
    expect(units.status).toBe(200);
    expect(units.body.some((unit) => unit.tenantId === PLANTS.partner.id)).toBe(false);
    expect(units.body.some((unit) => unit.tenantId === PLANTS.demo2.id)).toBe(true);

    // (a) the selector offers only the plants of the OrgAdmin's own organisation: no Partner Org / Plant at all
    const tree = await openPlantTree(page);
    await expect(tree.getByText('Demo Org', { exact: true })).toBeVisible();
    await expect(tree.getByText('Partner Org', { exact: true })).toHaveCount(0);
    await expect(tree.getByText('Partner Plant', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('adm-02a-isabel-selector.png') });
    await page.keyboard.press('Escape');

    // (b) a selection of Partner Plant stored before the organisation check existed (no organizationId on the
    // stored tenant, so the browser leaves it to the server): the server's 403 TENANT_NOT_ALLOWED becomes the
    // access notice with a way back to the home plant — never an endless "Loading" or an empty menu
    const storedKey = `proact.plantSelection.${isabel.user.id}`;
    const foreign = JSON.stringify({ tenant: { id: PLANTS.partner.id, name: PLANTS.partner.name } });
    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [storedKey, foreign]);
    await page.goto('/events');
    const accessNotice = page.getByTestId('plant-access-refused');
    await expect(accessNotice).toBeVisible({ timeout: 60_000 });
    await expect(accessNotice).toContainText('You do not have access to this plant');
    await expect(accessNotice).toContainText(PLANTS.partner.name);
    await expect(page.getByText(/Unexpected Application Error|Something went wrong/i)).toHaveCount(0);
    await expect(page.locator('[data-testid="event-row"]')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('adm-02a-partner-refused.png'), fullPage: true });
    await accessNotice.getByRole('button', { name: /Switch to my plant/ }).click();
    await expect(accessNotice).toBeHidden();
    await expect(plantTrigger(page)).toContainText(PLANTS.demo.name);
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    // the recovery is what the browser keeps: a reload starts on the home plant
    await page.reload();
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plant-access-refused')).toHaveCount(0);
    await expect(plantTrigger(page)).toContainText(PLANTS.demo.name);
  });

  test('ADM-02b Partner OrgAdmin sees only Partner Org and Partner Plant', async ({ page }) => {
    // the v1 lists behind the selector are organisation-scoped for an OrgAdmin
    const lucas = await apiLogin(USERS.lucas);
    const tenants = await call<Array<{ id: string; name: string }>>(lucas.token, 'GET', '/tenants');
    expect(tenants.status).toBe(200);
    expect(tenants.body.map((tenant) => tenant.name)).toEqual([PLANTS.partner.name]);
    const organizations = await call<Array<{ id: string; name: string }>>(lucas.token, 'GET', '/organizations');
    expect(organizations.status).toBe(200);
    expect(organizations.body.map((organization) => organization.name)).toEqual([PLANTS.partner.org]);

    await signIn(page, USERS.lucas);
    await expect(plantTrigger(page)).toContainText('Partner Plant');
    const tree = await openPlantTree(page);
    await expect(tree.getByText('Partner Org', { exact: true })).toBeVisible();
    await tree.getByText('Partner Org', { exact: true }).locator('xpath=..').locator('svg').first().click();
    await expect(tree.getByText('Partner Plant', { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('adm-02b-lucas-selector.png') });
    await expect(tree.getByText('Demo Org', { exact: true })).toHaveCount(0);
    await expect(tree.getByText('Demo Plant', { exact: true })).toHaveCount(0);
    await expect(tree.getByText('Demo Plant 2', { exact: true })).toHaveCount(0);
  });

  test('ADM-02c Partner OrgAdmin deep link to Demo Plant data is the scoped not-found', async ({ page }) => {
    const helena = await apiLogin(USERS.helena);
    const demoEvents = await call<{ items: Array<{ id: string }> }>(helena.token, 'GET', '/v2/production-events?limit=1', undefined, {
      'X-Tenant-Id': PLANTS.demo.id,
    });
    const demoEventId = demoEvents.body.items[0]?.id;
    expect(demoEventId).toBeTruthy();
    const demoPlans = await call<Array<{ id: string; name: string }>>(helena.token, 'GET', `/production-plans?tenantId=${PLANTS.demo.id}`);
    const demoPlan = demoPlans.body[0];

    const lucas = await apiLogin(USERS.lucas);
    const scoped = await call<ApiErrorBody>(lucas.token, 'GET', `/v2/production-events/${demoEventId}`, undefined, {
      'X-Tenant-Id': PLANTS.partner.id,
    });
    expect(scoped.status).toBe(404);
    expect(scoped.body.code).toBe('NOT_FOUND');
    const asDemo = await call<ApiErrorBody>(lucas.token, 'GET', `/v2/production-events/${demoEventId}`, undefined, {
      'X-Tenant-Id': PLANTS.demo.id,
    });
    expect(asDemo.status).toBe(403);
    expect(asDemo.body.code).toBe('TENANT_NOT_ALLOWED');

    await signIn(page, USERS.lucas);
    note(
      test.info(),
      'observation',
      'The v2 Event Hub has no event deep link (no URL parameter), so the event not-found UI is only reachable through the API; the plan deep link is checked in the browser.',
    );
    if (demoPlan) {
      await page.goto(`/plans/${demoPlan.id}`);
      await expect(page.getByTestId('plan-dashboard-off').or(page.locator('[role="alert"]')).first()).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('body')).not.toContainText(demoPlan.name);
      await page.screenshot({ path: test.info().outputPath('adm-02c-plan-deep-link.png'), fullPage: true });
    }
  });
});
