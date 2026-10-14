import { test, expect } from '@playwright/test';
import { expectHidden, expectRefused } from './support/hidden-controls';
import {
  DEMO, DEMO_HEADER, MINUTE, VIEWERS, apiLogin, call, command, currentStop, loginAsViewerInDemoPlant, note, openHub,
  tag, unitsOf, type ApiErrorBody, type ListBody, type UnitView, type ViewerSession,
} from './support/viewer-world';

/**
 * VIEWER persona — journey 3: v2 screens show a "Read-only" hint and offer no write control to a viewer;
 * every write from Demo Plant is still refused by the server with 403 READ_ONLY_ROLE (WriteAccessGuard)
 * or FORBIDDEN_ROLE (role-gated routes), and nothing is created. The v1 task dialog still offers its
 * button and shows the refusal on screen.
 * Pedro: Event Hub v2 (new event, close a running stop, code an event) and a task.
 * Nadia: a plan draft, a reason code, a valuation policy, an RCA case, and the raw API.
 */
/**
 * Role-gated routes (plans, codes, policies, RCAs, flags) are refused by the RolesGuard, which runs before the
 * WriteAccessGuard (last in the chain): a viewer gets 403 FORBIDDEN_ROLE there and READ_ONLY_ROLE only on
 * member-level routes (production events, tasks). Both are refusals of kind "role"; the code seen is recorded.
 */
const REFUSAL_CODES = ['READ_ONLY_ROLE', 'FORBIDDEN_ROLE'];

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

/** A viewer's write on a role-gated route: 403 with READ_ONLY_ROLE or FORBIDDEN_ROLE (see REFUSAL_CODES). */
function expectViewerRefusal(result: { status: number; body: ApiErrorBody }): void {
  expect(result.status, JSON.stringify(result.body)).toBe(403);
  expect(REFUSAL_CODES).toContain(result.body.code);
}

test.describe('Viewer — every write in Demo Plant is refused (READ_ONLY_ROLE)', () => {
  test.beforeAll(async () => {
    pedro = await apiLogin(VIEWERS.pedro);
    nadia = await apiLogin(VIEWERS.nadia);
    demoUnits = await unitsOf(pedro.token, DEMO.id);
  });

  test('R1 Pedro: Event Hub — Read-only hint, no New event / Close stop / Edit controls; the server refuses each write; nothing changes', async ({ page }) => {
    const label = tag('R1');
    const running = await runningStop(pedro.token);
    const unit = running?.unit ?? demoUnits[0];
    await loginAsViewerInDemoPlant(page, VIEWERS.pedro);
    await openHub(page, unit.name);

    // new event: the toolbar shows the Read-only hint instead of the button; the server refuses the create
    await expect(page.getByTestId('read-only-hint').first()).toBeVisible();
    await expect(page.getByTestId('read-only-hint').first()).toHaveText(/Read-only/);
    await expectHidden(page.getByTestId('new-event'));
    await expectHidden(page.getByRole('link', { name: 'New event' }));
    await page.screenshot({ path: test.info().outputPath('viewer-r1-read-only-hub.png') });
    const create = await command<ApiErrorBody & { id?: string }>(pedro.token, '/v2/production-events', {
      unitId: unit.id, startTime: new Date(Date.now() - 30 * MINUTE).toISOString(), durationSeconds: 600, physicalType: 'downtime', description: label,
    }, DEMO_HEADER);
    expectRefused(create, 'READ_ONLY_ROLE');
    expect(create.body).not.toHaveProperty('id');

    if (!running) {
      note(test.info(), 'observation', 'No running stop in Demo Plant at test time: the close / code controls were not checked in the browser.');
      return;
    }
    const { stop } = running;
    // the running stop is listed with Open only (no Close stop); its detail offers no Edit / Split / Close
    const card = currentStop(page, stop.id);
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: 'Open' })).toBeVisible();
    await expectHidden(card.getByRole('button', { name: 'Close stop' }));
    await card.getByRole('link', { name: 'Open' }).click();
    const detail = page.getByTestId('event-detail');
    await expect(detail).toBeVisible();
    await expectHidden(detail.getByRole('button', { name: 'Edit / code' }));
    await expectHidden(detail.getByRole('button', { name: 'Close stop' }));
    await page.screenshot({ path: test.info().outputPath('viewer-r1-detail-read-only.png') });

    // the server still refuses closing and coding the stop
    const close = await command<ApiErrorBody>(pedro.token, `/v2/production-events/${stop.id}/close`, { reason: `${label} viewer must not close` }, DEMO_HEADER);
    expectRefused(close, 'READ_ONLY_ROLE');
    const codes = await call<ListBody<ReasonCode>>(pedro.token, 'GET', '/v2/reason-codes?limit=200', undefined, DEMO_HEADER);
    const reason = codes.body.items.find((code) => code.active);
    expect(reason, 'Demo Plant has an active reason code').toBeTruthy();
    const coded = await call<ApiErrorBody>(pedro.token, 'PATCH', `/v2/production-events/${stop.id}`, { reasonCodeId: (reason as ReasonCode).id }, { ...DEMO_HEADER, 'If-Match': '"1"' });
    expectRefused(coded, 'READ_ONLY_ROLE');

    const after = await call<EventBody>(pedro.token, 'GET', `/v2/production-events/${stop.id}`, undefined, DEMO_HEADER);
    expect(after.status).toBe(200);
    expect(after.body.isOpen).toBe(true);
  });

  test('R2 Pedro: a task for Demo Plant cannot be created from the read-only plant', async ({ page }) => {
    const title = tag('R2-task');
    await loginAsViewerInDemoPlant(page, VIEWERS.pedro);
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible({ timeout: 60_000 });
    // the read-only plant offers no New task; the form page (/tasks/new) reached directly is refused on save
    await expect(page.getByRole('link', { name: 'New task' })).toHaveCount(0);
    await page.goto('/tasks/new');
    await expect(page.getByRole('heading', { name: 'New task', level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Title').fill(title);
    const posted = page.waitForResponse((r) => /\/api\/(v2\/)?tasks$/.test(r.url()) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create task' }).click();
    const response = await posted;
    // the client names the acting plant, so the server sees the viewer-only scope and refuses before
    // anything is stored (WriteAccessGuard, 403 READ_ONLY_ROLE)
    expect(response.request().headers()['x-tenant-id'], 'the task client names the acting plant').toBe(DEMO.id);
    expect(response.status(), 'POST tasks from the read-only plant must be refused').toBe(403);
    expect(((await response.json()) as ApiErrorBody).code).toBe('READ_ONLY_ROLE');
    await expect(page).toHaveURL(/\/tasks\/new$/); // stays on the form with the draft; no crash
    await page.screenshot({ path: test.info().outputPath('viewer-r2-task.png') });
    // the same payload sent directly with the acting plant named is refused the same way
    const body = response.request().postDataJSON() as Record<string, unknown>;
    const path = new URL(response.url()).pathname.replace(/^\/api/, '');
    const direct = await command<ApiErrorBody & { id?: string }>(pedro.token, path, { ...body, title: `${title}-api` }, { ...DEMO_HEADER, 'X-Client-Audited': 'true' });
    expect(direct.status).toBe(403);
    expect(direct.body.code).toBe('READ_ONLY_ROLE');
    expect(direct.body).not.toHaveProperty('id');
    const tasks = await call<Array<{ title: string; tenantId: string }>>(pedro.token, 'GET', `/tasks?tenantId=${DEMO.id}`);
    expect(tasks.status).toBe(200);
    expect(tasks.body.filter((task) => task.title.startsWith(title))).toEqual([]);
  });

  test('R3 Nadia: Planning shows the Read-only hint and no New plan; the server refuses a plan draft; nothing stored', async ({ page }) => {
    const name = tag('R3-plan');
    await loginAsViewerInDemoPlant(page, VIEWERS.nadia);
    await page.goto('/planning?tab=plans');
    await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plans-tab')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plans-tab').getByTestId('read-only-hint')).toBeVisible();
    await expectHidden(page.getByTestId('plan-new'));
    await page.screenshot({ path: test.info().outputPath('viewer-r3-plan.png') });
    const unitId = demoUnits[0].id;
    const plan = await command<ApiErrorBody>(nadia.token, '/v2/production-plans', {
      name, unitId, validFrom: '2026-12-01T06:00:00.000Z', validTo: '2026-12-02T06:00:00.000Z', basis: 'quantity', headerTarget: '1000', slices: [],
    }, DEMO_HEADER);
    expectViewerRefusal(plan);
    note(test.info(), 'observation', `plan draft refused with ${plan.body.code}`);
    const plans = await call<ListBody<{ name: string }>>(nadia.token, 'GET', `/v2/production-plans?limit=200&unitId=${unitId}`, undefined, DEMO_HEADER);
    expect(plans.status).toBe(200);
    expect(plans.body.items.map((entry) => entry.name)).not.toContain(name);
  });

  test('R4 Nadia: Codes and Finance show the Read-only hint, no New code / New policy version; the server refuses both', async ({ page }) => {
    const code = tag('R4').replace(/[^A-Za-z0-9._:-]/g, '-');
    await loginAsViewerInDemoPlant(page, VIEWERS.nadia);
    await page.goto('/codes-admin');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('code-row').first()).toBeVisible({ timeout: 30_000 }); // reads are allowed
    await expect(page.getByTestId('read-only-hint').first()).toBeVisible();
    await expectHidden(page.getByTestId('code-new'));
    await page.screenshot({ path: test.info().outputPath('viewer-r4-code.png') });
    const created = await command<ApiErrorBody>(nadia.token, '/v2/reason-codes', { code, name: 'P-VIEW viewer must not create codes' }, DEMO_HEADER);
    expectViewerRefusal(created);
    note(test.info(), 'observation', `reason code refused with ${created.body.code}`);
    const codes = await call<ListBody<ReasonCode>>(nadia.token, 'GET', '/v2/reason-codes?limit=500', undefined, DEMO_HEADER);
    expect(codes.body.items.map((item) => item.code)).not.toContain(code);

    await page.goto('/finance');
    await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('policies-tab')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('policies-tab').getByTestId('read-only-hint')).toBeVisible();
    await expectHidden(page.getByTestId('policy-new'));
    await page.screenshot({ path: test.info().outputPath('viewer-r4-policy.png') });
    const policy = await command<ApiErrorBody>(nadia.token, '/v2/valuation-policies', { effectiveFrom: '2026-12-01T00:00:00.000Z', notes: tag('R4-policy') }, DEMO_HEADER);
    expectViewerRefusal(policy);
    note(test.info(), 'observation', `valuation policy refused with ${policy.body.code}`);
  });

  test('R5 Nadia: RCA shows the Read-only hint and no New case; the server refuses a case; no case exists afterwards', async ({ page }) => {
    const title = tag('R5-case');
    await loginAsViewerInDemoPlant(page, VIEWERS.nadia);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('rca-v2').getByTestId('read-only-hint')).toBeVisible();
    await expectHidden(page.getByTestId('new-case'));
    await page.screenshot({ path: test.info().outputPath('viewer-r5-rca.png') });
    const refused = await command<ApiErrorBody>(nadia.token, '/v2/rcas', { title }, DEMO_HEADER);
    expectViewerRefusal(refused);
    note(test.info(), 'observation', `RCA case refused with ${refused.body.code}`);
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
