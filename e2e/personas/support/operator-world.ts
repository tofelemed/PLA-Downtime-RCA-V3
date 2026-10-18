import { expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../../test-utils/api-helpers';
import { loginViaUI } from '../../test-utils/auth-helpers';
import { call, command } from '../../test-utils/downtime-world';
import { eventRowOf, pickReasonCode } from './event-hub-ui';

/**
 * Shared world of the OPERATOR persona tests (docs/DEMO_PERSONAS.md): the five operators of Demo
 * Plant, the DEMO-LINE-1 unit, two reason codes, and the Event Hub v2 locators of the UX04 journey.
 * Everything created here carries the `P-OPS-` prefix and is left in the database on purpose.
 */
export const PASSWORD = 'Persona-2026!demo';
export const OPERATORS = {
  liam: 'liam.murphy@demo.acme.com',
  yuki: 'yuki.sato@demo.acme.com',
  carlos: 'carlos.mendes@demo.acme.com',
  /** unit-limited: only DEMO-LINE-1 */
  ingrid: 'ingrid.hansen@demo.acme.com',
  /** unit-limited: only DEMO-LINE-1 */
  amir: 'amir.rahimi@demo.acme.com',
} as const;
export const DEMO_PLANT_ID = '5f011848-1cb5-4b7c-b75a-8938b46260a9';
export const LINE_1_CODE = 'unit100';
export const LINE_2_CODE = 'unit200';
export const PREFIX = 'P-OPS-';
export const MINUTE = 60_000;

export interface UnitView {
  id: string;
  code: string;
  name: string;
}

export interface ReasonCodeView {
  id: string;
  code: string;
  name: string;
  active: boolean;
  parentId: string | null;
}

export interface EventBody {
  id: string;
  unitId: string;
  rowVersion: number;
  description: string | null;
  reasonCodeId: string | null;
  isOpen: boolean;
  startTime: string;
  endTime: string | null;
}

export interface ListBody<T> {
  items: T[];
}

export interface Session {
  token: string;
  userId: string;
}

export const tag = (journey: string): string => `${PREFIX}${journey}-${randomUUID().slice(0, 8)}`;
export const iso = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString();

export async function session(email: string): Promise<Session> {
  const result = await authenticate(email, PASSWORD);
  const user = result.user as { id?: string; userId?: string } | null;
  return { token: result.accessToken, userId: user?.id ?? user?.userId ?? '' };
}

export async function unitByCode(token: string, code: string): Promise<UnitView> {
  const units = await call<ListBody<UnitView>>(token, 'GET', '/v2/units?limit=200');
  const unit = units.body.items.find((entry) => entry.code === code);
  if (!unit) throw new Error(`unit ${code} is not visible to this operator`);
  return unit;
}

/** Two active leaf causes; grouping nodes cannot be selected in the reason picker. */
export async function reasonPair(token: string): Promise<[ReasonCodeView, ReasonCodeView]> {
  const codes = await call<ListBody<ReasonCodeView>>(token, 'GET', '/v2/reason-codes?limit=200');
  const parents = new Set(codes.body.items.filter((code) => code.active).map((code) => code.parentId));
  const active = codes.body.items.filter((code) => code.active && !parents.has(code.id));
  const pick = (wanted: string, fallback: number) => active.find((code) => code.code === wanted) ?? active[fallback];
  const a = pick('MECH-BRG', 0);
  const b = pick('ELEC-MTR', 1);
  if (!a || !b || a.id === b.id) throw new Error('need two active reason codes in Demo Plant');
  return [a, b];
}

export const createEvent = (token: string, body: Record<string, unknown>) => command<EventBody>(token, '/v2/production-events', body);
export const getEvent = (token: string, id: string) => call<EventBody>(token, 'GET', `/v2/production-events/${id}`);

export async function loginOperator(page: Page, email: string): Promise<void> {
  await loginViaUI(page, email, PASSWORD);
}

export async function openHub(page: Page, unitName: string | null): Promise<void> {
  await page.goto('/events');
  // first visit compiles the lazy page chunk on the dev server
  await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
  if (unitName) await chooseUnit(page, 'filter-units', unitName);
  await page.getByTestId('event-window').selectOption('preset:24h');
}

export async function chooseUnit(page: Page, filterTestId: string, unitName: string): Promise<void> {
  await page.getByTestId(filterTestId).click();
  await page.getByRole('checkbox', { name: unitName, exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(filterTestId)).toHaveAttribute('aria-label', /1 selected/);
}

export const row = (page: Page, id: string): Locator => eventRowOf(page, id);
export const stop = (page: Page, id: string): Locator => page.locator(`[data-testid="current-stop"][data-event-id="${id}"]`);

export async function codeReason(page: Page, reasonId: string, search: string): Promise<void> {
  const detail = page.getByTestId('event-detail');
  await detail.getByRole('button', { name: 'Edit / code' }).click();
  const form = page.getByTestId('event-form');
  await pickReasonCode(form.locator('#reasonCodeId'), reasonId, search);
  await expect(form.getByTestId('impacted-periods')).toBeVisible();
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toBeHidden();
  // the save returns to the event page
  await expect(detail).toBeVisible();
}

/** The timezone the form types in, read from its own hint ("Plant time (Europe/…)"). */
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

export async function logoutViaHeader(page: Page): Promise<void> {
  await page.locator('header button').filter({ has: page.locator('svg.lucide-log-out') }).click();
  await page.waitForSelector('input#email', { timeout: 10_000 });
}

/** Buttons that would start a write on an analytical screen; an operator must not be offered any. */
export const writeControls = (page: Page): Locator =>
  page.locator('main').getByRole('button', { name: /^(new|create|add|approve|edit|delete|save|publish|activate)\b/i });
