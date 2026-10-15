import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { UnitImpactRuleView } from '../../src/api/v2/types/unit-impact';
import type { SourceStatusMappingView } from '../../src/api/v2/types/status-mappings';
import type { RoleDelegationView } from '../../src/api/v2/types/role-delegations';
import { apiLogin, call, command, signIn, signOut } from './support/admin-helpers';

const JONAS = 'jonas.weber@demo.acme.com';
const FATIMA = 'fatima.haddad@demo.acme.com';
const SARA = 'sara.nouri@demo.acme.com';
const DAVID = 'david.chen@demo.acme.com';
const KAVEH = 'kaveh.ahmadi@demo.acme.com';
interface Unit { id: string; code: string; }
interface Asset { id: string; unitId: string; code: string; }
let units: Unit[] = [];

test.setTimeout(90_000);

function relativeDate(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function fillDate(page: Page, label: string, date: string): Promise<void> {
  await page.getByLabel(`${label} date`, { exact: true }).fill(date);
  await page.getByLabel(`${label} time`, { exact: true }).fill('06:00');
}

async function createBudget(token: string, unitId: string): Promise<string> {
  const result = await command<{ id: string }>(token, '/v2/uncertainty-budgets', {
    unitId, boundary: `demo_delegate_${randomUUID().slice(0, 8)}`, uom: 't',
    components: [{ kind: 'meter', label: 'Demo: certified weigh feeder', standardUncertainty: '0.3' }],
    coverageFactor: '2', calibrationRef: 'Demo: delegation certificate verification',
    effectiveFrom: new Date(Date.now() - 1000).toISOString(),
    reviewDueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  expect(result.status).toBe(201);
  return result.body.id;
}

async function verifyDelegatedMetrology(delegateToken: string, authorToken: string, unitId: string): Promise<string> {
  const separate = await createBudget(authorToken, unitId);
  const approved = await command(delegateToken, `/v2/uncertainty-budgets/${separate}/approve`, {});
  expect(approved.status).toBe(200);
  const ownId = await createBudget(delegateToken, unitId);
  const own = await command<{ code: string }>(delegateToken, `/v2/uncertainty-budgets/${ownId}/approve`, {});
  expect(own.status).toBe(403);
  expect(own.body.code).toBe('SEPARATION_OF_DUTIES');
  const outside = await createBudget(authorToken, units.find((unit) => unit.code === 'unit100')!.id);
  const outsideAttempt = await command<{ code: string }>(delegateToken, `/v2/uncertainty-budgets/${outside}/approve`, {});
  await test.info().attach('metrology-unit-boundary-response', { body: JSON.stringify({ budgetId: outside, ...outsideAttempt }, null, 2), contentType: 'application/json' });
  expect(outsideAttempt.status, 'unit200 metrology delegation must not approve a unit100 budget').toBe(403);
  expect(outsideAttempt.body.code).toBe('FORBIDDEN_ROLE');
  return createBudget(authorToken, unitId);
}

test.beforeAll(async () => {
  const manager = await apiLogin(JONAS);
  const result = await call<{ items: Unit[] }>(manager.token, 'GET', '/v2/units?limit=200');
  expect(result.status).toBe(200);
  units = result.body.items;
});

test('unit impact rule is drafted in the UI and approved by a different manager', async ({ page }) => {
  const author = await apiLogin(JONAS);
  const assets = await call<{ items: Asset[] }>(author.token, 'GET', '/v2/assets?limit=200');
  expect(assets.status).toBe(200);
  const rules = await call<{ items: UnitImpactRuleView[] }>(author.token, 'GET', '/v2/unit-impact-rules?limit=200');
  expect(rules.status).toBe(200);
  const unit = units.find((row) => row.code === 'unit200')!;
  const candidates = assets.body.items.filter((asset) => asset.unitId === unit.id);
  const asset = candidates.find((item) => !rules.body.items.some((rule) => rule.assetId === item.id)) ?? candidates[0];
  expect(asset).toBeDefined();
  const reason = `Demo: HDPE standby capacity UI ${randomUUID()}`;
  await signIn(page, JONAS);
  await page.goto('/master-data/unit-impact-rules');
  await page.getByTestId('impact-rule-new').click();
  await page.locator('#impactUnit').selectOption(unit.id);
  await page.locator('#impactAsset').selectOption(asset.id);
  await page.locator('#impactMode').selectOption('fractional');
  await page.locator('#impactPercent').fill('25');
  await page.locator('#impactReason').fill(reason);
  await fillDate(page, 'Effective from', relativeDate(60));
  await fillDate(page, 'Effective to (optional)', relativeDate(61));
  const creating = page.waitForResponse((r) => r.url().endsWith('/v2/unit-impact-rules') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add draft rule', exact: true }).click();
  const created = await creating;
  expect(created.status()).toBe(201);
  const draft = await created.json() as UnitImpactRuleView;
  expect(Number(draft.fraction)).toBe(0.25);
  const row = page.getByRole('row').filter({ hasText: reason });
  await expect(row).toContainText('Partial: 25 % of the rate');
  await expect(row.getByTestId('approve-version')).toBeDisabled();
  const own = await command<{ code: string }>(author.token, `/v2/unit-impact-rules/${draft.id}/approve`, {});
  expect(own.status).toBe(403);
  expect(own.body.code).toBe('SEPARATION_OF_DUTIES');
  await signOut(page);
  await signIn(page, FATIMA);
  await page.goto('/master-data/unit-impact-rules');
  await row.getByTestId('supersede').check();
  await row.getByTestId('approve-version').click();
  await expect(row).toContainText('Approved');
  const saved = await call<UnitImpactRuleView>(author.token, 'GET', `/v2/unit-impact-rules/${draft.id}`);
  expect(saved.status).toBe(200);
  expect(saved.body.state).toBe('approved');
  expect(saved.body.createdBy).toBe(author.user.id);
  expect(saved.body.approvedBy).not.toBe(author.user.id);
});

test('source owner creates status rules and a separate accountant approves the version', async ({ page }) => {
  const author = await apiLogin(SARA);
  const source = `demo-ui-${randomUUID().slice(0, 8)}`;
  await signIn(page, SARA);
  await page.goto('/connectivity/source-status');
  await page.getByTestId('mapping-new-source').click();
  await page.getByTestId('mapping-source').fill(source);
  await fillDate(page, 'Effective from', relativeDate(-1));
  await page.getByLabel('Source status 1', { exact: true }).fill('Released');
  await page.getByTestId('mapping-released').check();
  await page.getByTestId('mapping-add-status').click();
  await page.getByLabel('Source status 2', { exact: true }).fill('In Review');
  await page.locator('#mapping-notes').fill('Demo: HDPE laboratory certificate release workflow UI');
  const creating = page.waitForResponse((r) => r.url().endsWith('/v2/source-status-mappings') && r.request().method() === 'POST');
  await page.getByTestId('mapping-save').click();
  const created = await creating;
  expect(created.status()).toBe(201);
  const draft = await created.json() as SourceStatusMappingView;
  const group = page.locator(`[data-testid="mapping-source-group"][data-source="${source}"]`);
  await expect(group).toContainText('You drafted this version; another source owner approves it.');
  await expect(group.getByTestId('mapping-approve')).toHaveCount(0);
  const own = await command<{ code: string }>(author.token, `/v2/source-status-mappings/${draft.id}/approve`, {});
  expect(own.status).toBe(403);
  expect(own.body.code).toBe('SEPARATION_OF_DUTIES');
  await signOut(page);
  await signIn(page, DAVID);
  await page.goto('/connectivity/source-status');
  await group.getByTestId('mapping-approve').click();
  await expect(group.getByTestId('mapping-version')).toHaveAttribute('data-state', 'approved');
  await expect(group.getByTestId('mapping-version')).toHaveAttribute('data-in-force', 'true');
  await expect(group.getByTestId('mapping-rules')).toContainText('RELEASED → released');
  await expect(group.getByTestId('mapping-rules')).toContainText('IN REVIEW → not released');
  const versions = await call<{ items: SourceStatusMappingView[] }>(author.token, 'GET', '/v2/source-status-mappings');
  expect(versions.status).toBe(200);
  expect(versions.body.items.find((item) => item.id === draft.id)).toMatchObject({ state: 'approved', inForce: true, createdBy: author.user.id });
});

test('metrology delegation grants approval, preserves maker-checker, and loses access after UI revocation', async ({ page }) => {
  const author = await apiLogin(KAVEH);
  const delegate = await apiLogin(SARA);
  const budgetAuthor = await apiLogin(DAVID);
  const unit = units.find((row) => row.code === 'unit200')!;
  const reason = `Demo: HDPE unit200 metrology cover UI ${randomUUID()}`;
  let createdId: string | undefined;
  let revoked = false;
  await signIn(page, KAVEH);
  try {
    await page.goto('/delegations');
    await page.getByTestId('delegation-new').click();
    await expect(page.getByTestId('delegation-save')).toBeDisabled();
    await page.getByTestId('delegation-delegate').selectOption(delegate.user.id);
    await page.getByTestId('delegation-role').selectOption('metrology_approver');
    await page.getByTestId('delegation-unit').selectOption(unit.id);
    await fillDate(page, 'From', relativeDate(-1));
    await fillDate(page, 'Until (at most 90 days)', relativeDate(1));
    await page.getByTestId('delegation-reason').fill(reason);
    const creating = page.waitForResponse((r) => r.url().endsWith('/v2/role-delegations') && r.request().method() === 'POST');
    await page.getByTestId('delegation-save').click();
    const created = await creating;
    expect(created.status()).toBe(201);
    const delegation = await created.json() as RoleDelegationView;
    createdId = delegation.id;
    expect(delegation).toMatchObject({ inForce: true, scopeKind: 'unit', scopeId: unit.id, delegateId: delegate.user.id, delegatorId: author.user.id });
    const pendingId = await verifyDelegatedMetrology(delegate.token, budgetAuthor.token, unit.id);
    const row = page.getByRole('row').filter({ hasText: reason });
    await expect(row).toContainText('In force');
    await row.getByTestId('delegation-revoke').click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('button', { name: 'Revoke delegation', exact: true })).toBeDisabled();
    await page.getByTestId('delegation-revoke-reason').fill('Demo: metrologist returned from planned leave');
    const revoking = page.waitForResponse((r) => r.url().endsWith(`/role-delegations/${createdId}/revoke`) && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Revoke delegation', exact: true }).click();
    expect((await revoking).ok()).toBe(true);
    revoked = true;
    await expect(row).toHaveCount(0);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(row).toContainText('Revoked');
    const list = await call<{ items: RoleDelegationView[] }>(author.token, 'GET', '/v2/role-delegations?state=all&limit=100');
    expect(list.status).toBe(200);
    expect(list.body.items.find((item) => item.id === createdId)).toMatchObject({ inForce: false, revokedBy: author.user.id, revokeReason: 'Demo: metrologist returned from planned leave' });
    const denied = await command<{ code: string }>(delegate.token, `/v2/uncertainty-budgets/${pendingId}/approve`, {});
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('FORBIDDEN_ROLE');
  } finally {
    if (createdId && !revoked) {
      const cleanup = await command(author.token, `/v2/role-delegations/${createdId}/revoke`, { reason: 'Demo: restore role boundary after browser test' });
      expect(cleanup.status).toBeLessThan(300);
    }
  }
});
