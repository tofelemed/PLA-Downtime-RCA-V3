import { test, expect } from '@playwright/test';
import {
  apiLogin,
  call,
  createEventViaUi,
  DEMO_PLANT,
  ensureUnit,
  eventRow,
  expectNoRecommendation,
  MINUTE,
  newSuffix,
  openHub,
  openStop,
  PREFIX,
  REL_USERS,
  stopCard,
  uiLogin,
  waitForRecommendation,
  type RelSession,
} from './support/reliability-world';

/**
 * RELIABILITY ENGINEER persona — journey 8, the D13 RCA trigger policy of Demo Plant
 * (`durationThresholdSeconds` 7200 since the SME D17 answers of 2026-10-14, recommend-only) seen from the Event Hub as Amara:
 * - a 130 min unplanned stop recorded through "New event" gets one provisional "Long unplanned stop"
 *   recommendation and no automatic case;
 * - a 10 min unplanned stop gets none;
 * - a 130 min *planned* stop gets none (the duration trigger is for unplanned downtime only).
 * Data left behind: unit "P-REL-TRG-<suffix>" and its three stops.
 */
const suffix = `TRG-${newSuffix()}`;
let amara: RelSession;
let unitName = '';

test.describe.configure({ mode: 'serial', timeout: 240_000 });

test.describe('Reliability engineer — RCA trigger policy (journey 8)', () => {
  test.beforeAll(async () => {
    amara = await apiLogin(REL_USERS.amara);
    expect(amara.tenantId).toBe(DEMO_PLANT);
    unitName = (await ensureUnit(amara, suffix)).unitName;
  });

  test('T1 (amara): a 130 min unplanned stop recorded in the Event Hub is recommended for RCA, once, without a case', async ({ page }) => {
    await uiLogin(page, REL_USERS.amara);
    await openHub(page, unitName);
    const stopId = await createEventViaUi(page, {
      unitName,
      startIso: new Date(Date.now() - 130 * MINUTE).toISOString(),
      scheduleClass: 'unplanned',
      description: `${PREFIX}long-${suffix}`,
    });
    const recommendation = await waitForRecommendation(amara.token, stopId);
    expect(recommendation).toMatchObject({ trigger: 'duration', provisional: true, state: 'open' });
    const all = await call<{ items: unknown[] }>(amara.token, 'GET', `/v2/rca-recommendations?eventIds=${stopId}`);
    expect(all.body.items).toHaveLength(1);
    const cases = await call<{ items: unknown[] }>(amara.token, 'GET', `/v2/rcas?q=${encodeURIComponent(`${PREFIX}long-${suffix}`)}`);
    expect(cases.body.items).toHaveLength(0);
    const event = await call<{ states: { rca: string } }>(amara.token, 'GET', `/v2/production-events/${stopId}`);
    expect(event.body.states.rca, 'a recommendation never changes the event state').toBe('none');

    await expect(stopCard(page, stopId)).toBeVisible();
    await openStop(page, stopId);
    const panel = page.getByTestId('event-rca-panel');
    await expect(panel.getByTestId('rca-recommendations')).toContainText('RCA recommended: Long unplanned stop · RCA policy v');
    await expect(panel.getByTestId('rca-recommendations')).toContainText('provisional (event still open)');
    await expect(panel.getByTestId('rca-recommendations').getByText('RCA recommended')).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath('t1-long-stop-recommended.png'), fullPage: true });
  });

  test('T2 (amara): a 10 min unplanned stop is below the threshold and shows no recommendation', async ({ page }) => {
    await uiLogin(page, REL_USERS.amara);
    await openHub(page, unitName);
    const stopId = await createEventViaUi(page, {
      unitName,
      startIso: new Date(Date.now() - 30 * MINUTE).toISOString(),
      durationMinutes: 10,
      scheduleClass: 'unplanned',
      description: `${PREFIX}short-${suffix}`,
    });
    await expectNoRecommendation(amara.token, stopId);
    await expect(eventRow(page, stopId)).toBeVisible();
    await eventRow(page, stopId).getByRole('link').first().click();
    const detail = page.getByTestId('event-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('event-rca-panel')).toBeVisible();
    await expect(detail.getByTestId('rca-recommendations')).toHaveCount(0);
    await expect(detail.getByLabel('RCA state: No RCA')).toBeVisible();
  });

  test('T3 (amara): a 130 min planned stop is not an RCA trigger', async ({ page }) => {
    await uiLogin(page, REL_USERS.amara);
    await openHub(page, unitName);
    const stopId = await createEventViaUi(page, {
      unitName,
      startIso: new Date(Date.now() - 200 * MINUTE).toISOString(),
      durationMinutes: 130,
      scheduleClass: 'planned',
      description: `${PREFIX}planned-${suffix}`,
    });
    await expectNoRecommendation(amara.token, stopId);
    await expect(eventRow(page, stopId)).toBeVisible();
    await eventRow(page, stopId).getByRole('link').first().click();
    await expect(page.getByTestId('event-detail').getByTestId('rca-recommendations')).toHaveCount(0);
  });
});
