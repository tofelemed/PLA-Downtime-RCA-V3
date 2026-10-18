import { test, expect } from '@playwright/test';
import { CONSOLE_ADMIN, apiLogin, DEMO_UNIT_CODE, eventsByEventId, findConnection, INT_USERS, jobsOf, loadState, openConsole, PREFIX, selectConnection, uiLogin, unitByCode } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — the formerly failing assertions of journeys 3, 4 and 5 (fixed in 6164e78),
 * kept outside the serial journey files so a regression here never stops a later journey. Runs after
 * integration-03 and integration-04 (it reads their state file).
 *
 * INT-03d: INT-03b / INT-03c created a connection with a wrong password / without the CA; the worker's
 * subscribe job failed on the non-retryable CONNACK / TLS error at config v1 (`health.configVersion`).
 * Both connections were corrected through the edit wizard (config v2): the host restarts the failed job
 * on its next sweep (audited `config_changed`, failed → running). Formerly the job stayed `failed` with
 * the old error forever.
 *
 * INT-04c: INT-04b published one full event lifecycle (open → closed → attributes changed → deleted,
 * four messages) while the subscription was paused; on resume the broker delivered the four queued
 * messages within a few hundred milliseconds. Every accepted revision is applied in order, so one event
 * exists, retracted, with its revision history. Formerly the older revisions were skipped as
 * 'superseded' and the retraction found no event.
 *
 * INT-05d: an untouched payload profile editor is clean (`data-dirty=false`) on every fresh open.
 * Formerly the key-order of the stored `time` block produced a `{}` patch and an enabled Save.
 */
test.describe('Integration admin — formerly failing (fixed in 6164e78)', () => {
  test('INT-04c (omar): the lifecycle queued during the pause exists as a retracted event after the resume', async () => {
    const state = loadState();
    expect(state.lifecycleEventId, 'INT-04b recorded the lifecycle event id').toBeTruthy();
    const omar = await apiLogin(INT_USERS.omar);
    const unit = await unitByCode(omar.token, DEMO_UNIT_CODE);
    // formerly failing: burst delivery collapsed the lifecycle to its last message (a delete) and the event never existed
    await expect.poll(async () => (await eventsByEventId(omar.token, unit.id, state.lifecycleEventId ?? '')).length, { intervals: [2_000], timeout: 30_000 }).toBe(1);
    const [event] = await eventsByEventId(omar.token, unit.id, state.lifecycleEventId ?? '');
    expect(event.states.physical).toBe('retracted');
  });

  test('INT-03d (omar): a subscription that failed on a wrong password / missing CA recovers once the connection is corrected', async () => {
    const state = loadState();
    const omar = await apiLogin(INT_USERS.omar);
    for (const name of [`${PREFIX}mqtt-badpw-${state.suffix}`, `${PREFIX}mqtt-tls-${state.suffix}`]) {
      const connection = await findConnection(omar.token, name);
      expect(connection?.configVersion, `${name} was corrected (config v2)`).toBeGreaterThanOrEqual(2);
      // formerly failing: the job that failed at config v1 was never restarted after the correction to v2
      await expect.poll(async () => (await jobsOf(omar.token, connection?.id ?? '')).find((job) => job.scope.mode === 'subscribe')?.state ?? 'none', { intervals: [5_000], timeout: 90_000 }).toBe('running');
    }
  });

  test('INT-05d (elena): an untouched payload profile editor is not dirty after a fresh login', async ({ page }) => {
    const state = loadState();
    // owner 18 Oct 2026: Integration is SuperAdmin-only; the console UI runs as the SuperAdmin
    await uiLogin(page, CONSOLE_ADMIN);
    await openConsole(page);
    await selectConnection(page, state.connectionName);
    await page.getByTestId('tab-profile').click();
    const row = page.getByTestId('state-map-row').first();
    await expect(row.getByLabel('Raw token')).toHaveValue('RUN'); // the saved map of INT-05 is there
    await page.screenshot({ path: test.info().outputPath('int-05d-dirty-editor.png'), fullPage: true });
    // formerly failing: the editor showed "Patch to send (payloadProfilePatch) {}" and an enabled Save for a profile nobody touched
    await expect(page.getByTestId('profile-editor')).toHaveAttribute('data-dirty', 'false');
  });
});
