import { test, expect, type Page } from '@playwright/test';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call } from './test-utils/downtime-world';

/**
 * Accessibility gate (owner 15 Oct, `@axe-core/playwright`): every main page is scanned with axe against
 * WCAG 2.1 A / AA and the test fails on any serious or critical violation (moderate / minor ones are
 * printed, not failed). Pages that need a record (event, period, RCA case) open the first one the
 * manager can read; without one the scan is skipped with a note rather than failed.
 */
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
/** owner 18 Oct 2026: Integration is SuperAdmin-only, so its pages are scanned as the SuperAdmin */
const SUPER_ADMIN = { email: 'test@example.com', password: 'Test123!@#' };
const FLAGS = ['v2.eventHub', 'v2.downtimeAnalysis', 'v2.plaAnalytics', 'v2.planDashboard', 'v2.rca'];
const BLOCKING = new Set(['serious', 'critical']);
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface ListPage<T> {
  items?: T[];
}

/** What the spec reads of an axe result (typed here so the e2e typecheck does not need the package types). */
interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: Array<{ target: unknown[] }>;
}

interface AxeBuilderLike {
  withTags(tags: string[]): AxeBuilderLike;
  analyze(): Promise<{ violations: AxeViolation[] }>;
}

type AxeBuilderConstructor = new (options: { page: Page }) => AxeBuilderLike;

/** The package name in a variable: loaded at run time (root devDependency @axe-core/playwright). */
const AXE_MODULE = '@axe-core/playwright';

async function axeBuilder(page: Page): Promise<AxeBuilderLike> {
  const loaded = (await import(AXE_MODULE)) as { default?: unknown; AxeBuilder?: unknown };
  const Builder = (loaded.AxeBuilder ?? loaded.default) as AxeBuilderConstructor | undefined;
  if (typeof Builder !== 'function') throw new Error('@axe-core/playwright is not installed');
  return new Builder({ page });
}

let token = '';

async function firstId<T extends { id: string }>(path: string): Promise<T | null> {
  const result = await call<ListPage<T>>(token, 'GET', path);
  return result.status === 200 ? (result.body.items?.[0] ?? null) : null;
}

async function scan(page: Page, path: string, ready: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 60_000 });
  // let lazy cards and charts settle before the scan
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const results = await (await axeBuilder(page)).withTags(WCAG).analyze();
  const blocking = results.violations.filter((v) => v.impact && BLOCKING.has(v.impact));
  const other = results.violations.filter((v) => !v.impact || !BLOCKING.has(v.impact));
  if (other.length > 0) test.info().annotations.push({ type: 'a11y-minor', description: other.map((v) => `${v.id} (${v.nodes.length})`).join(', ') });
  const summary = blocking.map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 5).map((n) => n.target.map(String).join(' ')) }));
  expect(summary, `serious / critical axe violations on ${path}`).toEqual([]);
}

test.describe('Accessibility of the main pages (axe, WCAG 2.1 AA, serious / critical fail)', () => {
  test.beforeAll(async () => {
    token = (await authenticate(MANAGER.email, MANAGER.password)).accessToken;
    for (const flag of FLAGS) await call(token, 'PUT', `/v2/feature-flags/${flag}`, { enabled: true });
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
  });

  const STATIC_PAGES: ReadonlyArray<[string, string, string]> = [
    ['Event Hub', '/events', 'main'],
    ['Downtime', '/downtime', '[data-testid="downtime-analysis"]'],
    ['PLA analytics', '/pla-analytics', '[data-testid="analytics-filters"]'],
    ['Reports', '/reports', '[data-testid="reports-v2"]'],
    ['Dashboard', '/dashboard', '[data-testid="analytics-dashboard"]'],
    ['Month close', '/month-close', 'main'],
    ['Master data', '/master-data', 'main'],
    ['Planning', '/planning', '[data-testid="planning-page"]'],
    ['Finance', '/finance', 'main'],
    ['Uncertainty budgets', '/measurement-uncertainty', 'main'],
    ['Delegations', '/delegations', 'main'],
    ['Codes & rules', '/master-data/codes-rules', 'main'],
    ['Tasks', '/tasks', 'main'],
    ['Settings', '/admin?tab=settings', 'main'],
  ];

  for (const [name, path, ready] of STATIC_PAGES) {
    test(`${name} (${path})`, async ({ page }) => {
      test.setTimeout(120_000);
      await scan(page, path, ready);
    });
  }

  test('event page', async ({ page }) => {
    const event = await firstId<{ id: string }>('/v2/production-events?limit=1&sort=-startTime');
    test.skip(!event, 'no production event in the demo plant');
    await scan(page, `/events/${event!.id}`, 'main');
  });

  test('Plan dashboard period', async ({ page }) => {
    test.setTimeout(120_000);
    const plans = await call<ListPage<{ id: string; name: string; version: { approvalState: string } }>>(token, 'GET', '/v2/production-plans?limit=200');
    const plan = plans.body.items?.find((item) => item.name.startsWith('unit100') && item.version.approvalState === 'approved');
    expect(plan, 'the approved HDPE monthly plan must be present').toBeDefined();
    await page.goto(`/plans/${plan!.id}`);
    const period = page.getByTestId('period-row').first();
    await expect(period).toBeVisible({ timeout: 60_000 });
    await period.click();
    await expect(page).toHaveURL(/\/plans\/.+\/periods\/.+/);
    await scan(page, new URL(page.url()).pathname, '[data-testid="period-detail"]');
  });

  test('RCA case', async ({ page }) => {
    const rca = await firstId<{ id: string }>('/v2/rcas?limit=1');
    test.skip(!rca, 'no RCA case in the demo plant');
    await scan(page, `/rca/${rca!.id}`, 'main');
  });
});

test.describe('Accessibility of the Integration pages (SuperAdmin only, owner 18 Oct 2026)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
  });

  const INTEGRATION_PAGES: ReadonlyArray<[string, string, string]> = [
    ['Source priority', '/connectivity/source-authority', 'main'],
    ['Connectivity', '/connectivity', '[data-testid="integration-console"]'],
  ];

  for (const [name, path, ready] of INTEGRATION_PAGES) {
    test(`${name} (${path})`, async ({ page }) => {
      test.setTimeout(120_000);
      await scan(page, path, ready);
    });
  }
});
