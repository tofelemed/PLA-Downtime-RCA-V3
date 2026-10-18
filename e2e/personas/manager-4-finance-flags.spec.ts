import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { policiesOf, type PolicySummary } from '../test-utils/finance-world';
import { confirmDialog, fillDateTime } from './support/codes-finance-ui';
import { api, itemsOf, post } from './support/manager-api';
import { expectRefused } from './support/hidden-controls';
import { ADMINS, PREFIX, sessionOf, shortId, type Session } from './support/manager-users';
import { ensureFinanceUsers, FINANCE_APPROVER, FINANCE_MAINTAINER, financePage, type FinanceUsers } from '../test-utils/finance-users';

/**
 * Manager approver persona — journeys 6 and 7:
 * 6. Finance (`/finance`, plan 2.6 UI; SME V1 14 Oct 2026, finance roles): Mei and Oliver (manager
 *    approvers) see no draft buttons and are refused FX and policy writes with 403 FORBIDDEN_ROLE. The E2E
 *    finance maintainer (registered by Anna, granted `finance_maintainer`) drafts an open-ended USD → IRR FX
 *    version far in the future (a zero rate is a validation error first); the E2E finance approver approves
 *    it — when an open-ended approved version overlaps, the 409 VERSION_OVERLAP is shown and "supersede"
 *    closes that version at the draft's start (nothing retired, today's rate unchanged) — and the screen
 *    names the revaluation queued. The maintainer drafts a 2099 policy version without an approve control;
 *    the approver signs it off (author/approver SoD is covered by finance-valuation.spec.ts). Demo Plant's
 *    approved policy versions stay as they were.
 * 7. Feature flags: no screen exists for them (the frontend only reads flags), so Anna switches a flag
 *    that is already on through the API (a no-op, never off) and the audit log shows the entry; the
 *    flag-gated menu entries stay visible.
 * Data: FX version source `P-MGR-FX …`, policy version notes `P-MGR-policy …` — kept.
 */
let mei: Session;
let oliver: Session;
let anna: Session;
let finance: FinanceUsers = { maintainer: '', approver: '' };
let policiesBefore: PolicySummary[] = [];
const suffix = shortId();
const fxSource = `${PREFIX}FX ${suffix}`;
const policyNotes = `${PREFIX}policy ${suffix}`;
// every run approves its own open-ended far-future version, one year after the latest live or drafted USD → IRR
// version of any run (persona specs share Demo Plant): "supersede" then closes exactly the one open-ended
// predecessor at this start (only an open-ended candidate may supersede an open-ended version)
let fxWindow = { from: '' };

test.describe.configure({ mode: 'serial', timeout: 180_000 });


interface FxVersion {
  id: string;
  version: number;
  state: string;
  source: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

async function fxVersions(token: string): Promise<FxVersion[]> {
  const list = await api<{ items: FxVersion[] }>(token, 'GET', '/v2/fx-rates?fromCurrency=USD&toCurrency=IRR&limit=200');
  expect(list.status).toBe(200);
  return itemsOf(list.body);
}

const fxDetail = (page: Page) => page.getByTestId('fx-detail');

/** The FX version's page (looked up by its source through the API: the list is paged). */
async function openFx(page: Page, token: string, source: string): Promise<void> {
  const id = (await fxVersions(token)).find((v) => v.source === source)?.id;
  expect(id, `FX version ${source}`).toBeDefined();
  await page.goto(`/finance/fx/${id}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(fxDetail(page)).toBeVisible({ timeout: 60_000 });
}

/** The policy version's page (looked up by its notes through the API). */
async function openPolicy(page: Page, token: string, notes: string): Promise<void> {
  const id = (await policiesOf(token)).find((p) => p.notes === notes)?.id;
  expect(id, `policy ${notes}`).toBeDefined();
  await page.goto(`/finance/policies/${id}`);
  await expect(page.getByTestId('policy-detail')).toBeVisible({ timeout: 60_000 });
}

test.describe('Manager persona — finance approvals and feature flags', () => {
  test.beforeAll(async () => {
    [mei, oliver, anna] = await Promise.all([sessionOf(ADMINS.mei), sessionOf(ADMINS.oliver), sessionOf(ADMINS.anna)]);
    // Anna (TenantAdmin) registers the E2E finance users and grants their finance roles in Demo Plant
    finance = await ensureFinanceUsers(anna.token, anna.token, { tenantId: anna.tenantId, organizationId: anna.organizationId });
    policiesBefore = await policiesOf(mei.token);
    const years = (await fxVersions(mei.token)).filter((v) => v.state !== 'retired').map((v) => Number(v.effectiveFrom.slice(0, 4)));
    fxWindow = { from: `${Math.max(2100, ...years) + 1}-01-01T00:00` };
  });

  test('J6a SME V1: Mei (manager approver) no longer drafts FX rates or policies: no button, 403 FORBIDDEN_ROLE', async ({ page }) => {
    await loginViaUI(page, ADMINS.mei.email, ADMINS.mei.password);
    await expect(page.locator('a[href="/finance"]').first()).toBeVisible();
    await page.goto('/finance?tab=fx');
    await expect(page.getByTestId('fx-rates-tab')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('fx-new')).toHaveCount(0);
    await page.goto('/finance?tab=policies');
    await expect(page.getByTestId('policies-tab')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('policy-new')).toHaveCount(0);
    const fx = { fromCurrency: 'USD', toCurrency: 'IRR', rate: '1', effectiveFrom: `${fxWindow.from}:00Z`, source: `${fxSource} refused` };
    expectRefused(await post(mei.token, '/v2/fx-rates', fx), 'FORBIDDEN_ROLE');
    const policy = { defaultBasis: 'contribution_margin', timeBasisRule: 'exclusive', reportingCurrencies: ['IRR', 'USD'], fxPolicy: 'snapshot', effectiveFrom: '2099-01-01T00:00:00Z' };
    expectRefused(await post(mei.token, '/v2/valuation-policies', policy), 'FORBIDDEN_ROLE');
  });

  test('J6b the finance maintainer drafts a future USD → IRR FX version (zero rate refused first)', async ({ browser }) => {
    const page = await financePage(browser, FINANCE_MAINTAINER);
    await page.goto('/finance?tab=fx');
    await page.getByTestId('fx-new').click({ timeout: 60_000 });
    await page.selectOption('#fromCurrency', 'USD');
    await page.selectOption('#toCurrency', 'IRR');
    await page.fill('#rate', '0');
    await fillDateTime(page, 'Valid from', fxWindow.from);
    await page.fill('#fxSource', fxSource);
    await page.getByTestId('fx-save').click();
    await expect(page.getByTestId('field-error-rate')).toContainText('greater than 0');
    expect((await fxVersions(finance.maintainer)).find((v) => v.source === fxSource)).toBeUndefined();
    await page.fill('#rate', '2750000');
    await page.getByTestId('fx-save').click();
    await expect(fxDetail(page)).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
    await expect(fxDetail(page).getByTestId('fx-rate')).toHaveText('1 USD = 2750000 IRR');
    await page.context().close();
  });

  test('J6c the finance approver approves it: the overlap with the live version is shown (409), supersede closes it; Oliver cannot approve', async ({ browser }) => {
    const draft = (await fxVersions(oliver.token)).find((v) => v.source === fxSource);
    expectRefused(await post(oliver.token, `/v2/fx-rates/${draft?.id}/approve`, {}), 'FORBIDDEN_ROLE');
    const live = (await fxVersions(oliver.token)).filter((v) => v.state === 'approved' && v.source !== fxSource);
    expect(live.length).toBeGreaterThan(0);
    const inForceToday = live.find((v) => v.effectiveFrom <= new Date().toISOString() && (v.effectiveTo === null || v.effectiveTo > new Date().toISOString()));
    expect(inForceToday, 'Demo Plant has a live USD → IRR rate before the test').toBeDefined();
    const page = await financePage(browser, FINANCE_APPROVER);
    await openFx(page, finance.approver, fxSource);
    await page.getByTestId('fx-approve').click();
    await confirmDialog(page, 'Approve rate');
    const refusal = page.getByRole('alertdialog').getByTestId('refusal');
    await expect.poll(async () => ((await refusal.count()) > 0 ? 'refused' : await fxDetail(page).getAttribute('data-state')), { timeout: 20_000 }).not.toBe('draft');
    if ((await refusal.count()) > 0) {
      await expect(refusal).toHaveAttribute('data-code', 'VERSION_OVERLAP');
      await expect(refusal.getByTestId('refusal-conflict')).toHaveCount(1);
      await expect(fxDetail(page)).toHaveAttribute('data-state', 'draft');
      await page.getByTestId('fx-supersede').click();
      await confirmDialog(page, 'Approve rate');
      test.info().annotations.push({ type: 'note', description: 'VERSION_OVERLAP with an open-ended approved version; approved with supersede' });
    }
    await expect(fxDetail(page)).toHaveAttribute('data-state', 'approved', { timeout: 20_000 });
    // SME V7: the approval names the revaluation it queued
    await expect(page.getByTestId('revaluation-queued')).toBeVisible();
    const after = await fxVersions(oliver.token);
    expect(after.find((v) => v.source === fxSource)?.state).toBe('approved');
    for (const version of live) expect(after.find((v) => v.id === version.id)?.state).toBe('approved'); // nothing retired
    expect(after.find((v) => v.id === inForceToday?.id)?.effectiveFrom).toBe(inForceToday?.effectiveFrom); // the live rate still applies today
    await page.context().close();
  });

  test('J6d valuation policy: the finance maintainer drafts, Oliver cannot approve (403 FORBIDDEN_ROLE), the finance approver approves; older versions unchanged', async ({ browser }) => {
    const author = await financePage(browser, FINANCE_MAINTAINER);
    await author.goto('/finance');
    await expect(author.getByTestId('policy-banner')).toBeVisible({ timeout: 60_000 });
    await author.getByTestId('policy-new').click();
    await fillDateTime(author, 'Starts', '2099-01-01T00:00');
    await author.fill('#policyNotes', policyNotes);
    await author.getByTestId('policy-save').click();
    await expect(author.getByTestId('policy-detail')).toHaveAttribute('data-status', 'unapproved', { timeout: 20_000 });
    // a maintainer never signs off (SME V1): no approve control
    await expect(author.getByTestId('policy-approve-start')).toHaveCount(0);
    const drafted = (await policiesOf(finance.maintainer)).find((p) => p.notes === policyNotes);
    expectRefused(await post(oliver.token, `/v2/valuation-policies/${drafted?.id}/approve`, {}), 'FORBIDDEN_ROLE');
    expect((await policiesOf(oliver.token)).find((p) => p.notes === policyNotes)?.approved).toBe(false);
    await author.context().close();

    const approver = await financePage(browser, FINANCE_APPROVER);
    await openPolicy(approver, finance.approver, policyNotes);
    await approver.getByTestId('policy-approve-start').click();
    await confirmDialog(approver, `Approve version ${drafted?.version}`);
    await expect(approver.getByTestId('policy-detail')).toHaveAttribute('data-status', 'approved', { timeout: 20_000 });
    const after = await policiesOf(oliver.token);
    expect(after.find((p) => p.notes === policyNotes)?.approved).toBe(true);
    expect(after.filter((p) => p.notes !== policyNotes)).toEqual(policiesBefore); // the owner's versions are untouched
    await approver.context().close();
  });

  test('J7 feature flags: no screen; Anna sets an already-on flag on through the API (no-op, audited); menu entries stay', async ({ page }) => {
    const flags = await api<{ items: Array<{ key: string; enabled: boolean }> }>(anna.token, 'GET', '/v2/feature-flags');
    expect(flags.status).toBe(200);
    expect(flags.body.items.every((flag) => flag.enabled)).toBe(true);
    const rca = flags.body.items.find((flag) => flag.key === 'v2.rca');
    expect(rca?.enabled).toBe(true);
    const since = new Date().toISOString();
    const set = await api<{ key: string; enabled: boolean }>(anna.token, 'PUT', '/v2/feature-flags/v2.rca', { enabled: true });
    expect([set.status, set.body.enabled]).toEqual([200, true]);
    const again = await api<{ items: Array<{ key: string; enabled: boolean }> }>(anna.token, 'GET', '/v2/feature-flags');
    expect(again.body.items.every((flag) => flag.enabled)).toBe(true);

    interface AuditRow { action: string; entityType: string; details: string | null; userId: string | null }
    const flagAudit = async (): Promise<AuditRow | null> => {
      const logs = await api<AuditRow[]>(anna.token, 'GET', `/audit-logs?userId=${anna.userId}&startDate=${encodeURIComponent(since)}&limit=50`);
      return itemsOf(logs.body).find((log) => (log.details ?? '').includes('feature-flags/v2.rca')) ?? null;
    };
    await expect.poll(flagAudit, { timeout: 15_000 }).not.toBeNull(); // the global interceptor logs the mutating request
    const entry = await flagAudit();
    expect(entry?.action).toBe('UPDATE');
    expect(entry?.userId).toBe(anna.userId);

    await loginViaUI(page, ADMINS.anna.email, ADMINS.anna.password);
    for (const href of ['/downtime', '/planning', '/master-data', '/finance']) await expect(page.locator(`nav a[href="${href}"]`)).toBeVisible();
    await expect(page.locator('nav a[href="/admin"]')).toBeVisible(); // Admin Panel: plant-level tabs for a TenantAdmin
  });
});
