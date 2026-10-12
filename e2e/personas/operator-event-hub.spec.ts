import { test, expect } from '@playwright/test';
import { call } from '../test-utils/downtime-world';
import {
  OPERATORS, MINUTE, LINE_1_CODE, codeReason, createEvent, getEvent, iso, loginOperator, openHub, plantLocal,
  plantTimezoneOf, reasonPair, row, session, stop, tag, unitByCode, type EventBody, type ListBody, type ReasonCodeView,
  type UnitView,
} from './support/operator-world';
import { backToList, fillPlantTime, openEventRow } from './support/event-hub-ui';

/**
 * OPERATOR persona — Event Hub v2 (/events) journeys of plan 3.2 (UX04): current stop → code → split →
 * recode → close, with persistence after a reload; the server's interval validation on a create; and
 * a reconnect mid-edit that keeps the draft. Data stays in the database (prefix P-OPS-).
 */
interface World {
  liam: string;
  yuki: string;
  unit: UnitView;
  reasons: [ReasonCodeView, ReasonCodeView];
}

const world = {} as World;

test.describe('Operator — Event Hub v2', () => {
  test.beforeAll(async () => {
    world.liam = (await session(OPERATORS.liam)).token;
    world.yuki = (await session(OPERATORS.yuki)).token;
    world.unit = await unitByCode(world.liam, LINE_1_CODE);
    world.reasons = await reasonPair(world.liam);
  });

  test('J1 UX04: unit → current stop → code → split → recode → close; the list persists after reload', async ({ page }) => {
    test.setTimeout(240_000);
    const label = tag('J1');
    await loginOperator(page, OPERATORS.liam);
    await openHub(page, world.unit.name);
    await expect(page.getByTestId('current-stops')).toBeVisible();

    const stops = page.getByTestId('current-stop');
    let stopId = (await stops.count()) > 0 ? await stops.first().getAttribute('data-event-id') : null;
    if (!stopId) {
      // nothing is running on the line: record the stop through the UI (end empty = still running)
      await page.getByRole('link', { name: 'New event' }).click();
      const form = page.getByTestId('event-form');
      await expect(form.locator('#unitId')).toHaveValue(world.unit.id);
      const timezone = await plantTimezoneOf(form);
      await fillPlantTime(form, 'Start', plantLocal(new Date(Date.now() - 40 * MINUTE), timezone));
      await form.locator('#description').fill(label);
      const created = page.waitForResponse((r) => r.url().endsWith('/v2/production-events') && r.request().method() === 'POST');
      await form.getByRole('button', { name: 'Save' }).click();
      const response = await created;
      expect(response.status()).toBe(201);
      stopId = ((await response.json()) as EventBody).id;
      await expect(form).toBeHidden();
      await backToList(page);
    }
    expect(stopId).toBeTruthy();
    const id = stopId as string;

    await expect(stop(page, id)).toBeVisible();
    await expect(stop(page, id).getByTestId('current-stop-elapsed')).toHaveText(/\d+:\d{2}/);
    await stop(page, id).getByRole('link', { name: 'Open' }).click();
    await codeReason(page, world.reasons[0].id);
    await expect(page.getByTestId('event-detail').getByLabel('Coding state: Coded')).toBeVisible();

    // cause changed: split at the slider default, recode the running half
    await page.getByTestId('event-detail').getByRole('button', { name: 'Split' }).click();
    const split = page.getByTestId('split-dialog');
    await expect(split.getByTestId('split-preview')).toContainText('Part 2');
    await split.locator('#split-reason').fill(`${label} cause changed`);
    const splitResponse = page.waitForResponse((r) => r.url().includes(`/production-events/${id}/split`));
    await split.getByRole('button', { name: 'Split' }).click();
    const result = (await (await splitResponse).json()) as { events: Array<{ id: string; isOpen: boolean }> };
    const running = result.events.find((event) => event.isOpen);
    const ended = result.events.find((event) => !event.isOpen);
    expect(running && ended).toBeTruthy();
    // the split opens the first part's page; Back returns to the list with the same filters
    await backToList(page);
    await expect(row(page, running!.id)).toBeVisible();
    await expect(row(page, ended!.id)).toBeVisible();
    await expect(row(page, id)).toHaveCount(0);

    await openEventRow(page, running!.id);
    await codeReason(page, world.reasons[1].id);
    await backToList(page);
    await expect(row(page, running!.id).getByTestId('event-reason')).toContainText(world.reasons[1].name);
    await expect(row(page, ended!.id).getByTestId('event-reason')).toContainText(world.reasons[0].name);

    await stop(page, running!.id).getByRole('button', { name: 'Close stop' }).click();
    const close = page.getByTestId('close-dialog');
    await close.locator('#close-reason').fill(`${label} restarted`);
    await close.getByRole('button', { name: 'Close stop' }).click();
    await expect(stop(page, running!.id)).toHaveCount(0);
    await expect(row(page, running!.id).getByTestId('event-duration')).not.toContainText('Running');
    await page.screenshot({ path: test.info().outputPath('operator-event-hub-j1.png'), fullPage: true });

    // persistence: reload, same filter, same values on screen and on the API
    await page.reload();
    await openHub(page, world.unit.name);
    await expect(row(page, running!.id).getByTestId('event-reason')).toContainText(world.reasons[1].name);
    await expect(row(page, ended!.id).getByTestId('event-reason')).toContainText(world.reasons[0].name);
    await expect(row(page, running!.id).getByTestId('event-duration')).not.toContainText('Running');
    const first = await getEvent(world.liam, ended!.id);
    const second = await getEvent(world.liam, running!.id);
    expect(first.body.reasonCodeId).toBe(world.reasons[0].id);
    expect(second.body.reasonCodeId).toBe(world.reasons[1].id);
    expect(second.body.isOpen).toBe(false);
    expect(second.body.endTime).not.toBeNull();
  });

  test('J2 validation: end before start, then end that disagrees with the duration → field error, nothing created', async ({ page }) => {
    const unit = world.unit.id;
    const window = `unitIds=${unit}&from=2026-10-01T00:00:00.000Z&to=2026-10-02T00:00:00.000Z&limit=100`;
    const before = await call<ListBody<EventBody>>(world.yuki, 'GET', `/v2/production-events?${window}`);
    await loginOperator(page, OPERATORS.yuki);
    await openHub(page, world.unit.name);
    await page.getByRole('link', { name: 'New event' }).click();
    const form = page.getByTestId('event-form');
    await expect(form.locator('#unitId')).toHaveValue(unit);
    await form.locator('#description').fill(tag('J2'));

    // end before start: the server refuses the interval, the error lands on a field or the form
    await fillPlantTime(form, 'Start', '2026-10-01T09:00');
    await fillPlantTime(form, 'End (empty = still running)', '2026-10-01T08:00');
    await form.getByRole('button', { name: 'Save' }).click();
    const fieldOrFormError = form.locator('[data-testid^="error-"], [data-testid="form-error"]').first();
    await expect(fieldOrFormError).toBeVisible();
    await expect(form).toBeVisible();

    // end and duration disagree: the server's field error reaches the duration input
    await fillPlantTime(form, 'End (empty = still running)', '2026-10-01T10:00');
    await form.locator('#durationMinutes').fill('30');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByTestId('error-durationMinutes')).toBeVisible();
    await expect(form).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('operator-event-hub-j2.png') });

    await form.getByRole('button', { name: 'Keep draft and close' }).click();
    await expect(form).toBeHidden();
    const after = await call<ListBody<EventBody>>(world.yuki, 'GET', `/v2/production-events?${window}`);
    expect(after.body.items.length).toBe(before.body.items.length);
  });

  test('J3 reconnect mid-edit keeps the draft; the save lands after the network is back', async ({ page }) => {
    const label = tag('J3');
    const created = await createEvent(world.yuki, {
      unitId: world.unit.id, startTime: iso(-5 * 60 * MINUTE), durationSeconds: 900, physicalType: 'downtime', description: label,
    });
    expect(created.status).toBe(201);
    const eventId = created.body.id;
    await loginOperator(page, OPERATORS.yuki);
    await openHub(page, world.unit.name);
    await openEventRow(page, eventId);
    await page.getByTestId('event-detail').getByRole('button', { name: 'Edit / code' }).click();
    const form = page.getByTestId('event-form');
    const mine = `${label} belt slipped (typed before reconnect)`;
    await form.locator('#description').fill(mine);

    // the tab reconnects (reload) mid-edit: the draft comes back from this tab's storage
    await form.getByRole('button', { name: 'Keep draft and close' }).click();
    await expect(form).toBeHidden();
    await page.reload();
    await openHub(page, world.unit.name);
    await openEventRow(page, eventId);
    await page.getByTestId('event-detail').getByRole('button', { name: 'Edit / code' }).click();
    const restored = page.getByTestId('event-form');
    await expect(restored.getByTestId('draft-restored')).toBeVisible();
    await expect(restored.locator('#description')).toHaveValue(mine);

    // the network drops while saving: nothing is lost, the form stays open with the draft until the
    // connection is back, then the queued save lands (no optimistic update, no duplicate)
    await page.context().setOffline(true);
    await restored.getByRole('button', { name: /Save|Saving/ }).click();
    await page.waitForTimeout(2_000);
    await expect(restored).toBeVisible();
    await expect(restored.locator('#description')).toHaveValue(mine);
    await page.context().setOffline(false);
    await expect(restored).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId('event-detail')).toContainText(mine);
    const saved = await getEvent(world.yuki, eventId);
    expect(saved.body.description).toBe(mine);
    expect(saved.body.rowVersion).toBeGreaterThan(created.body.rowVersion);
  });
});
