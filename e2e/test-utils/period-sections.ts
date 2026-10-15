import { expect, type Page } from '@playwright/test';

type PeriodSection = 'Reconciliation' | 'Actuals & quality' | 'Review & close' | 'Value' | 'History & exports';

/** Open the section that owns a control before checking its state or permissions. */
export async function openPeriodSection(page: Page, section: PeriodSection): Promise<void> {
  const link = page.getByRole('navigation', { name: 'Period sections' }).getByRole('link', { name: section, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('period-section-heading')).toHaveText(section);
}
