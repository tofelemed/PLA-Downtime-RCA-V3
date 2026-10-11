import { randomUUID } from 'node:crypto';
import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import { authenticate } from '../../test-utils/api-helpers';
import { loginViaUI } from '../../test-utils/auth-helpers';
import { api, created, itemsOf, ok, post } from './manager-api';

/**
 * The MASTER DATA ADMIN persona (docs/DEMO_PERSONAS.md): four legacy Analysts of Demo Plant holding the
 * `production_engineer` and `master_data_admin` scope roles. Every entity the persona specs create carries
 * the `P-MDA-` prefix and stays in the database (owner requirement). Approvals the server refuses to the
 * persona are done by the demo manager Jonas (API) as setup only; nothing is deleted or retired.
 */
export const PASSWORD = 'Persona-2026!demo';
export const PREFIX = 'P-MDA-';
export const DEMO_PLANT_ID = '5f011848-1cb5-4b7c-b75a-8938b46260a9';

export interface PersonaUser {
  email: string;
  password: string;
  name: string;
}

const persona = (local: string, name: string): PersonaUser => ({ email: `${local}@demo.acme.com`, password: PASSWORD, name });

export const MDA = {
  charlotte: persona('charlotte.evans', 'Charlotte Evans'),
  hiro: persona('hiro.yamamoto', 'Hiro Yamamoto'),
  zara: persona('zara.qureshi', 'Zara Qureshi'),
  felix: persona('felix.brandt', 'Felix Brandt'),
} as const;

/** Engineer (production_engineer only): the negative case of journey 1. */
export const NOAH = persona('noah.schmidt', 'Noah Schmidt');
/** Manager approver: approvals the persona may not do, as API setup only. */
export const JONAS = persona('jonas.weber', 'Jonas Weber');

export interface Session {
  token: string;
  userId: string;
  tenantId: string;
  organizationId: string;
  email: string;
}

interface LoginUser {
  id?: string;
  userId?: string;
  tenantId?: string;
  organizationId?: string;
}

/** API session of a persona user (the login route, never a role rewrite). */
export async function sessionOf(user: PersonaUser): Promise<Session> {
  const result = await authenticate(user.email, user.password);
  const login = (result.user ?? {}) as LoginUser;
  if (!login.tenantId) throw new Error(`${user.email}: login returned no tenant`);
  return { token: result.accessToken, userId: login.id ?? login.userId ?? '', tenantId: login.tenantId, organizationId: login.organizationId ?? '', email: user.email };
}

/** A fresh browser context signed in through the real login form. */
export async function asUser(browser: Browser, user: PersonaUser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await loginViaUI(page, user.email, user.password);
  return page;
}

export const shortId = (): string => randomUUID().slice(0, 8);

const DAY = 86_400_000;

/** UTC calendar date `offsetDays` from now (YYYY-MM-DD). */
export const utcDate = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/** The open Radix dialog (closed ones stay in the DOM with data-state="closed"). */
export const openDialog = (page: Page): Locator => page.locator('[role="dialog"][data-state="open"]');

/** A toast text: the toaster renders it twice (visible card + aria-live announcement). */
export async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
}

/** Picks an option of a shadcn / Radix select. */
export async function chooseOption(page: Page, combobox: Locator, name: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name, exact: true }).click();
}

/** A server-side role refusal rendered by the v2 screens (RefusalNotice / AdminRefusalAlert). */
export async function expectRoleRefusal(refusal: Locator): Promise<void> {
  await expect(refusal).toHaveAttribute('data-code', 'FORBIDDEN_ROLE', { timeout: 20_000 });
  await expect(refusal).toHaveAttribute('data-kind', 'role');
}

export interface MdaUnit {
  unitId: string;
  unitName: string;
  unitCode: string;
}

/** A `P-MDA-<kind> …` unit of Demo Plant, created by the persona itself (v1 POST /units). */
export async function mdaUnit(token: string, tenantId: string, kind: string, suffix: string): Promise<MdaUnit> {
  const unitName = `${PREFIX}${kind} ${suffix}`;
  const unitCode = `${PREFIX}${kind}-${suffix}`;
  const unitId = await created(api(token, 'POST', '/units', { name: unitName, code: unitCode, tenantId }), `${kind} unit`);
  return { unitId, unitName, unitCode };
}

export interface MdaProduct {
  productId: string;
  productName: string;
  productCode: string;
}

export async function mdaProduct(token: string, tenantId: string, kind: string, suffix: string): Promise<MdaProduct> {
  const productName = `${PREFIX}product ${kind} ${suffix}`;
  const productCode = `${PREFIX}P-${kind}-${suffix}`;
  const productId = await created(api(token, 'POST', '/products', { name: productName, code: productCode, tenantId }), 'product');
  return { productId, productName, productCode };
}

export interface PlanWorld extends MdaUnit, MdaProduct {
  suffix: string;
  profileId: string;
}

/**
 * A unit with a published UTC calendar (3 × 8 h), a product and an approved profile with approved
 * planning / sustained rates: the persona drafts everything it may (CALENDAR_WRITERS / PROFILE_WRITERS),
 * the manager approves (PROFILE_APPROVERS). Used by the plan-approval refusal of journey 5.
 */
export async function seedPlanWorld(author: Session, approver: Session, kind: string): Promise<PlanWorld> {
  const suffix = shortId();
  const unit = await mdaUnit(author.token, author.tenantId, kind, suffix);
  const product = await mdaProduct(author.token, author.tenantId, kind, suffix);
  const calendarId = await created(
    post(author.token, '/v2/calendar-versions', {
      unitId: unit.unitId,
      timezone: 'UTC',
      operationalDayStart: '06:00',
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '14:00' },
        { name: 'B', startLocal: '14:00', endLocal: '22:00' },
        { name: 'C', startLocal: '22:00', endLocal: '06:00' },
      ],
      effectiveFrom: utcDate(-6),
    }),
    'calendar',
  );
  await ok(post(author.token, `/v2/calendar-versions/${calendarId}/publish`, {}), 'publish calendar');
  const from = `${utcDate(-10)}T00:00:00Z`;
  const profileId = await created(post(author.token, '/v2/profiles', { unitId: unit.unitId, productId: product.productId, quantityUom: 't', rateTimebase: 'h', effectiveFrom: from }), 'profile');
  await ok(post(approver.token, `/v2/profiles/${profileId}/approve`, {}), 'approve profile');
  for (const [rateKind, rate] of [['planning', '90'], ['sustained', '100']]) {
    const rateId = await created(post(author.token, `/v2/profiles/${profileId}/rates`, { rateKind, rate, timebase: 'h', effectiveFrom: from }), `${rateKind} rate`);
    await ok(post(approver.token, `/v2/rates/${rateId}/approve`, {}), `approve ${rateKind}`);
  }
  return { ...unit, ...product, suffix, profileId };
}

interface ListedUnit {
  id: string;
  name: string;
  code: string;
}

/** The persona's `P-MDA-<kind>-…` units of the plant, newest first (what an earlier spec left behind). */
export async function listMdaUnits(token: string, kind: string): Promise<ListedUnit[]> {
  const units = await api<ListedUnit[]>(token, 'GET', '/units');
  if (units.status !== 200) throw new Error(`units: ${units.status}`);
  return itemsOf(units.body).filter((unit) => unit.code.startsWith(`${PREFIX}${kind}-`)).reverse();
}
