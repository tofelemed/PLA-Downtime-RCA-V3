import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginViaUI } from '../test-utils/auth-helpers';
import { findCode } from '../test-utils/codes-world';
import { call, command } from '../test-utils/downtime-world';
import { HANNAH, MATEO, SAMUEL, apiSession } from './support/engineer-users';
import { expectHidden, expectRefused } from './support/hidden-controls';

/**
 * Production engineer persona — journey 5, the writes the persona must NOT be able to do: the control is
 * not offered on screen (capability-hidden), the server still refuses the write (403) and nothing persists: a reason code on /codes-admin (T18 pattern), an RCA
 * case on /rca (§13.2), a connection (the integration console is closed to her: owner 18 Oct 2026,
 * Integration is SuperAdmin-only). The planning refusal (retire a rate) lives in engineer-planning.spec.ts. Nothing is created.
 */
const suffix = randomUUID().slice(0, 8);

test.describe.configure({ timeout: 120_000 });

test.describe('Engineer — refusals (journey 5)', () => {
  test('Mateo on /codes-admin: reason codes are readable, New code is not offered, the server refuses a create with 403 and nothing is stored', async ({ page }) => {
    const code = `P-ENG-REFUSED-${suffix}`;
    await loginViaUI(page, MATEO.email, MATEO.password);
    await page.goto('/master-data/codes-rules');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('code-row').first()).toBeVisible({ timeout: 30_000 }); // reads are allowed
    await expectHidden(page.getByTestId('code-new'));
    await page.screenshot({ path: test.info().outputPath('engineer-codes-admin-no-create.png') });
    const mateo = await apiSession(MATEO);
    expectRefused(await command(mateo.token, '/v2/reason-codes', { code, name: 'P-ENG engineer attempt' }), 'FORBIDDEN_ROLE');
    expect(await findCode(mateo.token, code)).toBeNull();
  });

  test('Samuel on /rca: New case is not offered, the server refuses a create with FORBIDDEN_ROLE; no case exists afterwards', async ({ page }) => {
    const title = `P-ENG RCA refused ${suffix}`;
    await loginViaUI(page, SAMUEL.email, SAMUEL.password);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await expectHidden(page.getByTestId('new-case'));
    await page.screenshot({ path: test.info().outputPath('engineer-rca-no-create.png') });
    const samuel = await apiSession(SAMUEL);
    expectRefused(await command(samuel.token, '/v2/rcas', { title }), 'FORBIDDEN_ROLE');
    const cases = await call<{ items: Array<{ title: string }> }>(samuel.token, 'GET', `/v2/rcas?q=${encodeURIComponent(title)}`);
    expect(cases.status).toBe(200);
    expect(cases.body.items.filter((item) => item.title === title)).toEqual([]);
  });

  test('Hannah: no Connectivity menu, a direct visit shows no integration console, and the server refuses a connection create (403)', async ({ page }) => {
    const name = `P-ENG refused connection ${suffix}`;
    await loginViaUI(page, HANNAH.email, HANNAH.password);
    // owner 18 Oct 2026: Integration is SuperAdmin-only
    await expect(page.locator('nav a[href="/connectivity"]')).toHaveCount(0);
    await page.goto('/connectivity');
    await expect(page.getByRole('heading', { name: 'Connectivity', level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('integration-console')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('engineer-console-closed.png') });
    const hannah = await apiSession(HANNAH);
    const create = await command(hannah.token, '/v2/connections', { sourceType: 'pi_web_api', displayName: name, config: { baseUrl: 'https://pi.example.invalid/piwebapi' } });
    expectRefused(create, 'FORBIDDEN_ROLE');
    const connections = await call<{ items: Array<{ displayName: string }> }>(hannah.token, 'GET', '/v2/connections?limit=200');
    expect(connections.body.items.map((item) => item.displayName)).not.toContain(name);
  });
});
