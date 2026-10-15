import { test, expect } from '@playwright/test';
import { apiLogin, call, command, DEMO_PLANT, loadState, newSuffix, PREFIX, REL_USERS, uiLogin, type RelSession } from './support/reliability-world';
import { MANAGERS } from './support/manager-users';
import { acceptInvestigation, addVerifiedAction, finishActions, moveCase, prepareInvestigation } from './support/rca-workflow';

/**
 * RELIABILITY ENGINEER persona — journey 5, the RCA knowledge base (`/rca-knowledge-base`) as Leila:
 * the entry the server wrote when a case was closed (plan 3.9 step 4) is found by search, opens with the
 * case's root cause, and a helpful vote is kept once per user (v2 screen behind `v2.rca`, owner decision
 * 2026-10-12; publish is offered to RCA writers). The entry comes from
 * `reliability-rca-case.spec.ts` (state file); when that file did not run, Leila opens a case of her own
 * through the v2 API and takes it through the case workflow (RCA-01 / SME CA1: a verified action, closure
 * requested by her, approved by Jonas, a manager approver independent of the investigation).
 */
interface KnowledgeEntry {
  id: string;
  rcaId: string;
  title: string;
  rootCause: string | null;
  isPublished: boolean;
  helpfulVotes: number;
  author: string | null;
}

let leila: RelSession;
let caseId = '';
let caseTitle = '';
let rootCause = '';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

async function ensureClosedCase(): Promise<void> {
  const state = loadState();
  const existing = state?.closed ? await call<{ status: string }>(leila.token, 'GET', `/v2/rcas/${state.caseId}`) : null;
  if (state?.closed && existing?.status === 200 && existing.body.status === 'Closed') {
    caseId = state.caseId;
    caseTitle = state.caseTitle;
    rootCause = 'Coupling misalignment';
    return;
  }
  const suffix = newSuffix();
  caseTitle = `${PREFIX}kb-case-${suffix}`;
  rootCause = `${PREFIX}root cause ${suffix}`;
  const created = await command<{ id: string; rowVersion: number }>(leila.token, '/v2/rcas', {
    title: caseTitle,
    description: 'Opened by the knowledge-base journey because the case journey had not run',
    rootCause,
    recommendations: [{ title: 'Inspect the coupling after every seal change' }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  caseId = created.body.id;
  const jonas = await apiLogin(MANAGERS.jonas.email);
  await addVerifiedAction(leila.token, caseId, `${PREFIX}kb-action-${suffix}`);
  await prepareInvestigation(leila.token, caseId, rootCause);
  await finishActions(leila.token, jonas.token, caseId);
  await acceptInvestigation(leila.token, caseId);
  const requested = await moveCase(leila.token, caseId, { to: 'Closure Review', residualRisk: 'Coupling alignment checked at each PM' });
  expect(requested.status, JSON.stringify(requested.body)).toBe(200);
  const closed = await moveCase(jonas.token, caseId, { to: 'Closed' });
  expect(closed.status, JSON.stringify(closed.body)).toBe(200);
}

test.describe('Reliability engineer — RCA knowledge base (journey 5)', () => {
  test.beforeAll(async () => {
    leila = await apiLogin(REL_USERS.leila);
    expect(leila.tenantId).toBe(DEMO_PLANT);
    await ensureClosedCase();
  });

  test('J5a (leila): closing a case produced one unpublished knowledge entry carrying the case content', async () => {
    // v2 list of the acting plant (the v1 `/rca-knowledge-base` route is retired)
    const entries = await call<{ items: KnowledgeEntry[] }>(leila.token, 'GET', `/v2/rca-knowledge?q=${encodeURIComponent(caseTitle)}`);
    expect(entries.status).toBe(200);
    const mine = entries.body.items.filter((entry) => entry.rcaId === caseId);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: caseTitle, rootCause, isPublished: false });
    expect(mine[0].author, 'attributed to the person who closed the case').toBeTruthy();
  });

  test('J5b (leila): the v2 screen finds the entry on the server, opens it with the root cause, keeps one helpful vote', async ({ page }) => {
    await uiLogin(page, REL_USERS.leila);
    await page.goto('/rca-knowledge-base');
    await expect(page.getByRole('heading', { name: 'RCA Knowledge Base' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('rca-knowledge-v2')).toBeVisible();
    await page.getByLabel('Search knowledge entries').fill(caseTitle);
    const row = page.getByTestId('knowledge-list').getByRole('row', { name: `Open entry ${caseTitle}` });
    await expect(row).toBeVisible();
    await row.click();
    const detail = page.getByTestId('knowledge-detail');
    await expect(detail.getByRole('heading', { name: caseTitle })).toBeVisible();
    await expect(detail).toContainText(rootCause);
    await detail.getByRole('button', { name: 'Quality' }).click(); // secondary detail behind a disclosure
    await expect(detail.getByTestId('quality-breakdown')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('j5-knowledge-entry.png'), fullPage: true });

    const entryOf = async () =>
      (await call<{ items: Array<KnowledgeEntry & { myVote: string | null; helpfulCount: number }> }>(
        leila.token,
        'GET',
        `/v2/rca-knowledge?q=${encodeURIComponent(caseTitle)}`,
      )).body.items.find((entry) => entry.rcaId === caseId);
    await detail.getByRole('button', { name: /^Helpful/ }).click();
    await expect.poll(async () => (await entryOf())?.myVote).toBe('helpful');
    const once = (await entryOf())?.helpfulCount ?? 0;
    await detail.getByRole('button', { name: /^Helpful/ }).click();
    await expect.poll(async () => (await entryOf())?.helpfulCount, { message: 'one vote per user' }).toBe(once);
    await expect(detail.getByTestId('knowledge-publish'), 'a reliability engineer may publish').toBeVisible();
  });

  test('J5c (leila): the knowledge base offers no manual entry form; entries are born from closed cases only', async ({ page }) => {
    await uiLogin(page, REL_USERS.leila);
    await page.goto('/rca-knowledge-base');
    await expect(page.getByRole('heading', { name: 'RCA Knowledge Base' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: /new entry|add entry|create entry|new template/i })).toHaveCount(0);
    await expect(page.getByTestId('knowledge-filters')).toBeVisible();
  });
});
