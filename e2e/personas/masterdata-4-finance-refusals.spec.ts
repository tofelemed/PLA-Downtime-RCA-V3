import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginViaUI } from '../test-utils/auth-helpers';
import { findCode } from '../test-utils/codes-world';
import { policiesOf } from '../test-utils/finance-world';
import { openLibrary, openRule } from './support/codes-finance-ui';
import { api, itemsOf, post } from './support/manager-api';
import { expectHidden, expectRefused } from './support/hidden-controls';
import { JONAS, MDA, PREFIX, listMdaUnits, seedPlanWorld, sessionOf, shortId, utcDate, type Session } from './support/masterdata-world';

/**
 * Master data admin persona — journeys 5, 6 and 7:
 * 6. Finance (`/finance`, SME V1 14 Oct 2026): FX and valuation rates are finance's now, so Zara sees no
 *    "Add exchange rate draft" and the server refuses her FX and valuation-rate drafts (403 FORBIDDEN_ROLE);
 *    nothing is stored. The finance journey itself runs in manager-4-finance-flags.spec.ts.
 * 5. Writes not offered on screen (capability-hidden) and refused by the server (403), never persisted:
 *    plan approval (Charlotte), RCA case (Hiro), valuation policy draft (Felix; finance maintainers
 *    only, SME V1), a connection on Connectivity; period approval, feature flags through the API (403).
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


async function openFinance(page: Page, tab: 'fx' | 'policies'): Promise<void> {
  await page.goto(`/finance?tab=${tab}`);
  await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
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

  test('MDA-06 SME V1: Zara (master_data_admin) no longer drafts FX or valuation rates: no button, the server refuses (403 FORBIDDEN_ROLE), nothing stored', async ({ page }) => {
    const before = await fxVersions(zara.token);
    await loginViaUI(page, MDA.zara.email, MDA.zara.password);
    await openFinance(page, 'fx');
    await expect(page.getByTestId('fx-rates-tab')).toBeVisible({ timeout: 20_000 });
    await expectHidden(page.getByTestId('fx-new'));
    await page.screenshot({ path: test.info().outputPath('mda-06-fx-new-hidden.png'), fullPage: true });
    const fx = { fromCurrency: 'USD', toCurrency: 'IRR', rate: '2750000', effectiveFrom: `${nextFxYear(before)}-01-01T00:00:00Z`, source: fxSource };
    expectRefused(await post(zara.token, '/v2/fx-rates', fx), 'FORBIDDEN_ROLE');
    const rate = { impactCodeId: randomUUID(), basis: 'cost_per_hour', value: '1', currency: 'USD', effectiveFrom: '2099-01-01T00:00:00Z' };
    expectRefused(await post(zara.token, '/v2/valuation-rates', rate), 'FORBIDDEN_ROLE');
    const after = await fxVersions(zara.token);
    expect(after.find((v) => v.source === fxSource)).toBeUndefined();
    expect(after.length).toBe(before.length);
  });

  test('MDA-05a Charlotte: no approve control on a draft plan on /planning (server 403); period approval and feature flags 403 through the API', async ({ page }) => {
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
    await expectHidden(page.getByTestId('approve-plan-submit'));
    expectRefused(await post(charlotte.token, `/v2/production-plans/${plan.body.id}/approve`, { expectedVersion: 1 }), 'FORBIDDEN_ROLE');
    await expect(page.getByTestId('plan-detail').getByTestId('version-state').first()).toHaveAttribute('data-state', 'draft');
    await page.screenshot({ path: test.info().outputPath('mda-05a-plan-approve-hidden.png'), fullPage: true });
    const stored = await api<{ approvalState: string }>(charlotte.token, 'GET', `/v2/production-plans/${plan.body.id}/versions/1`);
    expect([stored.status, stored.body.approvalState]).toEqual([200, 'draft']);

    const periods = await api<{ items: Array<{ id: string }> }>(charlotte.token, 'GET', '/v2/production-periods?limit=1');
    const periodId = periods.status === 200 && itemsOf(periods.body)[0]?.id ? itemsOf(periods.body)[0].id : randomUUID();
    const period = await post<{ code: string }>(charlotte.token, `/v2/production-periods/${periodId}/approve`, {});
    expect([period.status, period.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    const flag = await api<{ code: string }>(charlotte.token, 'PUT', '/v2/feature-flags/v2.rca', { enabled: true });
    expect([flag.status, flag.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
  });

  test('MDA-05b Hiro: New case is not offered (server 403); Connectivity is not reachable; integration writes are 403', async ({ page }) => {
    const title = `${PREFIX}RCA refused ${suffix}`;
    await loginViaUI(page, MDA.hiro.email, MDA.hiro.password);
    await expect(page.locator('nav a[href="/connectivity"]')).toHaveCount(0);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await expectHidden(page.getByTestId('new-case'));
    await page.screenshot({ path: test.info().outputPath('mda-05b-rca-no-create.png') });
    const hiro = await sessionOf(MDA.hiro);
    expectRefused(await post(hiro.token, '/v2/rcas', { title }), 'FORBIDDEN_ROLE');
    const cases = await api<{ items: Array<{ title: string }> }>(hiro.token, 'GET', `/v2/rcas?q=${encodeURIComponent(title)}`);
    expect(cases.status).toBe(200);
    expect(itemsOf(cases.body).filter((item) => item.title === title)).toEqual([]);

    // not in the menu, but the v2 integration console (flag on) opens read-only by URL; no write is offered
    const name = `${PREFIX}refused connection ${suffix}`;
    await page.goto('/connectivity');
    await expect(page.getByTestId('integration-console')).toBeVisible({ timeout: 60_000 });
    test.info().annotations.push({ type: 'observation', description: 'Connectivity is hidden from the master_data_admin menu, yet /connectivity renders the v2 integration console read-only (UX06 non-writer pattern).' });
    await expectHidden(page.getByTestId('new-connection'));
    await page.screenshot({ path: test.info().outputPath('mda-05b-connection-hidden.png') });
    const connections = await api<{ items: Array<{ displayName: string }> }>(hiro.token, 'GET', '/v2/connections?limit=200');
    expect(itemsOf(connections.body).map((item) => item.displayName)).not.toContain(name);
    const connection = await post<{ code: string }>(hiro.token, '/v2/connections', { sourceType: 'mqtt', displayName: name });
    expect([connection.status, connection.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
  });

  test('MDA-05c Felix: New policy version is not offered on /finance (finance maintainers only, SME V1), the server refuses it; nothing stored', async ({ page }) => {
    const before = await policiesOf(felix.token);
    await loginViaUI(page, MDA.felix.email, MDA.felix.password);
    await openFinance(page, 'policies');
    await expect(page.getByTestId('policy-banner')).toBeVisible({ timeout: 20_000 });
    await expectHidden(page.getByTestId('policy-new'));
    await page.screenshot({ path: test.info().outputPath('mda-05c-policy-hidden.png'), fullPage: true });
    expectRefused(await post(felix.token, '/v2/valuation-policies', { effectiveFrom: '2099-06-01T00:00:00Z', notes: policyNotes }), 'FORBIDDEN_ROLE');
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
    await page.goto('/master-data/units');
    await expect(page.getByRole('heading', { level: 1, name: 'Production units' })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('searchbox', { name: 'Search units' }).fill(units[0].code);
    await expect(page.getByRole('link', { name: units[0].name, exact: true })).toBeVisible();
    // the reason tree starts collapsed: the code is found with the library search; the rule opens on its own page
    await openLibrary(page, 'reason-codes', root);
    await expect(page.locator(`[data-testid="code-match"][data-code="${root}"]`)).toBeVisible({ timeout: 30_000 });
    await openRule(page, felix.token, rule?.name ?? '');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(rule?.name ?? '');
    await page.goto('/planning?tab=calendars');
    await expect(page.getByTestId('calendars-tab')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#crewSelect option', { hasText: crew })).toHaveCount(1);
  });
});
