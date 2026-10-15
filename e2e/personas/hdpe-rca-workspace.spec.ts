import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { API, signIn } from './support/admin-helpers';
import { apiLogin, call, command, REL_USERS } from './support/reliability-world';

interface CaseRow { id: string; rowVersion: number; description: string }

async function createCase() {
  const session = await apiLogin(REL_USERS.viktor);
  const result = await command<CaseRow>(session.token, '/v2/rcas', {
    title: `HDPE workspace ${randomUUID().slice(0, 8)}`,
    description: 'Extruder discharge pressure instability',
  });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return { rca: result.body, token: session.token };
}

async function openDefinition(page: Page, id: string) {
  await signIn(page, REL_USERS.viktor);
  await page.goto(`/rca/${id}?origin=queue`);
  await page.getByTestId('edit-definition').click();
  await expect(page.getByTestId('case-definition-page')).toBeVisible();
}

test.describe('HDPE RCA workspace decomposition', () => {
  test.describe.configure({ timeout: 90_000 });
  test.beforeAll(() => {
    test.skip(!API.includes(':4006/'), 'Fixture mutations require the isolated HDPE UI database on port 4006.');
  });

  for (const width of [1280, 390]) {
    test(`definition navigation and action disclosure preserve state at ${width}px`, async ({ page }) => {
      const { rca } = await createCase();
      await page.setViewportSize({ width, height: 900 });
      await openDefinition(page, rca.id);
      expect(new URL(page.url()).searchParams.get('origin')).toBe('queue');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'definition overflow').toBeLessThanOrEqual(1);
      await page.screenshot({ path: test.info().outputPath(`definition-${width}.png`), fullPage: true });
      await page.getByRole('link', { name: 'Back to overview', exact: true }).click();
      await expect(page.getByTestId('case-definition-page')).toHaveCount(0);
      expect(new URL(page.url()).searchParams.get('origin')).toBe('queue');
      await page.goBack();
      await expect(page.getByTestId('case-definition-page')).toBeVisible();
      await page.reload();
      await expect(page.getByTestId('case-definition-page')).toBeVisible();
      await page.getByTestId('tab-actions').click();
      const summary = page.getByTestId('new-action-disclosure').locator('summary');
      await summary.click();
      await page.locator('#action-title').fill('Check extruder die pressure');
      await summary.click();
      await expect(page.locator('#action-title')).toBeHidden();
      await summary.click();
      await expect(page.locator('#action-title')).toHaveValue('Check extruder die pressure');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'action form overflow').toBeLessThanOrEqual(1);
      await page.screenshot({ path: test.info().outputPath(`actions-${width}.png`), fullPage: true });
    });
  }

  test('definition draft survives leaving, browser Back and cancelled reload, then saves once', async ({ page }) => {
    const { rca, token } = await createCase();
    await openDefinition(page, rca.id);
    await page.locator('#edit-description').fill('Retained extruder pressure investigation');
    await page.getByTestId('tab-evidence').click();
    await expect(page.getByTestId('case-definition-page')).toHaveCount(0);
    await page.goBack();
    await page.getByRole('button', { name: 'Restore definition draft', exact: true }).click();
    await expect(page.locator('#edit-description')).toHaveValue('Retained extruder pressure investigation');
    const dialog = page.waitForEvent('dialog');
    const reload = page.reload({ waitUntil: 'commit', timeout: 5_000 }).catch(() => null);
    const warning = await dialog;
    expect(warning.type()).toBe('beforeunload');
    await warning.dismiss();
    await expect(page.locator('#edit-description')).toHaveValue('Retained extruder pressure investigation');
    await reload;
    const save = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/v2/rcas/${rca.id}`));
    await page.getByTestId('save-case').click();
    expect((await save).status()).toBe(200);
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    const stored = await call<CaseRow>(token, 'GET', `/v2/rcas/${rca.id}`);
    expect(stored.body.description).toBe('Retained extruder pressure investigation');
    await page.reload();
    await expect(page.locator('#edit-description')).toHaveValue(stored.body.description);
    await expect(page.getByTestId('definition-draft-restore')).toHaveCount(0);
  });

  test('restored stale definition keeps its version and cannot overwrite another editor', async ({ page }) => {
    const { rca, token } = await createCase();
    await openDefinition(page, rca.id);
    await page.locator('#edit-description').fill('My unfinished pressure finding');
    await page.getByTestId('tab-evidence').click();
    await expect(page.getByTestId('case-definition-page')).toHaveCount(0);
    const latest = await call<CaseRow>(token, 'GET', `/v2/rcas/${rca.id}`);
    const changed = await call<CaseRow>(token, 'PATCH', `/v2/rcas/${rca.id}`, { description: 'Independently reviewed finding' }, { 'If-Match': `"${latest.body.rowVersion}"` });
    expect(changed.status, JSON.stringify(changed.body)).toBe(200);
    await page.goBack();
    await page.getByRole('button', { name: 'Restore definition draft', exact: true }).click();
    const save = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/v2/rcas/${rca.id}`));
    await page.getByTestId('save-case').click();
    expect([409, 412]).toContain((await save).status());
    await expect(page.locator('#edit-description')).toHaveValue('My unfinished pressure finding');
    const stored = await call<CaseRow>(token, 'GET', `/v2/rcas/${rca.id}`);
    expect(stored.body.description).toBe('Independently reviewed finding');
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  });

  test('viewer can bookmark the definition without edit or action controls', async ({ page }) => {
    const { rca } = await createCase();
    await signIn(page, 'grace.whitfield@demo.acme.com');
    await page.goto(`/rca/${rca.id}/definition`);
    await expect(page.getByTestId('case-definition-page')).toBeVisible();
    await expect(page.locator('#edit-description')).toBeDisabled();
    await expect(page.getByTestId('save-case')).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to overview', exact: true }).click();
    await expect(page.getByTestId('edit-definition')).toHaveCount(0);
    await page.getByTestId('tab-actions').click();
    await expect(page.getByTestId('new-action-disclosure')).toHaveCount(0);
  });
});
