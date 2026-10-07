import { Injectable, Logger } from '@nestjs/common';
import { SCADAConnection } from '../entities/scada-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';

export interface SCADASession {
  connectionId: string;
  client: any; // SCADA client instance
  connection: SCADAConnection;
  isConnected: boolean;
  lastActivity: Date;
  sessionId: string;
}

@Injectable()
export class SCADAClientService {
  private readonly logger = new Logger(SCADAClientService.name);
  private sessions: Map<string, SCADASession> = new Map();

  constructor(
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
    private connectivityGateway: ConnectivityGateway,
  ) {}

  /**
   * Connect to SCADA system
   */
  async connect(connection: SCADAConnection): Promise<SCADASession> {
    const connectionId = connection.id;
    
    try {
      this.logger.log(`Connecting to SCADA system: ${connection.name}`);

      // Create SCADA client based on connection type
      let client: any;
      
      if (connection.connectionType === 'opc') {
        // OPC DA connection
        client = new (require('scada').OPCClient)({
          host: connection.ipAddress,
          serverName: connection.name,
          timeout: connection.timeoutMs || 10000,
          retries: connection.retryCount || 3,
        });
      } else if (connection.connectionType === 'modbus') {
        // Modbus connection
        client = new (require('scada').ModbusClient)({
          host: connection.ipAddress,
          port: connection.port || 502,
          unitId: connection.unitId || 1,
          timeout: connection.timeoutMs || 5000,
          retries: connection.retryCount || 3,
        });
      } else if (connection.connectionType === 'ethernetip') {
        // EtherNet/IP connection
        client = new (require('scada').EtherNetIPClient)({
          host: connection.ipAddress,
          port: connection.port || 44818,
          timeout: connection.timeoutMs || 10000,
          retries: connection.retryCount || 3,
        });
      } else if (connection.connectionType === 'database') {
                 // Database connection - using metadata for database configuration
         const dbConfig = connection.metadata?.database || {};
         client = new (require('scada').DatabaseClient)({
           type: connection.dataType || 'sqlserver',
           host: connection.ipAddress,
           port: connection.port,
           database: dbConfig.databaseName || connection.name,
           username: dbConfig.username,
           password: dbConfig.password,
           timeout: connection.timeoutMs || 30000,
         });
      } else {
        throw new Error(`Unsupported SCADA connection type: ${connection.connectionType}`);
      }

      // Connect to system
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
        this.logger.error(`SCADA client error for connection ${connectionId}: ${error.message}`);
        this.handleConnectionError(connectionId, error);
      });

      client.on('close', () => {
        this.logger.log(`SCADA connection closed for ${connectionId}`);
        this.handleConnectionClose(connectionId);
      });

      client.on('data', (data: any) => {
        this.logger.log(`SCADA data received for connection ${connectionId}: ${JSON.stringify(data)}`);
        this.handleDataReceived(connectionId, data);
      });

      // Create session
      const session: SCADASession = {
        connectionId,
        client,
        connection,
        isConnected: true,
        lastActivity: new Date(),
        sessionId: `scada_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Store session
      this.sessions.set(connectionId, session);

      // Record health status
      await this.recordHealthStatus(connection, 'connected', undefined, {
        connectionType: 'scada',
        scadaType: connection.connectionType,
        ipAddress: connection.ipAddress,
        port: connection.port,
        serverName: connection.name,
        databaseType: connection.dataType,
        databaseName: connection.name,
        testTimestamp: new Date().toISOString(),
      });

      // Broadcast connection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'scada', {
        status: 'connected',
        message: 'Successfully connected to SCADA system',
        timestamp: new Date(),
        sessionId: session.sessionId,
      });

      this.logger.log(`Successfully connected to SCADA system: ${connection.name}`);
      return session;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to connect to SCADA system: ${errorMessage}`);
      
      // Record health status
      await this.recordHealthStatus(connection, 'error', errorMessage, {
        connectionType: 'scada',
        scadaType: connection.connectionType,
        ipAddress: connection.ipAddress,
        port: connection.port,
        serverName: connection.name,
        databaseType: connection.dataType,
        databaseName: connection.name,
        error: errorMessage,
        testTimestamp: new Date().toISOString(),
      });

      // Broadcast connection failure
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'scada', {
        status: 'error',
        message: `Connection failed: ${errorMessage}`,
        timestamp: new Date(),
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Disconnect from SCADA system
   */
  async disconnect(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) {
      this.logger.warn(`No active session found for connection: ${connectionId}`);
      return;
    }

    try {
      this.logger.log(`Disconnecting from SCADA system: ${session.connection.name}`);

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
        connectionType: 'scada',
        scadaType: session.connection.connectionType,
        ipAddress: session.connection.ipAddress,
        port: session.connection.port,
        serverName: session.connection.name,
        databaseType: session.connection.dataType,
        databaseName: session.connection.name,
        testTimestamp: new Date().toISOString(),
      });

      // Broadcast disconnection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'scada', {
        status: 'disconnected',
        message: 'Disconnected from SCADA system',
        timestamp: new Date(),
      });

      this.logger.log(`Successfully disconnected from SCADA system: ${session.connection.name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error during SCADA disconnection: ${errorMessage}`);
    } finally {
      // Remove session
      this.sessions.delete(connectionId);
    }
  }

  /**
   * Read SCADA tags
   */
  async readTags(connectionId: string, tagNames: string[]): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Reading SCADA tags: ${tagNames.join(', ')}`);

      // Update last activity
      session.lastActivity = new Date();

      // Read tags using SCADA client
      const result = await new Promise<any>((resolve, reject) => {
        session.client.readTags(tagNames, (err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      this.logger.log(`Successfully read ${tagNames.length} SCADA tags`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to read SCADA tags: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Write SCADA tags
   */
  async writeTags(connectionId: string, tagValues: { [key: string]: any }): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Writing SCADA tags: ${Object.keys(tagValues).join(', ')}`);

      // Update last activity
      session.lastActivity = new Date();

      // Write tags using SCADA client
      await new Promise<void>((resolve, reject) => {
        session.client.writeTags(tagValues, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.logger.log(`Successfully wrote ${Object.keys(tagValues).length} SCADA tags`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to write SCADA tags: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Browse SCADA tag database
   */
  async browseTags(connectionId: string, filter?: string): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Browsing SCADA tags: ${filter || 'all'}`);

      // Update last activity
      session.lastActivity = new Date();

      // Browse tags using SCADA client
      const result = await new Promise<any>((resolve, reject) => {
        session.client.browseTags(filter, (err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      this.logger.log(`Successfully browsed SCADA tags`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to browse SCADA tags: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get SCADA system information
   */
  async getSystemInfo(connectionId: string): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Getting SCADA system information`);

      // Update last activity
      session.lastActivity = new Date();

      // Get system information using SCADA client
      const result = await new Promise<any>((resolve, reject) => {
        session.client.getSystemInfo((err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      this.logger.log(`Successfully retrieved SCADA system information`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get SCADA system information: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Execute SCADA command
   */
  async executeCommand(connectionId: string, command: string, parameters?: any): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Executing SCADA command: ${command}`);

      // Update last activity
      session.lastActivity = new Date();

      // Execute command using SCADA client
      const result = await new Promise<any>((resolve, reject) => {
        session.client.executeCommand(command, parameters, (err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      this.logger.log(`Successfully executed SCADA command: ${command}`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute SCADA command: ${errorMessage}`);
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
      message: session.isConnected ? 'Connected to SCADA system' : 'Disconnected from SCADA system',
      sessionId: session.sessionId,
      lastActivity: session.lastActivity,
      scadaType: session.connection.connectionType,
      systemName: session.connection.name,
    };
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): SCADASession[] {
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
      connectionType: 'scada',
      scadaType: session.connection.connectionType,
      ipAddress: session.connection.ipAddress,
      port: session.connection.port,
      serverName: session.connection.name,
      databaseType: session.connection.dataType,
      databaseName: session.connection.name,
      error: errorMessage,
      testTimestamp: new Date().toISOString(),
    });

    // Broadcast error status
    this.connectivityGateway.broadcastConnectionStatus(connectionId, 'scada', {
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
      connectionType: 'scada',
      scadaType: session.connection.connectionType,
      ipAddress: session.connection.ipAddress,
      port: session.connection.port,
      serverName: session.connection.name,
      databaseType: session.connection.dataType,
      databaseName: session.connection.name,
      testTimestamp: new Date().toISOString(),
    });

    // Broadcast disconnection status
    this.connectivityGateway.broadcastConnectionStatus(connectionId, 'scada', {
      status: 'disconnected',
      message: 'Connection closed',
      timestamp: new Date(),
    });
  }

  /**
   * Handle data received
   */
  private handleDataReceived(connectionId: string, data: any): void {
    // Log data received for debugging
    this.logger.log(`SCADA data received for connection ${connectionId}: ${JSON.stringify(data)}`);
    // Note: Data broadcasting can be implemented when needed
  }

  /**
   * Record health status
   */
  private async recordHealthStatus(
    connection: SCADAConnection,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'scada';
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
