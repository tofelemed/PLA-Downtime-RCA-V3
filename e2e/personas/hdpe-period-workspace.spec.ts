import { test, expect, type Page } from '@playwright/test';
import { signIn, API } from './support/admin-helpers';
import { ACCOUNTING_USERS, seedAccountingWorld, type AccountingWorld } from './support/hdpe-accounting-world';

const seedPath = '/plans/4de7640b-796d-448d-a9e8-d49cc0e76a27/periods/9443d078-d582-4c5b-81bd-21e93be02e4e';
const sections = ['Reconciliation', 'Actuals & quality', 'Review & close', 'Value', 'History & exports'] as const;
let world: AccountingWorld;

async function section(page: Page, name: typeof sections[number]) {
  await page.getByRole('navigation', { name: 'Period sections' }).getByRole('link', { name, exact: true }).click();
  await expect(page.getByTestId('period-section-heading')).toHaveText(name);
}

test.describe('HDPE period workspace navigation and draft safety', () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeAll(async () => {
    test.skip(!API.includes(':4006/'), 'Fixture mutations require the isolated HDPE UI database on port 4006.');
    test.setTimeout(360_000);
    world = await seedAccountingWorld();
  });

  for (const width of [1280, 390]) {
    test(`section links preserve revision, ledger and other query state at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, ACCOUNTING_USERS.accountant);
      await page.goto(`${seedPath}?view=approved&ledger=capacity&origin=queue`);
      await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved');
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));
      for (const name of sections) {
        await section(page, name);
        const url = new URL(page.url());
        expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'approved', ledger: 'capacity', origin: 'queue' });
        await expect(page.getByRole('navigation', { name: 'Period sections' }).getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${name} page overflow`).toBeLessThanOrEqual(1);
        await page.screenshot({ path: test.info().outputPath(`${width}-${name.split(' ')[0].toLowerCase()}.png`), fullPage: true });
      }
      await page.goBack();
      await expect(page.getByTestId('period-section-heading')).toHaveText('Value');
      await page.goForward();
      await expect(page.getByTestId('period-section-heading')).toHaveText('History & exports');
      await page.reload();
      await expect(page.getByTestId('period-section-heading')).toHaveText('History & exports');
      await page.getByTestId('view-current').click();
      await expect(page).toHaveURL(/view=current/);
      expect(new URL(page.url()).searchParams.get('ledger')).toBe('capacity');
      expect(failures).toEqual([]);
    });
  }

  test('unfinished manual fields survive sections, leaving and returning, and cancelled reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, ACCOUNTING_USERS.author);
    const path = `/plans/${world.fixture.planId}/periods/${world.fixture.periods.a}`;
    await page.goto(path);
    await page.getByTestId('add-manual-line').click();
    await page.locator('#manualQuantity').fill('12.5');
    await page.locator('#manualReasonText').fill('Retained HDPE draft evidence');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'editable mobile page overflow').toBeLessThanOrEqual(1);
    await section(page, 'Actuals & quality');
    await expect(page.getByText('Unsaved loss-line changes.', { exact: false })).toBeVisible();
    await section(page, 'Reconciliation');
    await expect(page.locator('#manualQuantity')).toHaveValue('12.5');
    await expect(page.locator('#manualReasonText')).toHaveValue('Retained HDPE draft evidence');

    // The plan-grid back link is an SPA transition; the app-wide boundary retains the draft.
    await page.getByRole('link', { name: /· period accounting$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${world.fixture.planId}$`));
    await expect(page.getByTestId('period-grid')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'mobile plan grid overflow').toBeLessThanOrEqual(1);
    await page.goBack();
    await page.getByRole('button', { name: 'Restore loss-line draft', exact: true }).click();
    await expect(page.locator('#manualQuantity')).toHaveValue('12.5');
    await expect(page.locator('#manualReasonText')).toHaveValue('Retained HDPE draft evidence');

    await page.locator('#manualNoEvent').click();
    await page.locator('#manualMissingCode').click();
    // Keep this incomplete form as an unsaved draft; reload must warn, not silently clear it.
    const dialog = page.waitForEvent('dialog');
    // Dismissing beforeunload cancels navigation, so Playwright must not wait indefinitely for load.
    const reload = page.reload({ waitUntil: 'commit', timeout: 5_000 }).catch(() => null);
    const warning = await dialog;
    expect(warning.type()).toBe('beforeunload');
    await warning.dismiss();
    await expect(page.locator('#manualQuantity')).toHaveValue('12.5');
    await reload;
    await page.getByTestId('manual-line-form').getByRole('button', { name: 'Cancel', exact: true }).click();
    const discard = page.getByTestId('loss-line-editor').getByRole('button', { name: 'Discard changes', exact: true });
    if ((await discard.isVisible()) && (await discard.isEnabled())) {
      await discard.click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();
    }
  });

  test('viewer can read all five sections without accounting command controls', async ({ page }) => {
    await signIn(page, ACCOUNTING_USERS.viewer);
    await page.goto(seedPath);
    for (const name of sections) {
      await section(page, name);
      for (const id of ['save-lines', 'add-manual-line', 'wf-submit', 'sticky-submit', 'wf-approve', 'wf-revise', 'hold-open', 'day-certify', 'adjustment-propose', 'disposition-record', 'propose-correction']) {
        await expect(page.getByTestId(id)).toHaveCount(0);
      }
    }
  });
});
