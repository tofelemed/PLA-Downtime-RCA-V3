import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { findCode, findRule } from '../test-utils/codes-world';
import { api, itemsOf, post } from './support/manager-api';
import { JONAS, MDA, PREFIX, asUser, mdaUnit, sessionOf, shortId, type Session } from './support/masterdata-world';

/**
 * Master data admin persona — journeys 2 and 3 on `/codes-admin`:
 * - Hiro (CODE_WRITERS) builds a `P-MDA-` reason tree (persists after reload), reparents, sees a cycle
 *   refused as 422 CODE_CYCLE and the retirement impact + 409 CODE_HAS_CHILDREN (nothing retired),
 *   creates an impact code and an OEE code, default mappings reason → OEE (two versions, history kept)
 *   and reason → impact; a rename is version 2 and visible in the versions tab.
 * - Zara (RULE_AUTHORS) drafts a coding_default rule (live 422), cannot activate it (403 FORBIDDEN_ROLE,
 *   as any master_data_admin: Hiro's API call is refused too), simulates; Jonas (manager) activates as
 *   setup; Zara's rollback is refused (403). Data: unit `P-MDA-CR …`, codes, rule `P-MDA-rule …` — kept.
 */
let hiro: Session;
let zara: Session;
let unit: { unitId: string; unitName: string };
const suffix = shortId();
const code = (name: string) => `${PREFIX}${name}-${suffix}`;
const [ROOT, CHILD, LEAF, ALT, IMP, OEE] = [code('ROOT'), code('CHILD'), code('LEAF'), code('ALT'), code('IMP'), code('OEE')];
const ruleName = `${PREFIX}rule ${suffix}`;

test.describe.configure({ mode: 'serial', timeout: 240_000 });

const rowOf = (page: Page, entry: string) => page.locator(`[data-testid="code-row"][data-code="${entry}"]`);
const refusal = (page: Page) => page.getByTestId('admin-refusal');

async function openTab(page: Page, tab: string): Promise<void> {
  await page.goto('/codes-admin');
  await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId(`tab-${tab}`).click();
}

async function selectCode(page: Page, entry: string): Promise<void> {
  await rowOf(page, entry).getByTestId('code-select').click();
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', entry, { timeout: 20_000 });
}

async function createCode(page: Page, entry: string, name: string, parentLabel: string | null): Promise<void> {
  await page.getByTestId('code-new').click();
  await page.fill('#new-code', entry);
  await page.fill('#new-name', name);
  if (parentLabel === null) await page.getByTestId('new-parent').selectOption('');
  else await page.getByTestId('new-parent').selectOption({ label: parentLabel });
  await page.getByTestId('code-create-submit').click();
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', entry, { timeout: 20_000 });
}

async function createFlatCode(page: Page, library: 'impact-codes' | 'oee-codes', entry: string, name: string): Promise<void> {
  await page.getByTestId(`tab-${library}`).click();
  await page.getByTestId('code-new').click();
  await page.fill('#new-code', entry);
  await page.fill('#new-name', name);
  await page.getByTestId('code-create-submit').click();
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', entry, { timeout: 20_000 });
}

async function moveCode(page: Page, entry: string, targetLabel: string): Promise<void> {
  await selectCode(page, entry);
  await page.getByTestId('code-move-target').selectOption({ label: targetLabel });
  await page.getByTestId('code-move-submit').click();
}

async function openRule(page: Page, name: string): Promise<void> {
  await openTab(page, 'rules');
  await page.locator(`[data-testid="rule-item"][data-name="${name}"]`).click();
  await expect(page.getByTestId('rule-detail')).toBeVisible({ timeout: 20_000 });
}

const mappingRow = (page: Page, kind: string, version: number) => page.locator(`[data-testid="mr-row"][data-kind="${kind}"][data-version="${version}"]`);

test.describe('Master data admin — codes, default mappings and declarative rules (/codes-admin)', () => {
  test.beforeAll(async () => {
    hiro = await sessionOf(MDA.hiro);
    zara = await sessionOf(MDA.zara);
    unit = await mdaUnit(hiro.token, hiro.tenantId, 'CR', suffix);
  });

  test('MDA-02a Hiro: reason tree persists, reparent, cycle 422, retire impact 409 (not retired), versions', async ({ page }) => {
    await loginViaUI(page, MDA.hiro.email, MDA.hiro.password);
    await expect(page.locator('nav a[href="/codes-admin"]')).toBeVisible();
    await openTab(page, 'reason-codes');
    await createCode(page, ROOT, `${PREFIX}root`, null);
    await createCode(page, CHILD, `${PREFIX}child`, `${ROOT} — ${PREFIX}root`);
    await createCode(page, LEAF, `${PREFIX}leaf`, `${CHILD} — ${PREFIX}child`);
    await createCode(page, ALT, `${PREFIX}alternative`, null);
    const ids = Object.fromEntries(await Promise.all([ROOT, CHILD, LEAF, ALT].map(async (entry) => [entry, (await findCode(hiro.token, entry))?.id ?? ''])));
    const expectTree = async (leafParent: string, leafDepth: string) => {
      await expect(rowOf(page, ROOT)).toHaveAttribute('data-depth', '0');
      await expect(rowOf(page, CHILD)).toHaveAttribute('data-parent', ids[ROOT]);
      await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[leafParent]);
      await expect(rowOf(page, LEAF)).toHaveAttribute('data-depth', leafDepth);
    };
    await expectTree(CHILD, '2');
    await openTab(page, 'reason-codes'); // reload → identical
    await expectTree(CHILD, '2');

    // validation: a code with spaces is refused by the server, nothing stored
    const bad = await post<{ code: string }>(hiro.token, '/v2/reason-codes', { code: `${PREFIX}bad code ${suffix}`, name: 'bad' });
    expect([400, 422]).toContain(bad.status);
    expect(await findCode(hiro.token, `${PREFIX}bad code ${suffix}`)).toBeNull();

    await moveCode(page, LEAF, `${ALT} — ${PREFIX}alternative`);
    await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[ALT], { timeout: 20_000 });
    await openTab(page, 'reason-codes');
    await expectTree(ALT, '1');
    await moveCode(page, LEAF, `${CHILD} — ${PREFIX}child`);
    await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[CHILD], { timeout: 20_000 });
    expect((await findCode(hiro.token, LEAF))?.parentId).toBe(ids[CHILD]);

    // a cycle the stale screen cannot see: ALT moves under CHILD through the API, then ROOT → under ALT → 422
    const alt = await findCode(hiro.token, ALT);
    const moved = await api(hiro.token, 'PUT', `/v2/reason-codes/${ids[ALT]}`, { parentId: ids[CHILD] }, { 'If-Match': `"${alt?.version}"` });
    expect(moved.status).toBe(200);
    await moveCode(page, ROOT, `${ALT} — ${PREFIX}alternative`);
    await expect(refusal(page)).toHaveAttribute('data-status', '422');
    await expect(refusal(page)).toHaveAttribute('data-code', 'CODE_CYCLE');

    // retire a parent: the impact is shown, the server answers 409 — the code stays active
    await openTab(page, 'reason-codes');
    await selectCode(page, ROOT);
    await page.getByTestId('code-retire').click();
    await expect(page.getByTestId('impact-children')).toHaveAttribute('data-count', '1');
    await page.getByTestId('retire-confirm').click();
    await expect(refusal(page)).toHaveAttribute('data-code', 'CODE_HAS_CHILDREN');
    await expect(page.getByTestId('refusal-references')).toContainText('1 active child code(s)');
    await page.keyboard.press('Escape');
    await expect(rowOf(page, ROOT)).toHaveCount(1);
    const root = await api<{ active: boolean }>(hiro.token, 'GET', `/v2/reason-codes/${ids[ROOT]}`);
    expect(root.status).toBe(200);
    expect(root.body.active).toBe(true);

    // a rename is version 2 of the node and listed in the versions tab
    await selectCode(page, CHILD);
    await page.fill('#code-name', `${PREFIX}child renamed`);
    await page.getByTestId('code-save').click();
    await expect(page.getByTestId('code-detail')).toHaveAttribute('data-version', '2');
    await page.getByTestId('tab-code-versions').click();
    await expect(page.locator('[data-testid="code-version"][data-version="2"] [data-testid="version-change"][data-key="name"]')).toContainText('child renamed');
    await page.screenshot({ path: test.info().outputPath('mda-02a-reason-tree.png'), fullPage: true });
  });

  test('MDA-02b Hiro: impact and OEE codes, default mappings reason → OEE (two versions) and reason → impact', async ({ page }) => {
    await loginViaUI(page, MDA.hiro.email, MDA.hiro.password);
    await openTab(page, 'reason-codes');
    await createFlatCode(page, 'impact-codes', IMP, `${PREFIX}impact`);
    await createFlatCode(page, 'oee-codes', OEE, `${PREFIX}oee`);
    const impact = await api<{ items: Array<{ id: string; code: string }> }>(hiro.token, 'GET', '/v2/impact-codes?limit=500');
    const impactId = itemsOf(impact.body).find((entry) => entry.code === IMP)?.id ?? '';
    expect(impactId).not.toBe('');
    const oee = await api<{ items: Array<{ code: string }> }>(hiro.token, 'GET', '/v2/oee-codes?limit=500');
    expect(itemsOf(oee.body).some((entry) => entry.code === OEE)).toBe(true);

    await page.getByTestId('tab-mapping-rules').click();
    await page.getByTestId('mr-reason').selectOption({ label: `${CHILD} — ${PREFIX}child renamed` });
    await page.getByTestId('mr-kind').selectOption('reason_to_oee');
    await page.getByTestId('mr-target').selectOption('availability');
    await page.getByTestId('mr-save').click();
    await expect(mappingRow(page, 'reason_to_oee', 1)).toHaveAttribute('data-target', 'availability', { timeout: 20_000 });
    await page.getByTestId('mr-target').selectOption('performance');
    await page.getByTestId('mr-save').click();
    await expect(mappingRow(page, 'reason_to_oee', 2)).toHaveAttribute('data-target', 'performance', { timeout: 20_000 });
    await expect(mappingRow(page, 'reason_to_oee', 1)).toHaveAttribute('data-target', 'availability'); // history kept

    await page.getByTestId('mr-kind').selectOption('reason_to_impact');
    await page.getByTestId('mr-target').selectOption({ label: `${IMP} — ${PREFIX}impact` });
    await page.getByTestId('mr-save').click();
    await expect(mappingRow(page, 'reason_to_impact', 1)).toHaveAttribute('data-target', impactId, { timeout: 20_000 });

    const childId = (await findCode(hiro.token, CHILD))?.id;
    const rules = await api<{ items: Array<{ ruleKind: string; version: number; targetValue: string | null; targetCodeId: string | null }> }>(hiro.token, 'GET', `/v2/code-mapping-rules?sourceCodeId=${childId}&limit=50`);
    expect(rules.status).toBe(200);
    const stored = itemsOf(rules.body);
    expect(stored.filter((rule) => rule.ruleKind === 'reason_to_oee').map((rule) => [rule.version, rule.targetValue]).sort()).toEqual([[1, 'availability'], [2, 'performance']]);
    expect(stored.find((rule) => rule.ruleKind === 'reason_to_impact')?.targetCodeId).toBe(impactId);

    // persists after a reload
    await openTab(page, 'mapping-rules');
    await page.getByTestId('mr-reason').selectOption({ label: `${CHILD} — ${PREFIX}child renamed` });
    await page.getByTestId('mr-kind').selectOption('reason_to_oee');
    await expect(mappingRow(page, 'reason_to_oee', 2)).toHaveAttribute('data-target', 'performance', { timeout: 20_000 });
    await page.screenshot({ path: test.info().outputPath('mda-02b-mappings.png'), fullPage: true });
  });

  test('MDA-03 Zara drafts a rule (live 422), activation refused for her and Hiro (403), simulates; Jonas activates; rollback refused', async ({ page, browser }) => {
    await loginViaUI(page, MDA.zara.email, MDA.zara.password);
    await openTab(page, 'rules');
    await page.getByTestId('rule-new').click();
    await expect(page.getByTestId('rule-kind')).toHaveValue('coding_default');
    await page.fill('#rule-name', ruleName);
    const condition = (index: number) => page.getByTestId('rule-condition').nth(index);
    await page.getByTestId('action-target').selectOption('scheduleClass');
    await page.getByTestId('action-value').selectOption('unplanned');
    await condition(0).getByTestId('rule-field').selectOption('physicalType');
    await condition(0).getByTestId('rule-op').selectOption('eq');
    await condition(0).getByTestId('rule-value').selectOption('downtime');
    await page.getByTestId('add-condition-all').click();
    await condition(1).getByTestId('rule-field').selectOption('durationSeconds');
    await condition(1).getByTestId('rule-op').selectOption('in');
    await condition(1).getByTestId('rule-value').fill('one hour'); // the server validates live: not a number
    await expect(condition(1).getByTestId('row-error')).toContainText('must be a number', { timeout: 20_000 });
    await expect(page.getByTestId('rule-validation')).toHaveAttribute('data-state', 'invalid');
    await condition(1).getByTestId('rule-op').selectOption('gte');
    await condition(1).getByTestId('rule-value').fill('3600');
    await page.getByTestId('add-condition-all').click();
    await condition(2).getByTestId('rule-field').selectOption('unitId');
    await condition(2).getByTestId('rule-op').selectOption('eq');
    await condition(2).getByTestId('rule-value').selectOption({ label: unit.unitName });
    await expect(page.getByTestId('rule-validation')).toHaveAttribute('data-state', 'valid', { timeout: 20_000 });
    await page.getByTestId('rule-save').click();
    await expect(page.getByTestId('rule-detail')).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });
    const stored = await findRule(zara.token, ruleName);
    expect(stored?.state).toBe('draft');

    // the author cannot activate: the persona is not a RULE_APPROVER (403 FORBIDDEN_ROLE, before separation of duties)
    await page.getByTestId('rule-activate').click();
    await expect(refusal(page)).toHaveAttribute('data-status', '403');
    await expect(refusal(page)).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');
    await page.screenshot({ path: test.info().outputPath('mda-03-activate-refused.png') });
    // nor any other master data admin
    const byHiro = await post<{ code: string }>(hiro.token, `/v2/rules/${stored?.id}/activate`, {}, { 'If-Match': `"${stored?.rowVersion}"` });
    expect([byHiro.status, byHiro.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    expect((await findRule(zara.token, ruleName))?.state).toBe('draft');

    await page.getByTestId('tab-simulation').click();
    await page.getByTestId('sim-unit').selectOption({ label: unit.unitName });
    await page.getByTestId('sim-run').click();
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-version', 'draft', { timeout: 30_000 });
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-matched', /^\d+$/);

    // setup: the manager activates version 1; Zara's changed draft becomes version 2 after a second activation
    const jonas = await asUser(browser, JONAS);
    await openRule(jonas, ruleName);
    await jonas.getByTestId('rule-activate').click();
    await expect(jonas.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '1', { timeout: 20_000 });
    await openRule(page, ruleName);
    await page.getByTestId('action-value').selectOption('external');
    await expect(page.getByTestId('rule-validation')).toHaveAttribute('data-state', 'valid', { timeout: 20_000 });
    await page.getByTestId('rule-save').click();
    await expect(page.getByTestId('rule-detail')).toHaveAttribute('data-has-draft', 'true', { timeout: 20_000 });
    await openRule(jonas, ruleName);
    await jonas.getByTestId('rule-activate').click();
    await expect(jonas.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '2', { timeout: 20_000 });
    await jonas.context().close();

    // Zara sees both versions but her rollback is refused; version 2 stays in force
    await openRule(page, ruleName);
    await page.getByTestId('tab-rule-versions').click();
    await expect(page.locator('[data-testid="rule-version"][data-version="2"]')).toHaveAttribute('data-current', 'true');
    await page.locator('[data-testid="rule-version"][data-version="1"]').getByTestId('rule-rollback').click();
    await expect(refusal(page)).toHaveAttribute('data-status', '403');
    await expect(refusal(page)).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');
    const versions = await api<{ items?: unknown[] } | unknown[]>(zara.token, 'GET', `/v2/rules/${stored?.id}/versions`);
    expect(itemsOf(versions.body)).toHaveLength(2);
    const active = await api<{ state: string; activeVersion: number }>(zara.token, 'GET', `/v2/rules/${stored?.id}`);
    expect([active.body.state, active.body.activeVersion]).toEqual(['active', 2]);
  });
});
