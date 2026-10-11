import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginViaUI } from '../test-utils/auth-helpers';
import { findCode } from '../test-utils/codes-world';
import { policiesOf } from '../test-utils/finance-world';
import { api, itemsOf, post } from './support/manager-api';
import { JONAS, MDA, PREFIX, expectRoleRefusal, listMdaUnits, seedPlanWorld, sessionOf, shortId, utcDate, type Session } from './support/masterdata-world';

/**
 * Master data admin persona — journeys 5, 6 and 7:
 * 6. Finance (`/finance`): Zara (PROFILE_WRITERS covers FX drafts) drafts a far-future USD → IRR version
 *    (zero rate refused first); her approval is refused (403 FORBIDDEN_ROLE); Jonas approves as setup
 *    (supersede when the open-ended live version overlaps); nothing is retired.
 * 5. Refusals shown on screen, never persisted: plan approval (Charlotte), RCA case (Hiro), valuation
 *    policy draft (Felix, POLICY_ROLES = manager only), the Connectivity screen; period approval, feature
 *    flags and integration writes through the API (403).
 * 7. Persistence: Felix (another master_data_admin) sees the unit, codes, rule and crew of the earlier
 *    specs after a re-login (hierarchy mappings: masterdata-5). Nothing is deleted or retired.
 */
let charlotte: Session;
let zara: Session;
let felix: Session;
let jonas: Session;
const suffix = shortId();
const fxSource = `${PREFIX}FX ${suffix}`;
const policyNotes = `${PREFIX}policy ${suffix}`;

test.describe.configure({ mode: 'serial', timeout: 240_000 });

const fxRow = (page: Page, source: string) => page.locator(`[data-testid="fx-row"][data-source="${source}"]`);
const fxState = (page: Page, source: string) => fxRow(page, source).getByTestId('version-state');

async function openFinance(page: Page, tab: 'fx-rates' | 'policies'): Promise<void> {
  await page.goto('/finance');
  await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId(`tab-${tab}`).click();
  if (tab === 'fx-rates') await page.locator('#fxPairFilter').selectOption('USD-IRR');
}

interface FxVersion {
  id: string;
  version: number;
  state: string;
  source: string | null;
  effectiveFrom: string;
}

async function fxVersions(token: string): Promise<FxVersion[]> {
  const list = await api<{ items: FxVersion[] }>(token, 'GET', '/v2/fx-rates?fromCurrency=USD&toCurrency=IRR&limit=200');
  expect(list.status).toBe(200);
  return itemsOf(list.body);
}

/** An open-ended far-future start of its own: one year after the latest live or drafted version (supersede closes an earlier open-ended one). */
const nextFxYear = (versions: FxVersion[]): number =>
  Math.max(5000, ...versions.filter((v) => v.state !== 'retired').map((v) => Number(v.effectiveFrom.slice(0, 4)))) + 1;

test.describe('Master data admin — finance drafts, refusals and persistence', () => {
  test.beforeAll(async () => {
    [charlotte, zara, felix, jonas] = await Promise.all([sessionOf(MDA.charlotte), sessionOf(MDA.zara), sessionOf(MDA.felix), sessionOf(JONAS)]);
  });

  test('MDA-06 Zara drafts a far-future USD → IRR FX version (zero rate refused); her approval is refused; Jonas approves; nothing retired', async ({ page }) => {
    const before = await fxVersions(zara.token);
    const fxYear = nextFxYear(before);
    await loginViaUI(page, MDA.zara.email, MDA.zara.password);
    await expect(page.locator('nav a[href="/finance"]')).toBeVisible();
    await openFinance(page, 'fx-rates');
    await page.getByTestId('fx-new').click();
    await page.selectOption('#fromCurrency', 'USD');
    await page.selectOption('#toCurrency', 'IRR');
    await page.fill('#rate', '0');
    await page.fill('#fxEffectiveFrom', `${fxYear}-01-01T00:00`);
    await page.fill('#fxSource', fxSource);
    await page.getByTestId('fx-save').click();
    await expect(page.getByTestId('field-error-rate')).toContainText('> 0');
    expect((await fxVersions(zara.token)).find((v) => v.source === fxSource)).toBeUndefined();
    await page.fill('#rate', '2750000');
    await page.getByTestId('fx-save').click();
    await expect(fxState(page, fxSource)).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
    await expect(fxRow(page, fxSource).getByTestId('fx-rate')).toHaveText('1 USD = 2750000 IRR');

    await fxRow(page, fxSource).getByTestId('fx-approve').click();
    await expectRoleRefusal(fxRow(page, fxSource).getByTestId('refusal'));
    await expect(fxState(page, fxSource)).toHaveAttribute('data-state', 'draft');
    await page.screenshot({ path: test.info().outputPath('mda-06-fx-approve-refused.png'), fullPage: true });

    const draft = (await fxVersions(zara.token)).find((v) => v.source === fxSource);
    expect(draft?.state).toBe('draft');
    expect(draft?.effectiveFrom.slice(0, 4)).toBe(String(fxYear));
    let approved = await post<{ code?: string }>(jonas.token, `/v2/fx-rates/${draft?.id}/approve`, {});
    if (approved.status === 409 && approved.body.code === 'VERSION_OVERLAP') {
      test.info().annotations.push({ type: 'note', description: 'VERSION_OVERLAP with the open-ended live version; approved with supersede' });
      approved = await post(jonas.token, `/v2/fx-rates/${draft?.id}/approve`, { supersede: true });
    }
    expect(approved.status).toBe(200);
    await page.reload();
    await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('tab-fx-rates').click();
    await page.locator('#fxPairFilter').selectOption('USD-IRR');
    await expect(fxState(page, fxSource)).toHaveAttribute('data-state', 'approved');
    const after = await fxVersions(zara.token);
    for (const version of before) expect(after.find((v) => v.id === version.id)?.state).toBe(version.state); // nothing retired
  });

  test('MDA-05a Charlotte: approving a draft plan is refused on /planning (403 shown); period approval and feature flags 403 through the API', async ({ page }) => {
    const world = await seedPlanWorld(felix, jonas, 'PLN');
    const planName = `${PREFIX}plan ${world.suffix}`;
    const dayStart = Date.parse(`${utcDate(5)}T06:00:00.000Z`);
    const plan = await post<{ id: string; code?: string }>(charlotte.token, '/v2/production-plans', {
      name: planName,
      unitId: world.unitId,
      validFrom: new Date(dayStart).toISOString(),
      validTo: new Date(dayStart + 86_400_000).toISOString(),
      basis: 'quantity',
      headerTarget: '2160',
      slices: [{ productId: world.productId }],
    });
    expect(plan.status, JSON.stringify(plan.body)).toBe(201);

    await loginViaUI(page, MDA.charlotte.email, MDA.charlotte.password);
    await page.goto('/planning?tab=plans');
    await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plans-tab')).toBeVisible({ timeout: 60_000 });
    await page.selectOption('#planUnitFilter', { label: world.unitName });
    await page.getByTestId('plan-row').filter({ hasText: planName }).first().click();
    await expect(page.getByTestId('plan-detail')).toBeVisible();
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'draft');
    await page.getByTestId('approve-plan-submit').click();
    await expectRoleRefusal(page.getByTestId('approve-plan').getByTestId('refusal'));
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'draft');
    await page.screenshot({ path: test.info().outputPath('mda-05a-plan-approve-refused.png'), fullPage: true });
    const stored = await api<{ approvalState: string }>(charlotte.token, 'GET', `/v2/production-plans/${plan.body.id}/versions/1`);
    expect([stored.status, stored.body.approvalState]).toEqual([200, 'draft']);

    const periods = await api<{ items: Array<{ id: string }> }>(charlotte.token, 'GET', '/v2/production-periods?limit=1');
    const periodId = periods.status === 200 && itemsOf(periods.body)[0]?.id ? itemsOf(periods.body)[0].id : randomUUID();
    const period = await post<{ code: string }>(charlotte.token, `/v2/production-periods/${periodId}/approve`, {});
    expect([period.status, period.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    const flag = await api<{ code: string }>(charlotte.token, 'PUT', '/v2/feature-flags/v2.rca', { enabled: true });
    expect([flag.status, flag.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
  });

  test('MDA-05b Hiro: opening an RCA case is refused in the dialog; Connectivity is not reachable; integration writes are 403', async ({ page }) => {
    const title = `${PREFIX}RCA refused ${suffix}`;
    await loginViaUI(page, MDA.hiro.email, MDA.hiro.password);
    await expect(page.locator('nav a[href="/connectivity"]')).toHaveCount(0);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('new-case').click();
    const dialog = page.getByTestId('create-case-dialog');
    await dialog.locator('#case-title').fill(title);
    await dialog.getByRole('button', { name: 'Create case' }).click();
    await expect(dialog.getByTestId('command-error')).toContainText('Refused (FORBIDDEN_ROLE)');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('mda-05b-rca-refused.png') });
    const hiro = await sessionOf(MDA.hiro);
    const cases = await api<{ items: Array<{ title: string }> }>(hiro.token, 'GET', `/v2/rcas?q=${encodeURIComponent(title)}`);
    expect(cases.status).toBe(200);
    expect(itemsOf(cases.body).filter((item) => item.title === title)).toEqual([]);

    // not in the menu, but the v2 integration console (flag on) opens read-only by URL; a write is refused on screen
    const name = `${PREFIX}refused connection ${suffix}`;
    await page.goto('/connectivity');
    await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
    test.info().annotations.push({ type: 'observation', description: 'Connectivity is hidden from the master_data_admin menu, yet /connectivity renders the v2 integration console read-only (UX06 non-writer pattern).' });
    await page.getByTestId('new-connection').click();
    await page.getByTestId('source-type-pi_web_api').click();
    await page.fill('#pi-name', name);
    await page.fill('#pi-url', 'https://pi.example.invalid/piwebapi');
    await page.fill('#pi-user', 'p-mda-reader');
    await page.fill('#pi-secret', 'not-a-real-secret');
    await page.getByTestId('connection-save').click();
    const refusal = page.getByTestId('connection-wizard').getByTestId('refusal');
    await expect(refusal).toHaveAttribute('data-kind', 'role');
    await expect(refusal).toContainText('integration administrator');
    await page.screenshot({ path: test.info().outputPath('mda-05b-connection-refused.png') });
    const connections = await api<{ items: Array<{ displayName: string }> }>(hiro.token, 'GET', '/v2/connections?limit=200');
    expect(itemsOf(connections.body).map((item) => item.displayName)).not.toContain(name);
    const connection = await post<{ code: string }>(hiro.token, '/v2/connections', { sourceType: 'mqtt', displayName: name });
    expect([connection.status, connection.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
  });

  test('MDA-05c Felix: a valuation policy draft is refused on /finance (POLICY_ROLES = manager only); nothing stored', async ({ page }) => {
    const before = await policiesOf(felix.token);
    await loginViaUI(page, MDA.felix.email, MDA.felix.password);
    await openFinance(page, 'policies');
    await expect(page.getByTestId('policy-banner')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('policy-new').click();
    await page.fill('#policyEffectiveFrom', '2099-06-01T00:00');
    await page.fill('#policyNotes', policyNotes);
    await page.getByTestId('policy-save').click();
    await expectRoleRefusal(page.getByTestId('policy-form').getByTestId('refusal'));
    await page.screenshot({ path: test.info().outputPath('mda-05c-policy-refused.png'), fullPage: true });
    const after = await policiesOf(felix.token);
    expect(after.find((p) => p.notes === policyNotes)).toBeUndefined();
    expect(after).toEqual(before);
  });

  test('MDA-07a Felix (another master_data_admin) sees the unit, codes, rule and crew left by the persona after re-login', async ({ page }) => {
    const units = await listMdaUnits(felix.token, 'U');
    expect(units.length, 'a P-MDA-U- unit of masterdata-1 exists').toBeGreaterThan(0);
    const codes = await api<{ items: Array<{ code: string }> }>(felix.token, 'GET', '/v2/reason-codes?limit=500');
    const root = itemsOf(codes.body).map((c) => c.code).filter((c) => c.startsWith(`${PREFIX}ROOT-`)).sort().at(-1) ?? '';
    expect(root, 'a P-MDA-ROOT- code of masterdata-2 exists').not.toBe('');
    expect((await findCode(felix.token, root))?.id).toBeTruthy();
    const rules = await api<{ items: Array<{ name: string; state: string }> }>(felix.token, 'GET', '/v2/rules?limit=200');
    const rule = itemsOf(rules.body).filter((r) => r.name.startsWith(`${PREFIX}rule `)).at(-1);
    expect(rule, 'a P-MDA-rule of masterdata-2 exists').toBeTruthy();
    const crews = await api<{ items: Array<{ name: string }> }>(felix.token, 'GET', '/v2/crews?limit=200');
    const crew = itemsOf(crews.body).map((c) => c.name).filter((n) => n.startsWith(`${PREFIX}crew `)).at(-1) ?? '';
    expect(crew, 'a P-MDA-crew of masterdata-3 exists').not.toBe('');

    await loginViaUI(page, MDA.felix.email, MDA.felix.password);
    await page.goto('/master-data');
    await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('tab', { name: 'Units', exact: true }).click();
    await page.getByPlaceholder('Search units...').fill(units[0].code);
    await expect(page.getByText(units[0].name, { exact: true })).toBeVisible();
    await page.goto('/codes-admin');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('tab-reason-codes').click();
    await expect(page.locator(`[data-testid="code-row"][data-code="${root}"]`)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('tab-rules').click();
    await expect(page.locator(`[data-testid="rule-item"][data-name="${rule?.name}"]`)).toBeVisible({ timeout: 30_000 });
    await page.goto('/planning?tab=calendars');
    await expect(page.getByTestId('calendars-tab')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#crewSelect option', { hasText: crew })).toHaveCount(1);
  });
});
