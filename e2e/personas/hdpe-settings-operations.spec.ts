import { test, expect, type Locator, type Page } from '@playwright/test';
import type { NotificationView } from '../../src/api/v2/types/notifications';
import { apiLogin, call, PLANTS, signIn } from './support/admin-helpers';

const MANAGER = 'jonas.weber@demo.acme.com';
const PLANT_PATH = `/v2/tenants/${PLANTS.demo.id}`;
const WINDOW = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-16T00:00:00.000Z' };
interface DisplaySettings {
  calendarSystem: 'gregorian' | 'persian';
  digits: 'latin' | 'persian';
  weekStart: 'saturday' | 'monday';
  timezone: string;
}
interface Unit { id: string; code: string; }
interface WeeklyReport { data: { groups: Array<{ key: string }> }; }
interface ValueReport { data: { total: { currencies: Array<{ currency: string; amount: string | null }> } }; }

test.setTimeout(90_000);

async function saveSettings(page: Page, button: Locator): Promise<void> {
  if (!(await button.isEnabled())) return;
  const response = page.waitForResponse((r) => r.url().endsWith(`${PLANT_PATH}/display-settings`) && r.request().method() === 'PATCH');
  await button.click();
  expect((await response).status()).toBe(200);
  await expect(button).toBeDisabled();
}

async function assertWeeklyBuckets(token: string, unitId: string, day: number): Promise<void> {
  const query = new URLSearchParams({ ...WINDOW, unitIds: unitId, groupBy: 'week', approvedOnly: 'false' });
  const report = await call<WeeklyReport>(token, 'GET', `/v2/reports/oee?${query}`);
  expect(report.status).toBe(200);
  expect(report.body.data.groups.length).toBeGreaterThan(0);
  for (const group of report.body.data.groups) {
    // The public contract uses ISO week numbers on Monday and Saturday dates for Iranian weeks.
    if (day === 1) expect(group.key).toMatch(/^2026-W(?:40|41|42)$/);
    else expect(new Date(`${group.key}T12:00:00Z`).getUTCDay()).toBe(6);
  }
}

async function assertPlantDate(page: Page, settings: DisplaySettings): Promise<void> {
  await page.goto('/connectivity/source-status');
  const time = page.getByTestId('mapping-version').first().locator('time').first();
  await expect(time).toBeVisible();
  const iso = await time.getAttribute('datetime');
  expect(iso).toBeTruthy();
  const locale = settings.digits === 'persian' ? 'fa-IR' : 'en-GB';
  const year = new Intl.DateTimeFormat(locale, {
    calendar: settings.calendarSystem === 'gregorian' ? 'gregory' : settings.calendarSystem,
    numberingSystem: settings.digits === 'persian' ? 'arabext' : 'latn',
    timeZone: settings.timezone, year: 'numeric',
  }).formatToParts(new Date(iso!)).find((part) => part.type === 'year')!.value;
  await expect(time).toContainText(year);
  if (settings.digits === 'persian') await expect(time).toContainText(/[۰-۹]/);
  else await expect(time).not.toContainText(/[۰-۹]/);
}

test('plant calendar, digits and reporting week propagate to dates and server weekly buckets', async ({ page }) => {
  const manager = await apiLogin(MANAGER);
  const original = await call<DisplaySettings>(manager.token, 'GET', PLANT_PATH);
  expect(original.status).toBe(200);
  const units = await call<{ items: Unit[] }>(manager.token, 'GET', '/v2/units?limit=200');
  expect(units.status).toBe(200);
  const unit = units.body.items.find((row) => row.code === 'unit100');
  expect(unit).toBeDefined();
  await signIn(page, MANAGER);
  try {
    for (const preference of [
      { calendarSystem: 'persian', digits: 'persian', weekStart: 'monday', weekday: 1 },
      { calendarSystem: 'gregorian', digits: 'latin', weekStart: 'saturday', weekday: 6 },
    ] as const) {
      await page.goto('/admin?tab=settings');
      await page.locator(`#calendar-${preference.calendarSystem}`).click();
      await page.locator(`#digits-${preference.digits}`).click();
      await saveSettings(page, page.getByRole('button', { name: 'Save', exact: true }).first());
      await page.locator(`#week-${preference.weekStart}`).click();
      await saveSettings(page, page.getByTestId('save-week-start'));
      const saved = await call<DisplaySettings>(manager.token, 'GET', PLANT_PATH);
      expect(saved.status).toBe(200);
      expect(saved.body).toMatchObject({ calendarSystem: preference.calendarSystem, digits: preference.digits, weekStart: preference.weekStart });
      await assertPlantDate(page, saved.body);
      await assertWeeklyBuckets(manager.token, unit!.id, preference.weekday);
      await page.goto('/admin?tab=settings');
      for (const id of [`calendar-${preference.calendarSystem}`, `digits-${preference.digits}`, `week-${preference.weekStart}`]) {
        await expect(page.locator(`#${id}`)).toBeChecked();
      }
    }
  } finally {
    const { calendarSystem, digits, weekStart } = original.body;
    const restored = await call<DisplaySettings>(manager.token, 'PATCH', `${PLANT_PATH}/display-settings`, { calendarSystem, digits, weekStart });
    expect(restored.status, 'restore original HDPE display settings').toBe(200);
    expect(restored.body).toMatchObject({ calendarSystem, digits, weekStart });
  }
});

test('USD and IRR preference changes the report columns and survives navigation and reload', async ({ page }) => {
  await signIn(page, MANAGER);
  const toggle = page.locator('header').getByTestId('display-currency-toggle');
  const original = await toggle.getByTestId('display-currency-IRR').getAttribute('data-state') === 'on' ? 'IRR' : 'USD';
  try {
    const response = page.waitForResponse((r) => r.url().includes('/v2/reports/loss-value?') && r.status() === 200);
    await page.goto(`/reports?${new URLSearchParams({ ...WINDOW, window: 'HDPE settings audit', approved: '0', view: 'value' })}`);
    const report = await (await response).json() as ValueReport;
    expect(report.data.total.currencies.map((row) => row.currency)).toEqual(expect.arrayContaining(['USD', 'IRR']));
    for (const currency of ['IRR', 'USD'] as const) {
      await toggle.getByTestId(`display-currency-${currency}`).click();
      const card = page.getByTestId('report-loss-value');
      await expect(card.getByRole('columnheader', { name: currency, exact: true })).toBeVisible();
      await expect(card.getByRole('columnheader', { name: currency === 'USD' ? 'IRR' : 'USD', exact: true })).toHaveCount(0);
      await expect(card.getByTestId('report-value-total')).toContainText(currency);
      await page.reload();
      await expect(toggle.getByTestId(`display-currency-${currency}`)).toHaveAttribute('data-state', 'on');
      await expect(page.getByTestId('report-value-total')).toContainText(currency);
      await page.goto('/admin?tab=settings');
      await expect(toggle.getByTestId(`display-currency-${currency}`)).toHaveAttribute('data-state', 'on');
      await page.goBack();
    }
  } finally {
    await toggle.getByTestId(`display-currency-${original}`).click();
  }
});

test('in-app notifications support opening one unread item and marking all read', async ({ page }, info) => {
  let candidate: { email: string; token: string } | undefined;
  for (const email of [MANAGER, 'fatima.haddad@demo.acme.com', 'sara.nouri@demo.acme.com']) {
    const session = await apiLogin(email);
    const list = await call<{ items: NotificationView[] }>(session.token, 'GET', '/v2/notifications?limit=20');
    expect(list.status).toBe(200);
    if (list.body.items.filter((item) => !item.read).length >= 2) {
      candidate = { email, token: session.token };
      break;
    }
  }
  test.skip(!candidate, 'No persona has two unread notifications among the newest 20 seeded items.');
  info.annotations.push({ type: 'persona', description: candidate!.email });
  await signIn(page, candidate!.email);
  await page.getByTestId('notification-bell').click();
  const first = page.locator('[data-testid="notification"][data-read="false"]').first();
  await expect(first).toBeVisible();
  const one = page.waitForResponse((r) => /\/notifications\/[^/]+\/read$/.test(r.url()) && r.request().method() === 'POST');
  await first.locator('a, button').click();
  const marked = await one;
  expect(marked.ok()).toBe(true);
  const id = new URL(marked.url()).pathname.split('/').at(-2);
  const list = await call<{ items: NotificationView[] }>(candidate!.token, 'GET', '/v2/notifications?limit=20');
  expect(list.body.items.find((item) => item.id === id)?.read).toBe(true);
  await page.getByTestId('notification-bell').click();
  const all = page.waitForResponse((r) => r.url().endsWith('/notifications/read-all') && r.request().method() === 'POST');
  await page.getByTestId('notification-read-all').click();
  expect((await all).ok()).toBe(true);
  await expect(page.getByTestId('notification-unread')).toHaveCount(0);
  const count = await call<{ unread: number }>(candidate!.token, 'GET', '/v2/notifications/unread-count');
  expect(count.status).toBe(200);
  expect(count.body.unread).toBe(0);
});
