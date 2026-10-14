import { randomUUID } from 'node:crypto';
import type { Browser, Page } from '@playwright/test';
import { authenticate } from './api-helpers';
import { loginViaUI } from './auth-helpers';
import { call } from './downtime-world';

/**
 * SME V1 (14 Oct 2026): valuation policies, FX rates, valuation rates and demand statuses are drafted by a
 * `finance_maintainer` and approved by a `finance_approver` (never the author); manager approvers get 403
 * FORBIDDEN_ROLE. E2E specs create their own finance users: registered as Analysts in the plant, then
 * granted the finance scope role in that plant through `POST /v2/user-scopes` (a SuperAdmin acting there, or
 * the plant's TenantAdmin).
 * Test accounts only; reruns reuse them (409 = already registered / already granted).
 */
export interface E2eAccount {
  name: string;
  email: string;
  password: string;
}

export const FINANCE_MAINTAINER: E2eAccount = { name: 'E2E finance maintainer', email: 'e2e-finance-maintainer@acme.com', password: 'E2e-finance-m1!' };
export const FINANCE_APPROVER: E2eAccount = { name: 'E2E finance approver', email: 'e2e-finance-approver@acme.com', password: 'E2e-finance-a1!' };

export interface Plant {
  tenantId: string;
  organizationId: string;
}

/** The acting plant of a token's user (its home tenant). */
export async function plantOf(token: string): Promise<Plant> {
  const profile = await call<Plant>(token, 'GET', '/auth/profile');
  if (profile.status !== 200) throw new Error(`profile: ${profile.status} ${JSON.stringify(profile.body)}`);
  return { tenantId: profile.body.tenantId, organizationId: profile.body.organizationId };
}

/** Registers `account` as an Analyst of the plant (409 = it exists). */
export async function ensureAnalyst(registrar: string, plant: Plant, account: E2eAccount): Promise<void> {
  const result = await call(registrar, 'POST', '/auth/register', { ...account, role: 'Analyst', ...plant });
  if (result.status !== 201 && result.status !== 409) throw new Error(`register ${account.email}: ${result.status} ${JSON.stringify(result.body)}`);
}

/** Grants a scope role in the whole plant (granter: SuperAdmin or the plant's TenantAdmin; 409 SCOPE_EXISTS = held). */
export async function grantPlantRole(granter: string, tenantId: string, email: string, role: string): Promise<void> {
  const result = await call(granter, 'POST', '/v2/user-scopes', { email, role }, { 'Idempotency-Key': randomUUID(), 'X-Tenant-Id': tenantId });
  if (result.status !== 201 && result.status !== 409) throw new Error(`grant ${role} to ${email}: ${result.status} ${JSON.stringify(result.body)}`);
}

export interface FinanceUsers {
  maintainer: string;
  approver: string;
}

/** The plant's E2E finance maintainer and approver (registered by `registrar`, roles granted by `granter`). */
export async function ensureFinanceUsers(granter: string, registrar: string, plant: Plant): Promise<FinanceUsers> {
  for (const [account, role] of [
    [FINANCE_MAINTAINER, 'finance_maintainer'],
    [FINANCE_APPROVER, 'finance_approver'],
  ] as const) {
    await ensureAnalyst(registrar, plant, account);
    await grantPlantRole(granter, plant.tenantId, account.email, role);
  }
  return {
    maintainer: (await authenticate(FINANCE_MAINTAINER.email, FINANCE_MAINTAINER.password)).accessToken,
    approver: (await authenticate(FINANCE_APPROVER.email, FINANCE_APPROVER.password)).accessToken,
  };
}

/** A browser page logged in as a finance account (register it first with `ensureFinanceUsers`). */
export async function financePage(browser: Browser, account: E2eAccount): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await loginViaUI(page, account.email, account.password);
  return page;
}
