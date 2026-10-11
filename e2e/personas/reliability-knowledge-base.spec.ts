import { test, expect } from '@playwright/test';
import { apiLogin, call, command, DEMO_PLANT, loadState, newSuffix, PREFIX, REL_USERS, uiLogin, type RelSession } from './support/reliability-world';

/**
 * RELIABILITY ENGINEER persona — journey 5, the RCA knowledge base (`/rca-knowledge-base`) as Leila:
 * the entry the server wrote when a case was closed (plan 3.9 step 4) is found by search, opens with the
 * case's root cause, and the only write the screen offers (a helpful vote) is kept. The entry comes from
 * `reliability-rca-case.spec.ts` (state file); when that file did not run, Leila opens and closes a case
 * of her own through the v2 API so the journey still has its closed case.
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
  if (state?.closed) {
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
  const closed = await call(leila.token, 'PATCH', `/v2/rcas/${caseId}`, { status: 'Closed' }, { 'If-Match': `"${created.body.rowVersion}"` });
  expect(closed.status, JSON.stringify(closed.body)).toBe(200);
}

test.describe('Reliability engineer — RCA knowledge base (journey 5)', () => {
  test.beforeAll(async () => {
    leila = await apiLogin(REL_USERS.leila);
    expect(leila.tenantId).toBe(DEMO_PLANT);
    await ensureClosedCase();
  });

  test('J5a (leila): closing a case produced one unpublished knowledge entry carrying the case content', async () => {
    const entries = await call<KnowledgeEntry[]>(leila.token, 'GET', `/rca-knowledge-base?tenantId=${DEMO_PLANT}`);
    expect(entries.status).toBe(200);
    const mine = entries.body.filter((entry) => entry.rcaId === caseId);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: caseTitle, rootCause, isPublished: false });
    expect(mine[0].author, 'attributed to the person who closed the case').toBeTruthy();
  });

  test('J5b (leila): search finds the entry, it opens with the root cause, a helpful vote is kept', async ({ page }) => {
    await uiLogin(page, REL_USERS.leila);
    await page.goto('/rca-knowledge-base');
    await expect(page.getByRole('heading', { name: 'RCA Knowledge Base' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('tab', { name: 'Investigations' })).toBeVisible();
    await page.getByPlaceholder('Search by title, description, or root cause...').fill(caseTitle);
    const card = page.locator('[class*="cursor-pointer"]').filter({ hasText: caseTitle }).first();
    await expect(card).toBeVisible();
    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: caseTitle })).toBeVisible();
    await expect(dialog).toContainText(rootCause);
    await page.screenshot({ path: test.info().outputPath('j5-knowledge-entry.png'), fullPage: true });

    const before = (await call<KnowledgeEntry[]>(leila.token, 'GET', `/rca-knowledge-base?tenantId=${DEMO_PLANT}`)).body.find((entry) => entry.rcaId === caseId);
    const vote = dialog.locator('button.border-green-500').first();
    await expect(vote).toBeVisible();
    await vote.click();
    await expect(page.getByText('Voted helpful').first()).toBeVisible();
    await expect
      .poll(async () => (await call<KnowledgeEntry[]>(leila.token, 'GET', `/rca-knowledge-base?tenantId=${DEMO_PLANT}`)).body.find((entry) => entry.rcaId === caseId)?.helpfulVotes)
      .toBe((before?.helpfulVotes ?? 0) + 1);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'RCA Knowledge Base' })).toBeVisible({ timeout: 60_000 });
    await page.getByPlaceholder('Search by title, description, or root cause...').fill(caseTitle);
    await expect(page.locator('[class*="cursor-pointer"]').filter({ hasText: caseTitle }).first()).toBeVisible();
  });

  test('J5c (leila): the knowledge base offers no manual entry form; entries are born from closed cases only', async ({ page }) => {
    await uiLogin(page, REL_USERS.leila);
    await page.goto('/rca-knowledge-base');
    await expect(page.getByRole('heading', { name: 'RCA Knowledge Base' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: /new entry|add entry|create entry|new template/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });
});
