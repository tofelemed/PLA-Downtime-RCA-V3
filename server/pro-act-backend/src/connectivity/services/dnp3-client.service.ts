import { Injectable, Logger } from '@nestjs/common';
import { DNP3Connection } from '../entities/dnp3-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';

export interface DNP3Session {
  connectionId: string;
  client: any; // DNP3 client instance
  connection: DNP3Connection;
  isConnected: boolean;
  lastActivity: Date;
  sessionId: string;
}

@Injectable()
export class DNP3ClientService {
  private readonly logger = new Logger(DNP3ClientService.name);
  private sessions: Map<string, DNP3Session> = new Map();

  constructor(
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
    private connectivityGateway: ConnectivityGateway,
  ) {}

  /**
   * Connect to DNP3 device
   */
  async connect(connection: DNP3Connection): Promise<DNP3Session> {
    const connectionId = connection.id;
    
    try {
      this.logger.log(`Connecting to DNP3 device: ${connection.name}`);

      // Create DNP3 client based on connection type
      let client: any;
      
      if (connection.connectionType === 'tcp') {
        // TCP connection
        client = new (require('dnp3').TCPClient)({
          host: connection.ipAddress,
          port: connection.port || 20000,
          timeout: connection.timeoutMs || 10000,
          retries: connection.retryCount || 3,
        });
             } else if (connection.connectionType === 'serial') {
         // Serial connection - using metadata for serial configuration
         const serialConfig = connection.metadata?.serial || {};
         client = new (require('dnp3').SerialClient)({
           port: serialConfig.port || 'COM1',
           baudRate: serialConfig.baudRate || 9600,
           dataBits: serialConfig.dataBits || 8,
           stopBits: serialConfig.stopBits || 1,
           parity: serialConfig.parity || 'none',
           timeout: connection.timeoutMs || 10000,
         });
      } else {
        throw new Error(`Unsupported connection type: ${connection.connectionType}`);
      }

      // Connect to device
      await new Promise<void>((resolve, reject) => {
        client.connect((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Set up event handlers
      client.on('error', (error: any) => {
        this.logger.error(`DNP3 client error for connection ${connectionId}: ${error.message}`);
        this.handleConnectionError(connectionId, error);
      });

      client.on('close', () => {
        this.logger.log(`DNP3 connection closed for ${connectionId}`);
        this.handleConnectionClose(connectionId);
      });

      // Create session
      const session: DNP3Session = {
        connectionId,
        client,
        connection,
        isConnected: true,
        lastActivity: new Date(),
        sessionId: `dnp3_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Store session
      this.sessions.set(connectionId, session);

             // Record health status
       await this.recordHealthStatus(connection, 'connected', undefined, {
         connectionType: 'dnp3',
         protocolType: connection.connectionType,
         ipAddress: connection.ipAddress,
         port: connection.port,
         sourceAddress: connection.sourceAddress,
         destinationAddress: connection.destinationAddress,
         testTimestamp: new Date().toISOString(),
       });

      // Broadcast connection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'dnp3', {
        status: 'connected',
        message: 'Successfully connected to DNP3 device',
        timestamp: new Date(),
        sessionId: session.sessionId,
      });

      this.logger.log(`Successfully connected to DNP3 device: ${connection.name}`);
      return session;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to connect to DNP3 device: ${errorMessage}`);
      
             // Record health status
       await this.recordHealthStatus(connection, 'error', errorMessage, {
         connectionType: 'dnp3',
         protocolType: connection.connectionType,
         ipAddress: connection.ipAddress,
         port: connection.port,
         sourceAddress: connection.sourceAddress,
         destinationAddress: connection.destinationAddress,
         error: errorMessage,
         testTimestamp: new Date().toISOString(),
       });

      // Broadcast connection failure
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'dnp3', {
        status: 'error',
        message: `Connection failed: ${errorMessage}`,
        timestamp: new Date(),
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Disconnect from DNP3 device
   */
  async disconnect(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) {
      this.logger.warn(`No active session found for connection: ${connectionId}`);
      return;
    }

    try {
      this.logger.log(`Disconnecting from DNP3 device: ${session.connection.name}`);

      // Close client connection
      if (session.client && session.client.close) {
        await new Promise<void>((resolve) => {
          session.client.close(() => resolve());
        });
      }

      // Update session
      session.isConnected = false;
      session.lastActivity = new Date();

             // Record health status
       await this.recordHealthStatus(session.connection, 'disconnected', undefined, {
         connectionType: 'dnp3',
         protocolType: session.connection.connectionType,
         ipAddress: session.connection.ipAddress,
         port: session.connection.port,
         sourceAddress: session.connection.sourceAddress,
         destinationAddress: session.connection.destinationAddress,
         testTimestamp: new Date().toISOString(),
       });

      // Broadcast disconnection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'dnp3', {
        status: 'disconnected',
        message: 'Disconnected from DNP3 device',
        timestamp: new Date(),
      });

      this.logger.log(`Successfully disconnected from DNP3 device: ${session.connection.name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error during DNP3 disconnection: ${errorMessage}`);
    } finally {
      // Remove session
      this.sessions.delete(connectionId);
    }
  }

  /**
   * Read DNP3 points
   */
  async readPoints(connectionId: string, group: number, variation: number, startIndex: number, count: number): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Reading DNP3 points: Group ${group}, Variation ${variation}, Start ${startIndex}, Count ${count}`);

      // Update last activity
      session.lastActivity = new Date();

      // Read points using DNP3 client
      const result = await new Promise<any>((resolve, reject) => {
        session.client.read({
          group,
          variation,
          startIndex,
          count,
        }, (err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      this.logger.log(`Successfully read ${count} DNP3 points`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to read DNP3 points: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Write DNP3 points
   */
  async writePoints(connectionId: string, group: number, variation: number, startIndex: number, values: any[]): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Writing DNP3 points: Group ${group}, Variation ${variation}, Start ${startIndex}, Count ${values.length}`);

      // Update last activity
      session.lastActivity = new Date();

      // Write points using DNP3 client
      await new Promise<void>((resolve, reject) => {
        session.client.write({
          group,
          variation,
          startIndex,
          values,
        }, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.logger.log(`Successfully wrote ${values.length} DNP3 points`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to write DNP3 points: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(connectionId: string): any {
    const session = this.sessions.get(connectionId);
    if (!session) {
      return { status: 'not_connected', message: 'No active connection' };
    }

    return {
      status: session.isConnected ? 'connected' : 'disconnected',
      message: session.isConnected ? 'Connected to DNP3 device' : 'Disconnected from DNP3 device',
      sessionId: session.sessionId,
      lastActivity: session.lastActivity,
      connectionType: session.connection.connectionType,
      deviceName: session.connection.name,
    };
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): DNP3Session[] {
    return Array.from(this.sessions.values()).filter(session => session.isConnected);
  }

  /**
   * Handle connection error
   */
  private async handleConnectionError(connectionId: string, error: any): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) return;

    session.isConnected = false;
    session.lastActivity = new Date();

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                     // Record health status
       await this.recordHealthStatus(session.connection, 'error', errorMessage, {
         connectionType: 'dnp3',
         protocolType: session.connection.connectionType,
         ipAddress: session.connection.ipAddress,
         port: session.connection.port,
         sourceAddress: session.connection.sourceAddress,
         destinationAddress: session.connection.destinationAddress,
         error: errorMessage,
         testTimestamp: new Date().toISOString(),
       });

    // Broadcast error status
    this.connectivityGateway.broadcastConnectionStatus(connectionId, 'dnp3', {
      status: 'error',
      message: `Connection error: ${errorMessage}`,
      timestamp: new Date(),
      error: errorMessage,
    });
  }

  /**
   * Handle connection close
   */
  private async handleConnectionClose(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) return;

    session.isConnected = false;
    session.lastActivity = new Date();

                     // Record health status
       await this.recordHealthStatus(session.connection, 'disconnected', 'Connection closed', {
         connectionType: 'dnp3',
         protocolType: session.connection.connectionType,
         ipAddress: session.connection.ipAddress,
         port: session.connection.port,
         sourceAddress: session.connection.sourceAddress,
         destinationAddress: session.connection.destinationAddress,
         testTimestamp: new Date().toISOString(),
       });

    // Broadcast disconnection status
    this.connectivityGateway.broadcastConnectionStatus(connectionId, 'dnp3', {
      status: 'disconnected',
      message: 'Connection closed',
      timestamp: new Date(),
    });
  }

  /**
   * Record health status
   */
  private async recordHealthStatus(
    connection: DNP3Connection,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'dnp3';
    // Note: ConnectionHealth entity doesn't have a generic connectionId field
    // We'll store the connection ID in the metrics for now
    health.metrics = { ...metrics, connectionId: connection.id };
    health.status = status;
    health.errorMessage = errorMessage || null;
    health.metrics = metrics;
    health.checkedAt = new Date();

    await this.connectionHealthRepository.save(health);
  }
}
