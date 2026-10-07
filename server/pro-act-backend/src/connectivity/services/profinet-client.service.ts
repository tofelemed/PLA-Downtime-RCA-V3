import { Injectable, Logger } from '@nestjs/common';
import { ProfinetConnection } from '../entities/profinet-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';

export interface ProfinetSession {
  connectionId: string;
  client: any; // Profinet client instance
  connection: ProfinetConnection;
  isConnected: boolean;
  lastActivity: Date;
  sessionId: string;
}

@Injectable()
export class ProfinetClientService {
  private readonly logger = new Logger(ProfinetClientService.name);
  private sessions: Map<string, ProfinetSession> = new Map();

  constructor(
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
    private connectivityGateway: ConnectivityGateway,
  ) {}

  /**
   * Connect to Profinet device
   */
  async connect(connection: ProfinetConnection): Promise<ProfinetSession> {
    const connectionId = connection.id;
    
    try {
      this.logger.log(`Connecting to Profinet device: ${connection.name}`);

             // Create Profinet client - using metadata for SNMP configuration
       const snmpConfig = connection.metadata?.snmp || {};
       const client = new (require('profinet').Client)({
         host: connection.ipAddress,
         port: connection.port || 161,
         community: snmpConfig.community || 'public',
         timeout: connection.timeoutMs || 5000,
         retries: connection.retryCount || 3,
         version: snmpConfig.version || 2,
         username: snmpConfig.username,
         password: snmpConfig.password,
         authProtocol: snmpConfig.authProtocol || 'sha',
         privProtocol: snmpConfig.privProtocol || 'aes',
         privPassword: snmpConfig.privPassword,
       });

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
        this.logger.error(`Profinet client error for connection ${connectionId}: ${error.message}`);
        this.handleConnectionError(connectionId, error);
      });

      client.on('close', () => {
        this.logger.log(`Profinet connection closed for ${connectionId}`);
        this.handleConnectionClose(connectionId);
      });

      // Create session
      const session: ProfinetSession = {
        connectionId,
        client,
        connection,
        isConnected: true,
        lastActivity: new Date(),
        sessionId: `profinet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Store session
      this.sessions.set(connectionId, session);

             // Record health status
       await this.recordHealthStatus(connection, 'connected', undefined, {
         connectionType: 'profinet',
         ipAddress: connection.ipAddress,
         port: connection.port,
         deviceId: connection.deviceId,
         slotNumber: connection.slotNumber,
         testTimestamp: new Date().toISOString(),
       });

      // Broadcast connection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'profinet', {
        status: 'connected',
        message: 'Successfully connected to Profinet device',
        timestamp: new Date(),
        sessionId: session.sessionId,
      });

      this.logger.log(`Successfully connected to Profinet device: ${connection.name}`);
      return session;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to connect to Profinet device: ${errorMessage}`);
      
             // Record health status
       await this.recordHealthStatus(connection, 'error', errorMessage, {
         connectionType: 'profinet',
         ipAddress: connection.ipAddress,
         port: connection.port,
         deviceId: connection.deviceId,
         slotNumber: connection.slotNumber,
         error: errorMessage,
         testTimestamp: new Date().toISOString(),
       });

      // Broadcast connection failure
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'profinet', {
        status: 'error',
        message: `Connection failed: ${errorMessage}`,
        timestamp: new Date(),
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Disconnect from Profinet device
   */
  async disconnect(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) {
      this.logger.warn(`No active session found for connection: ${connectionId}`);
      return;
    }

    try {
      this.logger.log(`Disconnecting from Profinet device: ${session.connection.name}`);

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
         connectionType: 'profinet',
         ipAddress: session.connection.ipAddress,
         port: session.connection.port,
         deviceId: session.connection.deviceId,
         slotNumber: session.connection.slotNumber,
         testTimestamp: new Date().toISOString(),
       });

      // Broadcast disconnection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'profinet', {
        status: 'disconnected',
        message: 'Disconnected from Profinet device',
        timestamp: new Date(),
      });

      this.logger.log(`Successfully disconnected from Profinet device: ${session.connection.name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error during Profinet disconnection: ${errorMessage}`);
    } finally {
      // Remove session
      this.sessions.delete(connectionId);
    }
  }

  /**
   * Read Profinet I/O data
   */
  async readIO(connectionId: string, oid: string): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Reading Profinet I/O data: OID ${oid}`);

      // Update last activity
      session.lastActivity = new Date();

      // Read data using Profinet client
      const result = await new Promise<any>((resolve, reject) => {
        session.client.get(oid, (err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      this.logger.log(`Successfully read Profinet I/O data: ${oid}`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to read Profinet I/O data: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Write Profinet I/O data
   */
  async writeIO(connectionId: string, oid: string, value: any): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Writing Profinet I/O data: OID ${oid}, Value ${value}`);

      // Update last activity
      session.lastActivity = new Date();

      // Write data using Profinet client
      await new Promise<void>((resolve, reject) => {
        session.client.set(oid, value, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.logger.log(`Successfully wrote Profinet I/O data: ${oid}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to write Profinet I/O data: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Browse Profinet device tree
   */
  async browseDevice(connectionId: string, rootOid?: string): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Browsing Profinet device tree: ${rootOid || 'root'}`);

      // Update last activity
      session.lastActivity = new Date();

      // Browse device tree using Profinet client
      const result = await new Promise<any>((resolve, reject) => {
        session.client.walk(rootOid || '1.3.6.1.2.1', (err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      this.logger.log(`Successfully browsed Profinet device tree`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to browse Profinet device tree: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(connectionId: string): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session || !session.isConnected) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    try {
      this.logger.log(`Getting Profinet device information`);

      // Update last activity
      session.lastActivity = new Date();

      // Get device information using standard SNMP OIDs
      const deviceInfo = await Promise.all([
        this.readIO(connectionId, '1.3.6.1.2.1.1.1.0'), // System description
        this.readIO(connectionId, '1.3.6.1.2.1.1.2.0'), // System object ID
        this.readIO(connectionId, '1.3.6.1.2.1.1.3.0'), // System uptime
        this.readIO(connectionId, '1.3.6.1.2.1.1.4.0'), // System contact
        this.readIO(connectionId, '1.3.6.1.2.1.1.5.0'), // System name
        this.readIO(connectionId, '1.3.6.1.2.1.1.6.0'), // System location
      ]);

      const info = {
        systemDescription: deviceInfo[0]?.value || 'Unknown',
        systemObjectId: deviceInfo[1]?.value || 'Unknown',
        systemUptime: deviceInfo[2]?.value || 'Unknown',
        systemContact: deviceInfo[3]?.value || 'Unknown',
        systemName: deviceInfo[4]?.value || 'Unknown',
        systemLocation: deviceInfo[5]?.value || 'Unknown',
      };

      this.logger.log(`Successfully retrieved Profinet device information`);
      return info;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get Profinet device information: ${errorMessage}`);
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
      message: session.isConnected ? 'Connected to Profinet device' : 'Disconnected from Profinet device',
      sessionId: session.sessionId,
      lastActivity: session.lastActivity,
      ipAddress: session.connection.ipAddress,
      deviceName: session.connection.name,
    };
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): ProfinetSession[] {
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
       connectionType: 'profinet',
       ipAddress: session.connection.ipAddress,
       port: session.connection.port,
       deviceId: session.connection.deviceId,
       slotNumber: session.connection.slotNumber,
       error: errorMessage,
       testTimestamp: new Date().toISOString(),
     });

    // Broadcast error status
    this.connectivityGateway.broadcastConnectionStatus(connectionId, 'profinet', {
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
       connectionType: 'profinet',
       ipAddress: session.connection.ipAddress,
       port: session.connection.port,
       deviceId: session.connection.deviceId,
       slotNumber: session.connection.slotNumber,
       testTimestamp: new Date().toISOString(),
     });

    // Broadcast disconnection status
    this.connectivityGateway.broadcastConnectionStatus(connectionId, 'profinet', {
      status: 'disconnected',
      message: 'Connection closed',
      timestamp: new Date(),
    });
  }

  /**
   * Record health status
   */
  private async recordHealthStatus(
    connection: ProfinetConnection,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'profinet';
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
