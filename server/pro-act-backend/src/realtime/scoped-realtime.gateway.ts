import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  credentialsOf,
  RealtimeAuthenticator,
  RealtimeAuthError,
  RealtimeSession,
} from './realtime-authenticator';
import { RealtimeMessage } from './realtime-message';
import { roomsForContext } from './realtime-rooms';
import { ReplayBuffer, ResumeResult } from './replay-buffer';

/** Server → client event names of the scoped channel. */
export const REALTIME_EVENTS = {
  message: 'realtime.message',
  ready: 'realtime.ready',
  subscribe: 'realtime.subscribe',
} as const;

export interface RoomState {
  room: string;
  headSeq: string | null;
}

/** Ack of `realtime.subscribe` (and payload of `realtime.ready`). */
export interface SubscribeAck {
  rooms: RoomState[];
  /** rooms whose missed messages are not available: refetch their snapshot */
  resync: string[];
  replayed: number;
}

interface SocketData {
  session?: RealtimeSession;
  expiryTimer?: NodeJS.Timeout;
}

/** The sink the realtime feed delivers to (the gateway; a fake in tests). */
export interface RealtimeSink {
  deliver(message: RealtimeMessage): void;
}

const MAX_TIMER_MS = 2_147_000_000;

/**
 * Authenticated, scoped realtime channel (plan 3.1, API05) on the `/realtime` namespace. The handshake
 * must carry `auth: { token, tenantId? }`; the socket joins only the rooms of its `RequestContext`
 * (`realtime-rooms.ts`) and is disconnected when its token expires (the client reconnects with a fresh
 * one). `realtime.subscribe { sinceSeq: { [room]: seq } }` re-reads the grants (re-join after a
 * permission change) and replays what the room buffer still holds, or names the rooms to resync.
 * The legacy `/socket.io` namespace (RealtimeGateway) is unchanged for v1 screens.
 */
@WebSocketGateway({
  namespace: '/realtime',
  // the token travels in the handshake, not in cookies: no credentialed CORS needed
  cors: { origin: true, credentials: false },
})
export class ScopedRealtimeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    RealtimeSink
{
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger(ScopedRealtimeGateway.name);
  readonly buffer = new ReplayBuffer(
    Number(process.env.REALTIME_REPLAY_SIZE) || 500,
  );

  constructor(private readonly authenticator: RealtimeAuthenticator) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      this.authenticator
        .authenticate(credentialsOf(socket.handshake.auth))
        .then((session) => {
          (socket.data as SocketData).session = session;
          next();
        })
        .catch((error: unknown) => {
          const code =
            error instanceof RealtimeAuthError ? error.code : 'UNAUTHENTICATED';
          next(new Error(code));
        });
    });
  }

  handleConnection(socket: Socket): void {
    const session = (socket.data as SocketData).session;
    if (!session) {
      socket.disconnect(true);
      return;
    }
    const ack = this.applySession(socket, session, {});
    socket.emit(REALTIME_EVENTS.ready, ack);
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as SocketData;
    if (data.expiryTimer) clearTimeout(data.expiryTimer);
  }

  @SubscribeMessage(REALTIME_EVENTS.subscribe)
  async handleSubscribe(
    socket: Socket,
    payload: unknown,
  ): Promise<SubscribeAck | { error: string }> {
    const previous = (socket.data as SocketData).session;
    try {
      const session = await this.authenticator.authenticate(
        previous ? previous.credentials : null,
      );
      return this.applySession(socket, session, sinceSeqOf(payload));
    } catch (error) {
      const code =
        error instanceof RealtimeAuthError ? error.code : 'UNAUTHENTICATED';
      socket.emit('realtime.error', { code });
      socket.disconnect(true);
      return { error: code };
    }
  }

  deliver(message: RealtimeMessage): void {
    this.server?.to(message.room).emit(REALTIME_EVENTS.message, message);
  }

  /** Joins exactly the session's rooms (leaving any other) and answers each room's resume state. */
  applySession(
    socket: Socket,
    session: RealtimeSession,
    sinceSeq: Record<string, string>,
  ): SubscribeAck {
    const data = socket.data as SocketData;
    data.session = session;
    this.scheduleExpiry(socket, session);
    const rooms = roomsForContext(session.context);
    for (const joined of [...socket.rooms]) {
      if (joined !== socket.id && !rooms.includes(joined))
        void socket.leave(joined);
    }
    void socket.join(rooms);
    const ack: SubscribeAck = { rooms: [], resync: [], replayed: 0 };
    for (const room of rooms) {
      const result = this.buffer.resume(room, sinceSeq[room]);
      ack.rooms.push({ room, headSeq: result.headSeq });
      ack.replayed += this.replay(socket, result);
      if (result.kind === 'resync') ack.resync.push(room);
    }
    return ack;
  }

  private replay(socket: Socket, result: ResumeResult): number {
    if (result.kind !== 'replay') return 0;
    for (const message of result.messages) {
      socket.emit(REALTIME_EVENTS.message, message);
    }
    return result.messages.length;
  }

  private scheduleExpiry(socket: Socket, session: RealtimeSession): void {
    const data = socket.data as SocketData;
    if (data.expiryTimer) clearTimeout(data.expiryTimer);
    if (session.expiresAt === null) return;
    const delay = Math.min(
      Math.max(session.expiresAt - Date.now(), 0),
      MAX_TIMER_MS,
    );
    data.expiryTimer = setTimeout(() => {
      this.logger.debug(`Token expired; disconnecting ${socket.id}`);
      socket.emit('realtime.error', { code: 'TOKEN_EXPIRED' });
      socket.disconnect(true);
    }, delay);
    data.expiryTimer.unref?.();
  }
}

/** `{ sinceSeq: { room: seq } }` with string values only; anything else is ignored. */
export function sinceSeqOf(payload: unknown): Record<string, string> {
  if (typeof payload !== 'object' || payload === null) return {};
  const raw = (payload as { sinceSeq?: unknown }).sinceSeq;
  if (typeof raw !== 'object' || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}
