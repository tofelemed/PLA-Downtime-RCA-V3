import { test, expect, type Locator, type Page } from '@playwright/test';
import { loginViaUI } from './test-utils/auth-helpers';

/**
 * Declared mode on the main Marun HDPE plant (`docs/PLA_DECLARED_MODE_PLAN.md`): Extruder1 accounts its
 * production by day from the OT production-loss message. Read-only UI journey over the day 29 Oct 2026 that
 * the task-12 API run built (PLA message MARUN-HDPE-20261029 planned 240 / actual 208 / lost 32 t, coded
 * 20 t MECH-GEARBOX + 12 t FEED-STARVED, certified): every mutating request is aborted in the browser.
 * `E2E_BASE_URL` points the browser at another frontend (the default is the Playwright config's). Skips when the plant password (`MARUN_E2E_PASSWORD`) is not set or the API is unreachable.
 */
const PASSWORD = process.env.MARUN_E2E_PASSWORD ?? '';
const API = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';
const BASE_URL = process.env.E2E_BASE_URL;
const EVENT_ID = 'pla:MARUN-HDPE-20261029';
const user = (name: string) => `${name}@hdpe-train.mpc`;

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.skip(!PASSWORD, 'Set MARUN_E2E_PASSWORD to run the declared-mode journey on the Marun HDPE plant.');
if (BASE_URL) test.use({ baseURL: BASE_URL });

/** The 29 Oct statement as the server sends it (Task 13): the declared split has no recovery share. */
const OWNER_DAY: Record<string, string> = { planned: '240', actual: '208', shortfall: '32', grossAttributed: '32', netAccounted: '32', unaccounted: '0' };
const DAY_WINDOW = 'from=2026-10-28T12:00:00.000Z&to=2026-10-29T12:00:00.000Z&window=dates';

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

test.describe('Declared mode on Marun HDPE (29 Oct 2026)', () => {
  test('admin: the Loss accounting card names the day grain and declared basis; the change form holds the accounting product', async ({ page }) => {
    await signInReadOnly(page, 'admin');
    await page.goto('/settings');
    const card = page.getByTestId('plant-loss-accounting');
    const summary = card.getByTestId('loss-in-force');
    await expect(summary).toBeVisible({ timeout: 60_000 });
    await expect(summary).toContainText(/daily accounting/i);
    await expect(summary).toContainText(/declared by the OT production loss event/i);
    await expect(summary).toContainText('HDPE Extruder 1');
    await card.getByTestId('loss-change').click();
    await expect(page.locator('#loss-product')).toContainText('HD5502');
  });

  test('operator: the Event Hub lists the production loss with Planned 240 / Actual 208 / Lost 32 and its two declared lines', async ({ page }) => {
    const omid = await apiSession('omid');
    const events = await getJson<{ items: Array<{ id: string; eventId: string }> }>(omid, `/v2/production-events?q=${EVENT_ID}&limit=5`);
    const event = events.items.find((item) => item.eventId === EVENT_ID);
    expect(event, 'the 29 Oct production loss event exists').toBeTruthy();

    await signInReadOnly(page, 'omid');
    await page.goto('/events?kinds=production_loss&from=2026-10-28T00:00:00.000Z&to=2026-10-31T00:00:00.000Z&window=custom');
    await expect(page.getByTestId('event-declared-planned').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('event-declared-planned').filter({ hasText: '240' }).first()).toBeVisible();
    await expect(page.getByTestId('event-declared-actual').filter({ hasText: '208' }).first()).toBeVisible();
    await expect(page.getByTestId('event-declared-shortfall').filter({ hasText: '32' }).first()).toBeVisible();

    await page.goto(`/events/${event!.id}`);
    const card = page.getByTestId('attributed-losses');
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card.getByTestId('attributed-quantity').first()).toContainText('32');
    const attributed = await getJson<{ items: Array<{ quantities: Array<{ lines: number }> }> }>(omid, `/v2/production-events/${event!.id}/attributed-losses`);
    expect(attributed.items[0].quantities[0].lines, 'declared lines (20 t + 12 t)').toBe(2);
  });

  test('manager: the period of 29 Oct shows the statement Planned 240 / Actual 208 / Shortfall 32 / Net 32 / Unaccounted 0', async ({ page }) => {
    const reza = await apiSession('reza');
    const plans = await getJson<{ items: Array<{ id: string }> }>(reza, '/v2/production-plans?limit=1');
    const days = await getJson<{ periods: Array<{ periodId: string }> }>(reza, '/v2/production-days/da0560f4-2916-450d-9d30-4012e86fa17e/2026-10-29');
    expect(plans.items.length).toBeGreaterThan(0);
    expect(days.periods).toHaveLength(1);

    await signInReadOnly(page, 'reza');
    await page.goto(`/plans/${plans.items[0].id}/periods/${days.periods[0].periodId}`);
    await expect(page.getByTestId('period-detail')).toBeVisible({ timeout: 60_000 });
    const statement = page.getByTestId('loss-statement');
    await expect(statement).toBeVisible({ timeout: 60_000 });
    await expectStatement(statement, OWNER_DAY);
    await expect(page.getByTestId('slice-figures')).toContainText('Checks');
  });

  test('manager: the Accounting statement page lists the 29 Oct row 240 / 208 / 32 / … / 0', async ({ page }) => {
    await signInReadOnly(page, 'reza');
    await page.goto(`/pla-analytics/statement?${DAY_WINDOW}`);
    await expect(page.getByRole('link', { name: 'Accounting statement' }).first()).toBeVisible({ timeout: 60_000 });
    const row = page.locator('[data-testid="statement-day"][data-local-date="2026-10-29"] [data-testid="statement-table-row"]').first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    for (const [key, value] of Object.entries(OWNER_DAY)) {
      await expect(row.getByTestId(`statement-cell-${key}`)).toHaveAttribute('data-value', value);
    }
    await row.getByTestId('statement-row-toggle').click();
    await expectStatement(page.getByTestId('statement-row-statement'), OWNER_DAY);
  });
});
