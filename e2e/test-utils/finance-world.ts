import { authenticate } from './api-helpers';
import { call, command } from './downtime-world';
import { grantPlantRole } from './finance-users';

/**
 * Plan 3.10 prerequisite e2e (finance screens). The valuation policy is tenant-wide (no unit scope), so
 * its test draft lives in a dedicated "E2E Test Tenant finance" (created once by the SuperAdmin, reused)
 * with its own author `e2e-finance-author@acme.com` (TenantAdmin there, granted finance_maintainer and
 * finance_approver so the separation-of-duties refusal is the one tested, SME V1) — never in Demo Plant,
 * whose policy versions are the owner's finance decision. FX rates of Demo Plant are only touched in a dedicated past window
 * (2001-01-01 → 2001-01-02 on the plant clock, source "E2E finance …"), retired again at the end.
 */
export const FINANCE_TENANT = { name: 'E2E Test Tenant finance', code: 'E2E-TENANT-FINANCE' };
const FINANCE_ORG = { name: 'E2E Test Org finance', code: 'E2E-ORG-FINANCE' };
export const FINANCE_AUTHOR = { email: 'e2e-finance-author@acme.com', password: 'E2e-finance-1!' };
export const E2E_FX_SOURCE = 'E2E finance';

interface Named {
  id: string;
  name: string;
  code?: string;
}

async function listOf(token: string, path: string): Promise<Named[]> {
  const result = await call<Named[] | { items?: Named[] }>(token, 'GET', path);
  if (result.status !== 200) throw new Error(`${path}: ${result.status} ${JSON.stringify(result.body)}`);
  return Array.isArray(result.body) ? result.body : (result.body.items ?? []);
}

async function createOnce(token: string, path: string, wanted: { name: string; code: string }, extra: Record<string, string> = {}): Promise<string> {
  const existing = (await listOf(token, path)).find((entry) => entry.code === wanted.code || entry.name === wanted.name);
  if (existing) return existing.id;
  const created = await call<{ id: string }>(token, 'POST', path, { ...wanted, ...extra });
  if (created.status !== 201 && created.status !== 200) throw new Error(`${path}: ${created.status} ${JSON.stringify(created.body)}`);
  return created.body.id;
}

/** The finance test tenant, its author (both finance roles there) and `v2.codesAdmin` on there. */
export async function ensureFinanceTenant(superAdmin: string): Promise<{ tenantId: string; organizationId: string; author: string }> {
  const organizationId = await createOnce(superAdmin, '/organizations', FINANCE_ORG);
  const tenantId = await createOnce(superAdmin, '/tenants', FINANCE_TENANT, { organizationId });
  const registered = await call(superAdmin, 'POST', '/auth/register', { name: 'E2E finance author', ...FINANCE_AUTHOR, role: 'TenantAdmin', tenantId, organizationId });
  if (registered.status !== 201 && registered.status !== 409) throw new Error(`register author: ${registered.status} ${JSON.stringify(registered.body)}`);
  for (const role of ['finance_maintainer', 'finance_approver']) await grantPlantRole(superAdmin, tenantId, FINANCE_AUTHOR.email, role);
  const session = await authenticate(FINANCE_AUTHOR.email, FINANCE_AUTHOR.password);
  const user = session.user as { tenantId?: string } | null;
  if (user?.tenantId !== tenantId) throw new Error(`${FINANCE_AUTHOR.email} is not a member of ${FINANCE_TENANT.name}`);
  const flag = await call(session.accessToken, 'PUT', '/v2/feature-flags/v2.codesAdmin', { enabled: true });
  if (flag.status !== 200) throw new Error(`flag: ${flag.status} ${JSON.stringify(flag.body)}`);
  return { tenantId, organizationId, author: session.accessToken };
}

interface FxRow {
  id: string;
  state: string;
  source: string | null;
}

/** Retires every not-yet-retired "E2E finance …" FX version of the tenant (a finance approver's token, SME V1). */
export async function retireE2eFxRates(financeApprover: string): Promise<number> {
  const list = await call<{ items: FxRow[] }>(financeApprover, 'GET', '/v2/fx-rates?fromCurrency=USD&toCurrency=IRR&limit=200');
  if (list.status !== 200) throw new Error(`fx-rates: ${list.status}`);
  const open = list.body.items.filter((row) => row.state !== 'retired' && (row.source ?? '').startsWith(E2E_FX_SOURCE));
  for (const row of open) {
    const retired = await command(financeApprover, `/v2/fx-rates/${row.id}/retire`, {});
    if (retired.status !== 200) throw new Error(`retire ${row.id}: ${retired.status} ${JSON.stringify(retired.body)}`);
  }
  return open.length;
}

export interface PolicySummary {
  id: string;
  version: number;
  approved: boolean;
  notes: string | null;
}

export async function policiesOf(token: string): Promise<PolicySummary[]> {
  const list = await call<{ items: PolicySummary[] }>(token, 'GET', '/v2/valuation-policies?limit=100');
  if (list.status !== 200) throw new Error(`valuation-policies: ${list.status}`);
  return list.body.items.map(({ id, version, approved, notes }) => ({ id, version, approved, notes }));
}
