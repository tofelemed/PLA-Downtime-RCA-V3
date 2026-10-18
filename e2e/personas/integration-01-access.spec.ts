import { test, expect } from '@playwright/test';
import { PLANTS, expandTreeNode, openPlantTree, selectPlant } from './support/admin-helpers';
import { findCode } from '../test-utils/codes-world';
import { expectHidden, expectRefused } from './support/hidden-controls';
import { apiLogin, BROKER, call, command, CONSOLE_ADMIN, DEMO_EVENTS_CONNECTION, DEMO_PLANT, DEMO_PLANT_2, findConnection, findOnPages, INT_USERS, newSuffix, NOAH, openConsole, PREFIX, uiLogin } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — journeys 1 (menu and access), 8 (cross-plant) and 9 (refusals).
 * Owner 18 Oct 2026: Integration is SuperAdmin-only. The SuperAdmin sees Connectivity in the sidebar and
 * opens the integration console; an `integration_admin` (Elena) and a plain Engineer (Noah) have no such
 * menu item and a direct visit shows no console. The server rules are unchanged: Elena reads connections,
 * Noah's console writes are refused with 403 FORBIDDEN_ROLE. In Demo Plant 2 the SuperAdmin creates a
 * connection in its (empty) console and Diego, integration_admin there as well, reads it through the API;
 * Freya cannot select Demo Plant 2 at all.
 * Approvals, codes and feature flags are not an integration administrator's business: 403 FORBIDDEN_ROLE.
 */
const suffix = newSuffix();

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('Integration admin — access, cross-plant, refusals', () => {
  test('INT-01a (SuperAdmin): Connectivity is in the sidebar and opens the integration console', async ({ page }) => {
    await uiLogin(page, CONSOLE_ADMIN);
    const nav = page.locator('nav').first();
    await nav.getByRole('button', { name: 'Expand sidebar' }).click();
    const link = nav.getByRole('link', { name: 'Connectivity' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/connectivity/);
    await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('tab', { name: 'Quarantine' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Source mappings' })).toBeVisible();
    await findOnPages(page, page.getByTestId('connection-item').filter({ hasText: DEMO_EVENTS_CONNECTION }));
    await page.screenshot({ path: test.info().outputPath('int-01a-console.png'), fullPage: true });
  });

  test('INT-01c (elena): an integration admin has no Connectivity menu and a direct visit shows no console; the API still lists connections', async ({ page }) => {
    await uiLogin(page, INT_USERS.elena);
    const nav = page.locator('nav').first();
    await nav.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(nav.getByRole('link', { name: 'Event Hub' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Connectivity' })).toHaveCount(0);
    await page.goto('/connectivity');
    await expect(page.getByRole('heading', { name: 'Connectivity', level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('integration-console')).toHaveCount(0);
    const elena = await apiLogin(INT_USERS.elena);
    expect(await findConnection(elena.token, DEMO_EVENTS_CONNECTION), 'server rules unchanged: an integration admin reads connections').not.toBeNull();
  });

  test('INT-01b (noah): no Connectivity menu; a direct visit shows no console and the server refuses the test and a new connection (403 role)', async ({ page }) => {
    await uiLogin(page, NOAH);
    const nav = page.locator('nav').first();
    await nav.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(nav.getByRole('link', { name: 'Event Hub' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Connectivity' })).toHaveCount(0);
    // owner 18 Oct 2026: Integration is SuperAdmin-only
    await page.goto('/connectivity');
    await expect(page.getByRole('heading', { name: 'Connectivity', level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('integration-console')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('int-01b-noah-no-console.png'), fullPage: true });
    const noah = await apiLogin(NOAH);
    const demoEvents = await findConnection(noah.token, DEMO_EVENTS_CONNECTION);
    expect(demoEvents, 'the Demo events connection is readable by an engineer').not.toBeNull();
    expectRefused(await command(noah.token, `/v2/connections/${demoEvents?.id}/test`, {}), 'FORBIDDEN_ROLE');
    const create = await command<{ code: string }>(noah.token, '/v2/connections', {
      sourceType: 'mqtt',
      displayName: `${PREFIX}noah-refused-${suffix}`,
      endpointConfig: { mqtt: { brokerUrl: BROKER.plain, topics: [`test/p-int-noah-${suffix}/+/+/+/+/events`] }, payloadProfile: { kind: 'interval_event_json', topicTemplate: `test/p-int-noah-${suffix}/{site}/{area}/{line}/{unit}/events` } },
    });
    expect(create.status).toBe(403);
    expect(create.body.code).toBe('FORBIDDEN_ROLE');
    expect(await findConnection(noah.token, `${PREFIX}noah-refused-${suffix}`)).toBeNull();
  });

  test('INT-08a (SuperAdmin + diego): in Demo Plant 2 the console is empty, a connection is created there and Diego reads it in that plant only', async ({ page }) => {
    // owner 18 Oct 2026: Integration is SuperAdmin-only; the console UI runs as the SuperAdmin
    await uiLogin(page, CONSOLE_ADMIN);
    await selectPlant(page, PLANTS.demo2);
    await openConsole(page);
    await expect(page.getByTestId('connections-list')).toBeVisible();
    await expect(page.getByTestId('connection-item').filter({ hasText: DEMO_EVENTS_CONNECTION })).toHaveCount(0);
    const name = `${PREFIX}dp2-mqtt-${suffix}`;
    await page.getByTestId('new-connection').click();
    await page.getByTestId('source-type-mqtt').click();
    await page.fill('#mqtt-template', `test/p-int-dp2-${suffix}/{site}/{area}/{line}/{unit}/events`);
    await page.getByTestId('mqtt-next').click();
    await page.fill('#mqtt-name', name);
    await page.fill('#mqtt-broker', BROKER.plain);
    await page.fill('#mqtt-topics', `test/p-int-dp2-${suffix}/+/+/+/+/events`);
    await page.getByTestId('mqtt-next').click();
    await page.fill('#mqtt-user', BROKER.username);
    await page.fill('#mqtt-secret', BROKER.password);
    await page.getByTestId('mqtt-next').click();
    await page.getByTestId('connection-save').click();
    await expect(page.getByTestId('connection-detail')).toHaveAttribute('data-source-type', 'mqtt');
    await expect(page.getByTestId('connection-active')).toHaveText('Active');
    await page.screenshot({ path: test.info().outputPath('int-08a-demo-plant-2.png'), fullPage: true });
    const diego = await apiLogin(INT_USERS.diego);
    expect(diego.tenantId).toBe(DEMO_PLANT);
    const inPlant2 = await findConnection(diego.token, name, DEMO_PLANT_2);
    expect(inPlant2?.sourceType).toBe('mqtt');
    expect(inPlant2?.hasSecret).toBe(true);
    expect(await findConnection(diego.token, name, DEMO_PLANT)).toBeNull();
  });

  test('INT-08b (freya): Demo Plant 2 is not offered in the plant selector and is refused by the API (TENANT_NOT_ALLOWED)', async ({ page }) => {
    await uiLogin(page, INT_USERS.freya);
    // the tree lists organisations; plants show once the organisation is expanded through its chevron
    const tree = await openPlantTree(page);
    await expect(tree.getByText(PLANTS.demo.org, { exact: true })).toBeVisible();
    await expandTreeNode(tree, PLANTS.demo.org);
    await expect(tree.getByText(PLANTS.demo.name, { exact: true })).toBeVisible();
    await expect(tree.getByText(PLANTS.demo2.name, { exact: true })).toHaveCount(0);
    await expect(tree.getByText(PLANTS.partner.name, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('int-08b-freya-plants.png') });
    await page.keyboard.press('Escape');
    const freya = await apiLogin(INT_USERS.freya);
    const refused = await call<{ code: string }>(freya.token, 'GET', '/v2/connections?limit=5', undefined, { 'X-Tenant-Id': DEMO_PLANT_2 });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('TENANT_NOT_ALLOWED');
  });

  test('INT-09a (freya): approving a plan or a period and switching a feature flag answer 403 FORBIDDEN_ROLE', async () => {
    const freya = await apiLogin(INT_USERS.freya);
    const plans = await call<{ items: Array<{ id: string }> }>(freya.token, 'GET', '/v2/production-plans?limit=1');
    expect(plans.status).toBe(200);
    expect(plans.body.items.length, 'Demo Plant has at least one plan to try approving').toBeGreaterThan(0);
    const plan = await command<{ code: string }>(freya.token, `/v2/production-plans/${plans.body.items[0].id}/approve`, {});
    expect(plan.status).toBe(403);
    expect(plan.body.code).toBe('FORBIDDEN_ROLE');

    const periods = await call<{ items: Array<{ id: string }> }>(freya.token, 'GET', '/v2/production-periods?limit=1');
    expect(periods.status).toBe(200);
    expect(periods.body.items.length).toBeGreaterThan(0);
    const period = await command<{ code: string }>(freya.token, `/v2/production-periods/${periods.body.items[0].id}/approve`, {});
    expect(period.status).toBe(403);
    expect(period.body.code).toBe('FORBIDDEN_ROLE');

    // the flag is already on; a refused PUT of the same value can never switch anything off
    const flag = await call<{ code: string }>(freya.token, 'PUT', '/v2/feature-flags/v2.integrationConsole', { enabled: true });
    expect(flag.status).toBe(403);
    expect(flag.body.code).toBe('FORBIDDEN_ROLE');
    const flags = await call<{ items: Array<{ key: string; enabled: boolean }> }>(freya.token, 'GET', '/v2/feature-flags');
    expect(flags.body.items.find((item) => item.key === 'v2.integrationConsole')?.enabled).toBe(true);
  });

  test('INT-09b (diego): Codes & Rules shows the codes without New code, and the server refuses a create with 403', async ({ page }) => {
    await uiLogin(page, INT_USERS.diego);
    await page.goto('/master-data/codes-rules');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('code-row').first()).toBeVisible({ timeout: 30_000 });
    await expectHidden(page.getByTestId('code-new'));
    await page.screenshot({ path: test.info().outputPath('int-09b-codes-read-only.png'), fullPage: true });
    const diego = await apiLogin(INT_USERS.diego);
    expectRefused(await command(diego.token, '/v2/reason-codes', { code: `${PREFIX}CODE-${suffix}`, name: `${PREFIX}integration admin attempt` }), 'FORBIDDEN_ROLE');
    expect(await findCode(diego.token, `${PREFIX}CODE-${suffix}`)).toBeNull(); // every page of the library
  });
});
