import { randomUUID } from 'node:crypto';
import { call, command } from './downtime-world';

/**
 * Plan 3.8 world: a new unit "E2E CR …" of the demo tenant (the T22 rule is limited to it, so no other
 * unit's events are touched), helpers to create downtime events and codes through the API, and a code
 * in another tenant (created by the SuperAdmin in an "E2E Test Tenant") that must never be listed for
 * the demo tenant. Everything is new "E2E …" data; existing codes and policies are not changed.
 */
const HOUR = 3_600_000;

export interface CodesWorld {
  suffix: string;
  tenantId: string;
  unitId: string;
  unitName: string;
  foreignCode: string | null;
}

export async function seedCodesWorld(manager: string, tenantId: string, superAdmin: string | null): Promise<CodesWorld> {
  const suffix = randomUUID().slice(0, 8);
  const unitName = `E2E CR ${suffix}`;
  const unit = await call<{ id: string }>(manager, 'POST', '/units', { name: unitName, code: `E2E-CR-${suffix}`, tenantId });
  if (unit.status !== 201 && unit.status !== 200) throw new Error(`unit: ${unit.status} ${JSON.stringify(unit.body)}`);
  return { suffix, tenantId, unitId: unit.body.id, unitName, foreignCode: superAdmin ? await foreignCode(superAdmin, tenantId, suffix) : null };
}

/** A reason code in another tenant (the SuperAdmin picks it with X-Tenant-Id); null when there is none. */
async function foreignCode(superAdmin: string, ownTenant: string, suffix: string): Promise<string | null> {
  const tenants = await call<Array<{ id: string; name: string }> | { items?: Array<{ id: string; name: string }> }>(superAdmin, 'GET', '/tenants');
  const list = Array.isArray(tenants.body) ? tenants.body : (tenants.body.items ?? []);
  const other = list.find((tenant) => tenant.id !== ownTenant && tenant.name.startsWith('E2E Test Tenant'));
  if (!other) return null;
  const code = `E2E-FOREIGN-${suffix}`;
  const created = await call(superAdmin, 'POST', '/v2/reason-codes', { code, name: 'E2E foreign tenant code' }, { 'Idempotency-Key': randomUUID(), 'X-Tenant-Id': other.id });
  if (created.status !== 201) throw new Error(`foreign code: ${created.status} ${JSON.stringify(created.body)}`);
  return code;
}

export interface EventView {
  id: string;
  classification: { scheduleClass: string };
  classificationBasis: Record<string, { source: string; ruleVersion: number | null }> | null;
}

/** A closed manual downtime of `hours` that started `startHoursAgo` hours ago in the E2E unit. */
export async function downtime(token: string, world: CodesWorld, startHoursAgo: number, hours: number, reasonCodeId?: string): Promise<EventView> {
  const start = Date.now() - startHoursAgo * HOUR;
  const result = await command<EventView>(token, '/v2/production-events', {
    unitId: world.unitId,
    eventType: 'ProductionLoss',
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + hours * HOUR).toISOString(),
    ...(reasonCodeId ? { reasonCodeId } : {}),
  });
  if (result.status !== 201) throw new Error(`event: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

export async function reasonCode(token: string, code: string, name: string, parentId?: string): Promise<{ id: string; version: number }> {
  const result = await command<{ id: string; version: number }>(token, '/v2/reason-codes', { code, name, ...(parentId ? { parentId } : {}) });
  if (result.status !== 201) throw new Error(`reason ${code}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

export async function findCode(token: string, code: string): Promise<{ id: string; version: number; parentId: string | null } | null> {
  // every page: the demo library outgrows one page of 500 as runs add codes
  let cursor: string | null = null;
  do {
    const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const list = await call<{ items: Array<{ id: string; code: string; version: number; parentId: string | null }>; nextCursor: string | null }>(
      token,
      'GET',
      `/v2/reason-codes?limit=500&includeRetired=true${query}`,
    );
    const found = list.body.items.find((item) => item.code === code);
    if (found) return found;
    cursor = list.body.nextCursor ?? null;
  } while (cursor);
  return null;
}

export async function findRule(token: string, name: string): Promise<{ id: string; rowVersion: number; state: string } | null> {
  const list = await call<{ items: Array<{ id: string; name: string; rowVersion: number; state: string }> }>(token, 'GET', '/v2/rules?limit=200');
  return list.body.items.find((item) => item.name === name) ?? null;
}

/** Retires the E2E rule (approver) so it never applies after the run; idempotent. */
export async function retireRule(approver: string, name: string): Promise<void> {
  const rule = await findRule(approver, name);
  if (!rule || rule.state === 'retired') return;
  await call(approver, 'POST', `/v2/rules/${rule.id}/retire`, {}, { 'Idempotency-Key': randomUUID(), 'If-Match': `"${rule.rowVersion}"` });
}
