import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { backToList, eventRowOf, fillPlantTime, openEventRow, pickReasonCode } from './personas/support/event-hub-ui';

/**
 * Plan 3.2 exit test — UX04 operator journey on the v2 Event Hub (flag `v2.eventHub` switched on through
 * the API for the demo tenant and left on — owner requirement: never switch a flag off):
 * unit → current stop with elapsed time → code reason → impacted periods → save → split at the cause
 * change → recode the second part → close the stop → list follows realtime without a reload;
 * reconnect mid-edit restores the draft and a changed server revision forces the conflict review;
 * a create whose end and duration disagree shows the server's field error.
 */
const API = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';
const OPERATOR = { email: 'operator@acme.com', password: 'demo123' };
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const MINUTE = 60_000;

interface ApiResult<T> {
  status: number;
  body: T;
}

async function call<T>(token: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
}

const command = <T>(token: string, path: string, body: unknown) =>
  call<T>(token, 'POST', path, body, { 'Idempotency-Key': randomUUID() });

interface EventBody {
  id: string;
  rowVersion: number;
  description: string | null;
  reasonCodeId: string | null;
}

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

interface World {
  manager: string;
  operator: string;
  unitId: string;
  unitName: string;
  reasonA: string;
  reasonB: string;
  /** part of every code this run creates: the reason picker's search */
  suffix: string;
}

const world = {} as World;

async function openHub(page: Page, unitName: string): Promise<void> {
  await page.goto('/events');
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('filter-units').click();
  await page.getByRole('checkbox', { name: unitName, exact: true }).click();
  await page.keyboard.press('Escape');
}

const row = (page: Page, id: string) => eventRowOf(page, id);
const stop = (page: Page, id: string) => page.locator(`[data-testid="current-stop"][data-event-id="${id}"]`);

async function codeReason(page: Page, reasonId: string, search: string): Promise<void> {
  const drawer = page.getByTestId('event-detail');
  await drawer.getByRole('button', { name: 'Edit / code' }).click();
  const form = page.getByTestId('event-form');
  await pickReasonCode(form.locator('#reasonCodeId'), reasonId, search);
  await expect(form.getByTestId('impacted-periods')).toBeVisible();
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toBeHidden();
}

test.describe('Event Hub v2 — UX04 operator journey (plan 3.2)', () => {
  test.beforeAll(async () => {
    world.manager = (await authenticate(MANAGER.email, MANAGER.password)).accessToken;
    const operator = await authenticate(OPERATOR.email, OPERATOR.password);
    world.operator = operator.accessToken;
    const tenantId = (operator.user as { tenantId: string }).tenantId;
    const flag = await call(world.manager, 'PUT', '/v2/feature-flags/v2.eventHub', { enabled: true });
    expect(flag.status).toBe(200);
    const suffix = randomUUID().slice(0, 8);
    world.suffix = suffix;
    world.unitName = `E2E UX04 ${suffix}`;
    const unit = await call<{ id: string }>(world.manager, 'POST', '/units', { name: world.unitName, code: `E2E-UX04-${suffix}`, tenantId });
    world.unitId = unit.body.id;
    const reason = (code: string, name: string) => command<{ id: string }>(world.manager, '/v2/reason-codes', { code: `${code}-${suffix}`, name });
    world.reasonA = (await reason('E2E-JAM', 'Conveyor jam')).body.id;
    world.reasonB = (await reason('E2E-MOT', 'Motor trip')).body.id;
  });

  test('unit → current stop → code → split → recode → close; list follows realtime', async ({ page }) => {
    const created = await command<EventBody>(world.operator, '/v2/production-events', { unitId: world.unitId, startTime: iso(-40 * MINUTE), physicalType: 'downtime' });
    expect(created.status).toBe(201);
    const stopId = created.body.id;
    const listCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/v2/production-events?')) listCalls.push(request.url());
    });
    await loginViaUI(page, OPERATOR.email, OPERATOR.password);
    await openHub(page, world.unitName);

    // server-side filter: the unit reaches the API as a query parameter, never as tenantId
    await expect.poll(() => listCalls.some((url) => new URL(url).searchParams.getAll('unitIds').includes(world.unitId))).toBe(true);
    expect(listCalls.every((url) => !new URL(url).searchParams.has('tenantId'))).toBe(true);

    await expect(stop(page, stopId)).toBeVisible();
    await expect(stop(page, stopId).getByTestId('current-stop-elapsed')).toHaveText(/\d+:\d{2}/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('event-hub-v2.png'), fullPage: true });
    await stop(page, stopId).getByRole('link', { name: 'Open' }).click();
    await codeReason(page, world.reasonA, world.suffix);
    await expect(page.getByTestId('event-detail').getByLabel('Coding state: Coded')).toBeVisible();

    const drawer = page.getByTestId('event-detail');
    await drawer.getByRole('button', { name: 'Split' }).click();
    const split = page.getByTestId('split-dialog');
    await expect(split.getByTestId('split-preview')).toContainText('Part 2');
    await split.locator('#split-reason').fill('cause changed from jam to motor trip');
    const splitResponse = page.waitForResponse((response) => response.url().includes(`/production-events/${stopId}/split`));
    await split.getByRole('button', { name: 'Split' }).click();
    const result = (await (await splitResponse).json()) as { events: Array<{ id: string; isOpen: boolean }> };
    const running = result.events.find((event) => event.isOpen);
    const ended = result.events.find((event) => !event.isOpen);
    expect(running && ended).toBeTruthy();
    // the split replaces the event page with a part of the split; Back only once it did
    await expect(page).toHaveURL(new RegExp(`/events/(${running!.id}|${ended!.id})$`));
    await backToList(page);
    await expect(row(page, running!.id)).toBeVisible();
    await expect(row(page, ended!.id)).toBeVisible();
    await expect(row(page, stopId)).toHaveCount(0);

    await openEventRow(page, running!.id);
    await codeReason(page, world.reasonB, world.suffix);
    await backToList(page);
    await expect(row(page, running!.id).getByTestId('event-reason')).toContainText('Motor trip');

    await stop(page, running!.id).getByRole('button', { name: 'Close stop' }).click();
    const close = page.getByTestId('close-dialog');
    await close.locator('#close-reason').fill('motor reset');
    await close.getByRole('button', { name: 'Close stop' }).click();
    await expect(stop(page, running!.id)).toHaveCount(0);
    await expect(row(page, running!.id).getByTestId('event-duration')).not.toContainText('Running');

    // realtime: an event written elsewhere appears without a manual refresh
    const other = await command<EventBody>(world.operator, '/v2/production-events', {
      unitId: world.unitId, startTime: iso(-3 * 60 * MINUTE), durationSeconds: 600, physicalType: 'downtime',
    });
    await expect(row(page, other.body.id)).toBeVisible({ timeout: 20_000 });
  });

  test('reconnect mid-edit keeps the draft; a changed server revision forces the conflict review', async ({ page }) => {
    const created = await command<EventBody>(world.operator, '/v2/production-events', {
      unitId: world.unitId, startTime: iso(-5 * 60 * MINUTE), durationSeconds: 900, physicalType: 'downtime',
    });
    const eventId = created.body.id;
    await loginViaUI(page, OPERATOR.email, OPERATOR.password);
    await openHub(page, world.unitName);
    await openEventRow(page, eventId);
    await page.getByTestId('event-detail').getByRole('button', { name: 'Edit / code' }).click();
    await page.getByTestId('event-form').locator('#description').fill('mine: belt slipped');

    // someone else edits while this tab reconnects
    const theirs = await call<EventBody>(world.operator, 'PATCH', `/v2/production-events/${eventId}`, { description: 'theirs' }, { 'If-Match': `"${created.body.rowVersion}"` });
    expect(theirs.status).toBe(200);
    await page.reload();
    await openHub(page, world.unitName);
    await openEventRow(page, eventId);
    await page.getByTestId('event-detail').getByRole('button', { name: 'Edit / code' }).click();
    const form = page.getByTestId('event-form');
    await expect(form.getByTestId('draft-restored')).toBeVisible();
    await expect(form.getByTestId('server-changed')).toBeVisible();
    await expect(form.locator('#description')).toHaveValue('mine: belt slipped');

    await form.getByRole('button', { name: 'Save' }).click();
    const conflict = page.getByTestId('conflict-dialog');
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText('theirs');
    await conflict.getByRole('button', { name: 'Apply my changes to the latest' }).click();
    await expect(form).toBeHidden();
    const saved = await call<EventBody>(world.operator, 'GET', `/v2/production-events/${eventId}`);
    expect(saved.body.description).toBe('mine: belt slipped');
    expect(saved.body.rowVersion).toBeGreaterThan(theirs.body.rowVersion);
  });

  test('create with end and duration that disagree shows the server field error (tablet viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loginViaUI(page, OPERATOR.email, OPERATOR.password);
    await openHub(page, world.unitName);
    await page.getByRole('link', { name: 'New event' }).click();
    const form = page.getByTestId('event-form');
    await expect(form.locator('#unitId')).toHaveValue(world.unitId);
    await fillPlantTime(form, 'Start', '2026-10-01T08:00');
    await fillPlantTime(form, 'End (empty = still running)', '2026-10-01T09:00');
    await form.locator('#durationMinutes').fill('30');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByTestId('error-durationMinutes')).toBeVisible();
    // the form is a page: "Keep draft and close" returns to the list
    await form.getByRole('button', { name: 'Keep draft and close' }).click();
    await expect(form).toBeHidden();
  });
});
