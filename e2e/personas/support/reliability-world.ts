import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { authenticate } from '../../test-utils/api-helpers';
import { loginViaUI } from '../../test-utils/auth-helpers';
import { call, command } from '../../test-utils/downtime-world';
import { backToList, eventRowOf, fillPlantTime } from './event-hub-ui';

/**
 * Shared world of the RELIABILITY ENGINEER persona journeys (docs/DEMO_PERSONAS.md): the four
 * `reliability_engineer` users of Demo Plant, API helpers with their tokens, the UI steps every journey
 * repeats (Event Hub "New event", opening a stop, opening a case) and a small state file so the journey
 * specs can hand the case they built to the knowledge-base spec. Everything created is prefixed
 * `P-REL-` and is never deleted (owner requirement).
 */
export const PASSWORD = 'Persona-2026!demo';
export const REL_USERS = {
  viktor: 'viktor.petrov@demo.acme.com',
  amara: 'amara.diallo@demo.acme.com',
  sebastian: 'sebastian.vogel@demo.acme.com',
  leila: 'leila.farouk@demo.acme.com',
} as const;
export const DEMO_PLANT = '5f011848-1cb5-4b7c-b75a-8938b46260a9';
export const PREFIX = 'P-REL-';
export const MINUTE = 60_000;
export const DAY = 86_400_000;

export interface RelSession {
  email: string;
  token: string;
  userId: string;
  tenantId: string;
}

export async function apiLogin(email: string): Promise<RelSession> {
  const session = await authenticate(email, PASSWORD);
  const user = session.user as { id: string; tenantId: string };
  return { email, token: session.accessToken, userId: user.id, tenantId: user.tenantId };
}

/**
 * Real-UI login. `loginViaUI` allows the header 5 s after the redirect; on a dev server busy with the other
 * personas' runs the first paint can take longer, so a late header is waited for instead of failing the
 * journey (a login that really failed still shows the form, and the header never comes).
 */
export async function uiLogin(page: Page, email: string): Promise<void> {
  try {
    await loginViaUI(page, email, PASSWORD);
  } catch (error) {
    if (!page.url().includes('/dashboard')) throw error;
    await expect(page.locator('header')).toBeVisible({ timeout: 30_000 });
  }
}

export { call, command };

export const newSuffix = () => randomUUID().slice(0, 8);

/**
 * State handed from the case journey to the later specs. It lives in the OS temp dir: `test-results/`
 * is wiped by every Playwright run, including the other personas' runs on the same machine.
 */
export interface RelState {
  suffix: string;
  unitId: string;
  unitName: string;
  stopId: string;
  secondStopId: string;
  caseId: string;
  caseTitle: string;
  closed: boolean;
}

const STATE_FILE = join(tmpdir(), 'proact-personas', 'reliability-state.json');

export function saveState(state: RelState): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadState(): RelState | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as RelState;
  } catch {
    return null;
  }
}

/** Demo Plant `master_data_admin` (docs/DEMO_PERSONAS.md) who creates the SETUP unit; never a journey actor. */
export const MASTER_DATA_SETUP_USER = 'charlotte.evans@demo.acme.com';

/**
 * A unit of this persona's own (`P-REL-<suffix>`) in the reliability user's plant, created through the v1
 * units API by a master-data-capable user: `POST /units` is for `master_data_admin` / `manager_approver`
 * (a reliability engineer is answered 403 by design). The unit keeps the other personas' stops out of
 * this world's filters.
 */
export async function ensureUnit(session: RelSession, suffix: string): Promise<{ unitId: string; unitName: string }> {
  const unitName = `${PREFIX}${suffix}`;
  const setup = await apiLogin(MASTER_DATA_SETUP_USER);
  if (setup.tenantId !== session.tenantId) throw new Error(`${MASTER_DATA_SETUP_USER} is not a member of ${session.tenantId}`);
  const unit = await call<{ id: string }>(setup.token, 'POST', '/units', { name: unitName, code: unitName, tenantId: session.tenantId });
  if (unit.status !== 201 && unit.status !== 200) throw new Error(`unit: ${unit.status} ${JSON.stringify(unit.body)}`);
  return { unitId: unit.body.id, unitName };
}

/** `2026-10-11T15:30` on the plant clock for the `<input type="datetime-local">` of the event form. */
export function plantLocal(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export async function openHub(page: Page, unitName: string): Promise<void> {
  await page.goto('/events');
  await expect(page.getByTestId('event-hub-v2')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('filter-units').click();
  await page.getByRole('checkbox', { name: unitName }).click();
  await page.keyboard.press('Escape');
}

export interface NewEventInput {
  unitName: string;
  startIso: string;
  durationMinutes?: number;
  scheduleClass: 'planned' | 'unplanned';
  description: string;
}

/** Records a downtime event through the Event Hub "New event" page; returns the id the server gave it. */
export async function createEventViaUi(page: Page, input: NewEventInput): Promise<string> {
  await page.getByRole('link', { name: 'New event' }).click();
  const form = page.getByTestId('event-form');
  await expect(form).toBeVisible();
  const hint = await form.getByText(/^Plant time \(/).first().textContent();
  const timezone = /\((.+)\)/.exec(hint ?? '')?.[1] ?? 'UTC';
  await form.locator('#unitId').selectOption({ label: input.unitName });
  await form.locator('#physicalType').selectOption('downtime');
  await fillPlantTime(form, 'Start', plantLocal(input.startIso, timezone));
  if (input.durationMinutes !== undefined) await form.locator('#durationMinutes').fill(String(input.durationMinutes));
  await form.locator('#scheduleClass').selectOption(input.scheduleClass);
  await form.locator('#description').fill(input.description);
  const created = page.waitForResponse((response) => response.request().method() === 'POST' && /\/v2\/production-events$/.test(response.url().split('?')[0]));
  await form.getByRole('button', { name: 'Save' }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { id: string };
  await expect(form).toBeHidden();
  // the save opens the new event's page; the journeys open it from the list instead
  const detail = page.getByTestId('event-detail');
  await expect(detail.getByText(input.description).first()).toBeVisible();
  await backToList(page);
  return body.id;
}

export const stopCard = (page: Page, id: string) => page.locator(`[data-testid="current-stop"][data-event-id="${id}"]`);
export const eventRow = (page: Page, id: string) => eventRowOf(page, id);

export async function openStop(page: Page, stopId: string): Promise<void> {
  await stopCard(page, stopId).getByRole('link', { name: 'Open' }).click();
  await expect(page.getByTestId('event-detail')).toBeVisible();
}

/** Opens a case page: the overview, or the sub-page that holds links / actions / outcome. */
export async function openCase(page: Page, caseId: string, tab?: 'links' | 'actions' | 'outcome'): Promise<void> {
  const sub = tab === 'actions' ? '/actions' : tab ? '/links' : '';
  await page.goto(`/rca/${caseId}${sub}`);
  await expect(page.getByTestId('case-detail')).toBeVisible({ timeout: 60_000 });
}

export interface RecommendationBody {
  id: string;
  trigger: string;
  provisional: boolean;
  state: string;
}

const recommendationsOf = (token: string, eventId: string) =>
  call<{ items: RecommendationBody[] }>(token, 'GET', `/v2/rca-recommendations?eventIds=${eventId}`);

/** Waits for the trigger service (outbox relay every second, inbox consumer) to record the recommendation. */
export async function waitForRecommendation(token: string, eventId: string): Promise<RecommendationBody> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await recommendationsOf(token, eventId);
    if (result.status === 200 && result.body.items.length > 0) return result.body.items[0];
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`no recommendation for ${eventId}`);
}

/** Gives the trigger service the same time it needs for a positive case, then asserts nothing fired. */
export async function expectNoRecommendation(token: string, eventId: string, seconds = 12): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  const result = await recommendationsOf(token, eventId);
  expect(result.status).toBe(200);
  expect(result.body.items).toEqual([]);
}

export const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
