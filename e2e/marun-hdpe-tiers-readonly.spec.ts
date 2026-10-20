import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from './test-utils/auth-helpers';

/**
 * Tier 1 / Tier 2 read-only journeys on the main Marun › HDPE plant (`plans/TIER1_TIER2_PLAN.md` gate 5;
 * method of `docs/qa/QA_SHELL.md`): UI login as the plant personas, every mutating API request aborted in
 * the browser (only login / token refresh go through), so the plant data is never changed. A page that
 * writes on render fails the run. Runs only when `MARUN_E2E_PASSWORD` is set (never stored in the repo).
 */
const PASSWORD = process.env.MARUN_E2E_PASSWORD ?? '';
const API = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';
const user = (name: string) => `${name}@hdpe-train.mpc`;

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.skip(!PASSWORD, 'Set MARUN_E2E_PASSWORD to run the read-only Marun HDPE journeys.');

let blocked: string[] = [];

async function signInReadOnly(page: Page, name: string): Promise<void> {
  blocked = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method) || /\/auth\/(login|refresh)$/.test(request.url())) return route.continue();
    blocked.push(`${method} ${new URL(request.url()).pathname}`);
    return route.abort();
  });
  await loginViaUI(page, user(name), PASSWORD);
}

async function apiToken(name: string): Promise<string> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user(name), password: PASSWORD }),
  });
  expect(response.ok, `login ${name}`).toBe(true);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function firstCaseId(token: string): Promise<string | null> {
  const response = await fetch(`${API}/v2/rcas?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await response.json()) as { items?: Array<{ id: string }> };
  return body.items?.[0]?.id ?? null;
}

test.afterEach(() => {
  expect(blocked, 'no page may write to the server on render').toEqual([]);
});

test.describe('Marun HDPE plant — Tier 1 / Tier 2 pages (read-only)', () => {
  test('admin: recurring causes, cause portfolio, capacity gap, month-close exceptions, downtime overview', async ({ page }) => {
    await signInReadOnly(page, 'admin');
    await page.goto('/reliability/causes');
    await expect(page.getByTestId('cause-report')).toBeVisible({ timeout: 60_000 });
    await page.goto('/reliability/portfolio');
    await expect(page.getByTestId('portfolio')).toBeVisible({ timeout: 60_000 });
    await page.goto('/pla-analytics/capacity-gap');
    await expect(page.getByTestId('pla-capacity-gap')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('capacity-gap-definitions')).toBeVisible();
    await page.goto('/month-close?section=exceptions');
    await expect(page.getByTestId('close-exceptions')).toBeVisible({ timeout: 60_000 });
    await page.goto('/downtime');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
  });

  test('admin: an investigation shows its History tab, the Causes panel and the PDF export', async ({ page }) => {
    const caseId = await firstCaseId(await apiToken('admin'));
    test.skip(!caseId, 'The plant has no investigation yet.');
    await signInReadOnly(page, 'admin');
    await page.goto(`/rca/${caseId}/history`);
    await expect(page.getByTestId('history-list')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('case-export-pdf')).toBeVisible();
    await page.goto(`/rca/${caseId}/analysis`);
    await expect(page.getByTestId('causes-panel')).toBeVisible({ timeout: 60_000 });
  });

  test('Start investigation: offered to a manager approver (reza), not to a production engineer (leila)', async ({ browser }) => {
    const rezaPage = await browser.newPage();
    await signInReadOnly(rezaPage, 'reza');
    await rezaPage.goto('/pla-analytics/losses?breakdown=loss-events');
    await expect(rezaPage.getByTestId('loss-events')).toBeVisible({ timeout: 60_000 });
    const rows = await rezaPage.getByTestId('loss-events').locator('tbody tr').count();
    if (rows > 0) await expect(rezaPage.getByTestId('start-rca').first()).toBeVisible();
    expect(blocked).toEqual([]);
    await rezaPage.close();

    const leilaPage = await browser.newPage();
    await signInReadOnly(leilaPage, 'leila');
    await leilaPage.goto('/pla-analytics/losses?breakdown=loss-events');
    await expect(leilaPage.getByTestId('loss-events')).toBeVisible({ timeout: 60_000 });
    await expect(leilaPage.getByTestId('start-rca')).toHaveCount(0);
    await leilaPage.close();
  });

  test('maryam: approvals inbox and the notification bell', async ({ page }) => {
    await signInReadOnly(page, 'maryam');
    await page.goto('/approvals');
    await expect(page.getByTestId('approval-inbox')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('notification-bell')).toBeVisible();
  });
});
