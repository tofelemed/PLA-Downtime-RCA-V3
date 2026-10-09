/** A message of the scoped realtime channel (backend `src/realtime/realtime-message.ts`). */
export interface RealtimeNotice {
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
  window: { from: string; to: string | null } | null;
}

export interface RoomState {
  room: string;
  headSeq: string | null;
}

/** Ack of `realtime.subscribe`. */
export interface SubscribeAck {
  rooms: RoomState[];
  resync: string[];
  replayed: number;
}

export type ResyncReason = 'gap' | 'reconnect' | 'unknown-position';

/** The part of a socket.io client the realtime client uses (a fake in tests). */
export interface SocketLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  emit(event: string, payload: unknown, ack?: (response: unknown) => void): unknown;
  disconnect(): unknown;
}

export interface RealtimeCredentials {
  token: string;
  tenantId: string;
}

export type SocketFactory = (
  url: string,
  auth: (callback: (data: Partial<RealtimeCredentials>) => void) => void,
) => SocketLike;
