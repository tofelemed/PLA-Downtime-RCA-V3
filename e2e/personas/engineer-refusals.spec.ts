import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginViaUI } from '../test-utils/auth-helpers';
import { findCode } from '../test-utils/codes-world';
import { call } from '../test-utils/downtime-world';
import { HANNAH, MATEO, SAMUEL, apiSession } from './support/engineer-users';

/**
 * Production engineer persona — journey 5, the writes the persona must NOT be able to do, each shown as
 * a clear refusal on screen and never persisted: a reason code on /codes-admin (T18 pattern), an RCA
 * case on /rca (§13.2), a connection on the integration console (UX06 non-writer pattern, raw payloads
 * hidden). The planning refusal (retire a rate) lives in engineer-planning.spec.ts. Nothing is created.
 */
const suffix = randomUUID().slice(0, 8);

test.describe.configure({ timeout: 120_000 });

test.describe('Engineer — refusals (journey 5)', () => {
  test('Mateo on /codes-admin: a new reason code is refused with 403 (role), shown clearly, and nothing is stored', async ({ page }) => {
    const code = `P-ENG-REFUSED-${suffix}`;
    await loginViaUI(page, MATEO.email, MATEO.password);
    await page.goto('/codes-admin');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('tab-reason-codes').click();
    await expect(page.getByTestId('code-row').first()).toBeVisible({ timeout: 30_000 }); // reads are allowed
    await page.getByTestId('code-new').click();
    await page.fill('#new-code', code);
    await page.fill('#new-name', 'P-ENG engineer attempt');
    await page.getByTestId('new-parent').selectOption('');
    await page.getByTestId('code-create-submit').click();
    const refusal = page.getByTestId('admin-refusal');
    await expect(refusal).toHaveAttribute('data-status', '403');
    await expect(refusal).toHaveAttribute('data-kind', 'role');
    await expect(refusal).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');
    await page.screenshot({ path: test.info().outputPath('engineer-codes-admin-refusal.png') });
    expect(await findCode((await apiSession(MATEO)).token, code)).toBeNull();
  });

  test('Samuel on /rca: opening a case is refused with FORBIDDEN_ROLE in the dialog; no case exists afterwards', async ({ page }) => {
    const title = `P-ENG RCA refused ${suffix}`;
    await loginViaUI(page, SAMUEL.email, SAMUEL.password);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('new-case').click();
    const dialog = page.getByTestId('create-case-dialog');
    await dialog.locator('#case-title').fill(title);
    await dialog.getByRole('button', { name: 'Create case' }).click();
    const refusal = dialog.getByTestId('command-error');
    await expect(refusal).toContainText('Refused (FORBIDDEN_ROLE)');
    await expect(dialog).toBeVisible(); // the dialog stays open with the refusal, nothing navigates
    await page.screenshot({ path: test.info().outputPath('engineer-rca-refusal.png') });
    const cases = await call<{ items: Array<{ title: string }> }>((await apiSession(SAMUEL)).token, 'GET', `/v2/rcas?q=${encodeURIComponent(title)}`);
    expect(cases.status).toBe(200);
    expect(cases.body.items.filter((item) => item.title === title)).toEqual([]);
  });

  test('Hannah on the integration console: saving a connection is refused with a role refusal; quarantine raw payloads stay hidden', async ({ page }) => {
    const name = `P-ENG refused connection ${suffix}`;
    await loginViaUI(page, HANNAH.email, HANNAH.password);
    await page.goto('/connectivity');
    await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('new-connection').click();
    await page.getByTestId('source-type-pi_web_api').click();
    await page.fill('#pi-name', name);
    await page.fill('#pi-url', 'https://pi.example.invalid/piwebapi');
    await page.fill('#pi-user', 'p-eng-reader');
    await page.fill('#pi-secret', 'not-a-real-secret');
    await page.getByTestId('connection-save').click();
    const refusal = page.getByTestId('connection-wizard').getByTestId('refusal');
    await expect(refusal).toHaveAttribute('data-kind', 'role');
    await expect(refusal).toContainText('integration administrator');
    await page.screenshot({ path: test.info().outputPath('engineer-console-refusal.png') });
    await page.keyboard.press('Escape');
    const connections = await call<{ items: Array<{ displayName: string }> }>((await apiSession(HANNAH)).token, 'GET', '/v2/connections?limit=200');
    expect(connections.body.items.map((item) => item.displayName)).not.toContain(name);

    // a non-writer never sees raw payloads of quarantined items (UX06)
    await page.getByTestId('tab-quarantine').click();
    await page.locator('#q-state').selectOption('resolved');
    await page.getByTestId('quarantine-refresh').click();
    const items = page.getByTestId('exception-row');
    if ((await items.count()) > 0) {
      await items.first().click();
      await expect(page.getByTestId('exception-detail')).toBeVisible();
      await expect(page.getByTestId('raw-payload-hidden')).toBeVisible();
    }
    await expect(page.getByTestId('raw-payload')).toHaveCount(0);
  });
});
