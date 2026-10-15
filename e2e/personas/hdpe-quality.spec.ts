import { test, expect } from '@playwright/test';
import { openPeriodSection } from '../test-utils/period-sections';
import { randomUUID } from 'node:crypto';
import { apiLogin, call, command, signIn, signOut, selectPlant, PLANTS } from './support/admin-helpers';
import type { LotDispositionView, ProductionPeriodView } from '../../src/api/v2/types/periods';

const ACCOUNTANT = 'sara.nouri@demo.acme.com';
const QUALITY = 'parisa.rahimi@demo.acme.com';
const LOT = `DEMO-QA-${randomUUID().slice(0, 8)}`;
let period: ProductionPeriodView;
let path = '';
let dispositionId = '';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.beforeAll(async () => {
  const author = await apiLogin(ACCOUNTANT);
  const units = await call<{ items: Array<{ id: string; code: string }> }>(author.token, 'GET', '/v2/units?limit=200');
  const unit = units.body.items.find((item) => item.code === 'unit100');
  expect(unit).toBeDefined();
  const from = new Date(Date.now() - 2 * 86400000).toISOString();
  const to = new Date().toISOString();
  const periods = await call<{ items: ProductionPeriodView[] }>(author.token, 'GET', `/v2/production-periods?unitIds=${unit!.id}&from=${from}&to=${to}&limit=50`);
  expect(periods.status).toBe(200);
  const chosen = periods.body.items.find((item) => item.utcEnd < to && item.slices.length > 0 && !item.isExcluded);
  expect(chosen, 'HDPE seed supplies a completed production shift').toBeDefined();
  period = chosen!;
  const plans = await call<{ items: Array<{ id: string; version: { id: string } }> }>(author.token, 'GET', '/v2/production-plans?limit=200');
  const plan = plans.body.items.find((item) => item.version.id === period.selectedPlanVersionId);
  expect(plan).toBeDefined();
  path = `/plans/${plan!.id}/periods/${period.id}`;
});

test('accountant records a lab downgrade with evidence; only Quality can decide it', async ({ page }) => {
  await signIn(page, ACCOUNTANT);
  await page.goto(`${path}/dispositions/new`);
  const form = page.getByTestId('disposition-form');
  await form.getByTestId('disposition-save').click();
  await expect(form.getByTestId('field-error-dispLot')).toBeVisible();
  await expect(form.getByTestId('field-error-dispQuantity')).toBeVisible();
  await form.getByLabel('Lot number', { exact: true }).fill(LOT);
  await form.getByLabel('Disposition', { exact: true }).selectOption('downgrade');
  await form.getByLabel('Quantity (t)', { exact: true }).fill('0.25');
  await form.getByLabel('Evidence (lab certificate, sample number)').fill('DEMO-LIMS-MFR-025');
  await form.getByLabel('Note (optional)').fill('Demo: MFR outside the prime grade target; approved secondary application pending independent lab review');
  const created = page.waitForResponse((r) => r.url().endsWith('/v2/lot-dispositions') && r.request().method() === 'POST');
  await form.getByTestId('disposition-save').click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  dispositionId = ((await response.json()) as LotDispositionView).id;
  await expect(page).toHaveURL(`${path}/actuals`);
  await openPeriodSection(page, 'Actuals & quality');
  const row = page.getByRole('row').filter({ has: page.getByTestId('disposition-row').filter({ hasText: LOT }) });
  await expect(row).toContainText('DEMO-LIMS-MFR-025');
  await expect(row.getByTestId('disposition-row')).toHaveAttribute('data-state', 'proposed');
  await expect(row.getByTestId('disposition-approve')).toHaveCount(0);
  const author = await apiLogin(ACCOUNTANT);
  const refused = await command<{ code: string }>(author.token, `/v2/lot-dispositions/${dispositionId}/approve`, {});
  expect(refused.status).toBe(403);
});

test('Quality approves the recorded lot in the UI and the decision survives reload', async ({ page }) => {
  await signIn(page, QUALITY);
  await page.goto(path);
  await openPeriodSection(page, 'Actuals & quality');
  const row = page.getByRole('row').filter({ has: page.getByTestId('disposition-row').filter({ hasText: LOT }) });
  const decided = page.waitForResponse((r) => r.url().endsWith(`/lot-dispositions/${dispositionId}/approve`) && r.request().method() === 'POST');
  await row.getByTestId('disposition-approve').click();
  expect((await decided).status()).toBe(200);
  await expect(row.getByTestId('disposition-row')).toHaveAttribute('data-state', 'approved');
  await page.reload();
  await expect(row.getByTestId('disposition-row')).toHaveAttribute('data-state', 'approved');
  await page.screenshot({ path: test.info().outputPath('hdpe-quality-approved.png'), fullPage: true });
  const quality = await apiLogin(QUALITY);
  const read = await call<LotDispositionView>(quality.token, 'GET', `/v2/lot-dispositions/${dispositionId}`);
  expect(read.body).toMatchObject({ state: 'approved', quantity: '0.25', decidedBy: quality.user.id });
  expect(read.body.authorId).not.toBe(read.body.decidedBy);
});

test('Quality cannot approve its own lot and a viewer cannot record dispositions', async ({ page }) => {
  const quality = await apiLogin(QUALITY);
  const own = await command<LotDispositionView>(quality.token, '/v2/lot-dispositions', {
    unitId: period.unitId, productId: period.slices[0].productId, lotCode: `${LOT}-SELF`,
    dispositionClass: 'scrap', quantity: '0.1', uom: 't', productionStart: period.utcStart,
    productionEnd: period.utcEnd, evidenceRef: 'DEMO-LIMS-SELF-CHECK', reason: 'Demo: maker-checker test',
  });
  expect(own.status).toBe(201);
  const refused = await command<{ code: string }>(quality.token, `/v2/lot-dispositions/${own.body.id}/approve`, {});
  expect(refused.status).toBe(403);
  await signIn(page, QUALITY);
  await page.goto(path);
  await openPeriodSection(page, 'Actuals & quality');
  const row = page.getByRole('row').filter({ has: page.getByTestId('disposition-row').filter({ hasText: `${LOT}-SELF` }) });
  await expect(row.getByTestId('disposition-approve')).toBeDisabled();
  await signOut(page);
  await signIn(page, 'pedro.santos@demo.acme.com');
  // Pedro's remembered plant is session-local; use the viewer's HDPE scope explicitly.
  await selectPlant(page, PLANTS.demo);
  await page.goto(`${path}/dispositions/new`);
  await expect(page.getByTestId('disposition-form')).toHaveCount(0);
  await expect(page.getByText('Operators, production engineers, production accountants, manager approvers and Quality / Lab approvers record dispositions.')).toBeVisible();
});
