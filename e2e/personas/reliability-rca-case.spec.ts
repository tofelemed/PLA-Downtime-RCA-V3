import { test, expect, type Page } from '@playwright/test';
import {
  apiLogin,
  call,
  command,
  createEventViaUi,
  day,
  DEMO_PLANT,
  ensureUnit,
  loadState,
  MINUTE,
  newSuffix,
  openCase,
  openHub,
  openStop,
  PREFIX,
  REL_USERS,
  saveState,
  stopCard,
  uiLogin,
  waitForRecommendation,
  type RelSession,
} from './support/reliability-world';

/**
 * RELIABILITY ENGINEER persona — the RCA case journeys of plan 3.9 (RCA01–03) on the v2 Event Hub and
 * `/rca` of Demo Plant, as the `reliability_engineer` users of docs/DEMO_PERSONAS.md:
 * 1. Viktor records a 70 min unplanned stop in the Event Hub, sees the policy's RCA badge, creates a case
 *    from it with the evidence preview; the repeated link is idempotent (one case).
 * 2. Viktor fills the nested content (recommendations, evidence, logic tree, root cause), reloads, links a
 *    second event from the case.
 * 7. Amara sees Viktor's case, adds her own action; the audit trail names both users.
 * 3. Viktor adds an action with a baseline, verifies it, closes the case → the event shows "RCA completed".
 * 4. Sebastian reads the outcome in USD and IRR: the figures are the server's (GET), nothing is converted.
 * Data left behind: unit "P-REL-<suffix>", its two stops, case "P-REL-case-<suffix>" with actions.
 */
const suffix = newSuffix();
let caseTitle = `${PREFIX}case-${suffix}`;
let viktor: RelSession;
let world = { unitId: '', unitName: '', stopId: '', secondStopId: '', caseId: '' };

test.describe.configure({ timeout: 240_000 });

/** A `--grep` re-run of the later journeys continues the world the state file recorded. */
function resume(): void {
  if (world.caseId) return;
  const state = loadState();
  if (!state) throw new Error('no case yet: run J1 first');
  world = { unitId: state.unitId, unitName: state.unitName, stopId: state.stopId, secondStopId: state.secondStopId, caseId: state.caseId };
  caseTitle = state.caseTitle;
}

async function selectStatus(page: Page, status: string): Promise<void> {
  // open the Radix select from the keyboard (a pointer-opened select can swallow the option click)
  await page.locator('#edit-status').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: status }).click();
  await expect(page.locator('#edit-status')).toHaveText(status);
}

test.describe('Reliability engineer — RCA case journeys (RCA01–03)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    viktor = await apiLogin(REL_USERS.viktor);
    expect(viktor.tenantId).toBe(DEMO_PLANT);
  });

  test('J1 RCA01 (viktor): 70 min stop recorded in the Event Hub → RCA badge → create case with evidence preview; repeat is idempotent', async ({ page }) => {
    world = { ...world, ...(await ensureUnit(viktor, suffix)) };
    await uiLogin(page, REL_USERS.viktor);
    await openHub(page, world.unitName);
    world.stopId = await createEventViaUi(page, {
      unitName: world.unitName,
      startIso: new Date(Date.now() - 70 * MINUTE).toISOString(),
      scheduleClass: 'unplanned',
      description: `${PREFIX}stop-${suffix}`,
    });
    const recommendation = await waitForRecommendation(viktor.token, world.stopId);
    expect(recommendation).toMatchObject({ trigger: 'duration', provisional: true, state: 'open' });
    const before = await call<{ items: unknown[] }>(viktor.token, 'GET', `/v2/rcas?q=${encodeURIComponent(caseTitle)}`);
    expect(before.body.items).toHaveLength(0); // recommend-only policy: no case opened by automation

    await expect(stopCard(page, world.stopId)).toBeVisible();
    await openStop(page, world.stopId);
    const panel = page.getByTestId('event-rca-panel');
    await expect(panel.getByTestId('rca-recommendations')).toContainText('Long unplanned stop · RCA policy v');
    await expect(panel.getByTestId('rca-recommendations')).toContainText('provisional');
    await page.screenshot({ path: test.info().outputPath('j1-rca-badge.png'), fullPage: true });
    await panel.getByTestId('open-link-rca').click();
    const dialog = page.getByTestId('link-rca-dialog');
    await expect(dialog.getByTestId('evidence-package')).toBeVisible();
    await expect(dialog.getByTestId('evidence-package')).toContainText('Approved impact');
    await dialog.getByRole('tab', { name: 'New case' }).click();
    await dialog.locator('#new-case-title').fill(caseTitle);
    await dialog.locator('#link-reason').fill(`${PREFIX}reason: long unplanned stop, policy recommendation accepted`);
    await dialog.getByTestId('link-rca-submit').click();
    await expect(panel.getByRole('status')).toContainText(`Linked to ${caseTitle}`);
    await expect(panel.getByTestId('rca-recommendations')).toHaveCount(0);
    await expect(page.getByTestId('event-detail').getByLabel('RCA state: RCA linked')).toBeVisible();

    const found = await call<{ items: Array<{ id: string }> }>(viktor.token, 'GET', `/v2/rcas?q=${encodeURIComponent(caseTitle)}`);
    expect(found.body.items).toHaveLength(1);
    world.caseId = found.body.items[0].id;
    const again = await command<{ created: boolean }>(viktor.token, `/v2/production-events/${world.stopId}/rca-link`, { rcaId: world.caseId });
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    const still = await call<{ items: unknown[] }>(viktor.token, 'GET', `/v2/rcas?q=${encodeURIComponent(caseTitle)}`);
    expect(still.body.items).toHaveLength(1);
    const links = await call<Array<{ linkType: string; targetId: string }>>(viktor.token, 'GET', `/v2/rcas/${world.caseId}/links`);
    expect(links.body.filter((link) => link.linkType === 'event' && link.targetId === world.stopId)).toHaveLength(1);
    saveState({ suffix, ...world, caseTitle, closed: false });
  });

  test('J2 (viktor): nested content saves and survives a reload; a second event is linked from the case', async ({ page }) => {
    resume();
    await uiLogin(page, REL_USERS.viktor);
    await openCase(page, world.caseId);
    await page.locator('#edit-description').fill(`${PREFIX}problem: pump P-101 tripped repeatedly after the coupling change`);
    const recs = page.getByTestId('rec');
    await recs.getByLabel('Recommendations title').fill('Realign the coupling');
    await recs.getByLabel('Recommendations Description').fill('Laser alignment after every seal change');
    await recs.getByRole('button', { name: 'Add' }).click();
    const evidence = page.getByTestId('ev');
    await evidence.getByLabel('Evidence title').fill('Vibration trend');
    await evidence.getByLabel('Evidence Source (tag, document, photo)').fill('P101.VIB');
    await evidence.getByRole('button', { name: 'Add' }).click();
    await page.getByLabel('Logic tree node').fill('Pump trips');
    await page.getByRole('button', { name: 'Add node' }).click();
    await page.getByLabel('Logic tree node').fill('High vibration');
    await page.getByLabel('Parent node').selectOption({ label: 'Pump trips' });
    await page.getByRole('button', { name: 'Add node' }).click();
    await page.locator('#edit-root-cause').fill('Coupling misalignment');
    await page.getByTestId('save-case').click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

    await openCase(page, world.caseId);
    await expect(page.getByTestId('rec')).toContainText('Realign the coupling');
    await expect(page.getByTestId('ev')).toContainText('P101.VIB');
    await expect(page.getByTestId('logic-tree')).toContainText('Pump trips');
    await expect(page.getByTestId('logic-tree')).toContainText('High vibration');
    await expect(page.locator('#edit-root-cause')).toHaveValue('Coupling misalignment');
    const saved = await call<{ rootCause: string; recommendations: unknown[]; evidence: unknown[]; logicTree: Array<{ parentId: string | null }> }>(
      viktor.token,
      'GET',
      `/v2/rcas/${world.caseId}`,
    );
    expect(saved.body.rootCause).toBe('Coupling misalignment');
    expect(saved.body.recommendations).toHaveLength(1);
    expect(saved.body.evidence).toHaveLength(1);
    expect(saved.body.logicTree.filter((node) => node.parentId !== null)).toHaveLength(1);

    const second = await command<{ id: string }>(viktor.token, '/v2/production-events', {
      unitId: world.unitId,
      physicalType: 'downtime',
      scheduleClass: 'unplanned',
      startTime: new Date(Date.now() - 180 * MINUTE).toISOString(),
      endTime: new Date(Date.now() - 160 * MINUTE).toISOString(),
      description: `${PREFIX}stop2-${suffix}`,
    });
    expect(second.status, JSON.stringify(second.body)).toBe(201);
    world.secondStopId = second.body.id;
    await page.getByTestId('tab-links').click();
    const add = page.getByTestId('add-link');
    await add.getByLabel('Link type').selectOption('event');
    await add.getByLabel('Target id').fill(world.secondStopId);
    await add.getByRole('button', { name: 'Link' }).click();
    await expect(add.getByRole('status')).toHaveText('Linked.');
    await expect(page.getByTestId('link-row')).toHaveCount(2);
    const row = page.getByTestId('link-row').filter({ hasText: world.secondStopId });
    await row.getByRole('button', { name: 'Evidence' }).click();
    await expect(row.getByTestId('evidence-package')).toContainText('Approved impact');
    const links = await call<Array<{ linkType: string; targetId: string }>>(viktor.token, 'GET', `/v2/rcas/${world.caseId}/links`);
    expect(links.body.map((link) => link.targetId).sort()).toEqual([world.stopId, world.secondStopId].sort());
    const event = await call<{ states: { rca: string } }>(viktor.token, 'GET', `/v2/production-events/${world.secondStopId}`);
    expect(event.body.states.rca).toBe('linked');
    saveState({ suffix, ...world, caseTitle, closed: false });
  });

  test('J7 (amara): a second reliability engineer sees the case and adds her own action', async ({ page }) => {
    resume();
    const amara = await apiLogin(REL_USERS.amara);
    await uiLogin(page, REL_USERS.amara);
    await page.goto('/rca');
    await expect(page.getByTestId('rca-v2')).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Search case titles').fill(caseTitle);
    await page.getByTestId('case-list').getByRole('button', { name: caseTitle }).click();
    await expect(page.getByTestId('case-title')).toHaveText(caseTitle);
    await expect(page.getByTestId('rec')).toContainText('Realign the coupling');
    await page.getByTestId('tab-actions').click();
    const form = page.getByTestId('action-form');
    await form.locator('#action-title').fill(`${PREFIX}action-amara-${suffix}`);
    await form.locator('#action-due').fill(day(14));
    await page.getByTestId('add-action').click();
    const row = page.getByTestId('action-row').filter({ hasText: `${PREFIX}action-amara-${suffix}` });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('verification-status')).toHaveText('No verification planned');
    await row.getByLabel(`Status of ${PREFIX}action-amara-${suffix}`).selectOption('in_progress');
    await expect(row.getByLabel(`Status of ${PREFIX}action-amara-${suffix}`)).toHaveValue('in_progress');

    const actions = await call<Array<{ title: string; ownerId: string | null; status: string }>>(amara.token, 'GET', `/v2/rcas/${world.caseId}/actions`);
    const hers = actions.body.find((action) => action.title === `${PREFIX}action-amara-${suffix}`);
    expect(hers).toMatchObject({ ownerId: amara.userId, status: 'in_progress' });
    const byUser = await call<Array<{ entityType: string; action: string }>>(amara.token, 'GET', `/audit-logs?userId=${amara.userId}&limit=20`);
    expect(byUser.body.some((row) => row.action === 'CREATE' && row.entityType === 'RCA')).toBe(true);
  });

  test('J3 RCA03 (viktor): action verified against its baseline, claims in USD and IRR, close → event shows RCA completed', async ({ page }) => {
    resume();
    await uiLogin(page, REL_USERS.viktor);
    await openCase(page, world.caseId, 'actions');
    const form = page.getByTestId('action-form');
    const realign = `Realign coupling ${suffix}.${test.info().retry}`; // unique per attempt: a retry adds to the same case
    const seal = `Replace seal kit ${suffix}.${test.info().retry}`;
    await form.locator('#action-title').fill(realign);
    await form.locator('#action-window-start').fill(day(-20));
    await form.locator('#action-window-end').fill(day(-5));
    await form.locator('#action-baseline').selectOption('recurrences');
    await form.locator('#action-baseline-value').fill('6');
    await form.locator('#action-claim').fill('1000');
    await form.locator('#action-claim-currency').selectOption('USD');
    await page.getByTestId('add-action').click();
    const action = page.getByTestId('action-row').filter({ hasText: realign });
    await expect(action.getByTestId('verification-status')).toHaveText('Verification due');
    await action.getByTestId('verify-action').click();
    await expect(action.getByTestId('realized')).toContainText('difference 3');
    await expect(action.getByTestId('verification-status')).toHaveText('Verified');

    await form.locator('#action-title').fill(seal);
    await form.locator('#action-claim').fill('50000000');
    await form.locator('#action-claim-currency').selectOption('IRR');
    await page.getByTestId('add-action').click();
    await expect(page.getByTestId('action-row').filter({ hasText: seal })).toContainText('50,000,000');

    await page.getByTestId('tab-outcome').click();
    await expect(page.getByTestId('outcome-claimed')).toContainText('1,000.00');
    await expect(page.getByTestId('outcome-claimed')).toContainText('50,000,000');
    await expect(page.getByTestId('outcome-realized')).toContainText(`${realign}: 3`);
    await expect(page.getByTestId('outcome-panel')).toContainText('Approved historical loss');

    await page.getByRole('tab', { name: 'Analysis' }).click();
    await selectStatus(page, 'Closed');
    await page.getByTestId('save-case').click();
    await expect(page.getByTestId('case-status')).toHaveText('Closed');
    const event = await call<{ states: { rca: string } }>(viktor.token, 'GET', `/v2/production-events/${world.stopId}`);
    expect(event.body.states.rca).toBe('completed');

    await openHub(page, world.unitName);
    await openStop(page, world.stopId);
    const detail = page.getByTestId('event-detail');
    await expect(detail.getByLabel('RCA state: RCA completed')).toBeVisible();
    await expect(detail.getByTestId('event-rca-panel')).toBeVisible();
    await expect(detail.getByTestId('rca-recommendations')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('j3-event-rca-completed.png'), fullPage: true });
    saveState({ suffix, ...world, caseTitle, closed: true });
  });

  test('J4 (sebastian): approved impact and claimed avoided loss follow the display currency and equal the GET figures', async ({ page }) => {
    resume();
    const sebastian = await apiLogin(REL_USERS.sebastian);
    const outcome = await call<{ claimedAvoided: Array<{ currency: string; amount: string; actions: number }>; approvedHistoricalLoss: { lines: number } }>(
      sebastian.token,
      'GET',
      `/v2/rcas/${world.caseId}/outcome`,
    );
    expect(outcome.status).toBe(200);
    // the server's decimal, formatted by the browser for display only (amount and currency are adjacent spans)
    const money = (amount: string, currency: string) => {
      const digits = currency === 'IRR' ? 0 : 2;
      const text = Number(amount).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
      return new RegExp(`${text.replace(/[.,]/g, '\\$&')}\\s*${currency}`);
    };
    const usd = outcome.body.claimedAvoided.find((claim) => claim.currency === 'USD');
    const irr = outcome.body.claimedAvoided.find((claim) => claim.currency === 'IRR');
    expect(usd && irr).toBeTruthy();

    const conversions: string[] = [];
    page.on('request', (request) => {
      if (/convert|fx|exchange/i.test(new URL(request.url()).pathname)) conversions.push(request.url());
    });
    await uiLogin(page, REL_USERS.sebastian);
    await openCase(page, world.caseId, 'outcome');
    const claimed = page.getByTestId('outcome-claimed');
    await expect(claimed).toContainText(money(usd!.amount, 'USD'));
    await expect(claimed).toContainText(money(irr!.amount, 'IRR'));
    await expect(claimed).toContainText(`(${usd!.actions} action(s))`);
    const approved = page.getByTestId('outcome-panel').locator('section').first();
    if (outcome.body.approvedHistoricalLoss.lines === 0) await expect(approved.getByTestId('approved-impact-none')).toBeVisible();

    const toggle = page.getByTestId('display-currency-toggle').first();
    await toggle.getByTestId('display-currency-IRR').click();
    await expect(claimed).toContainText(money(irr!.amount, 'IRR'));
    await expect(claimed).toContainText(money(usd!.amount, 'USD'));
    await toggle.getByTestId('display-currency-USD').click();
    await expect(claimed).toContainText(money(usd!.amount, 'USD'));
    expect(conversions, 'the browser asked no conversion endpoint').toEqual([]);
    await page.screenshot({ path: test.info().outputPath('j4-outcome-currency.png'), fullPage: true });
  });
});

/** Read-only check on the case above; outside the serial group so its retry does not replay the journeys. */
test.describe('Reliability engineer — audit trail of the shared case', () => {
  test('J7b: the audit trail of the case names both engineers', async () => {
    resume();
    if (!viktor) viktor = await apiLogin(REL_USERS.viktor);
    const amara = await apiLogin(REL_USERS.amara);
    const audit = await call<Array<{ userId: string; action: string; entityId: string }>>(amara.token, 'GET', `/audit-logs?entityType=RCA&entityId=${world.caseId}&limit=100`);
    expect(audit.status).toBe(200);
    const users = new Set(audit.body.map((row) => row.userId));
    expect(users.has(viktor.userId), 'viktor edited and closed the case').toBe(true);
    // DEFECT: POST /api/v2/rcas/{caseId}/actions is audited as `CREATE RCA` with the *action's* id as entityId
    // (the interceptor takes the created record's id and the first route segment), so the case's own audit
    // trail (entityType=RCA, entityId=caseId) never shows who added an action; the row is only found by user.
    expect(users.has(amara.userId), 'amara added an action to the case').toBe(true);
  });
});
