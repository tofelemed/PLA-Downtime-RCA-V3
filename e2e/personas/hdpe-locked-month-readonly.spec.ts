import { test, expect } from '@playwright/test';
import { openPeriodSection } from '../test-utils/period-sections';
import type { MonthCloseView } from '../../src/api/v2/types/month-close';
import { apiLogin, call, signIn } from './support/admin-helpers';
import { ACCOUNTING_USERS, readReconciliation, reviseThroughUi } from './support/hdpe-accounting-world';

/** Final HDPE acceptance only: no fixture creation; the sole command must be refused without a write. */
test('the final locked month shows independent sign-offs and refuses a direct UI revision', async ({ page }) => {
  test.skip(process.env.HDPE_ONLY !== '1', 'Requires the completed final HDPE seed, including its locked previous month.');
  test.setTimeout(120_000);
  const author = await apiLogin(ACCOUNTING_USERS.author);
  const current = await call<MonthCloseView>(author.token, 'GET', '/v2/month-closes/current');
  expect(current.status).toBe(200);
  const previous = await call<MonthCloseView>(author.token, 'GET', `/v2/month-closes/${current.body.previousMonthKey}`);
  expect(previous.status).toBe(200);
  expect(previous.body.state).toBe('locked');
  await signIn(page, ACCOUNTING_USERS.author);
  await page.goto('/month-close');
  await page.getByTestId('month-previous').click();
  await expect(page).toHaveURL(new RegExp(`month=${current.body.previousMonthKey}`));
  await expect(page.getByTestId('locked-note')).toBeVisible();
  for (const id of ['signoff-quantities', 'signoff-finance', 'signoff-locked']) await expect(page.getByTestId(id)).toHaveAttribute('data-signed', 'true');
  expect(previous.body.signOffs.quantitiesClosedBy?.id).not.toBe(previous.body.signOffs.financeSignedOffBy?.id);
  await expect(page.getByTestId('step-reopen')).toHaveCount(0);
  const proposal = previous.body.prerequisites.openProposals.find((item) => item.planId && item.manualReason?.includes('Demo:'));
  expect(proposal, 'seeded locked-month proposal with a plan link').toBeDefined();
  await page.getByRole('tablist', { name: 'Month close sections' }).getByRole('tab', { name: 'Proposals', exact: true }).click();
  await page.getByTestId('open-proposals').locator(`a[href="/plans/${proposal!.planId}/periods/${proposal!.periodId}"]`).click();
  const before = await readReconciliation(author.token, proposal!.periodId);
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved');
  await openPeriodSection(page, 'Review & close');
  expect(await reviseThroughUi(page, 'Demo: verify the locked month refuses direct revision')).toBe(409);
  await expect(page.getByRole('alertdialog').getByTestId('workflow-problem')).toHaveAttribute('data-code', 'MONTH_LOCKED');
  const after = await readReconciliation(author.token, proposal!.periodId);
  expect(after.revision).toMatchObject({ revision: before.revision.revision, lifecycle: 'approved' });
  expect(after.publishedRevision).toBe(before.publishedRevision);
});
