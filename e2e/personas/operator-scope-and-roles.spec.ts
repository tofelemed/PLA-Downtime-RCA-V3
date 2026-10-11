import { test, expect, type Page } from '@playwright/test';
import { call, command } from '../test-utils/downtime-world';
import {
  OPERATORS, LINE_1_CODE, LINE_2_CODE, chooseUnit, loginOperator, openHub, session, tag, unitByCode,
  type EventBody, type ListBody, type UnitView,
} from './support/operator-world';

/**
 * OPERATOR persona — what the role and the unit scope must hide or refuse:
 * J4 the unit-limited operators (ingrid, amir) see only DEMO-LINE-1 units and events; another unit's
 *    event answers the scoped 404 (never data), on the API and through the list / pickers;
 * J5 an operator (carlos) cannot plan, administer codes or finance: the menu hides the screens, the
 *    pages refuse the write with the server's 403 FORBIDDEN_ROLE, the API refuses a plan create.
 */
interface World {
  liam: string;
  ingrid: string;
  carlos: string;
  line1: UnitView;
  line2: UnitView;
  foreignEvent: EventBody;
}

const world = {} as World;

async function unitOptionsOf(page: Page, filterTestId: string): Promise<string[]> {
  await page.getByTestId(filterTestId).click();
  const names = await page.getByRole('dialog').getByRole('checkbox').evaluateAll((nodes) =>
    nodes.map((node) => node.parentElement?.textContent?.trim() ?? ''),
  );
  await page.keyboard.press('Escape');
  return names;
}

test.describe('Operator — scope and role limits', () => {
  test.beforeAll(async () => {
    world.liam = (await session(OPERATORS.liam)).token;
    world.ingrid = (await session(OPERATORS.ingrid)).token;
    world.carlos = (await session(OPERATORS.carlos)).token;
    world.line1 = await unitByCode(world.liam, LINE_1_CODE);
    world.line2 = await unitByCode(world.liam, LINE_2_CODE);
    // an event of another unit, seen by a tenant-wide operator
    const list = await call<ListBody<EventBody>>(world.liam, 'GET', `/v2/production-events?unitIds=${world.line2.id}&limit=1`);
    if (list.body.items.length === 0) {
      const created = await command<EventBody>(world.liam, '/v2/production-events', {
        unitId: world.line2.id, startTime: '2026-10-05T06:00:00.000Z', durationSeconds: 600, physicalType: 'downtime', description: tag('J4-line2'),
      });
      expect(created.status).toBe(201);
      world.foreignEvent = created.body;
    } else {
      world.foreignEvent = list.body.items[0];
    }
  });

  test('J4 unit-limited operator (ingrid): only DEMO-LINE-1 in the Event Hub; another unit\'s event is 404, never data', async ({ page }) => {
    await loginOperator(page, OPERATORS.ingrid);
    await openHub(page, null);
    await expect(page.getByTestId('scope-header')).toContainText('All units in your scope');

    // the unit picker of the filters and of the create form know one unit only
    expect(await unitOptionsOf(page, 'filter-units')).toEqual([world.line1.name]);
    await page.getByRole('button', { name: 'New event' }).click();
    const form = page.getByTestId('event-form');
    const options = await form.locator('#unitId option').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean));
    expect(options).toEqual([world.line1.id]);
    await page.keyboard.press('Escape');
    await expect(form).toBeHidden();

    // every listed event belongs to the line; the foreign event is not among them
    await chooseUnit(page, 'filter-units', world.line1.name);
    await expect(page.locator(`[data-testid="event-row"][data-event-id="${world.foreignEvent.id}"]`)).toHaveCount(0);
    const rows = page.getByTestId('event-row');
    const count = await rows.count();
    for (let i = 0; i < Math.min(count, 25); i += 1) await expect(rows.nth(i)).toContainText(world.line1.name);
    await page.screenshot({ path: test.info().outputPath('operator-scope-j4.png'), fullPage: true });

    // the API behind a direct link: scoped 404 with no event data in the body
    const direct = await call<Record<string, unknown>>(world.ingrid, 'GET', `/v2/production-events/${world.foreignEvent.id}`);
    expect(direct.status).toBe(404);
    expect(direct.body.code).toBe('NOT_FOUND');
    expect(direct.body).not.toHaveProperty('unitId');
    expect(direct.body).not.toHaveProperty('startTime');
    const foreignList = await call<ListBody<EventBody>>(world.ingrid, 'GET', `/v2/production-events?unitIds=${world.line2.id}&limit=5`);
    expect(foreignList.status === 200 ? foreignList.body.items : []).toEqual([]);
    const units = await call<ListBody<UnitView>>(world.ingrid, 'GET', '/v2/units?limit=50');
    expect(units.body.items.map((unit) => unit.code)).toEqual([LINE_1_CODE]);
    // a write on the other unit is refused without revealing it
    const write = await command<Record<string, unknown>>(world.ingrid, '/v2/production-events', {
      unitId: world.line2.id, startTime: '2026-10-05T07:00:00.000Z', durationSeconds: 60, physicalType: 'downtime', description: tag('J4-refused'),
    });
    expect([404, 422]).toContain(write.status);
    expect(write.body).not.toHaveProperty('id');
  });

  test('J4b unit-limited operator (amir): Downtime Analysis and the dashboard offer DEMO-LINE-1 only', async ({ page }) => {
    await loginOperator(page, OPERATORS.amir);
    await page.goto('/downtime');
    await expect(page.getByTestId('downtime-analysis')).toBeVisible({ timeout: 60_000 });
    expect(await unitOptionsOf(page, 'filter-units')).toEqual([world.line1.name]);
    await page.goto('/pla-analytics');
    await expect(page.getByTestId('pla-analytics-v2')).toBeVisible({ timeout: 60_000 });
    expect(await unitOptionsOf(page, 'filter-units')).toEqual([world.line1.name]);
  });

  test('J5 operator (carlos) cannot plan, administer codes or finance: hidden menu, 403 FORBIDDEN_ROLE on every write', async ({ page }) => {
    test.setTimeout(180_000);
    await loginOperator(page, OPERATORS.carlos);
    // the sidebar menu (not the dashboard's quick links, which live in their own <nav>)
    const menu = page.locator('aside nav');
    await expect(menu.locator('a[href="/dashboard"]')).toHaveCount(1);
    for (const href of ['/planning', '/codes-admin', '/finance', '/production-plans', '/rca', '/master-data', '/users']) {
      await expect(menu.locator(`a[href="${href}"]`), `menu must not offer ${href}`).toHaveCount(0);
    }
    for (const href of ['/events', '/downtime', '/tasks']) {
      await expect(menu.locator(`a[href="${href}"]`), `menu must offer ${href}`).toHaveCount(1);
    }

    // Codes & rules by URL: the page renders, the create is refused by the server with the role
    await page.goto('/codes-admin');
    await expect(page.getByTestId('codes-admin')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('code-new').click();
    const dialog = page.getByTestId('code-create-dialog');
    await dialog.locator('#new-code').fill(tag('J5').replace(/[^A-Za-z0-9._:-]/g, '-'));
    await dialog.locator('#new-name').fill('P-OPS operator must not create codes');
    await dialog.getByTestId('code-create-submit').click();
    const refusal = dialog.getByTestId('admin-refusal');
    await expect(refusal).toBeVisible();
    await expect(refusal).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');
    await expect(refusal).toHaveAttribute('data-status', '403');
    await page.screenshot({ path: test.info().outputPath('operator-roles-j5-codes.png') });
    await page.keyboard.press('Escape');

    // Finance by URL: a new valuation policy is refused the same way
    await page.goto('/finance');
    await expect(page.getByTestId('finance')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('policy-new').click();
    await page.locator('#policyEffectiveFrom').fill('2026-12-01T00:00');
    await page.getByTestId('policy-save').click();
    const policyRefusal = page.getByTestId('refusal');
    await expect(policyRefusal).toBeVisible();
    await expect(policyRefusal).toHaveAttribute('data-code', 'FORBIDDEN_ROLE');

    // Planning by URL: the page renders without crashing; the plan create is refused on the API
    await page.goto('/planning');
    await expect(page.getByTestId('planning-page')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('plan-new')).toBeVisible();
    const plan = await command<Record<string, unknown>>(world.carlos, '/v2/production-plans', {
      name: tag('J5-plan'), unitId: world.line1.id, validFrom: '2026-11-01T00:00:00.000Z', validTo: '2026-11-02T00:00:00.000Z',
    });
    expect(plan.status).toBe(403);
    expect(plan.body.code).toBe('FORBIDDEN_ROLE');
    const approve = await command<Record<string, unknown>>(world.carlos, '/v2/reason-codes', { code: tag('J5-code'), name: 'refused' });
    expect(approve.status).toBe(403);
    expect(approve.body.code).toBe('FORBIDDEN_ROLE');
  });
});
