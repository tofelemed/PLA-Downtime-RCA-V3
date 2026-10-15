import { test, expect, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { openPeriodSection } from '../test-utils/period-sections';
import { reconciliation } from '../test-utils/dashboard-world';
import { api, ok, post } from './support/manager-api';
import { asUser, MANAGERS, PREFIX, sessionOf, type Session } from './support/manager-users';
import { ensurePeriodWorld, type PeriodWorld } from './support/manager-world';

/**
 * Manager approver persona — journeys 3 and 4 on the v2 Plan Dashboard (plan 3.5, UX05 manager):
 * 3. Jonas (Manager) reconciles and submits shift A; as the submitter he cannot approve (T36
 *    SEPARATION_OF_DUTIES shown and 403); Fatima approves, exports and sees the sha256 hash; the state
 *    survives a reload and is read back from GET /v2/production-periods/{id}/reconciliation. Erik's
 *    submission of shift C with an unexplained residual is refused (422 RESIDUAL_UNEXPLAINED shown);
 *    once explained, Laura rejects it with a reason.
 * 4. Actuals adjustments (ADJUSTMENT_APPROVERS): Jonas proposes two on shift B, his own approval is
 *    refused, Fatima approves one and rejects the other with a reason; a zero quantity is a 422.
 * Data: unit `P-MGR-PD …`, its plan, periods, events, revisions, adjustments and one export — kept.
 */
let jonas: Session;
let fatima: Session;
let erik: Session;
let world: PeriodWorld;

test.describe.configure({ mode: 'serial', timeout: 180_000 });

/** The period's marker in the grid (`data-residual-state`, `data-workflow`) and its whole table row. */
const marker = (page: Page, periodId: string) => page.locator(`[data-testid="period-row"][data-period-id="${periodId}"]`);
const row = (page: Page, periodId: string) => page.locator('tr', { has: marker(page, periodId) });

/** The plan's period grid (`/plans/:planId`); a period opens on its own page. */
async function openGrid(page: Page): Promise<void> {
  await page.goto(`/plans/${world.planId}`);
  await expect(page.getByTestId('period-grid')).toBeVisible({ timeout: 60_000 });
}
const figure = (page: Page, key: string) => page.getByTestId('reconciliation-summary').getByTestId(`figure-${key}`);

async function openPeriod(page: Page, periodId: string): Promise<void> {
  await page.goto(`/plans/${world.planId}/periods/${periodId}`);
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('plan-dashboard-v2')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', /.+/, { timeout: 60_000 });
}

/** Saves draft lines through the API: the first candidate (when asked) plus manual availability lines without an event. */
async function saveLines(token: string, periodId: string, manual: string[], acceptCandidate: boolean): Promise<void> {
  const view = await reconciliation(token, periodId);
  const lines = [
    ...(acceptCandidate ? [{ action: 'accept', autoKey: view.candidates[0].autoKey }] : []),
    ...manual.map((quantity) => ({ action: 'manual', sliceId: view.slices[0].sliceId, kind: 'availability', quantity, missingEvent: true, evidenceType: 'log', evidenceRef: 'e2e shift log', reasonCodeId: world.reasonCodeId })),
  ];
  await ok(api(token, 'PUT', `/v2/production-periods/${periodId}/draft-lines`, { revision: view.revision.revision, baseRunId: view.baseRunId, lines }, { 'If-Match': `"${view.rowVersion}"` }), 'draft-lines');
}

interface Adjustment {
  id: string;
  state: string;
  code?: string;
}

async function propose(token: string, sliceId: string, quantity: string, note: string): Promise<{ status: number; body: Adjustment }> {
  return post<Adjustment>(token, '/v2/actuals/adjustments', { sliceId, kind: 'good', quantity, basis: 'measured', reason: `${PREFIX}${note}`, evidenceRef: `${PREFIX}weighbridge ticket ${world.suffix}` });
}

test.describe('Manager persona — period accounting and adjustments (Plan Dashboard)', () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000);
    [jonas, fatima, erik] = await Promise.all([sessionOf(MANAGERS.jonas), sessionOf(MANAGERS.fatima), sessionOf(MANAGERS.erik)]);
    world = await ensurePeriodWorld(jonas.token, jonas.tenantId, true);
    await saveLines(jonas.token, world.periods.a, ['60'], true); // accept 90 t + 60 t manual: residual 0
  });

  test('J3a Jonas submits shift A; the submitter cannot approve (T36 SEPARATION_OF_DUTIES shown and 403)', async ({ page }) => {
    await loginViaUI(page, MANAGERS.jonas.email, MANAGERS.jonas.password);
    await openGrid(page);
    await expect(row(page, world.periods.a).getByTestId('cell-gap')).toHaveText('150.00 t');
    await row(page, world.periods.a).click();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', /.+/, { timeout: 60_000 });
    await expect(figure(page, 'residual')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('waterfall')).toHaveAttribute('data-closes', 'true');
    await openPeriodSection(page, 'Review & close');
    await page.getByTestId('wf-submit').click();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await expect(page.getByTestId('wf-approve')).toBeDisabled();
    await expect(page.getByTestId('approve-gate')).toHaveAttribute('data-code', 'SEPARATION_OF_DUTIES');
    const view = await reconciliation(jonas.token, world.periods.a);
    const submitted = await api<{ revision: { revision: number; submittedHash: string } }>(jonas.token, 'GET', `/v2/production-periods/${world.periods.a}/reconciliation`);
    const refused = await post<{ code: string }>(jonas.token, `/v2/production-periods/${world.periods.a}/approve`, { revision: view.revision.revision, submittedHash: submitted.body.revision.submittedHash });
    expect([refused.status, refused.body.code]).toEqual([403, 'SEPARATION_OF_DUTIES']);
  });

  test('J3b Fatima approves the submitted snapshot, exports it and sees the hash; the state persists', async ({ page }) => {
    await loginViaUI(page, MANAGERS.fatima.email, MANAGERS.fatima.password);
    await openPeriod(page, world.periods.a);
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await openPeriodSection(page, 'Review & close');
    await expect(page.getByTestId('approve-gate')).toHaveCount(0);
    await page.getByTestId('wf-approve').click();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved');
    await openPeriodSection(page, 'History & exports');
    await expect(page.getByTestId('revision-history').locator('[data-action="approve"]')).toBeVisible();
    await page.getByTestId('export-start').click();
    await expect(page.getByTestId('export-job')).toHaveAttribute('data-state', 'completed', { timeout: 60_000 });
    await expect(page.getByTestId('export-hash')).toHaveText(/SHA-256\): [0-9a-f]{64}/);
    const download = page.waitForEvent('download');
    await page.getByTestId('export-download').click();
    expect((await download).suggestedFilename()).toMatch(/^traverse-forge-loss-lines-.+\.csv$/);
    await page.screenshot({ path: test.info().outputPath('manager-period-approved.png'), fullPage: true });

    await page.reload();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved', { timeout: 60_000 });
    await openGrid(page);
    await expect(marker(page, world.periods.a)).toHaveAttribute('data-workflow', 'approved');
    const view = await api<{ revision: { lifecycle: string; approvedBy?: string | null; submittedBy?: string | null } }>(fatima.token, 'GET', `/v2/production-periods/${world.periods.a}/reconciliation`);
    expect(view.body.revision.lifecycle).toBe('approved');
    expect(view.body.revision.submittedBy ?? jonas.userId).toBe(jonas.userId);
    expect(view.body.revision.approvedBy ?? fatima.userId).toBe(fatima.userId);
  });

  test('J3c an unexplained residual cannot be submitted (422 shown); once explained, Laura rejects with a reason', async ({ browser }) => {
    const author = await asUser(browser, MANAGERS.erik);
    await openPeriod(author, world.periods.c);
    await expect(figure(author, 'residual')).toHaveAttribute('data-value', '150');
    await openPeriodSection(author, 'Review & close');
    await author.getByTestId('wf-submit').click();
    await expect(author.getByTestId('workflow-problem')).toHaveAttribute('data-code', 'RESIDUAL_UNEXPLAINED');
    await expect(author.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'draft');
    await saveLines(erik.token, world.periods.c, ['150'], false);
    await author.reload();
    await openPeriodSection(author, 'Reconciliation');
    await expect(figure(author, 'residual')).toHaveAttribute('data-value', '0', { timeout: 60_000 });
    await openPeriodSection(author, 'Review & close');
    await author.getByTestId('wf-submit').click();
    await expect(author.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');

    const approver = await asUser(browser, MANAGERS.laura);
    await openPeriod(approver, world.periods.c);
    await openPeriodSection(approver, 'Review & close');
    await approver.getByTestId('wf-reject').click();
    await approver.getByTestId('wf-reason').fill(`${PREFIX}rejected: the 150 t line needs an event`);
    await approver.getByRole('button', { name: 'Return revision' }).click();
    await expect(approver.getByTestId('period-detail')).not.toHaveAttribute('data-lifecycle', 'in_review');
    await openPeriodSection(approver, 'History & exports');
    await expect(approver.getByTestId('revision-history').locator('[data-action="reject"]')).toBeVisible();
    const view = await api<{ revision: { lifecycle: string } }>(erik.token, 'GET', `/v2/production-periods/${world.periods.c}/reconciliation`);
    expect(view.body.revision.lifecycle).not.toBe('in_review');
    await author.context().close();
    await approver.context().close();
  });

  test('J4 adjustments: author proposes, own approval refused, Fatima approves one and rejects one; zero quantity is 422', async ({ page }) => {
    const view = await reconciliation(jonas.token, world.periods.b);
    const sliceId = view.slices[0].sliceId;
    const zero = await propose(jonas.token, sliceId, '0', 'zero adjustment');
    expect(zero.status).toBe(422);
    const first = await propose(jonas.token, sliceId, '-5', 'weighbridge recount A');
    const second = await propose(jonas.token, sliceId, '-7', 'weighbridge recount B');
    expect([first.status, first.body.state, second.status, second.body.state]).toEqual([201, 'proposed', 201, 'proposed']);

    const own = await post<{ code: string }>(jonas.token, `/v2/actuals/adjustments/${first.body.id}/approve`, { reason: 'own approval' });
    expect([own.status, own.body.code]).toEqual([403, 'SEPARATION_OF_DUTIES']);
    const approved = await post<Adjustment>(fatima.token, `/v2/actuals/adjustments/${first.body.id}/approve`, { reason: `${PREFIX}recount verified` });
    expect([approved.status, approved.body.state]).toEqual([200, 'approved']);

    // the second one is rejected in the period workspace: the reason is a required field of the dialog
    await loginViaUI(page, MANAGERS.fatima.email, MANAGERS.fatima.password);
    await openPeriod(page, world.periods.b);
    await openPeriodSection(page, 'Actuals & quality');
    const pending = page.getByTestId('adjustments').locator('tr', { has: page.locator('[data-testid="adjustment-row"][data-state="proposed"]') });
    await expect(pending).toHaveCount(1, { timeout: 60_000 });
    await pending.getByTestId('adjustment-reject').click();
    await page.getByTestId('wf-reason').fill(`${PREFIX}duplicate of the first recount`);
    await page.getByRole('button', { name: 'Reject adjustment' }).click();
    await expect(page.locator('[data-testid="adjustment-row"][data-state="rejected"]')).toHaveCount(1, { timeout: 60_000 });
    const again = await post<{ code: string }>(fatima.token, `/v2/actuals/adjustments/${second.body.id}/approve`, {});
    expect([again.status, again.body.code]).toEqual([409, 'INVALID_TRANSITION']);
    expect((await api<Adjustment>(jonas.token, 'GET', `/v2/actuals/adjustments/${first.body.id}`)).body.state).toBe('approved');
    expect((await api<Adjustment>(jonas.token, 'GET', `/v2/actuals/adjustments/${second.body.id}`)).body.state).toBe('rejected');

    // the approved adjustment is listed with the period's adjustments the manager inspects (UX05)
    await page.reload();
    const approvedRow = page.getByTestId('adjustments').locator('tr', { has: page.locator('[data-testid="adjustment-row"][data-state="approved"]') });
    await expect(approvedRow).toContainText('-5', { timeout: 60_000 });
    await expect(approvedRow).toContainText('Approved');
  });
});
