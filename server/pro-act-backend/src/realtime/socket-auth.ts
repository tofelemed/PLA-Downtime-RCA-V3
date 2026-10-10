import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  credentialsOf,
  RealtimeAuthenticator,
  RealtimeAuthError,
  RealtimeSession,
} from './realtime-authenticator';

interface SocketData {
  session?: RealtimeSession;
  expiryTimer?: NodeJS.Timeout;
}

const MAX_TIMER_MS = 2_147_000_000;

/**
 * Handshake authentication for the legacy namespaces (plan 3.11): `auth: { token, tenantId? }` is
 * verified like an HTTP request (access token only, tenant selection validated); a refused handshake
 * fails with `UNAUTHENTICATED` / `TENANT_REQUIRED` / `FORBIDDEN`. Without an authenticator (a process
 * that does not serve sockets) every handshake is refused.
 */
export function authenticateSockets(
  server: Server,
  authenticator: () => RealtimeAuthenticator | null,
): void {
  server.use((socket, next) => {
    const instance = authenticator();
    if (!instance) {
      next(new Error('UNAUTHENTICATED'));
      return;
    }
    instance
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

export function sessionOf(socket: Socket): RealtimeSession | undefined {
  return (socket.data as SocketData).session;
}

/** Disconnects the socket when its token expires; the client reconnects with a fresh token. */
export function scheduleTokenExpiry(
  socket: Socket,
  session: RealtimeSession,
  logger: Logger,
): void {
  clearTokenExpiry(socket);
  if (session.expiresAt === null) return;
  const delay = Math.min(
    Math.max(session.expiresAt - Date.now(), 0),
    MAX_TIMER_MS,
  );
  const data = socket.data as SocketData;
  data.expiryTimer = setTimeout(() => {
    logger.debug(`Token expired; disconnecting ${socket.id}`);
    socket.disconnect(true);
  }, delay);
  data.expiryTimer.unref?.();
}

export function clearTokenExpiry(socket: Socket): void {
  const data = socket.data as SocketData;
  if (data.expiryTimer) clearTimeout(data.expiryTimer);
  data.expiryTimer = undefined;
}
