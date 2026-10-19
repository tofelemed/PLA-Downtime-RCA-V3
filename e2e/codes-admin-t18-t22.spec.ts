import { test, expect, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';
import { ensureApprover } from './test-utils/dashboard-world';
import { downtime, findCode, findRule, retireRule, seedCodesWorld, type CodesWorld } from './test-utils/codes-world';
import { adminRefusal, confirmDialog, ruleVersionRow, createCode, expectUnder, moveCode, openCode, openLibrary, openRule } from './personas/support/codes-finance-ui';

/**
 * Plan 3.8 exit tests on `/master-data/codes-rules` (flag `v2.codesAdmin`, switched on for the demo tenant by the
 * manager and left on):
 * - T18 UI: 3-level reason tree → reload → identical (collapsed tree, paged top level, search); reparent ("Move under") → persisted; a cycle
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
let engineer = '';
let world: CodesWorld;

test.describe.configure({ mode: 'serial', timeout: 240_000 });

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
    engineer = (await authenticate(ENGINEER.email, ENGINEER.password)).accessToken;
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

    // build a 3-level tree and a second root; each code opens on its own page
    await createCode(page, 'reason-codes', ROOT, 'E2E root', null);
    await createCode(page, 'reason-codes', CHILD, 'E2E child', `${ROOT} — E2E root`);
    await createCode(page, 'reason-codes', LEAF, 'E2E leaf', `${CHILD} — E2E child`);
    await createCode(page, 'reason-codes', ALT, 'E2E alternative', null);
    const ids = Object.fromEntries(await Promise.all([ROOT, CHILD, LEAF, ALT].map(async (entry) => [entry, (await findCode(manager, entry))?.id ?? ''])));
    // the tree starts collapsed: where a code sits is read from the library search (each check reloads)
    await expectUnder(page, 'reason-codes', ROOT, 'Top level');
    await expectUnder(page, 'reason-codes', CHILD, 'E2E root');
    await expectUnder(page, 'reason-codes', LEAF, 'E2E root › E2E child');
    // the top level is paged (20 per page): opening a root shows only its own sub-codes
    await openLibrary(page, 'reason-codes');
    await expect(page.locator('[data-testid="code-tree"] > li').first()).toBeVisible({ timeout: 30_000 });
    expect(await page.locator('[data-testid="code-tree"] > li').count()).toBeLessThanOrEqual(20);
    await expect(page.locator('[data-testid="code-tree"] [data-testid="code-row"][data-depth="1"]')).toHaveCount(0);
    // codes of another tenant are never listed (NFR01)
    if (world.foreignCode) {
      await openLibrary(page, 'reason-codes', world.foreignCode);
      await expect(page.locator(`[data-testid="code-match"][data-code="${world.foreignCode}"]`)).toHaveCount(0);
    }

    // reparent with the picker → persisted; back under CHILD → persisted
    await moveCode(page, 'reason-codes', LEAF, `${ALT} — E2E alternative`);
    await expect.poll(async () => (await findCode(manager, LEAF))?.parentId, { timeout: 20_000 }).toBe(ids[ALT]);
    await expectUnder(page, 'reason-codes', LEAF, 'E2E alternative');
    await moveCode(page, 'reason-codes', LEAF, `${CHILD} — E2E child`);
    await expect.poll(async () => (await findCode(manager, LEAF))?.parentId, { timeout: 20_000 }).toBe(ids[CHILD]);

    // a cycle the stale screen cannot see: ALT moves under CHILD elsewhere, then ROOT → under ALT → 422
    await openCode(page, 'reason-codes', ROOT);
    const alt = await findCode(manager, ALT);
    const moved = await call(manager, 'PUT', `/v2/reason-codes/${ids[ALT]}`, { parentId: ids[CHILD] }, { 'If-Match': `"${alt?.version}"` });
    expect(moved.status).toBe(200);
    await page.getByTestId('code-move-target').selectOption({ label: `${ALT} — E2E alternative` });
    await page.getByTestId('code-move-submit').click();
    await expect(adminRefusal(page)).toHaveAttribute('data-status', '422');
    await expect(adminRefusal(page)).toHaveAttribute('data-code', 'CODE_CYCLE');
    await expect(adminRefusal(page)).toContainText('A code cannot be placed under itself');

    // retire a parent: the confirmation lists the impact first, then the 409 with the same counts
    await openCode(page, 'reason-codes', ROOT);
    await page.getByTestId('code-retire').click();
    await expect(page.getByTestId('impact-children')).toHaveAttribute('data-count', '1');
    await confirmDialog(page, 'Retire code');
    await expect(adminRefusal(page)).toHaveAttribute('data-code', 'CODE_HAS_CHILDREN');
    await expect(page.getByTestId('refusal-references')).toContainText('1 active sub-code,');
    await page.keyboard.press('Escape');

    // a new mapping version leaves the historical one unchanged
    await openCode(page, 'reason-codes', CHILD);
    await page.getByTestId('tab-code-mappings').click();
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
    await page.getByTestId('tab-code-details').click();
    await page.fill('#code-name', 'E2E child renamed');
    await page.getByTestId('code-save').click();
    await expect(page.getByTestId('code-detail')).toHaveAttribute('data-version', '2');
    await page.getByTestId('tab-code-versions').click();
    const version2 = page.getByRole('row').filter({ has: page.locator('[data-testid="code-version"][data-version="2"]') });
    await expect(version2.locator('[data-testid="version-change"][data-key="name"]')).toContainText('E2E child renamed');
    await page.getByTestId('tab-code-mappings').click();
    await page.getByRole('button', { name: 'Effect on the last 30 days' }).click();
    await expect(page.getByTestId('mapping-preview')).toHaveAttribute('data-events', '1');
    await expect(page.locator('[data-testid="preview-axis"][data-axis="scheduleClass"]')).toHaveAttribute('data-proposed', 'unplanned');
    await expect(page.locator('[data-testid="preview-axis"][data-axis="scheduleClass"]')).toHaveAttribute('data-differ', '1');

    // retire the leaf (no children): it is retired and leaves the active tree
    await openCode(page, 'reason-codes', LEAF);
    await page.getByTestId('code-retire').click();
    await expect(page.getByTestId('impact-children')).toHaveAttribute('data-count', '0');
    await confirmDialog(page, 'Retire code');
    await expect(page.getByTestId('code-detail')).toHaveAttribute('data-active', 'false', { timeout: 20_000 });
    await openLibrary(page, 'reason-codes', LEAF);
    await expect(page.locator(`[data-testid="code-match"][data-code="${LEAF}"]`)).toHaveCount(0, { timeout: 20_000 });
    if (world.foreignCode) expect(await findCode(manager, world.foreignCode)).toBeNull(); // every page of the library
  });

  test('T18: a production engineer sees the codes but a write is refused with 403, shown clearly', async ({ page }) => {
    await loginViaUI(page, ENGINEER.email, ENGINEER.password);
    await openLibrary(page, 'reason-codes');
    // the screen no longer offers code writes to a role that cannot make them; the server still refuses one
    await expect(page.getByTestId('code-new')).toHaveCount(0);
    const attempt = await command<{ code: string }>(engineer, '/v2/reason-codes', { code: `E2E-ENG-${world.suffix}`, name: 'E2E engineer attempt' });
    expect(attempt.status).toBe(403);
    expect(await findCode(manager, `E2E-ENG-${world.suffix}`)).toBeNull();
  });

  test('T22: build → live 422 → draft → author cannot activate → simulate → approver activates → applied → rollback', async ({ page, browser }) => {
    const name = `E2E T22 ${world.suffix}`;
    const before = await downtime(manager, world, 30, 2);
    expect(before.classification.scheduleClass).toBe('unknown');
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await page.goto('/master-data/codes-rules?tab=rules');
    await page.getByTestId('rule-new').click({ timeout: 60_000 });
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
    await expect(page.getByTestId('rule-activate')).toBeDisabled();
    const own = await call<{ code: string }>(manager, 'POST', `/v2/rules/${stored?.id}/activate`, {}, { 'Idempotency-Key': randomUUID(), 'If-Match': `"${stored?.rowVersion}"` });
    expect([own.status, own.body.code]).toEqual([403, 'SEPARATION_OF_DUTIES']);
    await page.getByTestId('tab-simulation').click();
    await page.getByTestId('sim-unit').selectOption({ label: world.unitName });
    await page.getByTestId('sim-run').click();
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-version', 'draft');
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-matched', '1');
    await expect(page.getByTestId('sim-result')).toHaveAttribute('data-changed', '1');
    await expect(page.getByRole('row').filter({ has: page.locator('[data-testid="sim-field"][data-field="scheduleClass"]') })).toContainText('Unplanned: 1');

    // the second approver activates version 1; the server applies it to new events
    const second = await asUser(browser, APPROVER);
    await openRule(second, manager, name);
    await second.getByTestId('rule-activate').click();
    await confirmDialog(second, 'Activate rule');
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
    await openRule(page, manager, name);
    await page.getByTestId('action-value').selectOption('external');
    await expect(page.getByTestId('rule-validation')).toHaveAttribute('data-state', 'valid', { timeout: 20_000 });
    await page.getByTestId('rule-save').click();
    await expect(page.getByTestId('rule-detail')).toHaveAttribute('data-has-draft', 'true', { timeout: 20_000 });
    await openRule(second, manager, name);
    await second.getByTestId('rule-activate').click();
    await confirmDialog(second, 'Activate rule');
    await expect(second.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '2', { timeout: 20_000 });
    expect((await downtime(manager, world, 12, 2)).classification.scheduleClass).toBe('external');
    await second.getByTestId('tab-rule-versions').click();
    const v2 = ruleVersionRow(second, 2);
    await expect(v2.locator('[data-change="added"]')).toContainText(/external/i);
    await expect(v2.locator('[data-change="removed"]')).toContainText(/unplanned/i);
    await ruleVersionRow(second, 1).getByTestId('rule-rollback').click();
    await confirmDialog(second, 'Restore version');
    await expect(second.getByTestId('rule-detail')).toHaveAttribute('data-active-version', '3', { timeout: 20_000 });
    await expect(second.locator('[data-testid="rule-version"][data-version="3"]')).toHaveAttribute('data-origin', 'rollback');
    expect((await downtime(manager, world, 8, 2)).classification.scheduleClass).toBe('unplanned');
    await second.context().close();
  });
});
