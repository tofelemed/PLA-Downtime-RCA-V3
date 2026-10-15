import { randomUUID } from 'node:crypto';
import { test, type Browser, type Page } from '@playwright/test';
import { authenticate } from '../../test-utils/api-helpers';
import { loginViaUI } from '../../test-utils/auth-helpers';

/**
 * The MANAGER APPROVER / TENANT ADMIN persona (docs/DEMO_PERSONAS.md): four legacy Managers and four
 * TenantAdmins of Demo Plant, all `manager_approver`. Every entity the persona specs create carries the
 * `P-MGR-` prefix; author and approver are always different users (separation of duties is real).
 */
export const PASSWORD = 'Persona-2026!demo';
export const PREFIX = 'P-MGR-';
export const DEMO_PLANT_ID = '5f011848-1cb5-4b7c-b75a-8938b46260a9';

export interface PersonaUser {
  email: string;
  password: string;
  name: string;
}

const persona = (local: string, name: string): PersonaUser => ({ email: `${local}@demo.acme.com`, password: PASSWORD, name });

/** Legacy `Manager` → `manager_approver` (menu without the admin screens). */
export const MANAGERS = {
  jonas: persona('jonas.weber', 'Jonas Weber'),
  fatima: persona('fatima.haddad', 'Fatima Haddad'),
  erik: persona('erik.johansson', 'Erik Johansson'),
  laura: persona('laura.rossi', 'Laura Rossi'),
} as const;

/** Legacy `TenantAdmin` → `manager_approver` plus the admin screens (Users, Connectivity, Master Data). */
export const ADMINS = {
  anna: persona('anna.keller', 'Anna Keller'),
  benjamin: persona('benjamin.carter', 'Benjamin Carter'),
  mei: persona('mei.tanaka', 'Mei Tanaka'),
  oliver: persona('oliver.hughes', 'Oliver Hughes'),
} as const;

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

/** API session of a persona user (the login route; never a role rewrite). */
export async function sessionOf(user: PersonaUser): Promise<Session> {
  const result = await authenticate(user.email, user.password);
  const login = (result.user ?? {}) as LoginUser;
  if (!login.tenantId) throw new Error(`${user.email}: login returned no tenant`);
  return { token: result.accessToken, userId: login.id ?? login.userId ?? '', tenantId: login.tenantId, organizationId: login.organizationId ?? '', email: user.email };
}

/** A fresh browser context signed in through the real login form. */
export async function asUser(browser: Browser, user: PersonaUser): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await loginViaUI(page, user.email, user.password);
  return page;
}

export const shortId = (): string => randomUUID().slice(0, 8);

const DAY = 86_400_000;

/** UTC calendar date `offsetDays` from now (YYYY-MM-DD). */
export const utcDate = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
