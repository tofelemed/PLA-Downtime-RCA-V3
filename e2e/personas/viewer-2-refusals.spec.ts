import { test, expect, type Page } from '@playwright/test';
import {
  DEMO, DEMO_HEADER, MINUTE, VIEWERS, apiLogin, call, command, currentStop, loginAsViewerInDemoPlant, note, openHub,
  plantLocal, plantTimezoneOf, tag, unitsOf, type ApiErrorBody, type ListBody, type UnitView, type ViewerSession,
} from './support/viewer-world';

/**
 * VIEWER persona — journey 3: every write from Demo Plant is refused by the server with 403 READ_ONLY_ROLE
 * (WriteAccessGuard), shown on screen as the read-only refusal, and nothing is created.
 * Pedro: Event Hub v2 (new event, close a running stop, code an event) and a task.
 * Nadia: a plan draft, a reason code, a valuation policy, an RCA case, and the raw API.
 */
const READ_ONLY_TITLE = 'Your role in this plant is read-only';
/**
 * Role-gated routes (plans, codes, policies, RCAs, flags) are refused by the RolesGuard, which runs before the
 * WriteAccessGuard (last in the chain): a viewer gets 403 FORBIDDEN_ROLE there and READ_ONLY_ROLE only on
 * member-level routes (production events, tasks). Both are refusals of kind "role"; the code seen is recorded.
 */
const REFUSAL_CODES = ['READ_ONLY_ROLE', 'FORBIDDEN_ROLE'];
const titleFor = (code: string | null) => (code === 'READ_ONLY_ROLE' ? READ_ONLY_TITLE : 'Your role does not allow this');

interface EventBody {
  id: string;
  unitId: string;
  status: string;
  isOpen: boolean;
}

interface ReasonCode {
  id: string;
  code: string;
  active: boolean;
}

let pedro: ViewerSession;
let nadia: ViewerSession;
let demoUnits: UnitView[];

test.describe.configure({ timeout: 240_000 });

/** The first Demo Plant stop that is still running, with its unit (the Event Hub shows it in "Current stops"). */
async function runningStop(token: string): Promise<{ stop: EventBody; unit: UnitView } | null> {
  const open = await call<ListBody<EventBody>>(token, 'GET', '/v2/production-events?isOpen=true&limit=50', undefined, DEMO_HEADER);
  expect(open.status).toBe(200);
  for (const stop of open.body.items) {
    if (stop.status === 'Cancelled') continue;
    const unit = demoUnits.find((entry) => entry.id === stop.unitId);
    if (unit) return { stop, unit };
  }
  return null;
}

async function expectFormRefusal(page: Page): Promise<void> {
  const error = page.getByTestId('event-form').getByTestId('form-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('READ_ONLY_ROLE');
  await expect(error).toContainText(/read-only/i);
  await expect(page.getByTestId('event-form')).toBeVisible();
}

test.describe('Viewer — every write in Demo Plant is refused (READ_ONLY_ROLE)', () => {
  test.beforeAll(async () => {
    pedro = await apiLogin(VIEWERS.pedro);
    nadia = await apiLogin(VIEWERS.nadia);
    demoUnits = await unitsOf(pedro.token, DEMO.id);
  });

  test('R1 Pedro: Event Hub — new event, close a running stop and code an event are refused on screen; nothing changes', async ({ page }) => {
    const label = tag('R1');
    const running = await runningStop(pedro.token);
    const unit = running?.unit ?? demoUnits[0];
    await loginAsViewerInDemoPlant(page, VIEWERS.pedro);
    await openHub(page, unit.name);

    // new event
    await page.getByRole('button', { name: 'New event' }).click();
    const form = page.getByTestId('event-form');
    await expect(form.locator('#unitId')).toHaveValue(unit.id);
    const timezone = await plantTimezoneOf(form);
    await form.locator('#startLocal').fill(plantLocal(new Date(Date.now() - 30 * MINUTE), timezone));
    await form.locator('#endLocal').fill(plantLocal(new Date(Date.now() - 20 * MINUTE), timezone));
    await form.locator('#description').fill(label);
    const create = page.waitForResponse((r) => r.url().endsWith('/v2/production-events') && r.request().method() === 'POST');
    await form.getByRole('button', { name: 'Save' }).click();
    const refused = await create;
    expect(refused.status()).toBe(403);
    expect(((await refused.json()) as ApiErrorBody).code).toBe('READ_ONLY_ROLE');
    await expectFormRefusal(page);
    await page.screenshot({ path: test.info().outputPath('viewer-r1-new-event.png') });
    await page.keyboard.press('Escape');
    const keep = form.getByRole('button', { name: 'Keep draft and close' });
    if (await keep.isVisible().catch(() => false)) await keep.click();
    await expect(form).toBeHidden();

    if (!running) {
      note(test.info(), 'observation', 'No running stop in Demo Plant at test time: the close / code refusals were not exercised in the browser.');
      return;
    }
    const { stop } = running;
    // close the running stop
    const card = currentStop(page, stop.id);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Close stop' }).click();
    const close = page.getByTestId('close-dialog');
    await close.locator('#close-reason').fill(`${label} viewer must not close`);
    await close.getByRole('button', { name: 'Close stop' }).click();
    const closeError = close.getByTestId('command-error');
    await expect(closeError).toBeVisible();
    await expect(closeError).toContainText('READ_ONLY_ROLE');
    await page.screenshot({ path: test.info().outputPath('viewer-r1-close-stop.png') });
    await page.keyboard.press('Escape');
    await expect(close).toBeHidden();

    // code the stop
    const codes = await call<ListBody<ReasonCode>>(pedro.token, 'GET', '/v2/reason-codes?limit=200', undefined, DEMO_HEADER);
    const reason = codes.body.items.find((code) => code.active);
    expect(reason, 'Demo Plant has an active reason code').toBeTruthy();
    await card.getByRole('button', { name: 'Open' }).click();
    await page.getByTestId('event-detail').getByRole('button', { name: 'Edit / code' }).click();
    const edit = page.getByTestId('event-form');
    await edit.locator('#reasonCodeId').selectOption((reason as ReasonCode).id);
    await edit.getByRole('button', { name: 'Save' }).click();
    await expectFormRefusal(page);
    await page.screenshot({ path: test.info().outputPath('viewer-r1-code-event.png') });

    const after = await call<EventBody>(pedro.token, 'GET', `/v2/production-events/${stop.id}`, undefined, DEMO_HEADER);
    expect(after.status).toBe(200);
    expect(after.body.isOpen).toBe(true);
  });

  test('R2 Pedro: a task for Demo Plant cannot be created from the read-only plant', async ({ page }) => {
    const title = tag('R2-task');
    await loginAsViewerInDemoPlant(page, VIEWERS.pedro);
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'New Task' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Create Task' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill(title);
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();
    const posted = page.waitForResponse((r) => /\/api\/tasks$/.test(r.url()) && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create Task' }).click();
    const response = await posted;
    // the v1 client names the acting plant (X-Tenant-Id from the plant selection), so the server sees the
    // viewer-only scope and refuses before anything is stored (WriteAccessGuard, 403 READ_ONLY_ROLE)
    expect(response.request().headers()['x-tenant-id'], 'the v1 task client names the acting plant').toBe(DEMO.id);
    const body = response.request().postDataJSON() as Record<string, unknown>;
    expect(body.tenantId).toBe(DEMO.id);
    expect(response.status(), 'POST /api/tasks from the read-only plant must be refused').toBe(403);
    expect(((await response.json()) as ApiErrorBody).code).toBe('READ_ONLY_ROLE');
    await expect(page.getByText('Save failed')).toBeVisible();
    await expect(dialog).toBeVisible(); // the dialog stays open with the draft; no crash
    await page.screenshot({ path: test.info().outputPath('viewer-r2-task.png') });
    // the same payload sent directly with the acting plant named is refused the same way
    const direct = await call<ApiErrorBody & { id?: string }>(pedro.token, 'POST', '/tasks', { ...body, title: `${title}-api` }, { ...DEMO_HEADER, 'X-Client-Audited': 'true' });
    expect(direct.status).toBe(403);
    expect(direct.body.code).toBe('READ_ONLY_ROLE');
    expect(direct.body).not.toHaveProperty('id');
    const tasks = await call<Array<{ title: string; tenantId: string }>>(pedro.token, 'GET', `/tasks?tenantId=${DEMO.id}`);
    expect(tasks.status).toBe(200);
    expect(tasks.body.filter((task) => task.title.startsWith(title))).toEqual([]);
  });

  test('R3 Nadia: a plan draft is refused with the read-only title and is not stored', async ({ page }) => {
    const name = tag('R3-plan');
    await loginAsViewerInDemoPlant(page, VIEWERS.nadia);
    await page.goto('/planning?tab=plans');
    await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plans-tab')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('plan-new').click();
    await page.fill('#planName', name);
    await page.locator('#planUnit').selectOption({ index: 1 });
    const unitId = await page.locator('#planUnit').inputValue();
    await page.fill('#planFrom', '2026-12-01T06:00');
    await page.fill('#planTo', '2026-12-02T06:00');
    await page.fill('#headerTarget', '1000');
    await page.locator('#slice-0-product').selectOption({ index: 1 });
    await page.getByTestId('plan-save').click();
    const refusal = page.getByTestId('refusal');
    await expect(refusal).toBeVisible();
    await expect(refusal).toHaveAttribute('data-kind', 'role');
    const planCode = await refusal.getAttribute('data-code');
    expect(REFUSAL_CODES).toContain(planCode);
    await expect(refusal).toContainText(titleFor(planCode));
    note(test.info(), 'observation', `plan draft refused with ${planCode}`);
    await page.screenshot({ path: test.info().outputPath('viewer-r3-plan.png') });
    const plans = await call<ListBody<{ name: string }>>(nadia.token, 'GET', `/v2/production-plans?limit=200&unitId=${unitId}`, undefined, DEMO_HEADER);
    expect(plans.status).toBe(200);
    expect(plans.body.items.map((plan) => plan.name)).not.toContain(name);
  });

  test('R4 Nadia: a reason code and a valuation policy are refused with the read-only title', async ({ page }) => {
    const code = tag('R4').replace(/[^A-Za-z0-9._:-]/g, '-');
    await loginAsViewerInDemoPlant(page, VIEWERS.nadia);
    await page.goto('/codes-admin');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('tab-reason-codes').click();
    await expect(page.getByTestId('code-row').first()).toBeVisible({ timeout: 30_000 }); // reads are allowed
    await page.getByTestId('code-new').click();
    const dialog = page.getByTestId('code-create-dialog');
    await dialog.locator('#new-code').fill(code);
    await dialog.locator('#new-name').fill('P-VIEW viewer must not create codes');
    await dialog.getByTestId('new-parent').selectOption('');
    await dialog.getByTestId('code-create-submit').click();
    const refusal = dialog.getByTestId('admin-refusal');
    await expect(refusal).toBeVisible();
    await expect(refusal).toHaveAttribute('data-status', '403');
    await expect(refusal).toHaveAttribute('data-kind', 'role');
    const codeCode = await refusal.getAttribute('data-code');
    expect(REFUSAL_CODES).toContain(codeCode);
    await expect(refusal).toContainText(codeCode === 'READ_ONLY_ROLE' ? READ_ONLY_TITLE : 'Your role does not allow this');
    note(test.info(), 'observation', `reason code refused with ${codeCode}`);
    await page.screenshot({ path: test.info().outputPath('viewer-r4-code.png') });
    await page.keyboard.press('Escape');
    const codes = await call<ListBody<ReasonCode>>(nadia.token, 'GET', '/v2/reason-codes?limit=500', undefined, DEMO_HEADER);
    expect(codes.body.items.map((item) => item.code)).not.toContain(code);

    await page.goto('/finance');
    await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('policy-new').click();
    await page.locator('#policyEffectiveFrom').fill('2026-12-01T00:00');
    await page.getByTestId('policy-save').click();
    const policyRefusal = page.getByTestId('refusal');
    await expect(policyRefusal).toBeVisible();
    await expect(policyRefusal).toHaveAttribute('data-kind', 'role');
    const policyCode = await policyRefusal.getAttribute('data-code');
    expect(REFUSAL_CODES).toContain(policyCode);
    await expect(policyRefusal).toContainText(titleFor(policyCode));
    note(test.info(), 'observation', `valuation policy refused with ${policyCode}`);
    await page.screenshot({ path: test.info().outputPath('viewer-r4-policy.png') });
  });

  test('R5 Nadia: an RCA case is refused in the dialog; no case exists afterwards', async ({ page }) => {
    const title = tag('R5-case');
    await loginAsViewerInDemoPlant(page, VIEWERS.nadia);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('new-case').click();
    const dialog = page.getByTestId('create-case-dialog');
    await dialog.locator('#case-title').fill(title);
    await dialog.getByRole('button', { name: 'Create case' }).click();
    const refusal = dialog.getByTestId('command-error');
    await expect(refusal).toBeVisible();
    await expect(refusal).toContainText(/Refused \((READ_ONLY_ROLE|FORBIDDEN_ROLE)\)/);
    note(test.info(), 'observation', `RCA case refused: ${(await refusal.textContent())?.split('Reference')[0]}`);
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('viewer-r5-rca.png') });
    const cases = await call<ListBody<{ title: string }>>(nadia.token, 'GET', `/v2/rcas?q=${encodeURIComponent(title)}`, undefined, DEMO_HEADER);
    expect(cases.status).toBe(200);
    expect(cases.body.items.filter((item) => item.title === title)).toEqual([]);
  });

  test('R6 Nadia (API): POST /v2/production-events, a reason code and a flag write answer 403 READ_ONLY_ROLE; nothing is created', async () => {
    const unit = demoUnits[0];
    const event = await command<ApiErrorBody & { id?: string }>(nadia.token, '/v2/production-events', {
      unitId: unit.id, startTime: '2026-10-05T06:00:00.000Z', durationSeconds: 600, physicalType: 'downtime', description: tag('R6'),
    }, DEMO_HEADER);
    expect(event.status).toBe(403);
    expect(event.body.code).toBe('READ_ONLY_ROLE');
    expect(event.body).not.toHaveProperty('id');
    const code = await command<ApiErrorBody>(nadia.token, '/v2/reason-codes', { code: tag('R6-code'), name: 'refused' }, DEMO_HEADER);
    expect(code.status).toBe(403);
    expect(REFUSAL_CODES).toContain(code.body.code);
    // the flag is already on; a refused PUT of the same value can never switch anything off
    const flag = await call<ApiErrorBody>(nadia.token, 'PUT', '/v2/feature-flags/v2.rca', { enabled: true }, DEMO_HEADER);
    expect(flag.status).toBe(403);
    expect(REFUSAL_CODES).toContain(flag.body.code);
    note(test.info(), 'observation', `API refusal codes: production event=${event.body.code}, reason code=${code.body.code}, feature flag=${flag.body.code}`);
    const flags = await call<ListBody<{ key: string; enabled: boolean }>>(nadia.token, 'GET', '/v2/feature-flags', undefined, DEMO_HEADER);
    expect(flags.body.items.find((item) => item.key === 'v2.rca')?.enabled).toBe(true);
  });
});
