import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { confirmDialog, fillDateTime } from './personas/support/codes-finance-ui';
import { expectRefused, expectSodDisabled } from './personas/support/hidden-controls';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call } from './test-utils/downtime-world';
import { E2E_FX_SOURCE, ensureFinanceTenant, FINANCE_TENANT, FINANCE_AUTHOR, policiesOf, retireE2eFxRates, type PolicySummary } from './test-utils/finance-world';
import { ensureFinanceUsers, FINANCE_APPROVER, FINANCE_MAINTAINER, financePage, plantOf, type FinanceUsers } from './test-utils/finance-users';

/**
 * Finance screens (plan 2.6 UI, prerequisite of 3.10) at `/finance`:
 * - FX rates in Demo Plant (SME V1, 14 Oct 2026): the E2E finance maintainer creates a USD → IRR draft for a
 *   dedicated past window (each saved draft opens its own page) and sees no approve control; the E2E
 *   finance approver approves it after a confirmation; a second draft for the same window is refused at
 *   approval with 409 VERSION_OVERLAP listing the first; the approver retires both through the screen.
 *   manager@acme.com (manager approver) is refused FX and policy writes with 403 FORBIDDEN_ROLE.
 * - Valuation policy in the dedicated "E2E Test Tenant finance": the author (holding both finance roles)
 *   creates a draft and its own approval is refused with 403 SEPARATION_OF_DUTIES. Demo Plant's policy
 *   versions are never touched (checked before / after).
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const ADMIN = { email: 'admin@acme.com', password: 'demo123' };
const WINDOW = { from: '2001-01-01T00:00', to: '2001-01-02T00:00' };

let manager = '';
let finance: FinanceUsers = { maintainer: '', approver: '' };
let demoPolicies: PolicySummary[] = [];
const suffix = Date.now().toString(36);

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const fxDetail = (page: Page) => page.getByTestId('fx-detail');

async function fxIdOf(source: string): Promise<string> {
  const list = await call<{ items: Array<{ id: string; source: string | null }> }>(finance.maintainer, 'GET', '/v2/fx-rates?fromCurrency=USD&toCurrency=IRR&limit=200');
  const id = list.body.items.find((rate) => rate.source === source)?.id;
  expect(id, `FX version ${source}`).toBeDefined();
  return id ?? '';
}

/** The FX version's page (the list is paged; the version is looked up by its source). */
async function openFx(page: Page, source: string): Promise<void> {
  await page.goto(`/finance/fx/${await fxIdOf(source)}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(fxDetail(page)).toBeVisible({ timeout: 60_000 });
}

async function addFxDraft(page: Page, source: string, rate: string): Promise<void> {
  await page.goto('/finance?tab=fx');
  await page.getByTestId('fx-new').click({ timeout: 60_000 });
  await page.fill('#rate', rate);
  await fillDateTime(page, 'Valid from', WINDOW.from);
  await fillDateTime(page, 'Valid until', WINDOW.to);
  await page.fill('#fxSource', source);
  await page.getByTestId('fx-save').click();
  await expect(fxDetail(page)).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
}

test.describe('Finance — FX rates and valuation policy approval (plan 3.10 prerequisite)', () => {
  test.beforeAll(async () => {
    manager = (await authenticate(MANAGER.email, MANAGER.password)).accessToken;
    const flags = await call<{ items: Array<{ key: string; enabled: boolean }> }>(manager, 'GET', '/v2/feature-flags');
    expect(flags.body.items.find((flag) => flag.key === 'v2.codesAdmin')?.enabled, 'v2.codesAdmin must be on for Demo Plant').toBe(true);
    const superAdmin = (await authenticate(ADMIN.email, ADMIN.password)).accessToken;
    finance = await ensureFinanceUsers(superAdmin, manager, await plantOf(manager));
    await retireE2eFxRates(finance.approver);
    demoPolicies = await policiesOf(manager);
  });

  test.afterAll(async () => {
    if (finance.approver) await retireE2eFxRates(finance.approver);
  });

  test('SME V1: a manager approver can no longer write FX rates or sign off a valuation policy (403 FORBIDDEN_ROLE)', async () => {
    const draft = { fromCurrency: 'USD', toCurrency: 'IRR', rate: '1', effectiveFrom: '2001-01-01T00:00:00Z', source: `${E2E_FX_SOURCE} ${suffix} refused` };
    expectRefused(await call(manager, 'POST', '/v2/fx-rates', draft, { 'Idempotency-Key': randomUUID() }), 'FORBIDDEN_ROLE');
    const [newest] = demoPolicies;
    expect(newest, 'Demo Plant has a valuation policy version').toBeDefined();
    expectRefused(await call(manager, 'POST', `/v2/valuation-policies/${newest.id}/approve`, {}, { 'Idempotency-Key': randomUUID() }), 'FORBIDDEN_ROLE');
  });

  test('FX: finance maintainer drafts, finance approver approves in a dedicated window; an overlapping draft is refused with 409; both retired', async ({ page, browser }) => {
    const [first, second] = [`${E2E_FX_SOURCE} ${suffix} A`, `${E2E_FX_SOURCE} ${suffix} B`];
    await loginViaUI(page, FINANCE_MAINTAINER.email, FINANCE_MAINTAINER.password);
    await expect(page.locator('a[href="/finance"]').first()).toBeVisible();

    await addFxDraft(page, first, '585000.25');
    await expect(fxDetail(page).getByTestId('fx-rate')).toHaveText('1 USD = 585,000.25 IRR');
    // a maintainer never approves (SME V1): no approve or retire control at all
    await expect(page.getByTestId('fx-approve')).toHaveCount(0);
    await addFxDraft(page, second, '590000');

    const approver = await financePage(browser, FINANCE_APPROVER);
    await openFx(approver, first);
    await approver.getByTestId('fx-approve').click();
    await confirmDialog(approver, 'Approve rate');
    await expect(fxDetail(approver)).toHaveAttribute('data-state', 'approved', { timeout: 20_000 });
    await openFx(approver, second);
    await approver.getByTestId('fx-approve').click();
    await confirmDialog(approver, 'Approve rate');
    const refusal = approver.getByRole('alertdialog').getByTestId('refusal');
    await expect(refusal).toHaveAttribute('data-code', 'VERSION_OVERLAP', { timeout: 20_000 });
    await expect(refusal.getByTestId('refusal-conflict')).toHaveCount(1);
    await approver.keyboard.press('Escape');
    await expect(fxDetail(approver)).toHaveAttribute('data-state', 'draft');

    for (const source of [second, first]) {
      await openFx(approver, source);
      await approver.getByTestId('fx-retire').click();
      await confirmDialog(approver, 'Retire rate');
      await expect(fxDetail(approver)).toHaveAttribute('data-state', 'retired', { timeout: 20_000 });
    }
    await approver.context().close();
  });

  test("policy: the author's own approval is refused (SEPARATION_OF_DUTIES) in the E2E finance tenant", async ({ page }) => {
    const superAdmin = (await authenticate(ADMIN.email, ADMIN.password)).accessToken;
    const { tenantId, organizationId, author } = await ensureFinanceTenant(superAdmin);
    const notes = `E2E finance SoD ${suffix}`;
    // The saved plant selection is one server-wide app setting (it names Demo Plant, and the header picks
    // the first listed tenant when none is saved); this browser alone reads a selection of the finance
    // tenant, and its writes are dropped, so the shared setting is never changed.
    const selection = { organization: { id: organizationId, name: 'E2E Test Org finance' }, tenant: { id: tenantId, name: FINANCE_TENANT.name, organizationId } };
    await page.route('**/api/app-settings/plantSelection**', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(selection) }) : route.abort(),
    );
    await loginViaUI(page, FINANCE_AUTHOR.email, FINANCE_AUTHOR.password);
    await page.goto('/finance');
    await expect(page.getByTestId('recalculation-notice')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('policy-banner')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('policy-new').click();
    await fillDateTime(page, 'Starts', '2099-01-01T00:00');
    await page.fill('#policyNotes', notes);
    await page.getByTestId('policy-save').click();
    // saving opens the version's page
    const row = page.getByTestId('policy-detail');
    await expect(row).toHaveAttribute('data-status', 'unapproved', { timeout: 20_000 });
    await expect(row).toContainText('You');

    // the author sees Approve disabled with the separation-of-duties reason; the server refuses her own approval
    await expectSodDisabled(row.getByTestId('policy-approve-start'));
    const drafted = (await policiesOf(author)).find((policy) => policy.notes === notes);
    expectRefused(await call(author, 'POST', `/v2/valuation-policies/${drafted?.id}/approve`, {}, { 'Idempotency-Key': randomUUID() }), 'SEPARATION_OF_DUTIES');
    const created = (await policiesOf(author)).find((policy) => policy.notes === notes);
    expect(created?.approved).toBe(false);
  });

  test("Demo Plant's valuation policy versions are unchanged by this spec", async () => {
    expect(await policiesOf(manager)).toEqual(demoPolicies);
  });
});
