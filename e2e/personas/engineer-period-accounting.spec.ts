import { test, expect, type Browser, type Page } from '@playwright/test';
import { loginViaUI } from '../test-utils/auth-helpers';
import { call, command } from '../test-utils/downtime-world';
import { reconciliation, saveLines } from '../test-utils/dashboard-world';
import { AISHA, MATEO, NOAH, SETUP_MANAGER, apiSession, type Session } from './support/engineer-users';
import { seedEngineerWorld, type EngineerWorld } from './support/engineer-world';
import { expectHidden, expectRefused } from './support/hidden-controls';

/**
 * Production engineer persona — UX05 period accounting (journey 2), actuals adjustments (journey 3) and
 * shared visibility after re-login (journey 7) on /plans/:planId/periods/:periodId.
 * Data: a "P-ENG PD …" unit, product, profile, reason codes (setup manager) and an approved plan with
 * its periods, outputs and stops written by an engineer (engineer-world.ts); shift A holds the T15
 * situation (accept 90 + manual 50 → residual 10) saved by Aisha through the API. Nothing is deleted.
 */
let world: EngineerWorld;
let aisha: Session;

test.describe.configure({ mode: 'serial', timeout: 120_000 });

const row = (page: Page, periodId: string) => page.locator(`[data-testid="period-row"][data-period-id="${periodId}"]`);
const figure = (page: Page, key: string) => page.getByTestId('reconciliation-summary').getByTestId(`figure-${key}`);

async function openPeriod(page: Page, periodId: string): Promise<void> {
  await page.goto(`/plans/${world.planId}/periods/${periodId}`);
  await expect(page.getByTestId('plan-dashboard-v2')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', /.+/, { timeout: 60_000 });
}

/** A second session of the same engineer that never hears the realtime channel (a tab left open). */
async function staleTab(browser: Browser, user: { email: string; password: string }, periodId: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.routeWebSocket(/socket\.io/, () => undefined);
  await page.route(/socket\.io/, (route) => route.abort());
  await loginViaUI(page, user.email, user.password);
  await openPeriod(page, periodId);
  return page;
}

test.describe('Engineer — period accounting (UX05), adjustments and shared visibility', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000);
    const setup = await apiSession(SETUP_MANAGER);
    aisha = await apiSession(AISHA);
    world = await seedEngineerWorld(setup.token, aisha.token, aisha.tenantId, 'PD');
    await saveLines(aisha.token, world.periods.a, world.reasons.feed, ['50']);
  });

  test('J2 Noah: opens shift A without writes, sees T15, links 10 t to the stop, closes the residual, submits; reload keeps it; a second submit is refused', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1024, height: 768 }); // tablet (UX07)
    await loginViaUI(page, NOAH.email, NOAH.password);
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
    });
    await openPeriod(page, world.periods.a);
    await expect(row(page, world.periods.a)).toHaveAttribute('data-residual-state', 'unaccounted');
    await expect(row(page, world.periods.a).getByTestId('cell-gap')).toHaveText('150.00 t');
    await expect(row(page, world.periods.a).getByTestId('cell-attributed')).toHaveText('140.00 t');
    await expect(figure(page, 'residual')).toHaveAttribute('data-value', '10');
    await expect(page.getByTestId('waterfall')).toHaveAttribute('data-closes', 'true');
    await page.getByTestId('actuals-provenance').locator('summary').click();
    await expect(page.getByTestId('provenance-slice')).toContainText('coverage');
    expect(writes).toEqual([]); // KPI03: opening the dashboard writes nothing

    await page.getByTestId('add-manual-line').click();
    await page.fill('#manualQuantity', '10');
    await page.locator(`[data-testid="evidence-event"][data-event-id="${world.stops.a}"]`).click();
    await page.getByTestId('manual-line-add').click();
    await page.getByTestId('save-lines').click();
    await expect(figure(page, 'residual')).toHaveAttribute('data-value', '0');
    await expect(row(page, world.periods.a)).toHaveAttribute('data-residual-state', 'balanced');

    // a stale tab of the same engineer still shows the draft after this tab submits
    const stale = await staleTab(browser, NOAH, world.periods.a);
    await expect(stale.getByTestId('wf-submit')).toBeEnabled();
    await page.getByTestId('wf-submit').click();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await expect(row(page, world.periods.a)).toHaveAttribute('data-workflow', 'in_review');
    await page.screenshot({ path: test.info().outputPath('engineer-period-submitted.png') });

    await stale.getByTestId('wf-submit').click();
    const problem = stale.getByTestId('workflow-problem');
    await expect(problem).toHaveAttribute('data-code', 'INVALID_TRANSITION');
    await expect(problem).toContainText('in_review accounting revision cannot become in_review');
    await stale.context().close();

    await page.reload();
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review', { timeout: 60_000 });
    await expect(page.getByTestId('wf-submit')).toHaveCount(0);
    // an engineer is not an approver: no Approve control or approve gate is shown, even to the submitter;
    // the server refuses the engineer's approval by role (403 FORBIDDEN_ROLE, before separation of duties)
    await expectHidden(page.getByTestId('wf-approve'));
    await expectHidden(page.getByTestId('approve-gate'));
    const noahApi = await apiSession(NOAH);
    const review = await call<{ revision: { revision: number; submittedHash: string | null } }>(noahApi.token, 'GET', `/v2/production-periods/${world.periods.a}/reconciliation`);
    expectRefused(await command(noahApi.token, `/v2/production-periods/${world.periods.a}/approve`, { revision: review.body.revision.revision, submittedHash: review.body.revision.submittedHash ?? '' }), 'FORBIDDEN_ROLE');
    await expect(page.getByTestId('revision-history').locator('[data-action="submit"]')).toBeVisible();
    const view = await call<{ revision: { lifecycle: string }; lines: unknown[] }>((await apiSession(NOAH)).token, 'GET', `/v2/production-periods/${world.periods.a}/reconciliation`);
    expect(view.body.revision.lifecycle).toBe('in_review');
    expect(view.body.lines).toHaveLength(3);
  });

  test('J3 Aisha proposes an actuals adjustment (PERIOD_WRITERS); the engineers cannot approve it (403) and the proposal shows in the provenance', async ({ page }) => {
    const view = await reconciliation(aisha.token, world.periods.b);
    const proposal = await command<{ id: string; state: string; createdBy: string }>(aisha.token, '/v2/actuals/adjustments', {
      sliceId: view.slices[0].sliceId,
      kind: 'good',
      quantity: '-5',
      basis: 'measured',
      reason: `P-ENG weighbridge correction ${world.suffix}`,
      evidenceRef: `P-ENG-WB-${world.suffix}`,
    });
    expect(proposal.status).toBe(201);
    expect(proposal.body.state).toBe('proposed');

    const noah = await apiSession(NOAH);
    for (const engineer of [noah, aisha]) {
      const refused = await command<{ code: string }>(engineer.token, `/v2/actuals/adjustments/${proposal.body.id}/approve`, {});
      expect([refused.status, refused.body.code]).toEqual([403, 'FORBIDDEN_ROLE']);
    }
    const stored = await call<{ state: string }>(noah.token, 'GET', `/v2/actuals/adjustments/${proposal.body.id}`);
    expect(stored.body.state).toBe('proposed');

    await loginViaUI(page, NOAH.email, NOAH.password);
    await openPeriod(page, world.periods.b);
    await page.getByTestId('actuals-provenance').locator('summary').click();
    const provenance = page.getByTestId('actuals-provenance');
    await expect(provenance).toContainText('Adjustments: good -5');
    await expect(provenance).toContainText('(proposed)');
    // UX observation: the v2 period workspace has no control to propose or decide an adjustment; the
    // persona's "cannot approve" is therefore the API 403 above, and the screen shows the proposal only.
    await expect(page.getByTestId('period-detail')).not.toContainText('Approve adjustment');
  });

  test('J7 Mateo (another engineer of the plant) sees the submitted accounting and the proposal after his own login', async ({ page }) => {
    await loginViaUI(page, MATEO.email, MATEO.password);
    await openPeriod(page, world.periods.a);
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await expect(row(page, world.periods.a).getByTestId('cell-attributed')).toHaveText('150.00 t');
    await expect(row(page, world.periods.a)).toHaveAttribute('data-residual-state', 'balanced');
    // UX observation: the history names other users by the first 8 characters of their id, not by name
    const noah = await apiSession(NOAH);
    await expect(page.getByTestId('revision-history').locator('[data-action="submit"]')).toContainText(`user ${noah.userId.slice(0, 8)}`);
    // an engineer is not an approver: no Approve / Reject / gate is offered, and the server still refuses
    await expect(page.getByTestId('workflow-bar')).toBeVisible();
    await expectHidden(page.getByTestId('wf-approve'));
    await expectHidden(page.getByTestId('wf-reject'));
    await expectHidden(page.getByTestId('approve-gate'));
    const mateo = await apiSession(MATEO);
    const current = await call<{ revision: { revision: number; submittedHash: string | null } }>(mateo.token, 'GET', `/v2/production-periods/${world.periods.a}/reconciliation`);
    const approve = await command(mateo.token, `/v2/production-periods/${world.periods.a}/approve`, { revision: current.body.revision.revision, submittedHash: current.body.revision.submittedHash ?? '' });
    expectRefused(approve, 'FORBIDDEN_ROLE');
    await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
    await page.screenshot({ path: test.info().outputPath('engineer-approve-refused.png') });
    await openPeriod(page, world.periods.b);
    await page.getByTestId('actuals-provenance').locator('summary').click();
    await expect(page.getByTestId('actuals-provenance')).toContainText('Adjustments: good -5');
  });
});
