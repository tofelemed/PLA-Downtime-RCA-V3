import { expect, type Page } from '@playwright/test';
import type { ReconciliationView } from '../../../src/api/v2/types/reconciliation';
import type { DayView } from '../../../src/api/v2/types/production-day';
import { seedDashboardWorld, type DashboardWorld } from '../../test-utils/dashboard-world';
import { apiLogin, call, command, type ApiSession } from './admin-helpers';

export const ACCOUNTING_USERS = {
  author: 'jonas.weber@demo.acme.com',
  checker: 'fatima.haddad@demo.acme.com',
  accountant: 'sara.nouri@demo.acme.com',
  viewer: 'grace.whitfield@demo.acme.com',
} as const;

export interface AccountingWorld {
  fixture: DashboardWorld;
  author: ApiSession;
  checker: ApiSession;
  accountant: ApiSession;
  localDate: string;
}

export async function readReconciliation(token: string, periodId: string, tenantId?: string): Promise<ReconciliationView> {
  const read = await call<ReconciliationView>(token, 'GET', `/v2/production-periods/${periodId}/reconciliation`, undefined,
    tenantId ? { 'X-Tenant-Id': tenantId } : {});
  expect(read.status, 'read period reconciliation').toBe(200);
  return read.body;
}

async function balanceDraft(world: AccountingWorld, periodId: string): Promise<void> {
  const view = await readReconciliation(world.author.token, periodId);
  const saved = await call(world.author.token, 'PUT', `/v2/production-periods/${periodId}/draft-lines`, {
    revision: view.revision.revision, baseRunId: view.baseRunId,
    lines: [
      ...view.candidates.map((candidate) => ({ action: 'accept', autoKey: candidate.autoKey })),
      { action: 'manual', sliceId: view.slices[0].sliceId, kind: 'availability', quantity: view.candidates.length ? '60' : '150',
      missingEvent: true, evidenceType: 'log', evidenceRef: `Demo: accounting UI ${world.fixture.suffix}`,
      reasonCodeId: world.fixture.reasonCodeId }],
  }, { 'If-Match': `"${view.rowVersion}"` });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
}

/** New unit/plan only; no shared HDPE period, settings or cache is changed. */
export async function seedAccountingWorld(): Promise<AccountingWorld> {
  const [author, checker, accountant] = await Promise.all([
    apiLogin(ACCOUNTING_USERS.author), apiLogin(ACCOUNTING_USERS.checker), apiLogin(ACCOUNTING_USERS.accountant),
  ]);
  expect(author.user.tenantId).toBeTruthy();
  const fixture = await seedDashboardWorld(author.token, author.user.tenantId!);
  const world = { fixture, author, checker, accountant, localDate: new Date(fixture.dayStart).toISOString().slice(0, 10) };
  for (const periodId of Object.values(fixture.periods)) await balanceDraft(world, periodId);
  return world;
}

/** API setup for the other shifts; the first shift's submit/approve is exercised through UI. */
export async function approveOtherShifts(world: AccountingWorld): Promise<void> {
  for (const periodId of [world.fixture.periods.b, world.fixture.periods.c]) {
    const view = await readReconciliation(world.author.token, periodId);
    const submitted = await command<ReconciliationView>(world.author.token, `/v2/production-periods/${periodId}/submit`, {
      revision: view.revision.revision, runId: view.baseRunId, contentHash: view.contentHash,
    });
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
    const approved = await command(world.checker.token, `/v2/production-periods/${periodId}/approve`, {
      revision: submitted.body.revision.revision, submittedHash: submitted.body.revision.submittedHash,
    });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  }
}

export async function readDay(world: AccountingWorld): Promise<DayView> {
  const read = await call<DayView>(world.author.token, 'GET', `/v2/production-days/${world.fixture.unitId}/${world.localDate}`);
  expect(read.status).toBe(200);
  return read.body;
}

export async function openAccountingPeriod(page: Page, world: AccountingWorld, periodId = world.fixture.periods.a): Promise<void> {
  await page.goto(`/plans/${world.fixture.planId}/periods/${periodId}`);
  await expect(page.getByTestId('period-detail')).toHaveAttribute('data-lifecycle', /.+/, { timeout: 60_000 });
  await expect(page.getByTestId('day-certification')).toBeVisible({ timeout: 60_000 });
}

export async function reviseThroughUi(page: Page, reason: string): Promise<number> {
  await page.getByTestId('wf-revise').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Reopen for revision', exact: true })).toBeDisabled();
  await dialog.getByTestId('wf-reason').fill(reason);
  const response = page.waitForResponse((r) => /\/production-periods\/[^/]+\/revise$/.test(r.url()) && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Reopen for revision', exact: true }).click();
  return (await response).status();
}
