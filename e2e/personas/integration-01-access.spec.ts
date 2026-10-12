import { test, expect } from '@playwright/test';
import { PLANTS, openPlantTree, selectPlant } from './support/admin-helpers';
import { expectHidden, expectRefused } from './support/hidden-controls';
import { apiLogin, BROKER, call, command, DEMO_EVENTS_CONNECTION, DEMO_PLANT, DEMO_PLANT_2, findConnection, findOnPages, INT_USERS, newSuffix, NOAH, openConsole, PREFIX, selectConnection, uiLogin } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — journeys 1 (menu and access), 8 (cross-plant) and 9 (refusals).
 * An `integration_admin` (legacy Engineer / Analyst + scope) sees Connectivity in the sidebar and opens
 * the integration console; a plain Engineer (Noah) has no such menu item, is offered no console write
 * and the server refuses each one with 403 FORBIDDEN_ROLE. Diego, integration_admin in Demo Plant 2 as well, switches
 * there and creates a connection in its (empty) console; Freya cannot select Demo Plant 2 at all.
 * Approvals, codes and feature flags are not an integration administrator's business: 403 FORBIDDEN_ROLE.
 */
const suffix = newSuffix();

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('Integration admin — access, cross-plant, refusals', () => {
  test('INT-01a (elena): Connectivity is in the sidebar and opens the integration console', async ({ page }) => {
    await uiLogin(page, INT_USERS.elena);
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

  test('INT-01b (noah): no Connectivity menu; a direct visit shows the console read-only (no test / new connection) and the server refuses both (403 role)', async ({ page }) => {
    await uiLogin(page, NOAH);
    const nav = page.locator('nav').first();
    await nav.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(nav.getByRole('link', { name: 'Event Hub' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Connectivity' })).toHaveCount(0);
    await openConsole(page);
    await selectConnection(page, DEMO_EVENTS_CONNECTION);
    // a non-writer is not offered the connection test (nor creating a connection); the server still refuses both
    await expectHidden(page.getByTestId('run-diagnostics'));
    await expectHidden(page.getByTestId('new-connection'));
    await page.screenshot({ path: test.info().outputPath('int-01b-noah-read-only.png'), fullPage: true });
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

  test('INT-08a (diego): switches to Demo Plant 2, sees its empty console and creates a connection there', async ({ page }) => {
    await uiLogin(page, INT_USERS.diego);
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
    const orgLabel = tree.getByText(PLANTS.demo.org, { exact: true });
    await expect(orgLabel).toBeVisible();
    if ((await tree.getByText(PLANTS.demo.name, { exact: true }).count()) === 0) await orgLabel.locator('xpath=..').locator('svg').first().click();
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
    await page.goto('/codes-admin');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('code-row').first()).toBeVisible({ timeout: 30_000 });
    await expectHidden(page.getByTestId('code-new'));
    await page.screenshot({ path: test.info().outputPath('int-09b-codes-read-only.png'), fullPage: true });
    const diego = await apiLogin(INT_USERS.diego);
    expectRefused(await command(diego.token, '/v2/reason-codes', { code: `${PREFIX}CODE-${suffix}`, name: `${PREFIX}integration admin attempt` }), 'FORBIDDEN_ROLE');
    const codes = await call<{ items: Array<{ code: string }> }>(diego.token, 'GET', '/v2/reason-codes?limit=500');
    expect(codes.body.items.map((item) => item.code)).not.toContain(`${PREFIX}CODE-${suffix}`);
  });
});
