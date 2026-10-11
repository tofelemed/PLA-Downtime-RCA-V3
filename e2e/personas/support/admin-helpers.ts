import { expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginViaUI } from '../../test-utils/auth-helpers';

/**
 * Shared helpers of the SuperAdmin / OrgAdmin persona journeys (e2e/personas/admin-*.spec.ts).
 * Every browser session is opened through the real login form; the API is used only for setup data
 * and for verifying what the screens show. Nothing here deletes, retires or switches anything off.
 */
export const API = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';
export const PASSWORD = 'Persona-2026!demo';
/** Every entity the admin persona creates carries this prefix (owner requirement: data stays). */
export const PREFIX = 'P-ADM-';

export interface Plant {
  id: string;
  name: string;
  org: string;
}

export const PLANTS = {
  demo: { id: '5f011848-1cb5-4b7c-b75a-8938b46260a9', name: 'Demo Plant', org: 'Demo Org' },
  demo2: { id: '1c19bda6-1c5e-42ac-af59-e1bda46b804f', name: 'Demo Plant 2', org: 'Demo Org' },
  partner: { id: 'd731498e-efd5-46f2-8bf0-64a4cf1fde3b', name: 'Partner Plant', org: 'Partner Org' },
} as const satisfies Record<string, Plant>;

/** docs/DEMO_PERSONAS.md — the four SuperAdmins, the four Demo Org OrgAdmins, the Partner OrgAdmin. */
export const USERS = {
  helena: 'helena.fischer@demo.acme.com',
  marcus: 'marcus.lindqvist@demo.acme.com',
  priya: 'priya.raman@demo.acme.com',
  tomasz: 'tomasz.nowak@demo.acme.com',
  isabel: 'isabel.moreno@demo.acme.com',
  daniel: 'daniel.okafor@demo.acme.com',
  sofia: 'sofia.bergstrom@demo.acme.com',
  ravi: 'ravi.krishnan@demo.acme.com',
  lucas: 'lucas.ferreira@demo.acme.com',
  /** tenant-wide Operator of Demo Plant, used only for the security spot-checks (journey 10) */
  liam: 'liam.murphy@demo.acme.com',
} as const;

export interface ApiResult<T> {
  status: number;
  body: T;
}

export interface ApiErrorBody {
  code?: string;
  message?: string | string[];
}

export async function call<T>(
  token: string | null,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed as T };
}

/** A v2 command: POST with a fresh Idempotency-Key (api-helpers convention). */
export const command = <T>(token: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  call<T>(token, 'POST', path, body, { 'Idempotency-Key': randomUUID(), ...headers });

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string | null;
  organizationId: string | null;
}

export interface ApiSession {
  token: string;
  user: SessionUser;
}

/** API token of a persona user (setup / verification only; the browser always logs in through the UI). */
export async function apiLogin(email: string): Promise<ApiSession> {
  const result = await call<{ access_token?: string; accessToken?: string; user: SessionUser }>(null, 'POST', '/auth/login', {
    email,
    password: PASSWORD,
  });
  const token = result.body.access_token ?? result.body.accessToken;
  if (result.status !== 200 && result.status !== 201) throw new Error(`login ${email}: ${result.status}`);
  if (!token) throw new Error(`login ${email}: no access token`);
  return { token, user: result.body.user };
}

export async function signIn(page: Page, email: string): Promise<void> {
  await loginViaUI(page, email, PASSWORD);
}

/** The header's logout button (LogOut icon); the login form appears afterwards. */
export async function signOut(page: Page): Promise<void> {
  await page.locator('header button').filter({ has: page.locator('svg.lucide-log-out') }).click();
  await page.waitForSelector('input#email', { timeout: 10_000 });
}

/** The plant selector trigger in the header (a Radix popover trigger showing the breadcrumb). */
export function plantTrigger(page: Page): Locator {
  return page.locator('header button[aria-haspopup="dialog"]').first();
}

/**
 * The open Radix dialog or popover content. Closed popovers stay in the DOM with `data-state="closed"`
 * (and `role="dialog"`), so `getByRole('dialog')` alone is ambiguous after one was dismissed.
 */
export function openDialog(page: Page): Locator {
  return page.locator('[role="dialog"][data-state="open"]');
}

/** A toast text: the toaster renders it twice (visible card + aria-live announcement). */
export async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible();
}

/** Opens the plant selector and returns its tree (popover content). */
export async function openPlantTree(page: Page): Promise<Locator> {
  await plantTrigger(page).click();
  const tree = openDialog(page);
  await expect(tree).toBeVisible();
  return tree;
}

/**
 * Selects a plant: expands its organisation through the chevron (clicking the organisation name
 * would select the organisation itself) and clicks the plant name.
 */
export async function selectPlant(page: Page, plant: Plant): Promise<void> {
  const tree = await openPlantTree(page);
  const orgLabel = tree.getByText(plant.org, { exact: true });
  await expect(orgLabel).toBeVisible();
  const plantLabel = tree.getByText(plant.name, { exact: true });
  if ((await plantLabel.count()) === 0) await orgLabel.locator('xpath=..').locator('svg').first().click();
  await plantLabel.click();
  await expect(tree).toBeHidden();
  await expect(plantTrigger(page)).toContainText(plant.name);
}

/** Picks an option of a shadcn / Radix select. */
export async function chooseOption(page: Page, combobox: Locator, name: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name, exact: true }).click();
}

export const suffix = (): string => randomUUID().slice(0, 8);

interface FlagsView {
  items: Array<{ key: string; enabled: boolean }>;
}

/** Whether a v2 flag is on for a plant, read as the given user (SuperAdmin may read any plant). */
export async function flagOn(token: string, plantId: string, key: string): Promise<boolean> {
  const flags = await call<FlagsView>(token, 'GET', '/v2/feature-flags', undefined, { 'X-Tenant-Id': plantId });
  if (flags.status !== 200) throw new Error(`feature flags of ${plantId}: ${flags.status}`);
  return flags.body.items.some((item) => item.key === key && item.enabled);
}

interface UnitsView {
  items: Array<{ id: string; name: string }>;
}

/** Names of the v2 units of a plant (what the v2 screens list for that plant). */
export async function v2UnitNames(token: string, plantId: string): Promise<string[]> {
  const units = await call<UnitsView>(token, 'GET', '/v2/units', undefined, { 'X-Tenant-Id': plantId });
  if (units.status !== 200) throw new Error(`v2 units of ${plantId}: ${units.status}`);
  return units.body.items.map((unit) => unit.name);
}

export function note(info: { annotations: Array<{ type: string; description?: string }> }, type: string, description: string): void {
  info.annotations.push({ type, description });
}
