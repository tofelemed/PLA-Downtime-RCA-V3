import { test, expect } from '@playwright/test';
import { openPeriodSection } from '../test-utils/period-sections';
import type { MonthCloseView } from '../../src/api/v2/types/month-close';
import type { PeriodSlaDetailView, QueueItemView } from '../../src/api/v2/types/period-sla';
import type { ChangeProposalView } from '../../src/api/v2/types/reconciliation';
import { apiLogin, call, command, PLANTS, selectPlant, signIn, signOut } from './support/admin-helpers';
import {
  ACCOUNTING_USERS, approveOtherShifts, openAccountingPeriod, readDay, readReconciliation,
  reviseThroughUi, seedAccountingWorld, type AccountingWorld,
} from './support/hdpe-accounting-world';

let world: AccountingWorld;
test.describe.configure({ mode: 'serial', timeout: 180_000 });
test.beforeAll(async () => {
  test.setTimeout(360_000);
  world = await seedAccountingWorld();
});

test('accountant queue agrees with the server and opens the selected period', async ({ page }) => {
  await signIn(page, ACCOUNTING_USERS.accountant);
  const response = page.waitForResponse((r) => r.url().includes('/v2/reconciliation-queue?') && r.status() === 200);
  await page.goto('/my-queue');
  const list = await (await response).json() as { items: QueueItemView[] };
  await expect(page.getByTestId('my-queue')).toBeVisible();
  expect(list.items.length).toBeGreaterThan(0);
  await expect(page.getByTestId('queue-row')).toHaveCount(list.items.length);
  const selected = list.items.find((item) => item.planId !== null);
  expect(selected, 'a queued plan period is available').toBeDefined();
  const row = page.getByRole('row').filter({ has: page.locator(`[data-testid="queue-row"][data-period-id="${selected!.periodId}"]`) });
  await expect(row.getByTestId('queue-task')).toHaveAttribute('data-task', selected!.task);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/plans/${selected!.planId}/periods/${selected!.periodId}$`));
  await expect(page.getByTestId('period-detail')).toBeVisible();
  await openPeriodSection(page, 'Review & close');
  await expect(page.getByTestId('sla-panel')).toBeVisible();
  const read = await readReconciliation(world.accountant.token, selected!.periodId);
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', read.revision.lifecycle);
});

test('a data hold pauses and resumes the dedicated period, then submission refuses self approval', async ({ page }) => {
  await signIn(page, ACCOUNTING_USERS.author);
  await openAccountingPeriod(page, world);
  await expect(page.getByTestId('day-certification')).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('day-certify')).toHaveCount(0);
  await page.getByTestId('hold-open').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Start waiting', exact: true })).toBeDisabled();
  await page.getByTestId('hold-kind-lab').check();
  const reason = `Demo: laboratory certificate UI ${world.fixture.suffix}`;
  await page.getByTestId('hold-text').fill(reason);
  await dialog.getByRole('button', { name: 'Start waiting', exact: true }).click();
  await expect(page.getByTestId('sla-hold')).toContainText(reason);
  const path = `/v2/production-periods/${world.fixture.periods.a}/sla`;
  const held = await call<PeriodSlaDetailView>(world.author.token, 'GET', path);
  expect(held.status).toBe(200);
  expect(held.body.sla).toMatchObject({ onHold: true, stage: 'waiting_for_data' });
  await page.getByTestId('hold-release').click();
  await page.getByTestId('hold-text').fill('Demo: approved laboratory result received');
  await dialog.getByRole('button', { name: 'Release the hold', exact: true }).click();
  await expect(page.getByTestId('hold-open')).toBeVisible();
  const released = await call<PeriodSlaDetailView>(world.author.token, 'GET', path);
  expect(released.body.sla.onHold).toBe(false);
  expect(released.body.holds.find((hold) => hold.reason === reason)).toMatchObject({ endNote: 'Demo: approved laboratory result received' });
  expect(released.body.holds.find((hold) => hold.reason === reason)?.endedAt).toBeTruthy();
  await page.getByTestId('wf-submit').click();
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'in_review');
  await expect(page.getByTestId('wf-approve')).toBeDisabled();
  await expect(page.getByTestId('approve-gate')).toHaveAttribute('data-code', 'SEPARATION_OF_DUTIES');
  const submitted = await readReconciliation(world.author.token, world.fixture.periods.a);
  const denied = await command<{ code: string }>(world.author.token, `/v2/production-periods/${world.fixture.periods.a}/approve`, {
    revision: submitted.revision.revision, submittedHash: submitted.revision.submittedHash,
  });
  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe('SEPARATION_OF_DUTIES');
});

test('workflow and revision filters query the server; a different manager approves through the UI', async ({ page }) => {
  await signIn(page, ACCOUNTING_USERS.checker);
  await page.goto(`/plans/${world.fixture.planId}`);
  await expect(page.getByTestId('period-grid')).toBeVisible();
  const filtered = page.waitForRequest((r) => r.url().includes('/v2/period-summaries?') && r.url().includes('in_review'));
  await page.locator('#gridWorkflow').selectOption('in_review');
  await filtered;
  await expect(page.getByTestId('period-row')).toHaveCount(1);
  const approved = page.waitForRequest((r) => r.url().includes('/v2/period-summaries?') && new URL(r.url()).searchParams.get('view') === 'approved');
  await page.locator('#gridView').selectOption('approved');
  await approved;
  await expect(page.getByTestId('period-row')).toHaveCount(0);
  await page.locator('#gridView').selectOption('current');
  const marker = page.locator(`[data-testid="period-row"][data-period-id="${world.fixture.periods.a}"]`);
  await expect(marker).toBeVisible();
  await marker.click();
  await openPeriodSection(page, 'Review & close');
  await expect(page.getByTestId('wf-approve')).toBeEnabled();
  await page.getByTestId('wf-approve').click();
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved');
  const saved = await readReconciliation(world.checker.token, world.fixture.periods.a);
  expect(saved.revision).toMatchObject({ lifecycle: 'approved', submittedBy: world.author.user.id, approvedBy: world.checker.user.id });
  await page.reload();
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'approved');
});

test('day certification enforces independence, and a UI revision reopens the certified day', async ({ page }) => {
  await approveOtherShifts(world);
  expect((await readDay(world)).state).toBe('ready');
  await signIn(page, ACCOUNTING_USERS.author);
  await openAccountingPeriod(page, world);
  await expect(page.getByTestId('day-certify')).toBeDisabled();
  await expect(page.getByTestId('day-certification')).toContainText('You submitted a shift of this day; another manager certifies it.');
  const own = await command<{ code: string }>(world.author.token, `/v2/production-days/${world.fixture.unitId}/${world.localDate}/certify`, {});
  expect(own.status).toBe(403);
  expect(own.body.code).toBe('SEPARATION_OF_DUTIES');
  await signOut(page);
  await signIn(page, ACCOUNTING_USERS.checker);
  await openAccountingPeriod(page, world);
  await page.getByTestId('day-certify').click();
  await expect(page.getByTestId('day-certification')).toHaveAttribute('data-state', 'certified');
  const certified = await readDay(world);
  expect(certified.certification?.certifiedBy).toBe(world.checker.user.id);
  expect(certified.periods).toHaveLength(3);
  expect(await reviseThroughUi(page, 'Demo: investigate a corrected scale record on the disposable test period')).toBe(201);
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', 'draft');
  await expect(page.getByTestId('day-certification')).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('day-reopened')).toBeVisible();
  const reopened = await readDay(world);
  expect(reopened.certification).toMatchObject({ state: 'reopened', reopenedBy: world.checker.user.id });
});

test('month navigation shows blocked current prerequisites and server-defined month boundaries', async ({ page }) => {
  const current = await call<MonthCloseView>(world.author.token, 'GET', '/v2/month-closes/current');
  expect(current.status).toBe(200);
  expect(current.body.state).toBe('open');
  expect(current.body.prerequisites.met).toBe(false);
  await signIn(page, ACCOUNTING_USERS.author);
  await page.goto('/month-close');
  await expect(page.getByTestId('close-prerequisites')).toHaveAttribute('data-met', 'false');
  await expect(page.getByTestId('step-close-quantities')).toBeDisabled();
  await expect(page.getByTestId('close-blocked')).toBeVisible();
  await page.getByTestId('month-previous').click();
  await expect(page).toHaveURL(new RegExp(`month=${current.body.previousMonthKey}`));
  const previous = await call<MonthCloseView>(world.author.token, 'GET', `/v2/month-closes/${current.body.previousMonthKey}`);
  expect(previous.status).toBe(200);
  await expect(page.getByTestId('month-label')).toContainText(previous.body.monthKey);
  expect(previous.body.endDate).toBe(current.body.firstDate);
  await page.getByTestId('month-next').click();
  await expect(page.getByTestId('month-label')).toContainText(current.body.monthKey);
  await expect(page.getByTestId('close-prerequisites')).toHaveAttribute('data-met', 'false');
});

test('correction evidence is required and an open month refuses the proposed correction without storing it', async ({ page }) => {
  const periodId = world.fixture.periods.b;
  const path = `/v2/production-periods/${periodId}/change-proposals`;
  const before = await call<{ items: ChangeProposalView[] }>(world.accountant.token, 'GET', path);
  expect(before.status).toBe(200);
  await signIn(page, ACCOUNTING_USERS.accountant);
  await openAccountingPeriod(page, world, periodId);
  await openPeriodSection(page, 'History & exports');
  await page.getByTestId('propose-correction').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Propose correction', exact: true })).toBeDisabled();
  await page.getByTestId('correction-reason').fill('Demo: open-month correction must use the normal revision workflow');
  await page.getByTestId('correction-evidence-type').selectOption('log');
  await page.getByTestId('correction-evidence-ref').fill(`DEMO-UI-OPEN-${world.fixture.suffix}`);
  const refusal = page.waitForResponse((r) => r.url().endsWith('/v2/period-change-proposals') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Propose correction', exact: true }).click();
  expect((await refusal).status()).toBe(409);
  await expect(page.getByTestId('workflow-problem')).toHaveAttribute('data-code', 'MONTH_OPEN');
  await expect(dialog).toBeVisible();
  const after = await call<{ items: ChangeProposalView[] }>(world.accountant.token, 'GET', path);
  expect(after.status).toBe(200);
  expect(after.body.items.map((item) => item.id)).toEqual(before.body.items.map((item) => item.id));
  expect((await readReconciliation(world.accountant.token, periodId)).revision.lifecycle).toBe('approved');
});

test('a viewer reads the accounting data but has no hold, submit, approve, revise or correction controls', async ({ page }) => {
  await signIn(page, ACCOUNTING_USERS.viewer);
  await selectPlant(page, PLANTS.demo);
  await openAccountingPeriod(page, world);
  for (const id of ['hold-open', 'hold-release', 'wf-submit', 'wf-approve', 'wf-revise', 'day-certify']) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
  await openPeriodSection(page, 'History & exports');
  await expect(page.getByTestId('propose-correction')).toHaveCount(0);
  const viewer = await apiLogin(ACCOUNTING_USERS.viewer);
  const view = await readReconciliation(viewer.token, world.fixture.periods.a, PLANTS.demo.id);
  const denied = await command<{ code: string }>(viewer.token, `/v2/production-periods/${world.fixture.periods.a}/submit`, {
    revision: view.revision.revision, runId: view.baseRunId, contentHash: view.contentHash,
  }, { 'X-Tenant-Id': PLANTS.demo.id });
  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe('FORBIDDEN_ROLE');
});
