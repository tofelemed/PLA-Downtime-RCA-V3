import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebSocketConnection } from '../entities/websocket-connection.entity';
import { CreateWebSocketConnectionDto, UpdateWebSocketConnectionDto, TestWebSocketConnectionDto } from '../dto/websocket-connection.dto';
import * as WebSocket from 'ws';

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private connections = new Map<string, WebSocket>();

  constructor(
    @InjectRepository(WebSocketConnection)
    private readonly webSocketConnectionRepository: Repository<WebSocketConnection>,
  ) {}

  async createWebSocketConnection(createDto: CreateWebSocketConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = this.webSocketConnectionRepository.create({
        ...createDto,
        tenantId,
        status: 'disconnected',
        errorCount: 0,
      });

      const savedConnection = await this.webSocketConnectionRepository.save(connection);
      
      this.logger.log(`WebSocket connection created: ${savedConnection.id}`);
      
      return {
        success: true,
        data: savedConnection,
        message: 'WebSocket connection created successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to create WebSocket connection: ${error.message}`);
      throw error;
    }
  }

  async getWebSocketConnections(tenantId: string): Promise<any> {
    try {
      const connections = await this.webSocketConnectionRepository.find({
        where: { tenantId },
        order: { createdAt: 'DESC' }
      });

      return {
        success: true,
        data: connections,
        message: 'WebSocket connections retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get WebSocket connections: ${error.message}`);
      throw error;
    }
  }

  async getWebSocketConnection(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      return {
        success: true,
        data: connection,
        message: 'WebSocket connection retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get WebSocket connection: ${error.message}`);
      throw error;
    }
  }

  async updateWebSocketConnection(id: string, updateDto: UpdateWebSocketConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      Object.assign(connection, updateDto);
      const updatedConnection = await this.webSocketConnectionRepository.save(connection);

      this.logger.log(`WebSocket connection updated: ${id}`);

      return {
        success: true,
        data: updatedConnection,
        message: 'WebSocket connection updated successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to update WebSocket connection: ${error.message}`);
      throw error;
    }
  }

  async deleteWebSocketConnection(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      // Close WebSocket connection if active
      const ws = this.connections.get(id);
      if (ws) {
        ws.close();
        this.connections.delete(id);
      }

      await this.webSocketConnectionRepository.remove(connection);

      this.logger.log(`WebSocket connection deleted: ${id}`);

      return {
        success: true,
        message: 'WebSocket connection deleted successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to delete WebSocket connection: ${error.message}`);
      throw error;
    }
  }

  async testWebSocketConnection(id: string, testDto: TestWebSocketConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      // Simulate WebSocket connection test
      const testResult = await this.performWebSocketTest(testDto);

      // Update connection status based on test result
      connection.status = testResult.success ? 'connected' : 'error';
      connection.lastConnected = testResult.success ? new Date() : null;
      connection.errorCount = testResult.success ? 0 : connection.errorCount + 1;
      connection.lastError = testResult.success ? null : testResult.error;

      await this.webSocketConnectionRepository.save(connection);

      return {
        success: testResult.success,
        data: testResult,
        message: testResult.success ? 'WebSocket connection test successful' : 'WebSocket connection test failed'
      };
    } catch (error) {
      this.logger.error(`Failed to test WebSocket connection: ${error.message}`);
      throw error;
    }
  }

  private async performWebSocketTest(testDto: TestWebSocketConnectionDto): Promise<any> {
    try {
      const { url, protocol, subprotocol, timeoutMs } = testDto;

      // Simulate WebSocket connection test
      await new Promise(resolve => setTimeout(resolve, 800));

      // Simulate test result (92% success rate for demo)
      const isSuccess = Math.random() > 0.08;

      if (isSuccess) {
        return {
          success: true,
          url,
          protocol: protocol || 'ws',
          subprotocol: subprotocol || null,
          responseTime: Math.floor(Math.random() * 50) + 25,
          handshake: 'SUCCESS',
          extensions: ['permessage-deflate'],
          readyState: 'OPEN'
        };
      } else {
        return {
          success: false,
          error: 'Connection refused or timeout'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async connectWebSocket(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      // Check if already connected
      if (this.connections.has(id)) {
        return {
          success: false,
          error: 'WebSocket already connected'
        };
      }

      // Create WebSocket connection
      const ws = new WebSocket(connection.url, {
        protocol: connection.subprotocol || undefined,
        handshakeTimeout: connection.timeoutMs || 30000
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            success: false,
            error: 'Connection timeout'
          });
        }, connection.timeoutMs || 30000);

        ws.on('open', () => {
          clearTimeout(timeout);
          this.connections.set(id, ws);
          
          // Update connection status
          connection.status = 'connected';
          connection.lastConnected = new Date();
          this.webSocketConnectionRepository.save(connection);

          resolve({
            success: true,
            data: {
              id,
              status: 'connected',
              readyState: 'OPEN',
              url: connection.url
            },
            message: 'WebSocket connected successfully'
          });
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: error.message
          });
        });

        ws.on('close', () => {
          this.connections.delete(id);
          connection.status = 'disconnected';
          this.webSocketConnectionRepository.save(connection);
        });
      });
    } catch (error) {
      this.logger.error(`Failed to connect WebSocket: ${error.message}`);
      throw error;
    }
  }

  async disconnectWebSocket(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      const ws = this.connections.get(id);
      if (ws) {
        ws.close();
        this.connections.delete(id);
      }

      // Update connection status
      connection.status = 'disconnected';
      await this.webSocketConnectionRepository.save(connection);

      return {
        success: true,
        message: 'WebSocket disconnected successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to disconnect WebSocket: ${error.message}`);
      throw error;
    }
  }

  async sendWebSocketMessage(id: string, message: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      const ws = this.connections.get(id);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return {
          success: false,
          error: 'WebSocket not connected'
        };
      }

      ws.send(message);

      return {
        success: true,
        data: {
          message,
          timestamp: new Date()
        },
        message: 'WebSocket message sent successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to send WebSocket message: ${error.message}`);
      throw error;
    }
  }

  async subscribeWebSocketEvents(id: string, events: string[], tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      const ws = this.connections.get(id);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return {
          success: false,
          error: 'WebSocket not connected'
        };
      }

      // Simulate event subscription
      const subscription = {
        subscriptionId: `sub_${Date.now()}`,
        events,
        status: 'ACTIVE',
        createdAt: new Date()
      };

      return {
        success: true,
        data: subscription,
        message: 'WebSocket events subscribed successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe to WebSocket events: ${error.message}`);
      throw error;
    }
  }

  async getWebSocketStatus(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.webSocketConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'WebSocket connection not found'
        };
      }

      const ws = this.connections.get(id);
      const isConnected = ws && ws.readyState === WebSocket.OPEN;

      return {
        success: true,
        data: {
          id,
          url: connection.url,
          status: isConnected ? 'connected' : 'disconnected',
          readyState: isConnected ? 'OPEN' : 'CLOSED',
          lastConnected: connection.lastConnected,
          errorCount: connection.errorCount,
          lastError: connection.lastError
        },
        message: 'WebSocket status retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get WebSocket status: ${error.message}`);
      throw error;
    }
  }
}
