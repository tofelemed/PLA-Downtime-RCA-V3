import { test, expect, type Page } from '@playwright/test';
import { expectHidden, expectRefused } from './support/hidden-controls';
import { apiLogin, call, command, exceptionsOf, INT_USERS, loadState, NOAH, openConsole, runSim, selectConnection, subscribeJob, uiLogin, type IntSession, type IntState } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — journey 6, the quarantine. Omar plays the `poison` scenario in the
 * connection's namespace: not JSON, 70 KB, a timestamp an hour in the future and a local-time timestamp
 * are each quarantined (not_json / too_large / future_timestamp / schema_invalid) while the session
 * stays connected and the fifth, healthy message is accepted. The Quarantine tab of the connection is
 * filtered to it and shows the four rows; one is closed as irrecoverable with an audited reason (a state
 * change, never a delete). Noah (plain Engineer) sees the rows but not the raw payload, and
 * is offered no resolve control (the server still refuses a resolve with 403).
 */
const POISON_CODES = ['not_json', 'too_large', 'future_timestamp', 'schema_invalid'] as const;
let state: IntState;
let omar: IntSession;

test.describe.configure({ mode: 'serial', timeout: 240_000 });

const row = (page: Page, code: string) => page.locator(`[data-testid="exception-row"][data-code="${code}"]`).first();

async function openConnectionQuarantine(page: Page, email: string): Promise<void> {
  await uiLogin(page, email);
  await openConsole(page);
  await selectConnection(page, state.connectionName);
  await page.getByTestId('tab-mqtt-quarantine').click();
  await expect(page.getByTestId('q-connection')).toHaveValue(state.connectionId);
}

test.describe('Integration admin — quarantine', () => {
  test.beforeAll(async () => {
    state = loadState();
    omar = await apiLogin(INT_USERS.omar);
  });

  test('INT-06a (omar): the poison scenario fills the quarantine of the connection; the session survives; one row is closed as irrecoverable', async ({ page }) => {
    await uiLogin(page, INT_USERS.omar);
    await openConsole(page);
    await selectConnection(page, state.connectionName);
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    const before = (await subscribeJob(omar.token, state.connectionId))?.health.counters ?? { received: 0, quarantined: 0 };

    await runSim('poison', state.namespace, ['--seed', `p-int-${state.suffix}-poison`]);
    await expect.poll(async () => {
      const open = await exceptionsOf(omar.token, state.connectionId, 'open');
      return POISON_CODES.filter((code) => open.some((item) => item.errorCode === code)).length;
    }, { intervals: [2_000], timeout: 90_000 }).toBe(POISON_CODES.length);
    // the counters travel with the worker's heartbeat (every 20 s), the exceptions are stored at once
    await expect.poll(async () => (await subscribeJob(omar.token, state.connectionId))?.health.counters.quarantined ?? 0, { intervals: [2_000], timeout: 60_000 }).toBeGreaterThanOrEqual(before.quarantined + 4);
    const job = await subscribeJob(omar.token, state.connectionId);
    expect(job?.state).toBe('running');
    expect(job?.health.connected).toBe(true);
    expect(job?.health.counters.received).toBeGreaterThanOrEqual(before.received + 5);

    await page.getByTestId('tab-mqtt-quarantine').click();
    await expect(page.getByTestId('q-connection')).toHaveValue(state.connectionId);
    await expect(async () => {
      await page.getByTestId('quarantine-refresh').click();
      for (const code of POISON_CODES) await expect(row(page, code)).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    await page.screenshot({ path: test.info().outputPath('int-06a-quarantine.png'), fullPage: true });

    // the row opens the item's own page (/connectivity/quarantine/:id)
    const exceptionId = await row(page, 'not_json').getAttribute('data-exception-id');
    await row(page, 'not_json').click();
    const detail = page.getByTestId('exception-detail');
    await expect(detail).toHaveAttribute('data-code', 'not_json');
    await expect(detail).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('raw-payload')).toBeVisible();
    await expect(page.getByTestId('exception-irrecoverable')).toBeDisabled(); // a reason is required
    await page.fill('#resolve-reason', 'P-INT: a non-JSON message from the simulator, nothing to replay');
    await page.getByTestId('exception-irrecoverable').click();
    // closing for good is confirmed first
    await page.getByRole('alertdialog').getByRole('button', { name: 'Mark irrecoverable' }).click();
    // the actions say "Closed as irrecoverable." until the detail refetches, then the detail says "This item is irrecoverable."
    await expect(page.getByText(/Closed as irrecoverable\.|This item is irrecoverable\./)).toBeVisible({ timeout: 20_000 });
    await expect(detail).toHaveAttribute('data-state', 'irrecoverable', { timeout: 20_000 });
    await expect.poll(async () => (await exceptionsOf(omar.token, state.connectionId, 'irrecoverable')).some((item) => item.id === exceptionId), { intervals: [2_000], timeout: 30_000 }).toBe(true);
    const stillOpen = await exceptionsOf(omar.token, state.connectionId, 'open');
    for (const code of ['too_large', 'future_timestamp', 'schema_invalid']) expect(stillOpen.some((item) => item.errorCode === code), code).toBe(true);
    const closed = await call<{ state: string; raw: { payloadVisible: boolean } | null }>(omar.token, 'GET', `/v2/ingestion-exceptions/${exceptionId}`);
    expect(closed.body.state).toBe('irrecoverable');
    expect(JSON.stringify(closed.body)).not.toContain('"password"');
  });

  test('INT-06b (noah): a non-writer sees the quarantine of the connection without the raw payload, and is offered no resolve control (server: 403)', async ({ page }) => {
    await openConnectionQuarantine(page, NOAH);
    await expect(async () => {
      await page.getByTestId('quarantine-refresh').click();
      await expect(row(page, 'too_large')).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    const exceptionId = await row(page, 'too_large').getAttribute('data-exception-id');
    await row(page, 'too_large').click();
    await expect(page.getByTestId('exception-detail')).toHaveAttribute('data-code', 'too_large');
    await expect(page.getByTestId('raw-payload-hidden')).toBeVisible();
    await expect(page.getByTestId('raw-payload')).toHaveCount(0);
    // the resolve controls are not offered to a non-writer; the server still refuses a resolve
    await expectHidden(page.locator('#resolve-reason'));
    await expectHidden(page.getByTestId('exception-irrecoverable'));
    await page.screenshot({ path: test.info().outputPath('int-06b-noah-hidden-payload.png'), fullPage: true });
    const noah = await apiLogin(NOAH);
    expectRefused(await command(noah.token, `/v2/ingestion-exceptions/${exceptionId}/resolve`, { action: 'irrecoverable', reason: 'P-INT: engineer attempt' }), 'FORBIDDEN_ROLE');
    const detail = await call<{ state: string; raw: { payloadVisible: boolean } | null }>(noah.token, 'GET', `/v2/ingestion-exceptions/${exceptionId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.state).toBe('open');
    expect(detail.body.raw?.payloadVisible ?? false).toBe(false);
  });

  test('INT-06p (omar): the closed row stays irrecoverable and the others stay open after a fresh login', async ({ page }) => {
    await openConnectionQuarantine(page, INT_USERS.omar);
    await page.locator('#q-state').selectOption('irrecoverable');
    await expect(async () => {
      await page.getByTestId('quarantine-refresh').click();
      await expect(row(page, 'not_json')).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await row(page, 'not_json').click();
    await expect(page.getByTestId('exception-detail')).toHaveAttribute('data-state', 'irrecoverable');
    await expect(page.getByText('This item is irrecoverable.')).toBeVisible();
    await page.goBack();
    await page.locator('#q-state').selectOption('open');
    await expect(row(page, 'schema_invalid')).toBeVisible({ timeout: 20_000 });
  });
});
