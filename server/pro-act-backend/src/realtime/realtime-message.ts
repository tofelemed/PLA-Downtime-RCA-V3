import { roomsForMessage, unitOfRoom } from './realtime-rooms';

/** Outbox row as the realtime feed reads it (`id` is the bigint sequence as text). */
export interface OutboxFeedRow {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  created_at: Date | string;
}

/**
 * What a browser receives (plan 3.1): an invalidation hint, never the payload. `seq` is the outbox id
 * (monotonic per tenant stream), `prevSeq` the previous `seq` delivered to the same room by this server
 * process (null for its first one): a client whose last seen `seq` differs from `prevSeq` missed
 * something and refetches its snapshot instead of trusting partial data.
 */
export interface RealtimeMessage {
  domainEventId: string;
  room: string;
  seq: string;
  prevSeq: string | null;
  type: string;
  entityType: string;
  entityId: string;
  revision: number;
  occurredAt: string;
  scope: { tenantId: string; unitIds: string[] };
  /** interval the change touches, when the message names one (ISO 8601, `to` null = open) */
  window: { from: string; to: string | null } | null;
}

export type RoutedMessage = Omit<RealtimeMessage, 'prevSeq'>;

/**
 * Message types never forwarded to browsers: per-observation intake traffic carries no state a screen
 * shows and would flood the channel.
 */
export const REALTIME_EXCLUDED_TYPES: ReadonlySet<string> = new Set([
  'RawAccepted',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

/** Units a payload is about: `unitId`, else every uuid of `unitIds`. */
export function unitIdsOf(payload: Record<string, unknown>): string[] {
  if (isUuid(payload.unitId)) return [payload.unitId];
  const list = payload.unitIds;
  return Array.isArray(list) ? [...new Set(list.filter(isUuid))] : [];
}

const WINDOW_FIELDS: ReadonlyArray<[string, string]> = [
  ['affectedFrom', 'affectedTo'],
  ['utcStart', 'utcEnd'],
  ['validFrom', 'validTo'],
  ['from', 'to'],
];

export function windowOf(
  payload: Record<string, unknown>,
): RealtimeMessage['window'] {
  for (const [fromKey, toKey] of WINDOW_FIELDS) {
    const from = payload[fromKey];
    if (typeof from !== 'string') continue;
    const to = payload[toKey];
    return { from, to: typeof to === 'string' ? to : null };
  }
  return null;
}

/**
 * One message per room of the row (tenant room + one per unit). Unit rooms see only their own unit in
 * `scope.unitIds`; the tenant room sees all of them.
 */
export function routeOutboxRow(row: OutboxFeedRow): RoutedMessage[] {
  if (REALTIME_EXCLUDED_TYPES.has(row.type) || !isUuid(row.tenant_id)) {
    return [];
  }
  const payload = row.payload ?? {};
  const unitIds = unitIdsOf(payload);
  const domainEventId = isUuid(payload.domainEventId)
    ? payload.domainEventId
    : `outbox:${row.id}`;
  const base = {
    domainEventId,
    seq: String(row.id),
    type: row.type,
    entityType: row.aggregate_type,
    entityId: row.aggregate_id,
    revision: Number(row.version) || 0,
    occurredAt: new Date(row.created_at).toISOString(),
    window: windowOf(payload),
  };
  return roomsForMessage(row.tenant_id, unitIds).map((room) => {
    const unit = unitOfRoom(room);
    return {
      ...base,
      room,
      scope: { tenantId: row.tenant_id, unitIds: unit ? [unit] : unitIds },
    };
  });
}
