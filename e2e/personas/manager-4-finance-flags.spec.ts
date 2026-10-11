import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { policiesOf, type PolicySummary } from '../test-utils/finance-world';
import { api, itemsOf } from './support/manager-api';
import { ADMINS, PREFIX, sessionOf, shortId, type Session } from './support/manager-users';

/**
 * Manager approver persona — journeys 6 and 7:
 * 6. Finance (`/finance`, plan 2.6 UI): Mei (TenantAdmin) drafts an open-ended USD → IRR FX version
 *    starting far in the future (a zero rate is a validation error first); Oliver approves it — when an open-ended
 *    approved version overlaps, the 409 VERSION_OVERLAP is shown and "supersede" closes that version at
 *    the draft's start (nothing is retired, the rate in force today is unchanged). Mei drafts a valuation policy version effective in
 *    2099; her own approval is refused (403 SEPARATION_OF_DUTIES); Oliver approves it. Demo Plant's
 *    approved policy versions stay as they were.
 * 7. Feature flags: no screen exists for them (the frontend only reads flags), so Anna switches a flag
 *    that is already on through the API (a no-op, never off) and the audit log shows the entry; the
 *    flag-gated menu entries stay visible.
 * Data: FX version source `P-MGR-FX …`, policy version notes `P-MGR-policy …` — kept.
 */
let mei: Session;
let oliver: Session;
let anna: Session;
let policiesBefore: PolicySummary[] = [];
const suffix = shortId();
const fxSource = `${PREFIX}FX ${suffix}`;
const policyNotes = `${PREFIX}policy ${suffix}`;
// every run approves its own open-ended far-future version (a later start every minute): "supersede" closes the
// open-ended predecessor at this start, and only an open-ended candidate may supersede an open-ended version
const fxYear = 2100 + Math.floor((Date.now() - Date.UTC(2026, 9, 11)) / 60_000) % 7000;
const fxWindow = { from: `${fxYear}-01-01T00:00` };

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const fxRow = (page: Page, source: string) => page.locator(`[data-testid="fx-row"][data-source="${source}"]`);
const fxState = (page: Page, source: string) => fxRow(page, source).getByTestId('version-state');

async function openFinance(page: Page, tab: 'fx-rates' | 'policies'): Promise<void> {
  await page.goto('/finance');
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId(`tab-${tab}`).click();
  if (tab === 'fx-rates') await page.locator('#fxPairFilter').selectOption('USD-IRR');
}

interface FxVersion {
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

test.describe('Manager persona — finance approvals and feature flags', () => {
  test.beforeAll(async () => {
    [mei, oliver, anna] = await Promise.all([sessionOf(ADMINS.mei), sessionOf(ADMINS.oliver), sessionOf(ADMINS.anna)]);
    policiesBefore = await policiesOf(mei.token);
  });

  test('J6a Mei drafts a future USD → IRR FX version (zero rate refused first)', async ({ page }) => {
    await loginViaUI(page, ADMINS.mei.email, ADMINS.mei.password);
    await expect(page.locator('a[href="/finance"]').first()).toBeVisible();
    await openFinance(page, 'fx-rates');
    await page.getByTestId('fx-new').click();
    await page.selectOption('#fromCurrency', 'USD');
    await page.selectOption('#toCurrency', 'IRR');
    await page.fill('#rate', '0');
    await page.fill('#fxEffectiveFrom', fxWindow.from);
    await page.fill('#fxSource', fxSource);
    await page.getByTestId('fx-save').click();
    await expect(page.getByTestId('field-error-rate')).toContainText('> 0');
    expect((await fxVersions(mei.token)).find((v) => v.source === fxSource)).toBeUndefined();
    await page.fill('#rate', '2750000');
    await page.getByTestId('fx-save').click();
    await expect(fxState(page, fxSource)).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
    await expect(fxRow(page, fxSource).getByTestId('fx-rate')).toHaveText('1 USD = 2750000 IRR');
  });

  test('J6b Oliver approves it: the overlap with the live version is shown (409), supersede closes it in 2099', async ({ page }) => {
    const live = (await fxVersions(oliver.token)).filter((v) => v.state === 'approved' && v.source !== fxSource);
    expect(live.length).toBeGreaterThan(0);
    const inForceToday = live.find((v) => v.effectiveFrom <= new Date().toISOString() && (v.effectiveTo === null || v.effectiveTo > new Date().toISOString()));
    expect(inForceToday, 'Demo Plant has a live USD → IRR rate before the test').toBeDefined();
    await loginViaUI(page, ADMINS.oliver.email, ADMINS.oliver.password);
    await openFinance(page, 'fx-rates');
    await fxRow(page, fxSource).getByTestId('fx-approve').click();
    const refusal = fxRow(page, fxSource).getByTestId('refusal');
    await expect.poll(async () => ((await refusal.count()) > 0 ? 'refused' : await fxState(page, fxSource).getAttribute('data-state')), { timeout: 20_000 }).not.toBe('draft');
    if ((await refusal.count()) > 0) {
      await expect(refusal).toHaveAttribute('data-code', 'VERSION_OVERLAP');
      await expect(refusal.getByTestId('refusal-conflict')).toHaveCount(1);
      await expect(fxState(page, fxSource)).toHaveAttribute('data-state', 'draft');
      await fxRow(page, fxSource).getByTestId('fx-supersede').click();
      await fxRow(page, fxSource).getByTestId('fx-approve').click();
        test.info().annotations.push({ type: 'note', description: 'VERSION_OVERLAP with an open-ended approved version; approved with supersede' });
    }
    await expect(fxState(page, fxSource)).toHaveAttribute('data-state', 'approved', { timeout: 20_000 });
    const after = await fxVersions(oliver.token);
    expect(after.find((v) => v.source === fxSource)?.state).toBe('approved');
    for (const version of live) expect(after.find((v) => v.version === version.version)?.state).toBe('approved'); // nothing retired
    expect(after.find((v) => v.version === inForceToday?.version)?.effectiveFrom).toBe(inForceToday?.effectiveFrom); // the live rate still applies today
    await page.reload();
    await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('tab-fx-rates').click();
    await page.locator('#fxPairFilter').selectOption('USD-IRR');
    await expect(fxState(page, fxSource)).toHaveAttribute('data-state', 'approved');
  });

  test("J6c valuation policy: Mei's own approval is refused (SEPARATION_OF_DUTIES); Oliver approves; older versions unchanged", async ({ browser }) => {
    const author = await browser.newPage();
    await loginViaUI(author, ADMINS.mei.email, ADMINS.mei.password);
    await openFinance(author, 'policies');
    await expect(author.getByTestId('policy-banner')).toBeVisible({ timeout: 20_000 });
    await author.getByTestId('policy-new').click();
    await author.fill('#policyEffectiveFrom', '2099-01-01T00:00');
    await author.fill('#policyNotes', policyNotes);
    await author.getByTestId('policy-save').click();
    const row = author.getByTestId('policy-row').filter({ hasText: policyNotes });
    await expect(row).toHaveAttribute('data-status', 'unapproved', { timeout: 20_000 });
    await row.getByTestId('policy-approve-start').click();
    await row.getByTestId('policy-approve-submit').click();
    await expect(row.getByTestId('refusal')).toHaveAttribute('data-code', 'SEPARATION_OF_DUTIES', { timeout: 20_000 });
    await expect(row.getByTestId('refusal')).toHaveAttribute('data-kind', 'duties');
    expect((await policiesOf(mei.token)).find((p) => p.notes === policyNotes)?.approved).toBe(false);
    await author.close();

    const approver = await browser.newPage();
    await loginViaUI(approver, ADMINS.oliver.email, ADMINS.oliver.password);
    await openFinance(approver, 'policies');
    const theirs = approver.getByTestId('policy-row').filter({ hasText: policyNotes });
    await theirs.getByTestId('policy-approve-start').click();
    await theirs.getByTestId('policy-approve-submit').click();
    await expect(theirs).toHaveAttribute('data-status', 'approved', { timeout: 20_000 });
    const after = await policiesOf(oliver.token);
    expect(after.find((p) => p.notes === policyNotes)?.approved).toBe(true);
    expect(after.filter((p) => p.notes !== policyNotes)).toEqual(policiesBefore); // the owner's versions are untouched
    await approver.close();
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
    for (const href of ['/downtime', '/planning', '/codes-admin', '/finance']) await expect(page.locator(`nav a[href="${href}"]`)).toBeVisible();
    await expect(page.locator('nav a[href="/admin"]')).toHaveCount(0); // Admin Panel is SuperAdmin-only
  });
});
