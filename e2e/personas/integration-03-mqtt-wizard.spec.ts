import { test, expect, type Page } from '@playwright/test';
import { apiLogin, BROKER, caPem, findConnection, INT_USERS, newSuffix, openConsole, PREFIX, saveState, selectConnection, subscribeJob, uiLogin, type IntSession } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — journey 3, the MQTT wizard as Omar against the Compose broker's password
 * listener (1885) and TLS listener (8885): a new connection `P-INT-mqtt-…` with the `proact-sim`
 * credentials typed in the wizard (write-only; `hasSecret`, never echoed), CONNACK test → success;
 * a connection with a wrong password → the test FAILS with the broker's refusal text and is then
 * corrected; a TLS connection without the CA → the TLS failure with the servername / CA hint, then the
 * CA PEM pasted → success. Every connection stays active; the first one is handed to the later specs.
 */
const suffix = newSuffix();
const namespace = `test/p-int-${suffix}`;
const mainName = `${PREFIX}mqtt-${suffix}`;
let omar: IntSession;

test.describe.configure({ mode: 'serial', timeout: 240_000 });

interface WizardInput {
  name: string;
  family: string;
  brokerUrl: string;
  password: string;
}

/** profile → basics → connection → advanced → save; returns once the detail of the new connection shows. */
async function createMqtt(page: Page, input: WizardInput): Promise<void> {
  await page.getByTestId('new-connection').click();
  await page.getByTestId('source-type-mqtt').click();
  await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'profile');
  await page.getByTestId('mqtt-kind').selectOption('interval_event_json');
  await page.fill('#mqtt-template', `${input.family}/{site}/{area}/{line}/{unit}/events`);
  await page.getByTestId('mqtt-next').click();
  await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'basics');
  await page.fill('#mqtt-name', input.name);
  await page.fill('#mqtt-broker', input.brokerUrl);
  await page.fill('#mqtt-topics', `${input.family}/+/+/+/+/events`);
  await page.getByTestId('mqtt-next').click();
  await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'connection');
  await page.fill('#mqtt-user', BROKER.username);
  await page.fill('#mqtt-secret', input.password);
  await page.getByTestId('mqtt-next').click();
  await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'advanced');
  await page.getByTestId('connection-save').click();
  await expect(page.getByTestId('connection-detail')).toHaveAttribute('data-source-type', 'mqtt', { timeout: 20_000 });
  await expect(page.getByTestId('connection-secret')).toHaveText('Credential stored (write-only)');
}

const testStep = (page: Page, step: string) => page.locator(`[data-testid="diagnostic-step"][data-step="${step}"]`);

test.describe('Integration admin — MQTT wizard', () => {
  test.beforeAll(async () => {
    omar = await apiLogin(INT_USERS.omar);
  });

  test('INT-03a (omar): wizard validation, a new connection on 1885 with the gateway credentials, CONNACK test succeeds, the password never travels back', async ({ page }) => {
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/api/')) return;
      bodies.push(await response.text().catch(() => ''));
    });
    await uiLogin(page, INT_USERS.omar);
    await openConsole(page);

    // validation: a broker URL that is not mqtt(s)://host is refused inline before anything is sent
    await page.getByTestId('new-connection').click();
    await page.getByTestId('source-type-mqtt').click();
    await page.getByTestId('mqtt-next').click();
    await page.fill('#mqtt-name', mainName);
    await page.fill('#mqtt-broker', 'http://not-a-broker');
    await page.getByTestId('mqtt-next').click();
    await expect(page.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'basics');
    await expect(page.locator('#mqtt-broker-error')).toContainText('mqtt://host');
    await page.screenshot({ path: test.info().outputPath('int-03a-broker-validation.png') });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('connection-wizard')).toBeHidden();

    await createMqtt(page, { name: mainName, family: namespace, brokerUrl: BROKER.plain, password: BROKER.password });
    const connection = await findConnection(omar.token, mainName);
    expect(connection).not.toBeNull();
    expect(connection?.hasSecret).toBe(true);
    expect(connection?.isActive).toBe(true);
    expect(connection?.endpointConfig.mqtt?.topics).toEqual([`${namespace}/+/+/+/+/events`]);
    const connectionId = connection?.id ?? '';
    await expect(page.getByTestId('connection-endpoint')).toContainText(`client id proact-${connectionId}`);
    saveState({ suffix, namespace, connectionId, connectionName: mainName });

    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('mqtt-test')).toHaveAttribute('data-health', 'connected', { timeout: 60_000 });
    await expect(testStep(page, 'connect')).toContainText('ok');
    await expect(testStep(page, 'username')).toContainText(BROKER.username);
    await expect(testStep(page, 'clientId')).toContainText('test-');
    await page.screenshot({ path: test.info().outputPath('int-03a-test-ok.png'), fullPage: true });

    // the worker hosts the subscription (reconcile every 10 s)
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    expect((await subscribeJob(omar.token, connectionId))?.state).toBe('running');

    expect(bodies.length).toBeGreaterThan(5);
    expect(bodies.filter((body) => body.includes(BROKER.password))).toEqual([]);
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(storage).not.toContain(BROKER.password);
  });

  test('INT-03b (omar): a wrong password → the test FAILS with the broker refusal; the corrected password → success', async ({ page }) => {
    const name = `${PREFIX}mqtt-badpw-${suffix}`;
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/api/')) return;
      bodies.push(await response.text().catch(() => ''));
    });
    await uiLogin(page, INT_USERS.omar);
    await openConsole(page);
    await createMqtt(page, { name, family: `test/p-int-badpw-${suffix}`, brokerUrl: BROKER.plain, password: `wrong-${suffix}` });
    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('mqtt-test')).toHaveAttribute('data-health', 'failed', { timeout: 60_000 });
    await expect(page.getByTestId('mqtt-test-message')).toContainText(/Broker refused connection: (BadUserNameOrPassword|NotAuthorized)/);
    await expect(testStep(page, 'connect')).not.toContainText('ok');
    await page.screenshot({ path: test.info().outputPath('int-03b-wrong-password.png'), fullPage: true });

    // the fix: replace the write-only password through the edit wizard (the stored one is never shown)
    await page.getByTestId('connection-edit').click();
    await page.getByTestId('mqtt-step-connection').click();
    await expect(page.locator('#mqtt-secret')).toHaveValue('');
    await page.fill('#mqtt-secret', BROKER.password);
    await page.getByTestId('connection-save').click();
    await expect(page.getByTestId('connection-wizard')).toBeHidden();
    await expect(page.getByTestId('connection-detail')).toBeVisible();
    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('mqtt-test')).toHaveAttribute('data-health', 'connected', { timeout: 60_000 });
    expect((await findConnection(omar.token, name))?.hasSecret).toBe(true);
    expect(bodies.filter((body) => body.includes(`wrong-${suffix}`) || body.includes(BROKER.password))).toEqual([]);
  });

  test('INT-03c (omar): TLS on 8885 without the CA fails with the servername / CA hint; with the CA PEM pasted it connects', async ({ page }) => {
    const name = `${PREFIX}mqtt-tls-${suffix}`;
    await uiLogin(page, INT_USERS.omar);
    await openConsole(page);
    await createMqtt(page, { name, family: `test/p-int-tls-${suffix}`, brokerUrl: BROKER.tls, password: BROKER.password });
    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('mqtt-test')).toHaveAttribute('data-health', 'failed', { timeout: 60_000 });
    await expect(page.getByTestId('mqtt-test-message')).toContainText('TLS handshake failed');
    await expect(page.getByTestId('mqtt-test-message')).toContainText('set tls.servername');
    await expect(page.getByTestId('mqtt-test-message')).toContainText('provide its CA');
    await expect(testStep(page, 'tlsMode')).toContainText('system');
    await page.screenshot({ path: test.info().outputPath('int-03c-tls-no-ca.png'), fullPage: true });

    await page.getByTestId('connection-edit').click();
    await page.getByTestId('mqtt-step-connection').click();
    await expect(page.getByTestId('mqtt-tls')).toBeVisible();
    await page.getByTestId('mqtt-tls-mode').selectOption('caPem');
    await page.fill('#mqtt-ca-pem', caPem());
    // changing the TLS trust of a stored connection requires the password again (SECRET_REQUIRED)
    await page.fill('#mqtt-secret', BROKER.password);
    await page.getByTestId('connection-save').click();
    await expect(page.getByTestId('connection-wizard')).toBeHidden({ timeout: 20_000 });
    await page.getByTestId('run-diagnostics').click();
    await expect(page.getByTestId('mqtt-test')).toHaveAttribute('data-health', 'connected', { timeout: 60_000 });
    await expect(testStep(page, 'tlsMode')).toContainText('caPem');
    await page.screenshot({ path: test.info().outputPath('int-03c-tls-ca-ok.png'), fullPage: true });
    const stored = await findConnection(omar.token, name);
    expect(stored?.endpointConfig.mqtt?.tls?.mode).toBe('caPem');
    expect(stored?.endpointConfig.mqtt?.brokerUrl).toBe(BROKER.tls);
    expect(JSON.stringify(stored)).not.toContain(BROKER.password);
  });

  test('INT-03p (omar): the connections survive a fresh login with their credential flag and topics', async ({ page }) => {
    const fresh = await apiLogin(INT_USERS.omar);
    for (const name of [mainName, `${PREFIX}mqtt-badpw-${suffix}`, `${PREFIX}mqtt-tls-${suffix}`]) {
      const row = await findConnection(fresh.token, name);
      expect(row?.isActive, name).toBe(true);
      expect(row?.hasSecret, name).toBe(true);
    }
    await uiLogin(page, INT_USERS.omar);
    await openConsole(page);
    await selectConnection(page, mainName);
    await expect(page.getByTestId('connection-secret')).toHaveText('Credential stored (write-only)');
    await expect(page.getByTestId('connection-endpoint')).toContainText(BROKER.plain);
  });
});
