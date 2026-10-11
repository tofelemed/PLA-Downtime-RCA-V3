import { expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginViaUI } from '../../test-utils/auth-helpers';
import { call, command, PLANTS, plantTrigger, selectPlant, type ApiErrorBody } from './admin-helpers';

/**
 * Shared world of the VIEWER persona journeys (docs/DEMO_PERSONAS.md): four users whose home plant is
 * Demo Plant 2 (legacy Operator there) and who hold exactly a `viewer` scope in Demo Plant. Everything the
 * journeys create carries the `P-VIEW-` prefix and stays in the database (owner requirement).
 */
export const PASSWORD = 'Persona-2026!demo';
export const PREFIX = 'P-VIEW-';
export const MINUTE = 60_000;
export const VIEWERS = {
  grace: 'grace.whitfield@demo.acme.com',
  pedro: 'pedro.santos@demo.acme.com',
  nadia: 'nadia.petrova@demo.acme.com',
  kenji: 'kenji.nakamura@demo.acme.com',
} as const;
export const DEMO = PLANTS.demo;
export const DEMO2 = PLANTS.demo2;
export const PARTNER = PLANTS.partner;
export const DEMO_HEADER = { 'X-Tenant-Id': DEMO.id };
export { call, command, plantTrigger, selectPlant, type ApiErrorBody };

/** The menus the two plants must offer (navigation-items.ts): operator at home, every read screen as viewer. */
export const OPERATOR_MENU = ['/dashboard', '/pla-analytics', '/events', '/downtime', '/tasks'];
export const OPERATOR_HIDDEN = ['/reports', '/planning', '/production-plans', '/rca', '/codes-admin', '/finance', '/users', '/master-data'];
export const VIEWER_MENU = [
  '/dashboard', '/reports', '/pla-analytics', '/production-plans', '/planning', '/events', '/downtime', '/rca',
  '/rca-knowledge-base', '/codes-admin', '/finance', '/tasks',
];
export const VIEWER_HIDDEN = ['/master-data', '/users', '/permissions', '/admin', '/connectivity', '/enhanced-historian', '/audit', '/settings'];

export interface ViewerSession {
  email: string;
  token: string;
  userId: string;
  homeTenantId: string | null;
  scopes: Array<{ tenantId: string; role: string; organizationId?: string }>;
}

interface LoginBody {
  access_token?: string;
  accessToken?: string;
  user: { id: string; homeTenantId?: string | null; scopes?: ViewerSession['scopes'] };
}

export const tag = (journey: string): string => `${PREFIX}${journey}-${randomUUID().slice(0, 8)}`;

/** API token of a viewer (setup and verification only; the browser always logs in through the form). */
export async function apiLogin(email: string): Promise<ViewerSession> {
  const result = await call<LoginBody>(null, 'POST', '/auth/login', { email, password: PASSWORD });
  const token = result.body.access_token ?? result.body.accessToken;
  if (!token || (result.status !== 200 && result.status !== 201)) throw new Error(`login ${email}: ${result.status}`);
  const user = result.body.user;
  return { email, token, userId: user.id, homeTenantId: user.homeTenantId ?? null, scopes: user.scopes ?? [] };
}

/** Real-UI login; a dev server busy with the other personas may paint the header after the 5 s allowance. */
export async function uiLogin(page: Page, email: string): Promise<void> {
  try {
    await loginViaUI(page, email, PASSWORD);
  } catch (error) {
    if (!page.url().includes('/dashboard')) throw error;
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 30_000 });
  }
}

export async function signOut(page: Page): Promise<void> {
  await page.locator('header button').filter({ has: page.locator('svg.lucide-log-out') }).click();
  await page.waitForSelector('input#email', { timeout: 10_000 });
}

/** Login and act on Demo Plant (the `viewer` scope): the selector must offer it. */
export async function loginAsViewerInDemoPlant(page: Page, email: string): Promise<void> {
  await uiLogin(page, email);
  await selectPlant(page, DEMO);
  await expect(readOnlyBadge(page)).toBeVisible();
}

export const readOnlyBadge = (page: Page): Locator => page.locator('header').getByText('Read-only', { exact: true });

/** Sidebar links (the dashboard's quick links live in their own <nav>). */
export async function expectMenu(page: Page, offered: string[], hidden: string[]): Promise<void> {
  const menu = page.locator('aside nav');
  await expect(menu.locator('a[href="/dashboard"]')).toHaveCount(1);
  for (const href of offered) await expect(menu.locator(`a[href="${href}"]`), `menu must offer ${href}`).toHaveCount(1);
  for (const href of hidden) await expect(menu.locator(`a[href="${href}"]`), `menu must not offer ${href}`).toHaveCount(0);
}

/** Unit names a multi-check filter offers (the Event Hub, Downtime and PLA screens share the control). */
export async function unitOptionsOf(page: Page, filterTestId = 'filter-units'): Promise<string[]> {
  await page.getByTestId(filterTestId).click();
  const options = page.locator('[role="dialog"][data-state="open"]').getByRole('checkbox');
  await expect(options.first()).toBeVisible({ timeout: 30_000 });
  const names = await options.evaluateAll((nodes) => nodes.map((node) => node.parentElement?.textContent?.trim() ?? ''));
  await page.keyboard.press('Escape');
  return names;
}

export interface UnitView {
  id: string;
  code: string;
  name: string;
}

export interface ListBody<T> {
  items: T[];
}

/** Every v2 unit of a plant as the viewer reads them with `X-Tenant-Id` (keyset pages followed to the end). */
export async function unitsOf(token: string, plantId: string): Promise<UnitView[]> {
  const items: UnitView[] = [];
  let cursor: string | null = null;
  do {
    const path: string = `/v2/units?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const page: { status: number; body: ListBody<UnitView> & { nextCursor?: string | null } } = await call(token, 'GET', path, undefined, { 'X-Tenant-Id': plantId });
    if (page.status !== 200) throw new Error(`v2 units of ${plantId}: ${page.status}`);
    items.push(...page.body.items);
    cursor = page.body.nextCursor ?? null;
  } while (cursor);
  return items;
}

export async function openHub(page: Page, unitName: string | null): Promise<void> {
  await page.goto('/events');
  await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
  if (unitName) await chooseUnit(page, unitName);
}

export async function chooseUnit(page: Page, unitName: string, filterTestId = 'filter-units'): Promise<void> {
  await page.getByTestId(filterTestId).click();
  await page.getByRole('checkbox', { name: unitName, exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(filterTestId)).toHaveAttribute('aria-label', /1 selected/);
}

export const eventRow = (page: Page, id: string): Locator => page.locator(`[data-testid="event-row"][data-event-id="${id}"]`);
export const currentStop = (page: Page, id: string): Locator => page.locator(`[data-testid="current-stop"][data-event-id="${id}"]`);

/** The timezone the Event Hub form types in, read from its own hint ("Plant time (Europe/…)"). */
export async function plantTimezoneOf(form: Locator): Promise<string> {
  const hint = await form.getByText(/Plant time \(/).first().textContent();
  const match = /Plant time \(([^)]+)\)/.exec(hint ?? '');
  if (!match) throw new Error(`no plant-time hint in the form: ${hint}`);
  return match[1];
}

/** `datetime-local` value of an instant on the plant clock. */
export function plantLocal(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export interface V2Call {
  method: string;
  url: string;
  tenant: string;
}

/** Records the `X-Tenant-Id` of every v2 request the page sends (which plant the screens read). */
export function trackV2Calls(page: Page): V2Call[] {
  const calls: V2Call[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    // API calls only (the dev server also serves the client's own `/src/api/v2/*` modules)
    if (url.pathname.startsWith('/api/v2/')) {
      calls.push({ method: request.method(), url: url.pathname, tenant: request.headers()['x-tenant-id'] ?? '' });
    }
  });
  return calls;
}

export function note(info: { annotations: Array<{ type: string; description?: string }> }, type: string, description: string): void {
  info.annotations.push({ type, description });
}
