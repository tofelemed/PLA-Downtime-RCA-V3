import { test, expect } from '@playwright/test';
import {
  PLANTS,
  PREFIX,
  USERS,
  apiLogin,
  call,
  flagOn,
  note,
  openDialog,
  selectPlant,
  signIn,
  suffix,
  type ApiSession,
  type Plant,
} from './support/admin-helpers';

/**
 * Admin persona — journeys 7 and 8: legacy screens for a flag-off plant, then a flag switch.
 * Partner Plant has every v2 flag off: Lucas (Partner OrgAdmin) sees the v1 Event Hub, creates a v1
 * event there and keeps it, and sees the v1 RCA module and v1 Connectivity. Then Helena switches
 * `v2.eventHub` ON for Partner Plant (there is no screen for flags, so through the API) and the v2
 * hub appears for both users. The flag is left on (owner requirement: never switch a flag off), so a
 * second run of ADM-07 finds the v2 hub and creates the v1 event through the v1 API instead; the v1
 * create dialog (ADM-07b) is then exercised on an "E2E Test Tenant …" plant whose flag is still off.
 */
interface V1Event {
  id: string;
  description: string;
  tenantId: string;
  unitId: string;
  source: string;
}

const EVENT_DESCRIPTION = `${PREFIX}v1 event ${suffix()}`;

/** The v1 "Production Output" create: the only v1 event type that needs no impact / OEE / reason codes. */
async function createV1EventViaApi(lucas: ApiSession): Promise<void> {
  const units = await call<Array<{ id: string; name: string }>>(lucas.token, 'GET', '/units');
  const unit = units.body.find((row) => row.name === 'Partner Line 1');
  expect(unit).toBeTruthy();
  const created = await call<V1Event>(lucas.token, 'POST', '/production-events', {
    eventId: `MAN-${Date.now()}`,
    unitId: unit?.id,
    description: EVENT_DESCRIPTION,
    startTime: new Date(Date.now() - 60 * 60_000).toISOString(),
    source: 'Manual',
    status: 'Open',
    tenantId: PLANTS.partner.id,
    eventType: 'ProductionOutput',
    quantity: 10,
    operatorName: 'Lucas Ferreira',
    shift: 'Day',
    crew: 'P-ADM crew',
  });
  expect(created.status).toBe(201);
}

/**
 * The first "E2E Test Tenant …" plant (by name) whose `v2.eventHub` is off, with its organisation name for
 * the plant selector; null when every such plant already has the v2 hub.
 */
async function flagOffE2ePlant(helena: ApiSession): Promise<Plant | null> {
  const tenants = await call<Array<{ id: string; name: string; organizationId: string }>>(helena.token, 'GET', '/tenants');
  const organizations = await call<Array<{ id: string; name: string }>>(helena.token, 'GET', '/organizations');
  expect(tenants.status).toBe(200);
  expect(organizations.status).toBe(200);
  const candidates = tenants.body.filter((tenant) => tenant.name.startsWith('E2E Test Tenant')).sort((a, b) => a.name.localeCompare(b.name));
  for (const tenant of candidates) {
    if (await flagOn(helena.token, tenant.id, 'v2.eventHub')) continue;
    const org = organizations.body.find((organization) => organization.id === tenant.organizationId)?.name;
    if (org) return { id: tenant.id, name: tenant.name, org };
  }
  return null;
}

test.describe('ADM-07 legacy screens on Partner Plant (flags off)', () => {
  test('ADM-07a /events shows the one (v2) Event Hub whatever the flag says; a v1 API event is created and kept', async ({ page }) => {
    test.setTimeout(180_000);
    const lucas = await apiLogin(USERS.lucas);
    await signIn(page, USERS.lucas);
    await page.goto('/events');
    // owner decision: one version of the application; the v1 Event Hub page was retired
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Event Hub', level: 1 })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('adm-07a-event-hub.png'), fullPage: true });
    await createV1EventViaApi(lucas);
    const events = await call<V1Event[]>(lucas.token, 'GET', `/production-events?tenantId=${PLANTS.partner.id}`);
    expect(events.status).toBe(200);
    const kept = events.body.find((event) => event.description === EVENT_DESCRIPTION);
    expect(kept).toBeTruthy();
    expect(kept?.tenantId).toBe(PLANTS.partner.id);
    expect(kept?.source).toBe('Manual');
  });

  test('ADM-07b a plant with v2.eventHub off also gets the v2 hub and its event form page (no v1 dialog)', async ({ page }) => {
    test.setTimeout(180_000);
    const helena = await apiLogin(USERS.helena);
    const legacyPlant = await flagOffE2ePlant(helena);
    test.skip(!legacyPlant, 'no "E2E Test Tenant" plant with v2.eventHub off exists');
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await signIn(page, USERS.helena);
    await selectPlant(page, legacyPlant!);
    await page.goto('/events');
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: 'New event' }).click();
    await expect(page.getByTestId('event-form')).toBeVisible();
    await expect(page).toHaveURL(/\/events\/new/);
    await page.goBack();
    await expect(page.getByTestId('event-hub-v2')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('ADM-07c /rca and /connectivity have one version each, whatever the flags say', async ({ page }) => {
    await signIn(page, USERS.lucas);
    // RCA has one version (owner decision): the v2 case list, even with v2.rca off in Partner Plant
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Root cause analysis', level: 1 })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('adm-07c-rca.png'), fullPage: true });
    // Connectivity has one version (owner decision): the integration console, whatever the flag says
    await page.goto('/connectivity');
    await expect(page.getByRole('heading', { name: 'Connectivity', level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('integration-console')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('adm-07c-connectivity.png'), fullPage: true });
  });
});

test.describe('ADM-08 feature flag switch for Partner Plant', () => {
  test('ADM-08a SuperAdmin turns v2.eventHub on for Partner Plant and the v2 hub appears (left on)', async ({ page }) => {
    test.setTimeout(180_000);
    const helena = await apiLogin(USERS.helena);
    note(
      test.info(),
      'observation',
      'There is no feature-flag screen; the flag is switched through PUT /api/v2/feature-flags/{key} with X-Tenant-Id (plan 3.1 step 5).',
    );
    const switched = await call<{ key: string; enabled: boolean }>(helena.token, 'PUT', '/v2/feature-flags/v2.eventHub', { enabled: true }, {
      'X-Tenant-Id': PLANTS.partner.id,
    });
    expect(switched.status).toBe(200);
    expect(switched.body.enabled).toBe(true);
    expect(await flagOn(helena.token, PLANTS.partner.id, 'v2.eventHub')).toBe(true);
    // the other Partner Plant flags stay off and Demo Org's plants are untouched
    expect(await flagOn(helena.token, PLANTS.partner.id, 'v2.rca')).toBe(false);
    expect(await flagOn(helena.token, PLANTS.demo.id, 'v2.eventHub')).toBe(true);

    await signIn(page, USERS.helena);
    await selectPlant(page, PLANTS.partner);
    await page.goto('/events');
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('filter-units').click();
    const options = openDialog(page);
    await expect(options.getByText('Partner Line 1', { exact: true })).toBeVisible();
    await expect(options.getByText('Line 1', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: test.info().outputPath('adm-08a-partner-v2-hub.png'), fullPage: true });
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible(); // one RCA version, the flag only selects server triggers
  });

  test('ADM-08b the Partner OrgAdmin now sees the v2 hub; an OrgAdmin cannot flip flags of another organisation', async ({ page }) => {
    await signIn(page, USERS.lucas);
    await page.goto('/events');
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    const isabel = await apiLogin(USERS.isabel);
    const refused = await call<{ code?: string }>(isabel.token, 'PUT', '/v2/feature-flags/v2.rca', { enabled: true }, { 'X-Tenant-Id': PLANTS.partner.id });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('TENANT_NOT_ALLOWED');
    const helena = await apiLogin(USERS.helena);
    expect(await flagOn(helena.token, PLANTS.partner.id, 'v2.rca')).toBe(false);
  });
});
