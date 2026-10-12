import { createLogger } from '@/lib/logger';
import {
  RealtimeCredentials,
  RealtimeNotice,
  ResyncReason,
  SocketFactory,
  SocketLike,
  SubscribeAck,
} from './realtime-types';

const log = createLogger('ScopedSocket');

export interface ScopedSocketHandlers {
  /** a new (deduplicated, in-order) notice for the acting tenant */
  onNotice(notice: RealtimeNotice): void;
  /** messages may have been missed: refetch the snapshot of these rooms */
  onResync(rooms: string[], reason: ResyncReason): void;
  /** the socket connected (true) or lost / could not open its connection (false) */
  onConnectionChange?(connected: boolean): void;
}

/** Remembers the last `capacity` ids (dedupe across replays and multi-room deliveries). */
export class RecentIds {
  private readonly ids = new Set<string>();
  constructor(private readonly capacity = 2000) {}

  /** true the first time an id is seen */
  add(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.capacity) {
      const oldest = this.ids.values().next().value;
      if (oldest !== undefined) this.ids.delete(oldest);
    }
    return true;
  }
}

const isNotice = (value: unknown): value is RealtimeNotice =>
  typeof value === 'object' && value !== null && typeof (value as RealtimeNotice).seq === 'string';

const isAck = (value: unknown): value is SubscribeAck =>
  typeof value === 'object' && value !== null && Array.isArray((value as SubscribeAck).rooms);

/**
 * Client of the scoped realtime channel (plan 3.1, API05). Authenticates with the access token in the
 * handshake (`auth`, never the URL), subscribes with the last `seq` per room, dedupes by
 * `domainEventId` and turns any gap — a `prevSeq` that is not the last seen `seq`, a reconnect without a
 * known position, or a server `resync` — into `onResync` instead of applying partial data.
 */
export class ScopedRealtimeClient {
  private socket: SocketLike | null = null;
  private readonly lastSeq = new Map<string, string>();
  private readonly seen = new RecentIds();
  private connectedBefore = false;

  constructor(
    private readonly factory: SocketFactory,
    private readonly handlers: ScopedSocketHandlers,
    private readonly credentials: () => RealtimeCredentials | null,
  ) {}

  start(url: string): void {
    if (this.socket) return;
    const socket = this.factory(url, (callback) => callback(this.credentials() ?? {}));
    socket.on('connect', () => {
      this.handlers.onConnectionChange?.(true);
      this.subscribe();
    });
    socket.on('disconnect', () => this.handlers.onConnectionChange?.(false));
    socket.on('realtime.message', (payload) => this.receive(payload));
    socket.on('realtime.error', (payload) => log.warn('Realtime channel error', payload));
    socket.on('connect_error', (error) => {
      this.handlers.onConnectionChange?.(false);
      log.warn('Realtime connection refused', (error as Error)?.message);
    });
    this.socket = socket;
  }

  stop(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.lastSeq.clear();
    this.connectedBefore = false;
  }

  /** Re-reads grants on the server (permission or plant change) and resumes every room. */
  subscribe(): void {
    const reconnect = this.connectedBefore;
    this.connectedBefore = true;
    const sinceSeq = Object.fromEntries(this.lastSeq);
    this.socket?.emit('realtime.subscribe', { sinceSeq }, (ack) => this.applyAck(ack, reconnect));
  }

  /** Handles one delivered message; exposed for tests. */
  receive(payload: unknown): void {
    if (!isNotice(payload)) return;
    const tenantId = this.credentials()?.tenantId;
    if (tenantId && payload.scope?.tenantId !== tenantId) return;
    const last = this.lastSeq.get(payload.room);
    // a replayed copy at or before the room's position changes nothing
    if (last !== undefined && Number(payload.seq) <= Number(last)) return;
    this.lastSeq.set(payload.room, payload.seq);
    if (last !== undefined && payload.prevSeq !== last) {
      this.handlers.onResync([payload.room], 'gap');
    }
    // the same domain event delivered to two rooms (multi-unit change) is handled once
    if (this.seen.add(payload.domainEventId)) this.handlers.onNotice(payload);
  }

  /** Room positions after (re)subscribing; exposed for tests. */
  applyAck(ack: unknown, reconnect: boolean): void {
    if (!isAck(ack)) return;
    const rooms = new Set(ack.rooms.map((state) => state.room));
    for (const room of [...this.lastSeq.keys()]) {
      if (!rooms.has(room)) this.lastSeq.delete(room);
    }
    const unknown: string[] = [];
    for (const state of ack.rooms) {
      if (!this.lastSeq.has(state.room) && reconnect) unknown.push(state.room);
      if (!this.lastSeq.has(state.room) || ack.resync.includes(state.room)) {
        if (state.headSeq) this.lastSeq.set(state.room, state.headSeq);
        else this.lastSeq.delete(state.room);
      }
    }
    if (ack.resync.length > 0) this.handlers.onResync(ack.resync, 'reconnect');
    const rest = unknown.filter((room) => !ack.resync.includes(room));
    if (rest.length > 0) this.handlers.onResync(rest, 'unknown-position');
  }
}
