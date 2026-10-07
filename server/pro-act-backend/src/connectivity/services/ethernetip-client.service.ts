import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EtherNetIPConnection } from '../entities/ethernetip-connection.entity';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';
import { EventEmitter } from 'events';

export interface EtherNetIPDataPoint {
  tagPath: string;
  value: any;
  dataType: string;
  quality: string;
  timestamp: Date;
}

export interface EtherNetIPSession {
  connectionId: string;
  isConnected: boolean;
  lastActivity: Date;
  pollingInterval?: NodeJS.Timeout;
}

@Injectable()
export class EtherNetIPClientService {
  private readonly logger = new Logger(EtherNetIPClientService.name);
  private activeSessions = new Map<string, EtherNetIPSession>();
  private eventEmitter: EventEmitter;

  constructor(
    @InjectRepository(EtherNetIPConnection)
    private ethernetipConnectionRepository: Repository<EtherNetIPConnection>,
    private connectivityGateway: ConnectivityGateway,
  ) {
    this.eventEmitter = this.connectivityGateway.getEventEmitter();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for data requests from frontend
    this.eventEmitter.on('data_request', async (data) => {
      if (data.connectionId) {
        const connection = await this.ethernetipConnectionRepository.findOne({
          where: { id: data.connectionId }
        });
        
        if (connection) {
          await this.readTags(data.connectionId, connection.tagPaths?.split(',') || []);
        }
      }
    });
  }

  async connect(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.ethernetipConnectionRepository.findOne({
        where: { id: connectionId }
      });

      if (!connection) {
        throw new Error(`EtherNet/IP connection not found: ${connectionId}`);
      }

      if (this.activeSessions.has(connectionId)) {
        this.logger.warn(`EtherNet/IP connection ${connectionId} already exists`);
        return true;
      }

      // For now, simulate EtherNet/IP connection
      // In a real implementation, you would use an EtherNet/IP library
      this.logger.log(`Connecting to EtherNet/IP device: ${connection.ipAddress}:${connection.port}`);

      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Store session
      const ethernetipSession: EtherNetIPSession = {
        connectionId,
        isConnected: true,
        lastActivity: new Date()
      };

      this.activeSessions.set(connectionId, ethernetipSession);

      // Set up polling if enabled
      if (connection.enabled && connection.pollingIntervalMs) {
        this.startPolling(connectionId, connection);
      }

      // Broadcast connection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'ethernetip', {
        status: 'connected',
        message: 'Successfully connected to EtherNet/IP device',
        deviceInfo: {
          ipAddress: connection.ipAddress,
          port: connection.port,
          backplaneSlot: connection.backplaneSlot,
          vendorId: connection.vendorId,
          productCode: connection.productCode
        }
      });

      this.logger.log(`Successfully connected to EtherNet/IP device: ${connection.ipAddress}:${connection.port}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to connect to EtherNet/IP device: ${error.message}`);
      
      // Broadcast connection failure
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'ethernetip', {
        status: 'error',
        message: `Connection failed: ${error.message}`,
        error: error.message
      });

      return false;
    }
  }

  async disconnect(connectionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session) {
        this.logger.warn(`No active session found for connection ${connectionId}`);
        return true;
      }

      // Stop polling
      if (session.pollingInterval) {
        clearInterval(session.pollingInterval);
      }

      // Remove from active sessions
      this.activeSessions.delete(connectionId);

      // Broadcast disconnection
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'ethernetip', {
        status: 'disconnected',
        message: 'Disconnected from EtherNet/IP device'
      });

      this.logger.log(`Successfully disconnected from EtherNet/IP device: ${connectionId}`);
      return true;

    } catch (error) {
      this.logger.error(`Error disconnecting from EtherNet/IP device: ${error.message}`);
      return false;
    }
  }

  async readTags(connectionId: string, tagPaths: string[]): Promise<EtherNetIPDataPoint[]> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      // Simulate reading tags from EtherNet/IP device
      // In a real implementation, you would use an EtherNet/IP library to read actual tags
      const dataPoints: EtherNetIPDataPoint[] = [];

      for (const tagPath of tagPaths) {
        // Simulate tag reading with random values
        const simulatedValue = Math.random() * 100;
        const dataType = this.getDataTypeFromTagPath(tagPath);
        
        dataPoints.push({
          tagPath,
          value: simulatedValue,
          dataType,
          quality: 'good',
          timestamp: new Date()
        });
      }

      // Broadcast data to subscribed clients
      this.connectivityGateway.broadcastConnectionData(connectionId, 'ethernetip', {
        type: 'tag_data',
        dataPoints,
        timestamp: new Date().toISOString()
      });

      return dataPoints;

    } catch (error) {
      this.logger.error(`Error reading EtherNet/IP tags: ${error.message}`);
      throw error;
    }
  }

  async writeTag(connectionId: string, tagPath: string, value: any, dataType?: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      // Simulate writing tag to EtherNet/IP device
      // In a real implementation, you would use an EtherNet/IP library to write actual tags
      this.logger.log(`Writing value ${value} to tag ${tagPath}`);

      // Simulate write operation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Broadcast write confirmation
      this.connectivityGateway.broadcastConnectionData(connectionId, 'ethernetip', {
        type: 'tag_written',
        tagPath,
        value,
        dataType: dataType || this.getDataTypeFromTagPath(tagPath),
        status: 'success',
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error(`Error writing EtherNet/IP tag: ${error.message}`);
      throw error;
    }
  }

  async browseTags(connectionId: string): Promise<string[]> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      // Simulate browsing available tags
      // In a real implementation, you would use an EtherNet/IP library to browse actual tags
      const simulatedTags = [
        'Program:MainProgram.Temperature',
        'Program:MainProgram.Pressure',
        'Program:MainProgram.FlowRate',
        'Program:MainProgram.Level',
        'Program:MainProgram.Speed',
        'Program:MainProgram.Status',
        'Program:MainProgram.Alarm',
        'Program:MainProgram.Setpoint'
      ];

      this.logger.log(`Browsed ${simulatedTags.length} tags from EtherNet/IP device`);

      return simulatedTags;

    } catch (error) {
      this.logger.error(`Error browsing EtherNet/IP tags: ${error.message}`);
      throw error;
    }
  }

  private startPolling(connectionId: string, connection: EtherNetIPConnection) {
    const session = this.activeSessions.get(connectionId);
    if (!session) return;

    const pollingInterval = setInterval(async () => {
      try {
        // Read default tags
        const defaultTags = connection.tagPaths?.split(',') || [];
        if (defaultTags.length > 0) {
          await this.readTags(connectionId, defaultTags);
        }
        session.lastActivity = new Date();
      } catch (error) {
        this.logger.error(`Polling error for connection ${connectionId}: ${error.message}`);
      }
    }, connection.pollingIntervalMs || 1000);

    session.pollingInterval = pollingInterval;
    this.logger.log(`Started polling for connection ${connectionId} every ${connection.pollingIntervalMs}ms`);
  }

  private getDataTypeFromTagPath(tagPath: string): string {
    // Simple heuristic to determine data type from tag path
    const lowerTagPath = tagPath.toLowerCase();
    
    if (lowerTagPath.includes('temperature') || lowerTagPath.includes('pressure') || 
        lowerTagPath.includes('flow') || lowerTagPath.includes('level') || 
        lowerTagPath.includes('speed') || lowerTagPath.includes('setpoint')) {
      return 'real';
    } else if (lowerTagPath.includes('status') || lowerTagPath.includes('alarm') || 
               lowerTagPath.includes('enable') || lowerTagPath.includes('run')) {
      return 'bool';
    } else if (lowerTagPath.includes('count') || lowerTagPath.includes('index') || 
               lowerTagPath.includes('id') || lowerTagPath.includes('number')) {
      return 'dint';
    } else {
      return 'real'; // Default to real
    }
  }

  // Get active sessions info
  getActiveSessions(): Array<{ connectionId: string; isConnected: boolean; lastActivity: Date }> {
    return Array.from(this.activeSessions.entries()).map(([connectionId, session]) => ({
      connectionId,
      isConnected: session.isConnected,
      lastActivity: session.lastActivity
    }));
  }

  // Check if connection is active
  isConnectionActive(connectionId: string): boolean {
    const session = this.activeSessions.get(connectionId);
    return session ? session.isConnected : false;
  }
}
