import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { apiLogin, call, command, PLANTS, selectPlant, signIn, signOut } from './support/admin-helpers';

const SARA = 'sara.nouri@demo.acme.com';
const DAVID = 'david.chen@demo.acme.com';
const METROLOGY = 'kaveh.ahmadi@demo.acme.com';
const NOTE = `Demo: HDPE governance browser ${randomUUID()}`;
interface Unit { id: string; code: string; }
let units: Unit[] = [];

async function choose(page: Page, testId: string, code: string): Promise<void> {
  const unit = units.find((row) => row.code === code);
  expect(unit).toBeDefined();
  await page.getByTestId(testId).selectOption(unit!.id);
}

test.beforeAll(async () => {
  const session = await apiLogin(SARA);
  const result = await call<{ items: Unit[] }>(session.token, 'GET', '/v2/units?limit=200');
  expect(result.status).toBe(200);
  units = result.body.items;
});

test('accountant filters both units and computes a budget through the server', async ({ page }) => {
  await signIn(page, SARA);
  await page.goto('/measurement-uncertainty');
  for (const code of ['unit100', 'unit200']) {
    await choose(page, 'budget-unit', code);
    await expect(page.getByTestId('budget-card').filter({ hasText: 'Demo: HDPE shift mass balance' })).toHaveCount(1);
  }
  await page.getByTestId('budget-new').click();
  await page.getByTestId('budget-save').click();
  await expect(page.getByTestId('field-error-budgetBoundary')).toBeVisible();
  const form = page.getByTestId('budget-form');
  const rows = form.getByTestId('budget-component');
  await rows.nth(0).getByLabel('Name', { exact: true }).fill('Demo: meter');
  await rows.nth(0).getByLabel('Standard uncertainty', { exact: true }).fill('0.3');
  await rows.nth(1).getByLabel('Name', { exact: true }).fill('Demo: scale');
  await rows.nth(1).getByLabel('Standard uncertainty', { exact: true }).fill('0.4');
  const response = page.waitForResponse((r) => r.url().includes('/uncertainty-budgets/preview') && r.request().method() === 'POST');
  await form.getByTestId('budget-compute').click();
  expect((await response).status()).toBe(200);
  await expect(form.getByTestId('budget-combined')).toContainText('0.500');
  await expect(form.getByTestId('budget-expanded')).toContainText('1.000');
});

test('metrology approves and a separate accountant adopts a budget through the UI', async ({ page }) => {
  const author = await apiLogin(SARA);
  const unitId = units.find((row) => row.code === 'unit100')!.id;
  const draft = await command<{ id: string }>(author.token, '/v2/uncertainty-budgets', {
    unitId, boundary: 'demo_browser_outlet', uom: 't', components: [
      { kind: 'meter', label: 'Demo: meter', standardUncertainty: '0.3' },
      { kind: 'scale', label: 'Demo: scale', standardUncertainty: '0.4' },
    ], coverageFactor: '2', calibrationRef: 'Demo: test certificate', notes: NOTE,
    effectiveFrom: new Date(Date.now() - 1000).toISOString(), reviewDueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  expect(draft.status).toBe(201);
  await signIn(page, METROLOGY);
  await page.goto('/measurement-uncertainty');
  await choose(page, 'budget-unit', 'unit100');
  const card = page.getByTestId('budget-card').filter({ hasText: NOTE });
  await card.getByTestId('budget-approve').click();
  await expect(card).toHaveAttribute('data-state', 'approved');
  await expect(card.getByTestId('budget-adopt')).toHaveCount(0);
  await signOut(page);
  await signIn(page, DAVID);
  await page.goto('/measurement-uncertainty');
  await choose(page, 'budget-unit', 'unit100');
  await card.getByTestId('budget-adopt').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Use as tolerance', exact: true }).click();
  await expect(card.getByTestId('budget-adopted')).toBeVisible();
});

test('source priority uses maker-checker and publishes the approved hierarchy', async ({ page }) => {
  const author = await apiLogin(SARA);
  const unitId = units.find((row) => row.code === 'unit200')!.id;
  const created = await command<{ id: string }>(author.token, '/v2/source-authority/versions', {
    unitId, notes: NOTE, measurementHierarchy: { boundary: 'pellet_outlet', conditions: ['primary_missing'], entries: [
      { rank: 1, sourceClass: 'reconciled_record', source: 'pi_output_ef', boundary: 'pellet_outlet' },
      { rank: 2, sourceClass: 'approved_estimate', source: 'manual', boundary: 'pellet_outlet' },
    ] },
  });
  expect(created.status).toBe(201);
  const refused = await command<{ code: string }>(author.token, `/v2/source-authority/versions/${created.body.id}/approve`, {});
  expect(refused.status).toBe(403);
  expect(refused.body.code).toBe('SEPARATION_OF_DUTIES');
  await signIn(page, DAVID);
  await page.goto('/connectivity/source-authority');
  await choose(page, 'authority-unit', 'unit200');
  await page.getByTestId('authority-approve').click();
  await expect(page.getByTestId('authority-in-force')).toContainText('pi_output_ef (reconciled record)manual (approved estimate)');
  await expect(page.getByTestId('authority-in-force')).not.toContainText('external_report');
  await expect(page.getByTestId('authority-approve')).toHaveCount(0);
});

test('viewer can inspect budgets but cannot propose, approve or adopt', async ({ page }) => {
  await signIn(page, 'grace.whitfield@demo.acme.com');
  await selectPlant(page, PLANTS.demo);
  await page.goto('/measurement-uncertainty');
  await choose(page, 'budget-unit', 'unit200');
  await expect(page.getByTestId('budget-card').first()).toBeVisible();
  for (const id of ['budget-new', 'budget-approve', 'budget-adopt']) await expect(page.getByTestId(id)).toHaveCount(0);
});

test('stream and lot filters follow the selected unit', async ({ page }) => {
  await signIn(page, 'noah.schmidt@demo.acme.com');
  await page.goto('/planning');
  await page.getByRole('tab', { name: 'Streams', exact: true }).click();
  for (const code of ['unit100', 'unit200']) {
    await page.locator('#streamUnit').selectOption(units.find((row) => row.code === code)!.id);
    await expect(page.getByTestId('unit-stream-row')).toContainText(`Demo: ${code} extrusion stream`);
    await expect(page.getByTestId('unit-streams-tab')).toContainText(`DEMO-${code}-`);
  }
});

test('manager sees the scoped delegation and both status filters work', async ({ page }) => {
  await signIn(page, 'jonas.weber@demo.acme.com');
  await page.goto('/delegations');
  await expect(page.getByTestId('delegations')).toContainText('Demo: planned shutdown leave cover for unit100');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByTestId('delegations')).toContainText('Fatima Haddad');
  await page.getByRole('button', { name: 'In force', exact: true }).click();
  await expect(page.getByTestId('delegation-revoke').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('delegations.png'), fullPage: true });
});
