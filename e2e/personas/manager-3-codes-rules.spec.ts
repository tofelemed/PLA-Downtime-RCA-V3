import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { downtime, findCode, findRule, type CodesWorld } from '../test-utils/codes-world';
import { api, itemsOf, post } from './support/manager-api';
import { asUser, MANAGERS, PREFIX, sessionOf, type Session } from './support/manager-users';
import { unitOf } from './support/manager-world';

/**
 * Manager approver persona — journey 5 on `/codes-admin` (plan 3.8, T18 / T22):
 * - T18: Erik (Manager) builds a 3-level reason tree, reparents with the picker (persisted after a
 *   reload), a cycle the API refuses is shown as 422 CODE_CYCLE, retiring a parent shows the impact and
 *   the 409 CODE_HAS_CHILDREN — nothing is retired; a new mapping version leaves the old one; versions
 *   and the mapping preview; an invalid code is a validation error.
 * - T22: Erik drafts a declarative rule (live 422 on a non-numeric value), cannot activate it himself
 *   (403 SEPARATION_OF_DUTIES), simulates; Laura activates it and the server applies it to new events;
 *   a changed draft becomes version 2, a rollback adds version 3 (history kept, nothing retired).
 * Data: unit `P-MGR-CR …`, codes `P-MGR-ROOT/CHILD/LEAF/ALT-…`, its events, rule `P-MGR T22 …` — kept.
 */
let erik: Session;
let world: CodesWorld;

test.describe.configure({ mode: 'serial', timeout: 240_000 });

const rowOf = (page: Page, code: string) => page.locator(`[data-testid="code-row"][data-code="${code}"]`);
const refusal = (page: Page) => page.getByTestId('admin-refusal');

async function openTab(page: Page, tab: string): Promise<void> {
  await page.goto('/codes-admin');
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId(`tab-${tab}`).click();
}

async function selectCode(page: Page, code: string): Promise<void> {
  await rowOf(page, code).getByTestId('code-select').click();
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', code, { timeout: 20_000 }); // the tree re-renders after a move
}

async function createCode(page: Page, code: string, name: string, parentLabel: string | null): Promise<void> {
  await page.getByTestId('code-new').click();
  await page.fill('#new-code', code);
  await page.fill('#new-name', name);
  if (parentLabel === null) await page.getByTestId('new-parent').selectOption('');
  else await page.getByTestId('new-parent').selectOption({ label: parentLabel });
  await page.getByTestId('code-create-submit').click();
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', code, { timeout: 20_000 });
}

async function moveCode(page: Page, code: string, targetLabel: string): Promise<void> {
  await selectCode(page, code);
  await page.getByTestId('code-move-target').selectOption({ label: targetLabel });
  await page.getByTestId('code-move-submit').click();
}

async function openRule(page: Page, name: string): Promise<void> {
  await openTab(page, 'rules');
  await page.locator(`[data-testid="rule-item"][data-name="${name}"]`).click();
}

test.describe('Manager persona — codes and declarative rules (/codes-admin)', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    erik = await sessionOf(MANAGERS.erik);
    const suffix = Math.random().toString(36).slice(2, 10);
    const unit = await unitOf(erik.token, erik.tenantId, 'CR', suffix);
    world = { suffix, tenantId: erik.tenantId, unitId: unit.unitId, unitName: unit.unitName, foreignCode: null };
  });

  test('T18 Erik: tree persists, reparent persists, cycle 422, retire impact 409 (not retired), mapping history, versions, preview', async ({ page }) => {
    const code = (name: string) => `${PREFIX}${name}-${world.suffix}`;
    const [ROOT, CHILD, LEAF, ALT] = [code('ROOT'), code('CHILD'), code('LEAF'), code('ALT')];
    await loginViaUI(page, MANAGERS.erik.email, MANAGERS.erik.password);
    await expect(page.locator('nav a[href="/codes-admin"]')).toBeVisible();
    await openTab(page, 'reason-codes');

    await createCode(page, ROOT, `${PREFIX}root`, null);
    await createCode(page, CHILD, `${PREFIX}child`, `${ROOT} — ${PREFIX}root`);
    await createCode(page, LEAF, `${PREFIX}leaf`, `${CHILD} — ${PREFIX}child`);
    await createCode(page, ALT, `${PREFIX}alternative`, null);
    const ids = Object.fromEntries(await Promise.all([ROOT, CHILD, LEAF, ALT].map(async (entry) => [entry, (await findCode(erik.token, entry))?.id ?? ''])));
    const expectTree = async (leafParent: string, leafDepth: string) => {
      await expect(rowOf(page, ROOT)).toHaveAttribute('data-depth', '0');
      await expect(rowOf(page, CHILD)).toHaveAttribute('data-parent', ids[ROOT]);
      await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[leafParent]);
      await expect(rowOf(page, LEAF)).toHaveAttribute('data-depth', leafDepth);
    };
    await expectTree(CHILD, '2');
    await openTab(page, 'reason-codes'); // reload → identical
    await expectTree(CHILD, '2');

    // validation: a code with spaces is refused, nothing stored
    const bad = await post<{ code: string }>(erik.token, '/v2/reason-codes', { code: `${PREFIX}bad code ${world.suffix}`, name: 'bad' });
    expect([400, 422]).toContain(bad.status);
    expect(await findCode(erik.token, `${PREFIX}bad code ${world.suffix}`)).toBeNull();

    // reparent with the picker → persisted (reload); back under CHILD → persisted (API)
    await moveCode(page, LEAF, `${ALT} — ${PREFIX}alternative`);
    await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[ALT], { timeout: 20_000 });
    await openTab(page, 'reason-codes');
    await expectTree(ALT, '1');
    await moveCode(page, LEAF, `${CHILD} — ${PREFIX}child`);
    await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[CHILD], { timeout: 20_000 });
    expect((await findCode(erik.token, LEAF))?.parentId).toBe(ids[CHILD]);

    // a cycle the stale screen cannot see: ALT moves under CHILD elsewhere, then ROOT → under ALT → 422
    const alt = await findCode(erik.token, ALT);
    const moved = await api(erik.token, 'PUT', `/v2/reason-codes/${ids[ALT]}`, { parentId: ids[CHILD] }, { 'If-Match': `"${alt?.version}"` });
    expect(moved.status).toBe(200);
    await moveCode(page, ROOT, `${ALT} — ${PREFIX}alternative`);
    await expect(refusal(page)).toHaveAttribute('data-status', '422');
    await expect(refusal(page)).toHaveAttribute('data-code', 'CODE_CYCLE');

    // retire a parent: impact counts first, then 409 with the same counts — the code stays active
    await openTab(page, 'reason-codes');
    await selectCode(page, ROOT);
    await page.getByTestId('code-retire').click();
    await expect(page.getByTestId('impact-children')).toHaveAttribute('data-count', '1');
    await page.getByTestId('retire-confirm').click();
    await expect(refusal(page)).toHaveAttribute('data-code', 'CODE_HAS_CHILDREN');
    await expect(page.getByTestId('refusal-references')).toContainText('1 active child code(s)');
    await page.keyboard.press('Escape');
    await expect(rowOf(page, ROOT)).toHaveCount(1);

    // a new mapping version leaves the historical one unchanged
    await page.getByTestId('tab-mapping-rules').click();
    await page.getByTestId('mr-reason').selectOption({ label: `${CHILD} — ${PREFIX}child` });
    await page.getByTestId('mr-kind').selectOption('reason_to_schedule_class');
    await page.getByTestId('mr-target').selectOption('planned');
    await page.getByTestId('mr-save').click();
    await expect(page.locator('[data-testid="mr-row"][data-version="1"]')).toHaveAttribute('data-target', 'planned');
    await page.getByTestId('mr-target').selectOption('unplanned');
    await page.getByTestId('mr-save').click();
    await expect(page.locator('[data-testid="mr-row"][data-version="2"]')).toHaveAttribute('data-target', 'unplanned');
    await expect(page.locator('[data-testid="mr-row"][data-version="1"]')).toHaveAttribute('data-target', 'planned');

    // versions of a node and the mapping preview of an event coded with the reason
    const coded = await downtime(erik.token, world, 3, 0.5, ids[CHILD]);
    expect(coded.classification.scheduleClass).toBe('unknown');
    await page.getByTestId('tab-reason-codes').click();
    await selectCode(page, CHILD);
    await page.fill('#code-name', `${PREFIX}child renamed`);
    await page.getByTestId('code-save').click();
    await expect(page.getByTestId('code-detail')).toHaveAttribute('data-version', '2');
    await page.getByTestId('tab-code-versions').click();
    await expect(page.locator('[data-testid="code-version"][data-version="2"] [data-testid="version-change"][data-key="name"]')).toContainText('child renamed');
    await page.getByTestId('tab-mapping-preview').click();
    await expect(page.getByTestId('mapping-preview')).toHaveAttribute('data-events', '1');
    await expect(page.locator('[data-testid="preview-axis"][data-axis="scheduleClass"]')).toHaveAttribute('data-proposed', 'unplanned');
    await page.screenshot({ path: test.info().outputPath('manager-codes-tree.png'), fullPage: true });
  });

  test('T22 Erik drafts a rule (live 422), cannot activate it; Laura activates; applied; v2 and rollback keep history', async ({ page, browser }) => {
    const name = `${PREFIX}T22 ${world.suffix}`;
    const before = await downtime(erik.token, world, 30, 2);
    expect(before.classification.scheduleClass).toBe('unknown');
    await loginViaUI(page, MANAGERS.erik.email, MANAGERS.erik.password);
    await openTab(page, 'rules');
    await page.getByTestId('rule-new').click();
    await page.fill('#rule-name', name);
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
    await condition(2).getByTestId('rule-value').selectOption({ label: world.unitName });
    await expect(page.getByTestId('rule-validation')).toHaveAttribute('data-state', 'valid', { timeout: 20_000 });
    await page.getByTestId('rule-save').click();
    await expect(page.getByTestId('rule-detail')).toHaveAttribute('data-state', 'draft', { timeout: 20_000 });

    const stored = await findRule(erik.token, name);
    const view = await api<{ draft: { definition: unknown } }>(erik.token, 'GET', `/v2/rules/${stored?.id}`);
    expect(view.body.draft.definition).toEqual({
      when: { all: [{ field: 'physicalType', op: 'eq', value: 'downtime' }, { field: 'durationSeconds', op: 'gte', value: 3600 }, { field: 'unitId', op: 'eq', value: world.unitId }] },
      then: [{ set: 'scheduleClass', value: 'unplanned' }],
    });
    expect(JSON.stringify(view.body)).not.toMatch(/function|=>/);

    // the author cannot activate (403 SEPARATION_OF_DUTIES); the draft simulates on the stored events
    await page.getByTestId('rule-activate').click();
    await expect(refusal(page)).toHaveAttribute('data-code', 'SEPARATION_OF_DUTIES');
    await expect(refusal(page)).toHaveAttribute('data-status', '403');
    await page.getByTestId('tab-simulation').click();
    await page.getByTestId('sim-unit').selectOption({ label: world.unitName });
    await page.getByTestId('sim-run').click();
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-version', 'draft');
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-matched', '1');
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-changed', '1');

    // Laura (another manager) activates version 1; the server applies it to new events
    const laura = await asUser(browser, MANAGERS.laura);
    await openRule(laura, name);
    await laura.getByTestId('rule-activate').click();
    await expect(laura.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '1', { timeout: 20_000 });
    const long = await downtime(erik.token, world, 20, 2);
    expect(long.classification.scheduleClass).toBe('unplanned');
    expect(long.classificationBasis?.scheduleClass).toMatchObject({ source: 'declarative_rule', ruleVersion: 1 });
    expect((await downtime(erik.token, world, 16, 0.5)).classification.scheduleClass).toBe('unknown');

    // a changed draft becomes version 2; rollback to version 1 adds version 3 and restores the behaviour
    await openRule(page, name);
    await page.getByTestId('action-value').selectOption('external');
    await expect(page.getByTestId('rule-validation')).toHaveAttribute('data-state', 'valid', { timeout: 20_000 });
    await page.getByTestId('rule-save').click();
    await expect(page.getByTestId('rule-detail')).toHaveAttribute('data-has-draft', 'true', { timeout: 20_000 });
    await openRule(laura, name);
    await laura.getByTestId('rule-activate').click();
    await expect(laura.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '2', { timeout: 20_000 });
    expect((await downtime(erik.token, world, 12, 2)).classification.scheduleClass).toBe('external');
    await laura.getByTestId('tab-rule-versions').click();
    await laura.locator('[data-testid="rule-version"][data-version="1"]').getByTestId('rule-rollback').click();
    await expect(laura.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '3', { timeout: 20_000 });
    await expect(laura.locator('[data-testid="rule-version"][data-version="3"]')).toHaveAttribute('data-origin', 'rollback');
    expect((await downtime(erik.token, world, 8, 2)).classification.scheduleClass).toBe('unplanned');
    const versions = await api<unknown[] | { items?: unknown[] }>(erik.token, 'GET', `/v2/rules/${stored?.id}/versions`);
    expect(itemsOf(versions.body).length).toBeGreaterThanOrEqual(3); // history kept
    expect((await findRule(erik.token, name))?.state).toBe('active');
    await laura.context().close();
  });
});
