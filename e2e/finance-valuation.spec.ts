import { test, expect, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call } from './test-utils/downtime-world';
import { E2E_FX_SOURCE, ensureFinanceTenant, FINANCE_TENANT, FINANCE_AUTHOR, policiesOf, retireE2eFxRates, type PolicySummary } from './test-utils/finance-world';

/**
 * Finance screens (plan 2.6 UI, prerequisite of 3.10) at `/finance` behind `v2.codesAdmin`:
 * - FX rates as manager@acme.com in Demo Plant: a USD → IRR draft for a dedicated past window is created
 *   and approved (the API has no separation of duties for FX rates, so no second approver is needed); a
 *   second draft for the same window is refused at approval with 409 VERSION_OVERLAP listing the first;
 *   both are retired again through the screen.
 * - Valuation policy in the dedicated "E2E Test Tenant finance": the author creates a draft and its own
 *   approval is refused with 403 SEPARATION_OF_DUTIES. Demo Plant's policy versions are never touched
 *   (checked before / after).
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const ADMIN = { email: 'admin@acme.com', password: 'demo123' };
const WINDOW = { from: '2001-01-01T00:00', to: '2001-01-02T00:00' };

let manager = '';
let demoPolicies: PolicySummary[] = [];
const suffix = Date.now().toString(36);

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const fxRow = (page: Page, source: string) => page.locator(`[data-testid="fx-row"][data-source="${source}"]`);

async function openFinance(page: Page): Promise<void> {
  await page.goto('/finance');
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
}

async function addFxDraft(page: Page, source: string, rate: string): Promise<void> {
  await page.getByTestId('fx-new').click();
  await page.fill('#rate', rate);
  await page.fill('#fxEffectiveFrom', WINDOW.from);
  await page.fill('#fxEffectiveTo', WINDOW.to);
  await page.fill('#fxSource', source);
  await page.getByTestId('fx-save').click();
  await expect(fxRow(page, source).getByTestId('version-state')).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
}

test.describe('Finance — FX rates and valuation policy approval (plan 3.10 prerequisite)', () => {
  test.beforeAll(async () => {
    manager = (await authenticate(MANAGER.email, MANAGER.password)).accessToken;
    const flags = await call<{ items: Array<{ key: string; enabled: boolean }> }>(manager, 'GET', '/v2/feature-flags');
    expect(flags.body.items.find((flag) => flag.key === 'v2.codesAdmin')?.enabled, 'v2.codesAdmin must be on for Demo Plant').toBe(true);
    await retireE2eFxRates(manager);
    demoPolicies = await policiesOf(manager);
  });

  test.afterAll(async () => {
    if (manager) await retireE2eFxRates(manager);
  });

  test('FX: draft → approve in a dedicated window; an overlapping draft is refused with 409; both retired', async ({ page }) => {
    const [first, second] = [`${E2E_FX_SOURCE} ${suffix} A`, `${E2E_FX_SOURCE} ${suffix} B`];
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await expect(page.locator('a[href="/finance"]').first()).toBeVisible();
    await openFinance(page);
    await page.getByTestId('tab-fx-rates').click();
    await page.locator('#fxPairFilter').selectOption('USD-IRR');

    await addFxDraft(page, first, '585000.25');
    await expect(fxRow(page, first).getByTestId('fx-rate')).toHaveText('1 USD = 585000.25 IRR');
    await fxRow(page, first).getByTestId('fx-approve').click();
    await expect(fxRow(page, first).getByTestId('version-state')).toHaveAttribute('data-state', 'approved', { timeout: 20_000 });

    await addFxDraft(page, second, '590000');
    await fxRow(page, second).getByTestId('fx-approve').click();
    const refusal = fxRow(page, second).getByTestId('refusal');
    await expect(refusal).toHaveAttribute('data-code', 'VERSION_OVERLAP', { timeout: 20_000 });
    await expect(refusal.getByTestId('refusal-conflict')).toHaveCount(1);
    await expect(fxRow(page, second).getByTestId('version-state')).toHaveAttribute('data-state', 'draft');

    for (const source of [second, first]) {
      await fxRow(page, source).getByTestId('fx-retire').click();
      await expect(fxRow(page, source).getByTestId('version-state')).toHaveAttribute('data-state', 'retired', { timeout: 20_000 });
    }
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
    await openFinance(page);
    await expect(page.getByTestId('recalculation-notice')).toBeVisible();
    await expect(page.getByTestId('policy-banner')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('policy-new').click();
    await page.fill('#policyEffectiveFrom', '2099-01-01T00:00');
    await page.fill('#policyNotes', notes);
    await page.getByTestId('policy-save').click();
    const row = page.getByTestId('policy-row').filter({ hasText: notes });
    await expect(row).toHaveAttribute('data-status', 'unapproved', { timeout: 20_000 });
    await expect(row).toContainText('You');

    await row.getByTestId('policy-approve-start').click();
    await row.getByTestId('policy-approve-submit').click();
    const refusal = row.getByTestId('refusal');
    await expect(refusal).toHaveAttribute('data-code', 'SEPARATION_OF_DUTIES', { timeout: 20_000 });
    await expect(refusal).toHaveAttribute('data-kind', 'duties');
    const created = (await policiesOf(author)).find((policy) => policy.notes === notes);
    expect(created?.approved).toBe(false);
  });

  test("Demo Plant's valuation policy versions are unchanged by this spec", async () => {
    expect(await policiesOf(manager)).toEqual(demoPolicies);
  });
});
