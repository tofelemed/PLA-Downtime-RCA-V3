import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Event Hub screen helpers shared by the persona journeys: the event list is a table (one `<tr>` per
 * event, marked by `[data-testid="event-row"][data-event-id]` in its start cell), an event opens as its
 * own page (`/events/:id`), and the form's plant times are a date + time pair.
 */
export const eventRowOf = (page: Page | Locator, id: string): Locator =>
  page.locator('tr', { has: page.locator(`[data-testid="event-row"][data-event-id="${id}"]`) });

/** Opens the event page from its list row (the start time is the row's link). */
export async function openEventRow(page: Page, id: string): Promise<void> {
  await eventRowOf(page, id).getByRole('link').first().click();
  await expect(page.getByTestId('event-detail')).toBeVisible();
}

/** Back from an event page to the list it was opened from (filters kept in the URL). */
export async function backToList(page: Page): Promise<void> {
  await page.goBack();
  await expect(page.getByTestId('event-hub-v2')).toBeVisible();
}

/** Types a plant wall-clock time (`YYYY-MM-DDTHH:mm`) into a date + time field of the event form. */
export async function fillPlantTime(form: Locator, label: 'Start' | 'End (empty = still ongoing)', local: string): Promise<void> {
  await form.getByLabel(`${label} date`, { exact: true }).fill(local.slice(0, 10));
  await form.getByLabel(`${label} time`, { exact: true }).fill(local.slice(11, 16));
}

/** Opens the "More filters" row when it is closed (state, coding, RCA, origin … filters live there). */
export async function showMoreFilters(page: Page): Promise<void> {
  const toggle = page.getByTestId('more-filters');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

/**
 * Picks a reason code in the shared searchable tree picker (FE-04): opens the combobox `trigger`, types
 * `search` (part of the code or name: the picker renders at most 200 rows, so a code of a big library is
 * reached through the search), clicks the code's row in the popover (portalled to the page) and checks
 * the trigger holds it.
 */
export async function pickReasonCode(trigger: Locator, reasonId: string, search: string): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  await page.locator('[cmdk-input]').fill(search);
  await page.locator(`[cmdk-item][data-reason-id="${reasonId}"]`).click();
  await expect(trigger).toHaveAttribute('data-value', reasonId);
}
