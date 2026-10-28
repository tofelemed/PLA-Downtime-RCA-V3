import { test, expect, type Locator, type Page } from '@playwright/test';
import { loginViaUI } from './test-utils/auth-helpers';

/**
 * Downtime over MQTT on the main Marun HDPE plant: Extruder1 receives its stops from the OT gateway on
 * `proact/marun/hdpe/downtime`. Read-only journey over the production day 28 Oct 2026 (plant time +03:30, UTC
 * 2026-10-27T20:30Z → 2026-10-28T20:30Z) that the 28 Oct run built: an open stop closed by OT revision 2, an
 * unknown reason coded by the operator and kept through a revision, a merge, a split of a quarantined Pelletizer
 * stop bound to Extruder1 and replayed, the feed counters, the review item of a later OT re-code, and the 29 Oct accounting left unchanged. Every
 * mutating request is aborted in the browser. `E2E_BASE_URL` points the browser at another frontend (the default
 * is the Playwright config's). Skips when the plant password (`MARUN_E2E_PASSWORD`) is not set or the API is unreachable.
 */
const PASSWORD = process.env.MARUN_E2E_PASSWORD ?? '';
const API = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';
const BASE_URL = process.env.E2E_BASE_URL;
const user = (name: string) => `${name}@hdpe-train.mpc`;

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.skip(!PASSWORD, 'Set MARUN_E2E_PASSWORD to run the downtime-over-MQTT journey on the Marun HDPE plant.');
if (BASE_URL) test.use({ baseURL: BASE_URL });

const EXTRUDER1 = 'da0560f4-2916-450d-9d30-4012e86fa17e';
const CONNECTION = 'f334beca-ca4f-4310-b87f-116d84e07740';
const OPEN_STOP = 'b801f719-8f5c-4825-ae16-1abd0854c429';
const OPEN_STOP_LINK = 'Open Downtime on HDPE Extruder 1, starting 2026-10-28 19:05';
const DAY_WINDOW = 'from=2026-10-27T20:30:00.000Z&to=2026-10-28T20:30:00.000Z&window=custom';
const MERGED = '037f10de-eb7e-4d8d-837e-a1b8ecc4b111';
const PERIOD_PAGE = '/plans/274b143e-d004-45d9-96cc-5ea20c8493a2/periods/be984a0f-914a-4841-902f-04be9076fc3b';
const UNIT_QUARANTINE = '1c6b978f-ad77-417d-97db-ec08511c09e6';
const CODE_QUARANTINE = '4a630fc6-6132-4713-ae94-0980acd0c93e';

/** The 29 Oct statement the declared-mode run certified; the 28 Oct stops must not move it. */
const OWNER_DAY: Record<string, string> = { planned: '240', actual: '208', shortfall: '32', grossAttributed: '32', netAccounted: '32', unaccounted: '0' };

async function expectStatement(statement: Locator, figures: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(figures)) {
    await expect(statement.locator(`[data-testid="statement-row"][data-key="${key}"]`)).toHaveAttribute('data-value', value);
  }
}

let blocked: string[] = [];
let reachable = false;

interface Session {
  token: string;
  tenantId: string;
}

interface StopView {
  source: string;
  isOpen: boolean;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  status: string;
  description: string | null;
  reasonCodeId: string | null;
  unitId: string;
  supersededByEventId: string | null;
  classification: { physicalType: string };
  verification: { verifiedBy: string | null };
  accountingPeriod: { localDate: string } | null;
}

interface ExceptionView {
  id: string;
  state: string;
  errorCode: string;
}

interface JobView {
  state: string;
  scope: { mode?: string };
  health: { counters: Record<string, number>; subscribedTopics: string[] };
}

async function apiSession(name: string): Promise<Session> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user(name), password: PASSWORD }),
  });
  expect(response.ok, `login ${name}`).toBe(true);
  const body = (await response.json()) as { access_token: string; user: { tenantId: string } };
  return { token: body.access_token, tenantId: body.user.tenantId };
}

async function getJson<T>(session: Session, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session.token}`, 'X-Tenant-Id': session.tenantId },
  });
  expect(response.status, path).toBe(200);
  return (await response.json()) as T;
}

const stop = (session: Session, id: string) => getJson<StopView>(session, `/v2/production-events/${id}`);

async function signInReadOnly(page: Page, name: string): Promise<void> {
  blocked = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || /\/auth\/(login|refresh)$/.test(request.url())) return route.continue();
    blocked.push(`${request.method()} ${new URL(request.url()).pathname}`);
    return route.abort();
  });
  await loginViaUI(page, user(name), PASSWORD);
}

test.beforeAll(async () => {
  try {
    reachable = (await fetch(`${API}/health`)).ok;
  } catch {
    reachable = false;
  }
  test.skip(!reachable, 'The API is not reachable.');
});

test.afterEach(() => {
  expect(blocked, 'no page may write to the server on render').toEqual([]);
});

test.describe('Downtime over MQTT on Marun HDPE (28 Oct 2026)', () => {
  test('operator: the stop that came in open is closed by OT revision 2, coded MECH-GEARBOX and verified', async ({ page }) => {
    const event = await stop(await apiSession('omid'), OPEN_STOP);
    expect(event).toMatchObject({ source: 'MQTT', isOpen: false, startTime: '2026-10-28T15:35:00.000Z', endTime: '2026-10-28T16:10:00.000Z' });
    expect(event).toMatchObject({ durationSeconds: 2100, status: 'Coded', classification: { physicalType: 'downtime' } });
    expect(event.verification.verifiedBy).not.toBeNull();
    expect(event.accountingPeriod?.localDate).toBe('2026-10-28');

    await signInReadOnly(page, 'omid');
    await page.goto(`/events?${DAY_WINDOW}`);
    await expect(page.getByRole('link', { name: OPEN_STOP_LINK })).toBeVisible({ timeout: 60_000 });
    // With no stop open the strip collapses to one line (the region and its heading render only for open stops).
    await expect(page.getByText('Current stops (0)', { exact: true })).toBeVisible();

    await page.goto(`/events/${OPEN_STOP}`);
    await expect(page.getByText('Verified by').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('MECH-GEARBOX · Gearbox failure').first()).toBeVisible();
    await expect(page.getByText('35 min').first()).toBeVisible();
    // OT revision 3 re-coded the stop ELEC-TRIP: the coding stayed, one review item is open (F2 fix, 28 Oct).
    await expect(page.getByRole('tab', { name: 'Source conflicts (1)' })).toBeVisible();
  });

  test('operator: OT revision 3 with another reason opened one dismiss-only review item and changed no coding', async ({ page }) => {
    const omid = await apiSession('omid');
    const history = await getJson<{ reviewItems: Array<{ kind: string; field: string | null; state: string }> }>(omid, `/v2/production-events/${OPEN_STOP}/revisions`);
    const items = history.reviewItems.filter((item) => item.kind === 'source_reason_changed');
    expect(items).toEqual([{ kind: 'source_reason_changed', field: 'reason', state: 'open' }].map((item) => expect.objectContaining(item)));

    await signInReadOnly(page, 'omid');
    await page.goto(`/events/${OPEN_STOP}`);
    await page.getByRole('tab', { name: 'Source conflicts (1)' }).click();
    await expect(page.getByText('Source now reports a different reason').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Dismiss' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept source' })).toHaveCount(0);
    await expect(page.getByText('MECH-GEARBOX · Gearbox failure').first()).toBeVisible();
  });

  test('operator: the unknown reason SCREEN-CHANGE coded GRADE-CHANGE survives OT revision 2', async ({ page }) => {
    const id = '351cc61a-c2c4-4dce-97a5-11c02f64666b';
    const event = await stop(await apiSession('omid'), id);
    expect(event.reasonCodeId).not.toBeNull();
    expect(event).toMatchObject({ endTime: '2026-10-28T13:45:00.000Z', description: 'Screen pack change, corrected end (e2e revision 2)', status: 'Coded' });

    await signInReadOnly(page, 'omid');
    await page.goto(`/events/${id}`);
    await expect(page.getByText('GRADE-CHANGE · Grade change').first()).toBeVisible({ timeout: 60_000 });
  });

  test('engineer: the 18:00 and 18:05 stops merged into one 10 min stop; the later revision landed on the superseded original', async () => {
    const leila = await apiSession('leila');
    const first = await stop(leila, '245a5dc0-5eca-4265-a85d-2dcb3e9a9a69');
    const second = await stop(leila, '64698144-a950-4d38-81cd-2f9f3bc1eb09');
    const merged = await stop(leila, MERGED);
    expect(first.supersededByEventId).toBe(MERGED);
    expect(second.supersededByEventId).toBe(MERGED);
    expect(first.endTime, 'OT revision 2 of -1800 lands on the superseded original').toBe('2026-10-28T14:36:00.000Z');
    expect(merged).toMatchObject({ startTime: '2026-10-28T14:30:00.000Z', endTime: '2026-10-28T14:40:00.000Z', durationSeconds: 600 });
  });

  test('engineer: the replayed Pelletizer stop was split into 13:00-13:08 and 13:08-13:15 on Extruder1, both ELEC-TRIP', async () => {
    const leila = await apiSession('leila');
    const original = await stop(leila, '56762143-2e70-41de-849f-0167f46f3429');
    const head = await stop(leila, 'faf6cedc-13a8-4f33-8d6d-6d06add8623d');
    const tail = await stop(leila, '5bd0a649-0a10-466a-a1c3-250607aafbc9');
    expect(head).toMatchObject({ startTime: '2026-10-28T13:00:00.000Z', endTime: '2026-10-28T13:08:00.000Z', unitId: EXTRUDER1 });
    expect(tail).toMatchObject({ startTime: '2026-10-28T13:08:00.000Z', endTime: '2026-10-28T13:15:00.000Z', unitId: EXTRUDER1 });
    expect(head.reasonCodeId).not.toBeNull();
    expect(tail.reasonCodeId, 'both parts keep the reason of the original (ELEC-TRIP)').toBe(head.reasonCodeId);
    expect(original.reasonCodeId).toBe(head.reasonCodeId);
  });

  test('admin: the quarantine holds the bound unknown unit and the coded unknown reason, both resolved', async ({ page }) => {
    const admin = await apiSession('admin');
    const unit = await getJson<ExceptionView>(admin, `/v2/ingestion-exceptions/${UNIT_QUARANTINE}`);
    const code = await getJson<ExceptionView>(admin, `/v2/ingestion-exceptions/${CODE_QUARANTINE}`);
    expect(unit).toMatchObject({ state: 'resolved', errorCode: 'unknown_unit' });
    expect(code).toMatchObject({ state: 'resolved', errorCode: 'unknown_code' });
    const list = await getJson<{ items: ExceptionView[] }>(admin, `/v2/ingestion-exceptions?connectionId=${CONNECTION}&state=resolved&limit=200`);
    expect(list.items.map((item) => item.id)).toEqual(expect.arrayContaining([UNIT_QUARANTINE, CODE_QUARANTINE]));

    await signInReadOnly(page, 'admin');
    await page.goto('/connectivity?tab=quarantine&state=any');
    await expect(page.getByRole('link', { name: /Unknown reason \/ impact code/ }).first()).toBeVisible({ timeout: 60_000 });
    await page.goto(`/connectivity/quarantine/${UNIT_QUARANTINE}`);
    await expect(page.getByText('Resolved').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Pelletizer1').first()).toBeVisible();
    await page.goto('/connectivity?tab=mappings');
    await expect(page.getByRole('link', { name: 'Pelletizer1' }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('admin: the subscribe job is connected to the downtime topic and reports every counter', async ({ page }) => {
    const admin = await apiSession('admin');
    const jobs = await getJson<{ items: JobView[] }>(admin, `/v2/ingestion-jobs?connectionId=${CONNECTION}&limit=100`);
    const job = jobs.items.find((item) => item.scope.mode === 'subscribe' && item.state !== 'stopped');
    expect(job, 'the MQTT connection has a running subscribe job').toBeTruthy();
    // The counters restart with the worker (received 15 / accepted 14 / duplicate 1 on the run itself), so the
    // spec pins their shape and the subscription, not the run's totals.
    for (const key of ['received', 'accepted', 'duplicate', 'stale', 'conflict', 'quarantined', 'quarantined_open', 'parked']) {
      expect(job!.health.counters[key], key).toBeGreaterThanOrEqual(0);
    }
    expect(job!.health.subscribedTopics).toContain('proact/marun/hdpe/downtime');

    await signInReadOnly(page, 'admin');
    await page.goto(`/connectivity/connections/${CONNECTION}`);
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 60_000 });
  });

  test('manager: the 29 Oct accounting is unchanged at 240 / 208 / 32 / 0 and the period shows the stops cross-check', async ({ page }) => {
    const reza = await apiSession('reza');
    const day = await getJson<{ accounting: { statement: Record<string, string> } }>(reza, `/v2/production-days/${EXTRUDER1}/2026-10-29`);
    expect(day.accounting.statement).toMatchObject({ planned: '240', actual: '208', shortfall: '32', unaccounted: '0' });

    await signInReadOnly(page, 'reza');
    await page.goto(PERIOD_PAGE);
    await expect(page.getByText('Stops cross-check:').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('16.33').first()).toBeVisible();
    const statement = page.getByTestId('loss-statement');
    await expect(statement).toBeVisible({ timeout: 60_000 });
    await expectStatement(statement, OWNER_DAY);
  });

  test('accountant: the verified stop is read-only (no Edit / code, Split or Verify coding)', async ({ page }) => {
    await signInReadOnly(page, 'sara');
    await page.goto(`/events/${OPEN_STOP}`);
    await expect(page.getByText('Verified by').first()).toBeVisible({ timeout: 60_000 });
    for (const name of ['Edit / code', 'Split', 'Verify coding']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
  });

  test('engineer: Stops & timeline over the 28 Oct production day lists the MQTT stop of 19:05', async ({ page }) => {
    await signInReadOnly(page, 'leila');
    await page.goto('/downtime/stops?from=2026-10-27T20:30:00.000Z&to=2026-10-28T20:30:00.000Z&window=dates');
    await expect(page.getByRole('link', { name: OPEN_STOP_LINK }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('MQTT').first()).toBeVisible();
  });
});
