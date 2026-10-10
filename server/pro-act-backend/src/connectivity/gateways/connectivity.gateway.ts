import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitter } from 'events';
import { RealtimeAuthenticator } from '../../realtime/realtime-authenticator';
import { authenticateSockets, sessionOf } from '../../realtime/socket-auth';

/**
 * Connector status / data pushes. Plan 3.11: the handshake needs an access token (same check as the
 * `/realtime` and `/socket.io` namespaces) and `subscribe_tenant` only admits the caller's tenants.
 * Connection and protocol rooms are not tenant-checked yet (recorded in the 3.11 evidence).
 */
@Injectable()
@WebSocketGateway({
  // the token travels in the handshake, not in cookies: no credentialed CORS needed
  cors: { origin: true, credentials: false },
  namespace: '/connectivity',
})
export class ConnectivityGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConnectivityGateway.name);
  private readonly eventEmitter = new EventEmitter();
  private connectedClients = new Map<string, Socket>();

  constructor(private readonly moduleRef: ModuleRef) {}

  afterInit(server: Server): void {
    authenticateSockets(server, () => {
      try {
        return this.moduleRef.get(RealtimeAuthenticator, { strict: false });
      } catch {
        return null;
      }
    });
  }

  handleConnection(client: Socket) {
    if (!sessionOf(client)) {
      client.disconnect(true);
      return;
    }
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
    
    // Send initial connection status
    client.emit('connected', {
      message: 'Connected to Connectivity Gateway',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe_connection')
  handleSubscribeConnection(
    @MessageBody() data: { connectionId: string; protocol: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Client ${client.id} subscribing to connection ${data.connectionId}`);
    client.join(`connection_${data.connectionId}`);
    
    // Also join protocol-specific room
    if (data.protocol) {
      client.join(`protocol_${data.protocol}`);
    }
    
    client.emit('subscription_confirmed', {
      connectionId: data.connectionId,
      protocol: data.protocol,
      timestamp: new Date().toISOString(),
    });
  }
  
  @SubscribeMessage('subscribe_protocol')
  handleSubscribeProtocol(
    @MessageBody() data: { protocol: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Client ${client.id} subscribing to protocol ${data.protocol}`);
    client.join(`protocol_${data.protocol}`);
    
    client.emit('protocol_subscription_confirmed', {
      protocol: data.protocol,
      timestamp: new Date().toISOString(),
    });
  }
  
  @SubscribeMessage('subscribe_tenant')
  handleSubscribeTenant(
    @MessageBody() data: { tenantId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const context = sessionOf(client)?.context;
    const member =
      !!context &&
      (context.isSuperAdmin ||
        context.tenantId === data?.tenantId ||
        context.scopes.some((scope) => scope.tenantId === data?.tenantId));
    if (!member) {
      client.emit('tenant_subscription_denied', { tenantId: data?.tenantId });
      return;
    }
    this.logger.log(`Client ${client.id} subscribing to tenant ${data.tenantId}`);
    client.join(`tenant_${data.tenantId}`);
    
    client.emit('tenant_subscription_confirmed', {
      tenantId: data.tenantId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('unsubscribe_connection')
  handleUnsubscribeConnection(
    @MessageBody() data: { connectionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Client ${client.id} unsubscribing from connection ${data.connectionId}`);
    client.leave(`connection_${data.connectionId}`);
  }

  @SubscribeMessage('request_data')
  handleRequestData(
    @MessageBody() data: { connectionId: string; nodes?: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Client ${client.id} requesting data from connection ${data.connectionId}`);
    
    // Emit event for protocol services to handle
    this.eventEmitter.emit('data_request', {
      connectionId: data.connectionId,
      clientId: client.id,
      nodes: data.nodes,
    });
  }


  // Method to broadcast connection status updates
  broadcastConnectionStatus(connectionId: string, protocol: string, status: any) {
    const statusUpdate = {
      connectionId,
      protocol,
      status,
      timestamp: new Date().toISOString(),
    };
    
    // Broadcast to room subscribers
    this.server.to(`connection_${connectionId}`).emit('connection_status', statusUpdate);
    
    // Also broadcast to protocol-specific rooms
    this.server.to(`protocol_${protocol}`).emit('connection_status', statusUpdate);
    
    // Broadcast system-wide for important status changes
    if (status.status === 'connected' || status.status === 'error' || status.status === 'disconnected') {
      this.server.emit('connection_status_changed', statusUpdate);
    }
  }
  
  // Method to broadcast connection health updates
  broadcastConnectionHealth(connectionId: string, protocol: string, health: any) {
    this.server.to(`connection_${connectionId}`).emit('connection_health', {
      connectionId,
      protocol,
      health,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Method to broadcast data from connections
  broadcastConnectionData(connectionId: string, protocol: string, data: any) {
    this.server.to(`connection_${connectionId}`).emit('connection_data', {
      connectionId,
      protocol,
      data,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Method to broadcast errors
  broadcastConnectionError(connectionId: string, protocol: string, error: any) {
    this.server.to(`connection_${connectionId}`).emit('connection_error', {
      connectionId,
      protocol,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast system-wide notifications
  broadcastSystemNotification(notification: any) {
    this.server.emit('system_notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  // Get event emitter for protocol services to use
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
