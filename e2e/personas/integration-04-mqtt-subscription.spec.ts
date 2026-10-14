import { test, expect, type Page } from '@playwright/test';
import { apiLogin, call, DEMO_UNIT_CODE, eventsByEventId, findConnection, INT_USERS, jobCommand, loadState, newSuffix, openConsole, runSim, saveState, seededEventIds, selectConnection, simEventId, subscribeJob, uiLogin, unitByCode, type IntSession, type IntState } from './support/integration-world';
import { eventRowOf, showMoreFilters } from './support/event-hub-ui';

/**
 * INTEGRATION ADMIN persona — journeys 4 (subscription lifecycle) and 5 (payload profile editor) on
 * the connection the wizard spec created. Omar watches the subscribe job run, publishes one event with
 * the simulator in the connection's namespace, sees the counters grow and the event land on the demo
 * unit (`\\PIAF\HDPE\Polymer\Line1\Extruder1` → DEMO-EXTRUDER1 by the demo placement rule), pauses the
 * job, publishes while paused, resumes and receives the queued messages (persistent session), and leaves
 * it running. Elena then edits the value map: a state map without running / stopped is refused with the
 * field error, a valid one is saved as a merge patch (If-Match) with live classification, and the server
 * refuses the invalid map as well (422).
 */
let state: IntState;
let omar: IntSession;
let unit: { id: string; name: string };

test.describe.configure({ mode: 'serial', timeout: 300_000 });

const counter = (page: Page, key: string) => page.locator(`[data-testid="mqtt-counters"] [data-counter="${key}"] dd`);
const counters = async (token: string, connectionId: string) => (await subscribeJob(token, connectionId))?.health.counters ?? { received: 0, accepted: 0 };

test.describe('Integration admin — MQTT subscription and payload profile', () => {
  test.beforeAll(async () => {
    state = loadState();
    omar = await apiLogin(INT_USERS.omar);
    unit = await unitByCode(omar.token, DEMO_UNIT_CODE);
  });

  test('INT-04a (omar): the job runs; an open-close run raises the counters and the event lands on the demo unit', async ({ page }) => {
    await uiLogin(page, INT_USERS.omar);
    await openConsole(page);
    await selectConnection(page, state.connectionName);
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    await expect(page.getByTestId('mqtt-job-state')).toHaveAttribute('data-state', 'running');
    const before = await counters(omar.token, state.connectionId);

    // the seed is unique per attempt: a re-run with the same seed is a set of duplicates / revisions to Pro-Act
    const log = await runSim('open-close', state.namespace, ['--seed', `p-int-${newSuffix()}-spaced`, '--hold', '3']);
    const eventId = simEventId(log);
    await expect.poll(async () => (await counters(omar.token, state.connectionId)).received, { intervals: [2_000], timeout: 60_000 }).toBeGreaterThanOrEqual(before.received + 4);
    expect((await counters(omar.token, state.connectionId)).accepted).toBeGreaterThanOrEqual(before.accepted + 4);
    await expect(counter(page, 'received')).toHaveText(String((await counters(omar.token, state.connectionId)).received), { timeout: 30_000 });
    await expect(page.getByTestId('mqtt-last-message')).not.toHaveText('never');
    await page.screenshot({ path: test.info().outputPath('int-04a-counters.png'), fullPage: true });

    // the event: source MQTT on the demo unit, closed then retracted by the delete, coded by its reason code
    await expect.poll(async () => (await eventsByEventId(omar.token, unit.id, eventId)).length, { intervals: [2_000], timeout: 60_000 }).toBe(1);
    const [event] = await eventsByEventId(omar.token, unit.id, eventId);
    expect(event.source).toBe('MQTT');
    expect(event.unitId).toBe(unit.id);
    expect(event.states.physical).toBe('retracted');
    expect(event.reasonCodeId).not.toBeNull();

    // on screen: Event Hub of Demo Plant, the demo unit, retracted rows shown on request (hidden by default)
    await page.goto('/events');
    await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('filter-units').click();
    await page.locator(`#filter-units-${unit.id}`).click();
    await page.keyboard.press('Escape');
    await showMoreFilters(page);
    await page.getByTestId('filter-physical-states').click();
    await page.locator('#filter-physical-states-retracted').click();
    await page.keyboard.press('Escape');
    const row = eventRowOf(page, event.id);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(unit.name);
    await page.screenshot({ path: test.info().outputPath('int-04a-event-hub.png'), fullPage: true });
  });

  test('INT-04b (omar): pause → publish → resume: the broker queued the messages in the persistent session; left running', async ({ page }) => {
    const run = newSuffix(); // seeds are unique per attempt: a re-run with the same seed is a set of duplicates
    await uiLogin(page, INT_USERS.omar);
    await openConsole(page);
    await selectConnection(page, state.connectionName);
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    const before = await counters(omar.token, state.connectionId);

    await jobCommand(page, 'pause', 'P-INT: pause before a planned publish');
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-job-state', 'paused', { timeout: 20_000 });
    await expect.poll(async () => (await subscribeJob(omar.token, state.connectionId))?.health.connected ?? null, { intervals: [2_000], timeout: 60_000 }).toBe(false);

    // while paused: three closed events with unique ids (no deletes) and one full lifecycle (open → closed → changed → deleted)
    const burstSeed = `p-int-${run}-burst`;
    const burstIds = seededEventIds(burstSeed, 'burst', 3); // the burst log prints no ids; the seeded ids are deterministic
    expect(await runSim('burst', state.namespace, ['--seed', burstSeed, '--count', '3', '--rate', '5'])).toContain('burst done: 3 events');
    const lifecycleId = simEventId(await runSim('open-close', state.namespace, ['--seed', `p-int-${run}-lifecycle`, '--hold', '2']));
    expect((await counters(omar.token, state.connectionId)).received).toBe(before.received); // nothing while paused

    await jobCommand(page, 'resume', 'P-INT: resume, the queued messages must arrive');
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
    await expect.poll(async () => (await counters(omar.token, state.connectionId)).received, { intervals: [2_000], timeout: 90_000 }).toBeGreaterThanOrEqual(before.received + 7);
    expect((await subscribeJob(omar.token, state.connectionId))?.health.sessionPresent).toBe(true);
    await expect(page.getByText('Session present on last connect').locator('xpath=..')).toContainText('yes');
    for (const id of burstIds) {
      await expect.poll(async () => (await eventsByEventId(omar.token, unit.id, id)).length, { intervals: [2_000], timeout: 60_000 }).toBe(1);
      expect((await eventsByEventId(omar.token, unit.id, id))[0].states.physical).toBe('closed');
    }
    await page.getByTestId('job-trail-toggle').click();
    await expect(page.locator('[data-testid="job-transition"][data-action="pause"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="job-transition"][data-action="resume"]').first()).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('int-04b-resumed.png'), fullPage: true });
    expect((await subscribeJob(omar.token, state.connectionId))?.state).toBe('running');
    // the queued lifecycle is checked by integration-07-defect-burst-lifecycle.spec.ts (a known defect must not stop INT-05)
    saveState({ ...state, lifecycleEventId: lifecycleId });
  });

  test('INT-05 (elena): a state map without running / stopped is refused with the field error; a valid one is merge-patched with live classification', async ({ page }) => {
    const elena = await apiLogin(INT_USERS.elena);
    await uiLogin(page, INT_USERS.elena);
    await openConsole(page);
    await selectConnection(page, state.connectionName);
    const versionBefore = (await findConnection(elena.token, state.connectionName))?.configVersion ?? 0;
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-editor')).toHaveAttribute('data-kind', 'interval_event_json');
    await page.getByTestId('state-map-add').click();
    const row = page.getByTestId('state-map-row').first();
    await row.getByLabel('Raw token').fill('RUN');
    await row.getByLabel('DT01 state').fill('idle');
    await expect(page.getByTestId('state-map-error')).toContainText('running or stopped');
    await expect(page.getByTestId('profile-save')).toBeDisabled();
    await page.screenshot({ path: test.info().outputPath('int-05-state-map-error.png'), fullPage: true });

    await row.getByLabel('DT01 state').fill('running');
    await expect(page.getByTestId('state-map-error')).toHaveCount(0);
    await page.locator('#state-probe-input').fill('run');
    await expect(page.getByTestId('state-probe-result')).toContainText('"run" → running');
    await page.locator('#state-probe-input').fill('STOP');
    await expect(page.getByTestId('state-probe-result')).toContainText('unmapped_value');
    await expect(page.getByTestId('profile-patch')).toContainText('"RUN": "running"');
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('profile-saved')).toBeVisible({ timeout: 20_000 });
    const patched = await findConnection(elena.token, state.connectionName);
    expect(patched?.endpointConfig.payloadProfile?.valueMaps?.state).toEqual({ RUN: 'running' });
    expect(patched?.endpointConfig.mqtt?.topics).toEqual([`${state.namespace}/+/+/+/+/events`]);
    expect(patched?.configVersion).toBeGreaterThan(versionBefore);

    // the server is the judge: the same invalid map through the API is refused with the field error; a stale If-Match is 412
    const invalid = await call<{ code: string; fieldErrors?: Array<{ field: string; message: string }>; message: string }>(
      elena.token,
      'PATCH',
      `/v2/connections/${state.connectionId}`,
      { payloadProfilePatch: { valueMaps: { state: { RUN: 'idle' } } } },
      { 'If-Match': `"${patched?.rowVersion ?? 0}"` },
    );
    expect(invalid.status).toBe(422);
    expect(JSON.stringify(invalid.body)).toContain('running or stopped');
    // the row has been changed by the wizard and the profile save: version 1 is stale
    const stale = await call<{ code: string }>(elena.token, 'PATCH', `/v2/connections/${state.connectionId}`, { payloadProfilePatch: { schemaVersion: '1.0' } }, { 'If-Match': '"1"' });
    expect(stale.status).toBe(412);
    expect((await findConnection(elena.token, state.connectionName))?.endpointConfig.payloadProfile?.valueMaps?.state).toEqual({ RUN: 'running' });

    // the subscription restarts at the new config version and keeps running
    await page.getByTestId('tab-subscription').click();
    await expect(page.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'connected', { timeout: 90_000 });
  });

  test('INT-05p (elena): the saved value map is shown again after a fresh login', async ({ page }) => {
    await uiLogin(page, INT_USERS.elena);
    await openConsole(page);
    await selectConnection(page, state.connectionName);
    await page.getByTestId('tab-profile').click();
    const row = page.getByTestId('state-map-row').first();
    await expect(row.getByLabel('Raw token')).toHaveValue('RUN');
    await expect(row.getByLabel('DT01 state')).toHaveValue('running');
    // whether the untouched editor reports itself clean is checked by integration-07-defect-*.spec.ts (known defect)
  });
});
