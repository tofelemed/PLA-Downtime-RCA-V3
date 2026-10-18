import { test, expect, type Page } from '@playwright/test';
import { call } from '../test-utils/downtime-world';
import { expandTreeNode } from './support/admin-helpers';
import {
  DEMO_PLANT_ID, LINE_1_CODE, OPERATORS, loginOperator, logoutViaHeader, session, tag, unitByCode, writeControls,
  type UnitView,
} from './support/operator-world';

/**
 * OPERATOR persona — read-only analytics, tasks and the per-user plant selection:
 * J6 Downtime Analysis (/downtime) and the v2 dashboard load read-only for the operator's unit, the
 *    filters reach the URL and the server, and no write control is offered;
 * J7 Tasks: create, complete (left in place), still completed after a re-login and on the API;
 * J8 logout / login keeps the plant selection per user and does not leak it to another user.
 */
interface TaskRecord {
  id: string;
  title: string;
  status: string;
}

interface World {
  carlos: { token: string; userId: string };
  line1: UnitView;
}

const world = {} as World;

const plantSelector = (page: Page) => page.locator('header button').filter({ hasText: /Demo Org|Select Plant/ }).first();

async function pickUnitInPlantSelector(page: Page, unitName: string): Promise<void> {
  await plantSelector(page).click();
  const tree = page.getByRole('dialog');
  await expect(tree.getByText('Demo Org', { exact: true })).toBeVisible();
  // chevron buttons ("Expand <name>"); an open node stays open, its units may still be loading
  await expandTreeNode(tree, 'Demo Org');
  await expandTreeNode(tree, 'HDPE');
  await tree.getByText(unitName, { exact: true }).click();
  await expect(plantSelector(page)).toContainText(unitName);
}

test.describe('Operator — analytics, tasks and plant selection', () => {
  test.beforeAll(async () => {
    world.carlos = await session(OPERATORS.carlos);
    world.line1 = await unitByCode(world.carlos.token, LINE_1_CODE);
  });

  test('J6 Downtime Analysis and the dashboard are read-only for the operator; filters work', async ({ page }) => {
    const reportCalls: URL[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/v2/reports/')) reportCalls.push(new URL(request.url()));
    });
    await loginOperator(page, OPERATORS.carlos);
    await page.goto(`/downtime?units=${world.line1.id}`);
    await expect(page.getByTestId('downtime-analysis')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('filter-units')).toHaveAttribute('aria-label', /1 selected/);
    await expect(page.getByTestId('kpi-summary')).toBeVisible();
    await expect(page.getByTestId('kpi-summary').getByTestId('kpi-downtime_total')).toBeVisible();
    await expect(page.getByTestId('reason-pareto')).toBeVisible();
    await expect(page.getByTestId('state-timeline')).toBeVisible();
    await expect.poll(() => reportCalls.some((url) => url.searchParams.getAll('unitIds').includes(world.line1.id))).toBe(true);
    expect(reportCalls.every((url) => !url.searchParams.has('tenantId'))).toBe(true);

    // filters: trend grouping and schedule class reach the URL and the next report calls
    await page.locator('#downtime-trend').selectOption('shift');
    await expect.poll(() => new URL(page.url()).searchParams.get('trend')).toBe('shift');
    await page.locator('#downtime-class').selectOption('unplanned');
    await expect.poll(() => new URL(page.url()).searchParams.get('class')).toBe('unplanned');
    // by value: the placeholder option carries the current label, so a label match would hit it
    await page.getByTestId('downtime-window').selectOption('30d');
    await expect.poll(() => new URL(page.url()).searchParams.get('window')).toBe('30d'); // A-5: a rolling window stays relative in the URL
    await expect(page.getByTestId('downtime-analysis')).toBeVisible();
    await expect(writeControls(page)).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('operator-downtime-j6.png'), fullPage: true });

    // the v2 dashboard: tiles load, nothing to write
    await page.goto('/dashboard');
    await expect(page.getByTestId('analytics-dashboard')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('scope-header')).toContainText('All units in your scope');
    await expect(page.getByTestId('dashboard-oee-operational')).toBeVisible();
    await expect(page.getByTestId('dashboard-oee-reconciled')).toBeVisible();
    await expect(page.locator('[role="status"][aria-label="Loading"]')).toHaveCount(0, { timeout: 30_000 });
    await expect(writeControls(page)).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('operator-dashboard-j6.png'), fullPage: true });
  });

  test('J7 Tasks: create, complete (kept), verified after a re-login and on the API', async ({ page }) => {
    const title = tag('J7-task');
    await loginOperator(page, OPERATORS.carlos);
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: 'New task' }).click();
    // the task form is a page (`/tasks/new`); the assignee defaults to the operator
    await expect(page.getByRole('heading', { name: 'New task', level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Description').fill('P-OPS operator task: check the line after the stop');
    await page.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.goto('/tasks');
    await page.getByLabel('Search tasks').fill(title);
    const taskRow = page.locator('tr', { hasText: title });
    await expect(taskRow).toBeVisible({ timeout: 30_000 });
    await expect(taskRow).toContainText('Open');

    await taskRow.getByRole('button', { name: /^Mark .* complete$/ }).click();
    await expect(taskRow).toContainText('Completed');
    await expect(taskRow.getByRole('button', { name: /^Mark .* complete$/ })).toHaveCount(0);

    // re-login: still there and still completed; the API agrees
    await logoutViaHeader(page);
    await loginOperator(page, OPERATORS.carlos);
    await page.goto('/tasks');
    // the list is paged: find the task by its title, as above
    await page.getByLabel('Search tasks').fill(title);
    await expect(page.locator('tr', { hasText: title })).toContainText('Completed', { timeout: 30_000 });
    const tasks = await call<TaskRecord[]>(world.carlos.token, 'GET', `/tasks?tenantId=${DEMO_PLANT_ID}`);
    const mine = tasks.body.find((task) => task.title === title);
    expect(mine?.status).toBe('Completed');
  });

  test('J8 logout / login keeps the plant selection per user and does not leak it to another user', async ({ page }) => {
    await loginOperator(page, OPERATORS.amir);
    await expect(plantSelector(page)).toContainText('HDPE', { timeout: 30_000 });
    await pickUnitInPlantSelector(page, world.line1.name);
    const amir = await session(OPERATORS.amir);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), `proact.plantSelection.${amir.userId}`);
    expect(stored).toContain(world.line1.id);

    await logoutViaHeader(page);
    await loginOperator(page, OPERATORS.amir);
    await expect(plantSelector(page)).toContainText(world.line1.name, { timeout: 30_000 });
    await page.reload();
    await expect(plantSelector(page)).toContainText(world.line1.name, { timeout: 30_000 });

    // another operator in the same browser starts from the default plant, not from Amir's unit
    await logoutViaHeader(page);
    await loginOperator(page, OPERATORS.ingrid);
    await expect(plantSelector(page)).toContainText('HDPE', { timeout: 30_000 });
    await expect(plantSelector(page)).not.toContainText(world.line1.name);
  });
});
