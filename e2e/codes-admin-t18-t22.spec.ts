import { test, expect, type Browser, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';
import { ensureApprover } from './test-utils/dashboard-world';
import { downtime, findCode, findRule, retireRule, seedCodesWorld, type CodesWorld } from './test-utils/codes-world';

/**
 * Plan 3.8 exit tests on `/codes-admin` (flag `v2.codesAdmin`, switched on for the demo tenant by the
 * manager and left on):
 * - T18 UI: 3-level reason tree → reload → identical; reparent (picker and drag) → persisted; a cycle
 *   the API refuses → 422 shown; retire a parent → impact dialog with counts, 409 with counts; a new
 *   mapping version leaves the historical one unchanged; versions and mapping preview; codes of another
 *   tenant are never listed; a production engineer gets 403 shown clearly.
 * - T22: a declarative rule built from pickers, validated live by the server, stored as JSON; the author
 *   cannot activate it (SEPARATION_OF_DUTIES), the second approver can; the server applies it to new
 *   events; simulation before/after; non-allowlisted field/operator → 422; activate increments, rollback
 *   restores. (The backend restart of T22 is the integration test `declarative-rules.int-spec.ts`.)
 * Users: manager@acme.com, engineer@acme.com, admin@acme.com (SuperAdmin, only to put one code in an
 * "E2E Test Tenant") and the second approver `e2e-pd-approver@acme.com` of the 3.5 spec. Data: new
 * "E2E …" codes, unit "E2E CR …", its events and rule "E2E T22 …" (limited to that unit, retired at the
 * end); no existing code or policy is changed.
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const ENGINEER = { email: 'engineer@acme.com', password: 'demo123' };
const ADMIN = { email: 'admin@acme.com', password: 'demo123' };
const APPROVER = { email: 'e2e-pd-approver@acme.com', password: 'E2e-approver-1!' };
const FLAG = 'v2.codesAdmin';

let manager = '';
let approver = '';
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
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', code);
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

async function asUser(browser: Browser, user: { email: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await loginViaUI(page, user.email, user.password);
  return page;
}

test.describe('Codes & rules — T18 UI and T22 (plan 3.8)', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const session = await authenticate(MANAGER.email, MANAGER.password);
    manager = session.accessToken;
    const user = session.user as { tenantId: string; organizationId: string };
    expect((await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true })).status).toBe(200);
    await ensureApprover(manager, user.tenantId, user.organizationId, APPROVER.email, APPROVER.password);
    approver = (await authenticate(APPROVER.email, APPROVER.password)).accessToken;
    const superAdmin = (await authenticate(ADMIN.email, ADMIN.password)).accessToken;
    world = await seedCodesWorld(manager, user.tenantId, superAdmin);
  });

  test.afterAll(async () => {
    if (world) await retireRule(approver, `E2E T22 ${world.suffix}`);
    // decision for the owner's demo: Codes & rules stays switched on for Demo Plant
    await call(manager, 'PUT', `/v2/feature-flags/${FLAG}`, { enabled: true });
  });

  test('T18 UI: tree persists, reparent persists, cycle 422, retire impact 409, mapping history, versions, tenant scope', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 }); // tablet (UX07)
    const code = (name: string) => `E2E-${name}-${world.suffix}`;
    const [ROOT, CHILD, LEAF, ALT] = [code('ROOT'), code('CHILD'), code('LEAF'), code('ALT')];
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await openTab(page, 'reason-codes');

    // build a 3-level tree (the parent defaults to the selected code) and a second root
    await createCode(page, ROOT, 'E2E root', null);
    await createCode(page, CHILD, 'E2E child', `${ROOT} — E2E root`);
    await createCode(page, LEAF, 'E2E leaf', `${CHILD} — E2E child`);
    await createCode(page, ALT, 'E2E alternative', null);
    const ids = Object.fromEntries(await Promise.all([ROOT, CHILD, LEAF, ALT].map(async (entry) => [entry, (await findCode(manager, entry))?.id ?? ''])));
    const expectTree = async (leafParent: string, leafDepth: string) => {
      await expect(rowOf(page, ROOT)).toHaveAttribute('data-depth', '0');
      await expect(rowOf(page, CHILD)).toHaveAttribute('data-parent', ids[ROOT]);
      await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[leafParent]);
      await expect(rowOf(page, LEAF)).toHaveAttribute('data-depth', leafDepth);
    };
    await expectTree(CHILD, '2');
    await openTab(page, 'reason-codes'); // reload → identical
    await expectTree(CHILD, '2');
    // codes of another tenant are never listed (NFR01)
    if (world.foreignCode) await expect(rowOf(page, world.foreignCode)).toHaveCount(0);

    // reparent with the picker → persisted; drag back → persisted
    await selectCode(page, LEAF);
    await page.getByTestId('code-move-target').selectOption({ label: `${ALT} — E2E alternative` });
    await page.getByTestId('code-move-submit').click();
    await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[ALT], { timeout: 20_000 });
    await openTab(page, 'reason-codes');
    await expectTree(ALT, '1');
    // drag with the handle; a tall viewport keeps both rows on screen so nothing scrolls mid-drag
    await page.setViewportSize({ width: 1024, height: 6000 });
    const handle = await rowOf(page, LEAF).getByTestId('drag-handle').boundingBox();
    const target = await rowOf(page, CHILD).getByTestId('code-select').boundingBox();
    expect(handle && target).toBeTruthy();
    await page.mouse.move((handle?.x ?? 0) + 4, (handle?.y ?? 0) + 4);
    await page.mouse.down();
    await page.mouse.move((target?.x ?? 0) + 20, (target?.y ?? 0) + 6, { steps: 8 });
    await page.mouse.up();
    await expect(rowOf(page, LEAF)).toHaveAttribute('data-parent', ids[CHILD], { timeout: 20_000 });
    expect((await findCode(manager, LEAF))?.parentId).toBe(ids[CHILD]);
    await page.setViewportSize({ width: 1024, height: 768 });

    // a cycle the stale screen cannot see: ALT moves under CHILD elsewhere, then ROOT → under ALT → 422
    const alt = await findCode(manager, ALT);
    const moved = await call(manager, 'PUT', `/v2/reason-codes/${ids[ALT]}`, { parentId: ids[CHILD] }, { 'If-Match': `"${alt?.version}"` });
    expect(moved.status).toBe(200);
    await selectCode(page, ROOT);
    await page.getByTestId('code-move-target').selectOption({ label: `${ALT} — E2E alternative` });
    await page.getByTestId('code-move-submit').click();
    await expect(refusal(page)).toHaveAttribute('data-status', '422');
    await expect(refusal(page)).toHaveAttribute('data-code', 'CODE_CYCLE');
    await expect(refusal(page)).toContainText('parentId');

    // retire a parent: impact counts first, then 409 with the same counts
    await openTab(page, 'reason-codes');
    await selectCode(page, ROOT);
    await page.getByTestId('code-retire').click();
    await expect(page.getByTestId('impact-children')).toHaveAttribute('data-count', '1');
    await page.getByTestId('retire-confirm').click();
    await expect(refusal(page)).toHaveAttribute('data-code', 'CODE_HAS_CHILDREN');
    await expect(page.getByTestId('refusal-references')).toContainText('1 active child code(s)');
    await page.keyboard.press('Escape');

    // a new mapping version leaves the historical one unchanged
    await page.getByTestId('tab-mapping-rules').click();
    await page.getByTestId('mr-reason').selectOption({ label: `${CHILD} — E2E child` });
    await page.getByTestId('mr-kind').selectOption('reason_to_schedule_class');
    await page.getByTestId('mr-target').selectOption('planned');
    await page.getByTestId('mr-save').click();
    await expect(page.locator('[data-testid="mr-row"][data-version="1"]')).toHaveAttribute('data-target', 'planned');
    await page.getByTestId('mr-target').selectOption('unplanned');
    await page.getByTestId('mr-save').click();
    await expect(page.locator('[data-testid="mr-row"][data-version="2"]')).toHaveAttribute('data-target', 'unplanned');
    await expect(page.locator('[data-testid="mr-row"][data-version="1"]')).toHaveAttribute('data-target', 'planned');

    // versions of a node and the default mapping preview (an event coded with the reason)
    // the mapping versions start now, so this earlier event keeps the event-type default (unknown)
    const coded = await downtime(manager, world, 3, 0.5, ids[CHILD]);
    expect(coded.classification.scheduleClass).toBe('unknown');
    await page.getByTestId('tab-reason-codes').click();
    await selectCode(page, CHILD);
    await page.fill('#code-name', 'E2E child renamed');
    await page.getByTestId('code-save').click();
    await expect(page.getByTestId('code-detail')).toHaveAttribute('data-version', '2');
    await page.getByTestId('tab-code-versions').click();
    await expect(page.locator('[data-testid="code-version"][data-version="2"] [data-testid="version-change"][data-key="name"]')).toContainText('E2E child renamed');
    await page.getByTestId('tab-mapping-preview').click();
    await expect(page.getByTestId('mapping-preview')).toHaveAttribute('data-events', '1');
    await expect(page.locator('[data-testid="preview-axis"][data-axis="scheduleClass"]')).toHaveAttribute('data-proposed', 'unplanned');
    await expect(page.locator('[data-testid="preview-axis"][data-axis="scheduleClass"]')).toHaveAttribute('data-differ', '1');

    // retire the leaf (no children): it leaves the active tree
    await selectCode(page, LEAF);
    await page.getByTestId('code-retire').click();
    await expect(page.getByTestId('impact-children')).toHaveAttribute('data-count', '0');
    await page.getByTestId('retire-confirm').click();
    await expect(rowOf(page, LEAF)).toHaveCount(0, { timeout: 20_000 });
    const list = await call<{ items: Array<{ code: string }> }>(manager, 'GET', '/v2/reason-codes?limit=500');
    if (world.foreignCode) expect(list.body.items.map((item) => item.code)).not.toContain(world.foreignCode);
  });

  test('T18: a production engineer sees the codes but a write is refused with 403, shown clearly', async ({ page }) => {
    await loginViaUI(page, ENGINEER.email, ENGINEER.password);
    await openTab(page, 'reason-codes');
    await page.getByTestId('code-new').click();
    await page.fill('#new-code', `E2E-ENG-${world.suffix}`);
    await page.fill('#new-name', 'E2E engineer attempt');
    await page.getByTestId('new-parent').selectOption('');
    await page.getByTestId('code-create-submit').click();
    await expect(refusal(page)).toHaveAttribute('data-status', '403');
    await expect(refusal(page)).toHaveAttribute('data-kind', 'role');
    expect(await findCode(manager, `E2E-ENG-${world.suffix}`)).toBeNull();
  });

  test('T22: build → live 422 → draft → author cannot activate → simulate → approver activates → applied → rollback', async ({ page, browser }) => {
    const name = `E2E T22 ${world.suffix}`;
    const before = await downtime(manager, world, 30, 2);
    expect(before.classification.scheduleClass).toBe('unknown');
    await loginViaUI(page, MANAGER.email, MANAGER.password);
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
    await condition(1).getByTestId('rule-value').fill('one hour');
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

    // stored as JSON, never as a function; non-allowlisted field / operator → 422
    const stored = await findRule(manager, name);
    const view = await call<{ draft: { definition: unknown } }>(manager, 'GET', `/v2/rules/${stored?.id}`);
    expect(view.body.draft.definition).toEqual({
      when: { all: [{ field: 'physicalType', op: 'eq', value: 'downtime' }, { field: 'durationSeconds', op: 'gte', value: 3600 }, { field: 'unitId', op: 'eq', value: world.unitId }] },
      then: [{ set: 'scheduleClass', value: 'unplanned' }],
    });
    expect(JSON.stringify(view.body)).not.toMatch(/function|=>/);
    const bad = await command<{ code: string; fieldErrors: Array<{ field: string }> }>(manager, '/v2/rules', {
      kind: 'coding_default', name: `E2E bad ${world.suffix}`, definition: { when: { all: [{ field: 'constructor', op: 'eval', value: 'x' }] }, then: [{ set: 'scheduleClass', value: 'unplanned' }] },
    });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('RULE_INVALID');
    expect(bad.body.fieldErrors.map((error) => error.field)).toEqual(expect.arrayContaining(['definition.when.all.0.field', 'definition.when.all.0.op']));

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
    await expect(page.locator('[data-testid="sim-field"][data-field="scheduleClass"]')).toContainText('unplanned: 1');

    // the second approver activates version 1; the server applies it to new events
    const second = await asUser(browser, APPROVER);
    await openTab(second, 'rules');
    await second.locator(`[data-testid="rule-item"][data-name="${name}"]`).click();
    await second.getByTestId('rule-activate').click();
    await expect(second.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '1', { timeout: 20_000 });
    const long = await downtime(manager, world, 20, 2);
    expect(long.classification.scheduleClass).toBe('unplanned');
    expect(long.classificationBasis?.scheduleClass).toMatchObject({ source: 'declarative_rule', ruleVersion: 1 });
    expect((await downtime(manager, world, 16, 0.5)).classification.scheduleClass).toBe('unknown');

    // replaying the same events through version 1 gives the same result
    const replay = () =>
      command<{ matched: number; changed: number; fields: unknown }>(manager, `/v2/rules/${stored?.id}/simulate`, {
        from: new Date(Date.now() - 48 * 3_600_000).toISOString(), to: new Date().toISOString(), unitIds: [world.unitId], version: 1,
      });
    const [first, again] = [await replay(), await replay()];
    expect(again.body).toMatchObject({ matched: first.body.matched, changed: first.body.changed, fields: first.body.fields });

    // a changed draft becomes version 2; rollback to version 1 adds version 3 and restores the behaviour
    await openTab(page, 'rules');
    await page.locator(`[data-testid="rule-item"][data-name="${name}"]`).click();
    await page.getByTestId('action-value').selectOption('external');
    await expect(page.getByTestId('rule-validation')).toHaveAttribute('data-state', 'valid', { timeout: 20_000 });
    await page.getByTestId('rule-save').click();
    await expect(page.getByTestId('rule-detail')).toHaveAttribute('data-has-draft', 'true', { timeout: 20_000 });
    await openTab(second, 'rules');
    await second.locator(`[data-testid="rule-item"][data-name="${name}"]`).click();
    await second.getByTestId('rule-activate').click();
    await expect(second.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '2', { timeout: 20_000 });
    expect((await downtime(manager, world, 12, 2)).classification.scheduleClass).toBe('external');
    await second.getByTestId('tab-rule-versions').click();
    const v2 = second.locator('[data-testid="rule-version"][data-version="2"]');
    await expect(v2.locator('[data-change="added"]')).toContainText('external');
    await expect(v2.locator('[data-change="removed"]')).toContainText('unplanned');
    await second.locator('[data-testid="rule-version"][data-version="1"]').getByTestId('rule-rollback').click();
    await expect(second.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '3', { timeout: 20_000 });
    await expect(second.locator('[data-testid="rule-version"][data-version="3"]')).toHaveAttribute('data-origin', 'rollback');
    expect((await downtime(manager, world, 8, 2)).classification.scheduleClass).toBe('unplanned');
    await second.context().close();
  });
});
