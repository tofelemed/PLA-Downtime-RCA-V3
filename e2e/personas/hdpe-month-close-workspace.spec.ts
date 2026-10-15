import { test, expect, type Page } from '@playwright/test';
import type { MonthCloseView } from '../../src/api/v2/types/month-close';
import { API, apiLogin, call, signIn } from './support/admin-helpers';
import { ACCOUNTING_USERS } from './support/hdpe-accounting-world';

const sections = ['Overview', 'Periods', 'Days', 'Proposals', 'History'] as const;
type Section = typeof sections[number];

async function selectSection(page: Page, section: Section): Promise<void> {
  const tab = page.getByRole('tablist', { name: 'Month close sections' }).getByRole('tab', { name: section, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: section, exact: true })).toBeVisible();
}

async function readMonth(email: string, selection: 'current' | 'previous'): Promise<MonthCloseView> {
  const session = await apiLogin(email);
  const current = await call<MonthCloseView>(session.token, 'GET', '/v2/month-closes/current');
  expect(current.status).toBe(200);
  if (selection === 'current') return current.body;
  const previous = await call<MonthCloseView>(session.token, 'GET', `/v2/month-closes/${current.body.previousMonthKey}`);
  expect(previous.status).toBe(200);
  return previous.body;
}

async function assertSample(page: Page, input: { id: string; shown: number; total: number }): Promise<void> {
  const list = page.getByTestId(input.id);
  await expect(list).toBeVisible();
  if (input.total === 0) { await expect(list.locator('table')).toHaveCount(0); return; }
  if (input.shown === 0) {
    await expect(list).toContainText(`${input.total} records reported; sample rows are unavailable.`); return;
  }
  await expect(list.locator('tbody tr')).toHaveCount(input.shown);
  await expect(list).toContainText(input.shown < input.total ? `First ${input.shown} of ${input.total} shown.` : `All ${input.total} shown.`);
  await expect(list.getByRole('navigation', { name: /pages/ })).toHaveCount(0);
}

async function assertSection(page: Page, section: Section, view: MonthCloseView): Promise<void> {
  const p = view.prerequisites;
  if (section === 'Overview') {
    await expect(page.getByTestId('close-count-periods-value')).toHaveText(String(p.pendingCount));
    await expect(page.getByTestId('close-count-days-value')).toHaveText(String(p.days - p.certifiedDays));
    await expect(page.getByTestId('close-count-proposals-value')).toHaveText(String(p.openProposalCount));
    await expect(page.getByTestId('close-sign-offs')).toHaveCount(1);
    await expect(page.getByTestId('close-state')).toHaveAttribute('data-state', view.state);
    return;
  }
  await expect(page.getByTestId('close-sign-offs')).toHaveCount(0);
  if (section === 'Periods') {
    await assertSample(page, { id: 'pending-periods', shown: p.pending.length, total: p.pendingCount });
    await expect(page.getByTestId('pending-periods').locator('table a')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open my queue', exact: true })).toHaveAttribute('href', '/my-queue');
  } else if (section === 'Days') {
    await assertSample(page, { id: 'uncertified-days', shown: p.uncertifiedDays.length, total: p.days - p.certifiedDays });
    await expect(page.getByTestId('uncertified-days').locator('a')).toHaveCount(0);
  } else if (section === 'Proposals') {
    await assertSample(page, { id: 'open-proposals', shown: p.openProposals.length, total: p.openProposalCount });
    await expect(page.getByTestId('open-proposals').getByRole('link', { name: 'Open period', exact: true })).toHaveCount(p.openProposals.filter((item) => item.planId).length);
  } else {
    await expect(page.getByTestId(view.history.length ? 'close-history' : 'close-history-empty')).toBeVisible();
  }
}

test.describe('HDPE month-close sections and responsive read-only navigation', () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(() => {
    test.skip(!API.includes(':4006/'), 'Run against the isolated HDPE UI database on port 4006.');
  });

  for (const width of [1280, 390]) for (const month of ['current', 'previous'] as const) {
    test(`${month} month counts, capped samples and keyboard navigation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const view = await readMonth(ACCOUNTING_USERS.author, month);
      expect(view.state).toBe(month === 'previous' ? 'locked' : 'open');
      await signIn(page, ACCOUNTING_USERS.author);
      const requests: string[] = []; const errors: string[] = [];
      page.on('request', (request) => { if (request.url().includes('/v2/month-closes/')) requests.push(request.method()); });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/month-close?month=${view.monthKey}&source=review`);
      await expect(page.getByTestId('month-label')).toContainText(view.monthKey);
      for (const section of sections) {
        await selectSection(page, section); await assertSection(page, section, view);
        expect(new URL(page.url()).searchParams.get('month')).toBe(view.monthKey);
        expect(new URL(page.url()).searchParams.get('source')).toBe('review');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${section} overflow`).toBeLessThanOrEqual(1);
        if (section === 'Overview' && width === 1280) {
          const signOffs = await page.getByTestId('close-sign-offs').boundingBox();
          expect(signOffs).not.toBeNull(); expect(signOffs!.y).toBeLessThan(900);
        }
        await page.screenshot({ path: test.info().outputPath(`${month}-${width}-${section.toLowerCase()}.png`), fullPage: true });
      }
      expect(requests).toEqual(['GET']);
      await page.goBack(); await expect(page.getByRole('tab', { name: 'Proposals', exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.goForward(); await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.reload(); await expect(page.getByRole('tabpanel', { name: 'History', exact: true })).toBeVisible();
      await page.getByRole('tab', { name: 'History', exact: true }).focus();
      await page.keyboard.press('Home');
      await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused();
      await expect(page.getByTestId('close-sign-offs')).toBeVisible();
      expect(requests.every((method) => method === 'GET')).toBe(true); expect(errors).toEqual([]);
    });
  }

  test('month navigation and count links preserve the selected section and query context', async ({ page }) => {
    const current = await readMonth(ACCOUNTING_USERS.accountant, 'current');
    await signIn(page, ACCOUNTING_USERS.accountant);
    await page.goto(`/month-close?month=${current.monthKey}&section=proposals&source=queue`);
    await page.getByTestId('month-previous').click();
    await expect(page.getByTestId('month-label')).toContainText(current.previousMonthKey);
    await expect(page.getByRole('tab', { name: 'Proposals', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).searchParams.get('source')).toBe('queue');
    await page.goBack(); await expect(page.getByTestId('month-label')).toContainText(current.monthKey);
    await page.goForward(); await expect(page.getByTestId('month-label')).toContainText(current.previousMonthKey);
    await selectSection(page, 'Overview');
    for (const section of ['periods', 'days', 'proposals']) {
      await page.getByTestId(`close-count-${section}`).click();
      expect(new URL(page.url()).searchParams.get('section')).toBe(section);
      expect(new URL(page.url()).searchParams.get('month')).toBe(current.previousMonthKey);
      await selectSection(page, 'Overview');
    }
  });

  test('a viewer has no month-close command controls in any section', async ({ page }) => {
    await signIn(page, ACCOUNTING_USERS.viewer);
    await page.goto('/month-close?section=invalid');
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    for (const section of sections) {
      await selectSection(page, section);
      for (const step of ['close-quantities', 'materiality-review', 'finance-sign-off', 'lock', 'reopen']) {
        await expect(page.getByTestId(`step-${step}`)).toHaveCount(0);
      }
    }
  });
});
