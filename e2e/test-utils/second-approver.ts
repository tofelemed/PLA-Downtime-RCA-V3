import type { Browser, Page } from '@playwright/test';
import { authenticate } from './api-helpers';
import { loginViaUI } from './auth-helpers';
import { call } from './downtime-world';

/**
 * D06 (owner decision 2026-10-12): production plans, profiles, rates, valuation rates and FX rates are
 * approved by someone other than the draft's author (403 SEPARATION_OF_DUTIES, SuperAdmin included).
 * E2E seeders that author such drafts as one manager approve them as this second manager approver of the
 * same plant: the `e2e-pd-approver` account the UX05 and T22 specs already use, registered on first use.
 */
export const SECOND_APPROVER = { email: 'e2e-pd-approver@acme.com', password: 'E2e-approver-1!' };

interface Profile {
  tenantId: string;
  organizationId: string;
}

/** Registers the account in the author's plant (409 = it exists); a legacy Manager may only grant Manager. */
async function ensureRegistered(authorToken: string): Promise<void> {
  const profile = await call<Profile>(authorToken, 'GET', '/auth/profile');
  if (profile.status !== 200) throw new Error(`profile: ${profile.status} ${JSON.stringify(profile.body)}`);
  const { tenantId, organizationId } = profile.body;
  for (const role of ['TenantAdmin', 'Manager']) {
    const result = await call(authorToken, 'POST', '/auth/register', { name: 'E2E PD approver', ...SECOND_APPROVER, role, tenantId, organizationId });
    if (result.status === 201 || result.status === 409) return;
    if (result.status !== 403) throw new Error(`register second approver: ${result.status} ${JSON.stringify(result.body)}`);
  }
  throw new Error('register second approver: refused for every approver role');
}

/** Token of the second manager approver of the author's plant (never the author of the seeded drafts). */
export async function secondApproverToken(authorToken: string): Promise<string> {
  await ensureRegistered(authorToken);
  return (await authenticate(SECOND_APPROVER.email, SECOND_APPROVER.password)).accessToken;
}

/** A browser page logged in as the second approver (register it first with `secondApproverToken`). */
export async function secondApproverPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await loginViaUI(page, SECOND_APPROVER.email, SECOND_APPROVER.password);
  return page;
}
