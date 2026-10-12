import { expect, type Page } from '@playwright/test';
import { fillPlantDateTime, plantLocal } from '../../test-utils/planning-world';

/** The `/planning` screen (plan 3.4): tab navigation and the plant clock of the scope header. */
export type PlanningTab = 'plans' | 'profiles' | 'calendars';

let timezone = 'UTC';

export async function openPlanningTab(page: Page, tab: PlanningTab): Promise<void> {
  await page.goto(`/planning?tab=${tab}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(`${tab}-tab`)).toBeVisible({ timeout: 60_000 });
  const header = (await page.getByTestId('scope-header').textContent()) ?? '';
  timezone = /([A-Za-z_]+\/[A-Za-z_]+|UTC) \(/.exec(header)?.[1] ?? 'UTC';
}

/** A UTC instant on the plant clock (`YYYY-MM-DDTHH:mm`), as the date + time fields take it. */
export const local = (utc: string): string => plantLocal(utc, timezone);

export const previewPeriods = (page: Page) => page.getByTestId('period-preview').getByTestId('preview-period');

export async function previewTargets(page: Page): Promise<string[]> {
  await page.getByTestId('plan-preview').click();
  await expect(previewPeriods(page)).toHaveCount(3);
  return previewPeriods(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-target') ?? ''));
}

export async function openPlanOfUnit(page: Page, unitName: string, planName?: string): Promise<void> {
  await openPlanningTab(page, 'plans');
  await page.selectOption('#planUnitFilter', { label: unitName });
  const rows = page.getByTestId('plan-row');
  await (planName ? rows.filter({ hasText: planName }) : rows).first().click();
  await expect(page.getByTestId('plan-detail')).toBeVisible();
}

export async function openProfile(page: Page, unitName: string, profileId: string): Promise<void> {
  await openPlanningTab(page, 'profiles');
  await page.selectOption('#profileUnitFilter', { label: unitName });
  await page.locator(`[data-testid="profile-row"][data-profile-id="${profileId}"]`).click();
  await expect(page.getByTestId('profile-detail')).toHaveAttribute('data-profile-id', profileId);
}

/** The rate's state marker and actions (`data-state`), inside its table row. */
export const rateRow = (page: Page, kind: string, version: number) => page.locator(`[data-testid="rate-row"][data-kind="${kind}"][data-version="${version}"]`);

/** The whole table row of a rate version (kind, rate, effective interval, state, actions). */
export const rateLine = (page: Page, kind: string, version: number) => page.locator('tr', { has: rateRow(page, kind, version) });

export async function addRateDraft(page: Page, kind: string, rate: string, effectiveFromUtc: string): Promise<void> {
  await page.getByTestId('rate-add').click();
  await page.selectOption('#rateKind', kind);
  await page.fill('#rate', rate);
  await fillPlantDateTime(page, 'Effective from', local(effectiveFromUtc));
  await page.getByTestId('rate-save').click();
}
