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
    this.server.emit(`${entity}${event}`, data);
  }

  // Entity-specific event broadcasting methods
  broadcastUserCreated(user: any) {
    this.server.emit('userCreated', user);
  }

  broadcastUserUpdated(user: any) {
    this.server.emit('userUpdated', user);
  }

  broadcastUserDeleted(userId: string) {
    this.server.emit('userDeleted', { id: userId });
  }

  broadcastOrganizationCreated(organization: any) {
    this.server.emit('organizationCreated', organization);
  }

  broadcastOrganizationUpdated(organization: any) {
    this.server.emit('organizationUpdated', organization);
  }

  broadcastOrganizationDeleted(organizationId: string) {
    this.server.emit('organizationDeleted', { id: organizationId });
  }

  broadcastTenantCreated(tenant: any) {
    this.server.emit('tenantCreated', tenant);
  }

  broadcastTenantUpdated(tenant: any) {
    this.server.emit('tenantUpdated', tenant);
  }

  broadcastTenantDeleted(tenantId: string) {
    this.server.emit('tenantDeleted', { id: tenantId });
  }

  broadcastUnitCreated(unit: any) {
    this.server.emit('unitCreated', unit);
  }

  broadcastUnitUpdated(unit: any) {
    this.server.emit('unitUpdated', unit);
  }

  broadcastUnitDeleted(unitId: string) {
    this.server.emit('unitDeleted', { id: unitId });
  }

  broadcastAssetCreated(asset: any) {
    this.server.emit('assetCreated', asset);
  }

  broadcastAssetUpdated(asset: any) {
    this.server.emit('assetUpdated', asset);
  }

  broadcastAssetDeleted(assetId: string) {
    this.server.emit('assetDeleted', { id: assetId });
  }

  broadcastProductionEventCreated(event: any) {
    this.server.emit('productionEventCreated', event);
  }

  broadcastProductionEventUpdated(event: any) {
    this.server.emit('productionEventUpdated', event);
  }

  broadcastProductionEventDeleted(eventId: string) {
    this.server.emit('productionEventDeleted', { id: eventId });
  }

  broadcastRCACreated(rca: any) {
    this.server.emit('rcaCreated', rca);
  }

  broadcastRCAUpdated(rca: any) {
    this.server.emit('rcaUpdated', rca);
  }

  broadcastRCADeleted(rcaId: string) {
    this.server.emit('rcaDeleted', { id: rcaId });
  }

  broadcastTaskCreated(task: any) {
    this.server.emit('taskCreated', task);
  }

  broadcastTaskUpdated(task: any) {
    this.server.emit('taskUpdated', task);
  }

  broadcastTaskDeleted(taskId: string) {
    this.server.emit('taskDeleted', { id: taskId });
  }

  // Generic method for any entity
  broadcastEntityCreated(entityType: string, entity: any) {
    this.server.emit(`${entityType}Created`, entity);
  }

  broadcastEntityUpdated(entityType: string, entity: any) {
    this.server.emit(`${entityType}Updated`, entity);
  }

  broadcastEntityDeleted(entityType: string, entityId: string) {
    this.server.emit(`${entityType}Deleted`, { id: entityId });
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