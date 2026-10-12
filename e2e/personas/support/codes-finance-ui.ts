import { expect, type Page } from '@playwright/test';
import { findRule } from '../../test-utils/codes-world';

/**
 * UI steps of `/codes-admin` and `/finance` after the T5 redesign: one library at a time (`?library=`),
 * a tree that starts collapsed (deep codes are found with the search, `?q=`), a page per code
 * (`/codes-admin/:library/:id`), per rule (`/codes-admin/rules/:id`), per FX rate (`/finance/fx/:id`)
 * and per policy version (`/finance/policies/:id`); destructive and approving actions ask first.
 */
export type Library = 'reason-codes' | 'impact-codes' | 'oee-codes' | 'failure-code-groups' | 'loss-category-defs';

export const adminRefusal = (page: Page) => page.getByTestId('admin-refusal');

/** The library tab of `/codes-admin`, optionally with a search. */
export async function openLibrary(page: Page, library: Library = 'reason-codes', search = ''): Promise<void> {
  const query = new URLSearchParams({ library, ...(search ? { q: search } : {}) });
  await page.goto(`/codes-admin?${query.toString()}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
}

/** "New code" from the library page; the new code's page opens. `parentLabel` null = top level, undefined = no parent field. */
export async function createCode(page: Page, library: Library, code: string, name: string, parentLabel?: string | null): Promise<void> {
  await openLibrary(page, library);
  await page.getByTestId('code-new').click();
  await page.fill('#new-code', code);
  await page.fill('#new-name', name);
  if (parentLabel === null) await page.getByTestId('new-parent').selectOption('');
  else if (parentLabel !== undefined) await page.getByTestId('new-parent').selectOption({ label: parentLabel });
  await page.getByTestId('code-create-submit').click();
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', code, { timeout: 20_000 });
}

/** Finds the code with the library search and opens its page. */
export async function openCode(page: Page, library: Library, code: string): Promise<void> {
  await openLibrary(page, library, code);
  await page.locator(`[data-testid="code-match"][data-code="${code}"]`).click({ timeout: 30_000 });
  await expect(page.getByTestId('code-detail')).toHaveAttribute('data-code', code, { timeout: 20_000 });
}

/** The search result row of a code says where it sits ("root › child", or "Top level"). */
export async function expectUnder(page: Page, library: Library, code: string, under: string): Promise<void> {
  await openLibrary(page, library, code);
  const row = page.getByRole('row').filter({ has: page.locator(`[data-testid="code-match"][data-code="${code}"]`) });
  await expect(row.getByRole('cell').nth(2)).toHaveText(under, { timeout: 30_000 });
}

/** "Move under" on the code's page. */
export async function moveCode(page: Page, library: Library, code: string, targetLabel: string): Promise<void> {
  await openCode(page, library, code);
  await page.getByTestId('code-move-target').selectOption({ label: targetLabel });
  await page.getByTestId('code-move-submit').click();
}

/** The rule's page (looked up by name through the API: the list is paged). */
export async function openRule(page: Page, token: string, name: string): Promise<void> {
  const rule = await findRule(token, name);
  expect(rule, `rule ${name}`).not.toBeNull();
  await page.goto(`/codes-admin/rules/${rule?.id}`);
  await expect(page.getByTestId('rule-detail')).toBeVisible({ timeout: 60_000 });
}

/** The confirm button of the open confirmation dialog. */
export async function confirmDialog(page: Page, label: string): Promise<void> {
  await page.getByRole('alertdialog').getByRole('button', { name: label }).click();
}

/** Fills a date-time input (tenant calendar Gregorian) by its legend prefix, e.g. "Valid from". */
export async function fillDateTime(page: Page, legend: string, isoLocal: string): Promise<void> {
  const [date, time] = isoLocal.split('T');
  const group = page.getByRole('group').filter({ hasText: legend }).first();
  await group.locator('input[type="date"]').fill(date);
  await group.locator('input[type="time"]').fill(time.slice(0, 5));
}

/** Adds an exchange rate draft through the dialog; the new rate's page opens. */
export async function addFxDraft(page: Page, input: { rate: string; from: string; source: string }): Promise<void> {
  await page.goto('/finance?tab=fx');
  await page.getByTestId('fx-new').click({ timeout: 60_000 });
  await page.fill('#rate', input.rate);
  await fillDateTime(page, 'Valid from', input.from);
  await page.fill('#fxSource', input.source);
  await page.getByTestId('fx-save').click();
  await expect(page.getByTestId('fx-detail')).toBeVisible({ timeout: 20_000 });
}

/** The row of a rule version in the Versions tab (its rollback button sits in another cell of the row). */
export const ruleVersionRow = (page: Page, version: number) =>
  page.getByRole('row').filter({ has: page.locator(`[data-testid="rule-version"][data-version="${version}"]`) });
