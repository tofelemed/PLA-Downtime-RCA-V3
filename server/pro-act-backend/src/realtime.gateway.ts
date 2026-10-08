import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/socket.io',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('RealtimeGateway');
  private warnedNoServer = false;

  /**
   * Nest only attaches the Socket.IO server inside an HTTP application. The worker process is an
   * application context, so there `server` is undefined and broadcasts are dropped (logged once).
   */
  private emit(event: string, payload: unknown): void {
    if (!this.server) {
      if (!this.warnedNoServer) {
        this.warnedNoServer = true;
        this.logger.log(
          'No Socket.IO server in this process; realtime broadcasts are disabled',
        );
      }
      return;
    }
    this.server.emit(event, payload);
  }

  afterInit(server: Server) {
    this.logger.log('Socket.IO Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Broadcast entity events
  broadcastEntityEvent(event: string, entity: string, data: any) {
    this.emit(`${entity}${event}`, data);
  }

  // Entity-specific event broadcasting methods
  broadcastUserCreated(user: any) {
    this.emit('userCreated', user);
  }

  broadcastUserUpdated(user: any) {
    this.emit('userUpdated', user);
  }

  broadcastUserDeleted(userId: string) {
    this.emit('userDeleted', { id: userId });
  }

  broadcastOrganizationCreated(organization: any) {
    this.emit('organizationCreated', organization);
  }

  broadcastOrganizationUpdated(organization: any) {
    this.emit('organizationUpdated', organization);
  }

  broadcastOrganizationDeleted(organizationId: string) {
    this.emit('organizationDeleted', { id: organizationId });
  }

  broadcastTenantCreated(tenant: any) {
    this.emit('tenantCreated', tenant);
  }

  broadcastTenantUpdated(tenant: any) {
    this.emit('tenantUpdated', tenant);
  }

  broadcastTenantDeleted(tenantId: string) {
    this.emit('tenantDeleted', { id: tenantId });
  }

  broadcastUnitCreated(unit: any) {
    this.emit('unitCreated', unit);
  }

  broadcastUnitUpdated(unit: any) {
    this.emit('unitUpdated', unit);
  }

  broadcastUnitDeleted(unitId: string) {
    this.emit('unitDeleted', { id: unitId });
  }

  broadcastAssetCreated(asset: any) {
    this.emit('assetCreated', asset);
  }

  broadcastAssetUpdated(asset: any) {
    this.emit('assetUpdated', asset);
  }

  broadcastAssetDeleted(assetId: string) {
    this.emit('assetDeleted', { id: assetId });
  }

  broadcastProductionEventCreated(event: any) {
    this.emit('productionEventCreated', event);
  }

  broadcastProductionEventUpdated(event: any) {
    this.emit('productionEventUpdated', event);
  }

  broadcastProductionEventDeleted(eventId: string) {
    this.emit('productionEventDeleted', { id: eventId });
  }

  broadcastRCACreated(rca: any) {
    this.emit('rcaCreated', rca);
  }

  broadcastRCAUpdated(rca: any) {
    this.emit('rcaUpdated', rca);
  }

  broadcastRCADeleted(rcaId: string) {
    this.emit('rcaDeleted', { id: rcaId });
  }

  broadcastTaskCreated(task: any) {
    this.emit('taskCreated', task);
  }

  broadcastTaskUpdated(task: any) {
    this.emit('taskUpdated', task);
  }

  broadcastTaskDeleted(taskId: string) {
    this.emit('taskDeleted', { id: taskId });
  }

  // Generic method for any entity
  broadcastEntityCreated(entityType: string, entity: any) {
    this.emit(`${entityType}Created`, entity);
  }

  broadcastEntityUpdated(entityType: string, entity: any) {
    this.emit(`${entityType}Updated`, entity);
  }

  broadcastEntityDeleted(entityType: string, entityId: string) {
    this.emit(`${entityType}Deleted`, { id: entityId });
  }

  // Join room for specific entity updates
  @SubscribeMessage('joinEntityRoom')
  handleJoinEntityRoom(client: Socket, payload: { entityType: string; entityId: string }) {
    client.join(`${payload.entityType}:${payload.entityId}`);
    this.logger.log(`Client ${client.id} joined room ${payload.entityType}:${payload.entityId}`);
  }

  // Leave room for specific entity updates
  @SubscribeMessage('leaveEntityRoom')
  handleLeaveEntityRoom(client: Socket, payload: { entityType: string; entityId: string }) {
    client.leave(`${payload.entityType}:${payload.entityId}`);
    this.logger.log(`Client ${client.id} left room ${payload.entityType}:${payload.entityId}`);
  }
} 