import { RequestContext } from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';

/**
 * Rooms of the scoped realtime channel (plan 3.1, API05). A socket joins exactly one kind:
 *
 * - `tenant:<id>` when its grant covers the whole tenant (SuperAdmin, tenant/site grants, legacy users)
 * - `tenant:<id>:unit:<id>` for each unit of a unit-limited grant
 *
 * A message about a unit goes to the tenant room and to that unit's room; a message without a unit
 * goes to the tenant room only, so a unit-limited user never learns about another unit or tenant.
 */
export function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function unitRoom(tenantId: string, unitId: string): string {
  return `tenant:${tenantId}:unit:${unitId}`;
}

/** Rooms the identity may listen to in its acting tenant; empty without a tenant. */
export function roomsForContext(context: RequestContext): string[] {
  const tenantId = context.tenantId;
  if (!tenantId) return [];
  const units = restrictedUnitIds(context, tenantId);
  if (units === null) return [tenantRoom(tenantId)];
  return [...new Set(units)].map((unitId) => unitRoom(tenantId, unitId));
}

/** Rooms a message of `tenantId` about `unitIds` (empty = tenant-wide) is delivered to. */
export function roomsForMessage(
  tenantId: string,
  unitIds: readonly string[],
): string[] {
  return [
    tenantRoom(tenantId),
    ...[...new Set(unitIds)].map((unitId) => unitRoom(tenantId, unitId)),
  ];
}

/** Unit a unit room is about, or null for the tenant room. */
export function unitOfRoom(room: string): string | null {
  const match = /^tenant:[^:]+:unit:(.+)$/.exec(room);
  return match ? match[1] : null;
}
