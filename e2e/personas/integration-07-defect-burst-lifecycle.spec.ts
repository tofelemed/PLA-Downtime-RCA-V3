import { test, expect } from '@playwright/test';
import { apiLogin, DEMO_UNIT_CODE, eventsByEventId, findConnection, INT_USERS, jobsOf, loadState, openConsole, PREFIX, selectConnection, uiLogin, unitByCode } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — the known defects of journeys 3, 4 and 5, kept as failing assertions on
 * purpose and outside the serial journey files so a known defect never stops a later journey.
 *
 * INT-03d: INT-03b / INT-03c created a connection with a wrong password / without the CA; the worker's
 * subscribe job failed on the non-retryable CONNACK / TLS error. Both connections were then corrected
 * through the edit wizard (config v2) and their CONNACK test succeeds, but the job stays `failed` with
 * the old error: nothing restarts a failed subscription after the configuration changed. Expected: the
 * subscription recovers (job running) within the reconcile interval.
 *
 * INT-04c: INT-04b published one full event lifecycle (open → closed → attributes changed → deleted,
 * four messages) while the subscription was paused; on resume the broker delivered the four queued
 * messages within a few hundred milliseconds. The deliveries are persisted (`raw_observations`:
 * accepted + revision ×3) and counted, but no production event is ever created:
 * `NormalizationService.process` answers 'superseded' for every raw row a newer version has overtaken,
 * and the retraction normalized last finds no canonical event (`source_objects.state = retracted`,
 * `canonical_event_id` null). The same four messages spaced by seconds (INT-04a) leave a retracted
 * event with four revisions, the history DT11 keeps. Expected: one event, retracted, with revisions.
 *
 * INT-05d: after the first merge patch the untouched payload profile editor reports unsaved changes
 * ("Patch to send: {}", Save enabled) on every fresh open: `profilePatchOf` compares the `time` block by
 * JSON.stringify, the server stores its keys in another order, and `patch.time` becomes `undefined`,
 * which still counts as a key of the patch. Expected: an untouched editor is clean (`data-dirty=false`).
 */
test.describe('Integration admin — known defects (failing on purpose)', () => {
  test('INT-04c (omar): the lifecycle queued during the pause exists as a retracted event after the resume', async () => {
    const state = loadState();
    expect(state.lifecycleEventId, 'INT-04b recorded the lifecycle event id').toBeTruthy();
    const omar = await apiLogin(INT_USERS.omar);
    const unit = await unitByCode(omar.token, DEMO_UNIT_CODE);
    // DEFECT: burst delivery collapses the lifecycle to its last message (a delete) and the event never exists
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
      // DEFECT: the subscribe job created at config v1 failed on the non-retryable error and the worker never restarts it after
      // the correction (job stays `failed` with the old error while the CONNACK test of the same connection succeeds)
      await expect.poll(async () => (await jobsOf(omar.token, connection?.id ?? '')).find((job) => job.scope.mode === 'subscribe')?.state ?? 'none', { intervals: [5_000], timeout: 90_000 }).toBe('running');
    }
  });

  test('INT-05d (elena): an untouched payload profile editor is not dirty after a fresh login', async ({ page }) => {
    const state = loadState();
    await uiLogin(page, INT_USERS.elena);
    await openConsole(page);
    await selectConnection(page, state.connectionName);
    await page.getByTestId('tab-profile').click();
    const row = page.getByTestId('state-map-row').first();
    await expect(row.getByLabel('Raw token')).toHaveValue('RUN'); // the saved map of INT-05 is there
    await page.screenshot({ path: test.info().outputPath('int-05d-dirty-editor.png'), fullPage: true });
    // DEFECT: the editor shows "Patch to send (payloadProfilePatch) {}" and an enabled Save for a profile nobody touched
    await expect(page.getByTestId('profile-editor')).toHaveAttribute('data-dirty', 'false');
  });
});
