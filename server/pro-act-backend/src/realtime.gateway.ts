import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeAuthenticator } from './realtime/realtime-authenticator';
import { roomsForContext, roomsForMessage } from './realtime/realtime-rooms';
import {
  authenticateSockets,
  sessionOf,
  scheduleTokenExpiry,
  clearTokenExpiry,
} from './realtime/socket-auth';

/** Tenant and unit a v1 broadcast is about, read from the entity it carries. */
export interface BroadcastScope {
  tenantId: string;
  unitId?: string | null;
}

/**
 * Legacy v1 entity broadcasts on the `/socket.io` namespace (v1 screens, decision C4).
 *
 * Plan 3.11 (T14): the handshake must carry `auth: { token, tenantId? }` (the same JWT and tenant
 * selection as HTTP, via `RealtimeAuthenticator`); a socket joins only the tenant / unit rooms of its
 * RequestContext (`realtime-rooms.ts`) and is disconnected when its token expires. A broadcast goes only to
 * the rooms of the entity's tenant (and unit); one whose tenant cannot be determined is dropped, never
 * sent to everyone. Clients cannot join rooms themselves.
 */
@WebSocketGateway({
  // the token travels in the handshake, not in cookies: no credentialed CORS needed
  cors: { origin: true, credentials: false },
  namespace: '/socket.io',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger('RealtimeGateway');
  private warnedNoServer = false;

  constructor(private readonly moduleRef: ModuleRef) {}

  afterInit(server: Server): void {
    authenticateSockets(server, () => this.authenticator());
  }

  handleConnection(client: Socket): void {
    const session = sessionOf(client);
    if (!session) {
      client.disconnect(true);
      return;
    }
    void client.join(roomsForContext(session.context));
    scheduleTokenExpiry(client, session, this.logger);
  }

  handleDisconnect(client: Socket): void {
    clearTokenExpiry(client);
  }

  /** `<entity><event>` (e.g. `productionEventUpdated`) to the entity's tenant / unit rooms. */
  broadcastEntityEvent(
    event: string,
    entity: string,
    data: unknown,
    scope?: BroadcastScope,
  ): void {
    this.emit(`${entity}${event}`, data, scope);
  }

  broadcastProductionEventCreated(
    event: unknown,
    scope?: BroadcastScope,
  ): void {
    this.emit('productionEventCreated', event, scope);
  }

  broadcastProductionEventUpdated(
    event: unknown,
    scope?: BroadcastScope,
  ): void {
    this.emit('productionEventUpdated', event, scope);
  }

  broadcastEntityCreated(entityType: string, entity: unknown): void {
    this.emit(`${entityType}Created`, entity);
  }

  broadcastEntityUpdated(entityType: string, entity: unknown): void {
    this.emit(`${entityType}Updated`, entity);
  }

  broadcastEntityDeleted(entityType: string, entityId: string): void {
    this.emit(`${entityType}Deleted`, { id: entityId });
  }

  /**
   * Nest only attaches the Socket.IO server inside an HTTP application. The worker process is an
   * application context, so there `server` is undefined and broadcasts are dropped (logged once).
   */
  private emit(event: string, payload: unknown, scope?: BroadcastScope): void {
    if (!this.server) {
      if (!this.warnedNoServer) {
        this.warnedNoServer = true;
        this.logger.log(
          'No Socket.IO server in this process; realtime broadcasts are disabled',
        );
      }
      return;
    }
    const target = scope ?? scopeOfPayload(payload);
    if (!target) {
      this.logger.debug(`Dropped ${event}: no tenant to address it to`);
      return;
    }
    const units = target.unitId ? [target.unitId] : [];
    this.server
      .to(roomsForMessage(target.tenantId, units))
      .emit(event, payload);
  }

  private authenticator(): RealtimeAuthenticator | null {
    try {
      return this.moduleRef.get(RealtimeAuthenticator, { strict: false });
    } catch {
      return null;
    }
  }
}

/** Tenant (and unit) of a v1 entity payload: `tenantId` / `tenant_id`, `unitId` / `unit_id`. */
export function scopeOfPayload(payload: unknown): BroadcastScope | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const tenantId = firstString(record.tenantId, record.tenant_id);
  if (!tenantId) return null;
  return { tenantId, unitId: firstString(record.unitId, record.unit_id) };
}

function firstString(...values: unknown[]): string | null {
  const found = values.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return found ?? null;
}
