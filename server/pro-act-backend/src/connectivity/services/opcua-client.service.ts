import { Injectable, Logger } from '@nestjs/common';
import { OPCUAClient, MessageSecurityMode, SecurityPolicy, ClientSession, ClientSubscription, ClientMonitoredItem, DataValue, AttributeIds, TimestampsToReturn } from 'node-opcua';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OPCUAConnection } from '../entities/opcua-connection.entity';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';
import { EventEmitter } from 'events';

export interface OPCUADataPoint {
  nodeId: string;
  value: any;
  dataType: string;
  quality: string;
  timestamp: Date;
}

export interface OPCUASession {
  connectionId: string;
  session: ClientSession;
  subscription: ClientSubscription;
  monitoredItems: Map<string, ClientMonitoredItem>;
  isConnected: boolean;
  lastActivity: Date;
}

@Injectable()
export class OPCUAClientService {
  private readonly logger = new Logger(OPCUAClientService.name);
  private activeSessions = new Map<string, OPCUASession>();
  private eventEmitter: EventEmitter;

  constructor(
    @InjectRepository(OPCUAConnection)
    private opcuaConnectionRepository: Repository<OPCUAConnection>,
    private connectivityGateway: ConnectivityGateway,
  ) {
    this.eventEmitter = this.connectivityGateway.getEventEmitter();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for data requests from frontend
    this.eventEmitter.on('data_request', async (data) => {
      if (data.connectionId) {
        const connection = await this.opcuaConnectionRepository.findOne({
          where: { id: data.connectionId }
        });
        
        if (connection) {
          await this.readDataPoints(data.connectionId, data.nodes);
        }
      }
    });
  }

  async connect(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.opcuaConnectionRepository.findOne({
        where: { id: connectionId }
      });

      if (!connection) {
        throw new Error(`OPC UA connection not found: ${connectionId}`);
      }

      if (this.activeSessions.has(connectionId)) {
        this.logger.warn(`OPC UA connection ${connectionId} already exists`);
        return true;
      }

      // Create OPC UA client
      const client = OPCUAClient.create({
        applicationName: connection.applicationName || 'ProAct Client',
        connectionStrategy: {
          initialDelay: 1000,
          maxRetry: 1
        },
        securityMode: this.getSecurityMode(connection.securityMode),
        securityPolicy: this.getSecurityPolicy(connection.securityPolicy),
        endpoint_must_exist: false
      });

      // Parse endpoint URL
      const endpointUrl = connection.endpoint;
      this.logger.log(`Connecting to OPC UA server: ${endpointUrl}`);

      // Connect to server
      await client.connect(endpointUrl);

      // Create session
      const session = await new Promise<ClientSession>((resolve, reject) => {
        const sessionOptions: any = {
          requestedSessionTimeout: connection.sessionTimeoutMs || 60000,
        };
        
        if (connection.username) {
          sessionOptions.userName = connection.username;
        }
        
        if (connection.passwordHash) {
          sessionOptions.password = connection.passwordHash;
        }
        
        client.createSession(sessionOptions, (err, session) => {
          if (err) {
            reject(err);
          } else if (session) {
            resolve(session);
          } else {
            reject(new Error('Failed to create session'));
          }
        });
      });

      // Create subscription
      const subscription = await ClientSubscription.create(session, {
        requestedPublishingInterval: connection.pollingIntervalMs || 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10
      });

      // Store session
      const opcuaSession: OPCUASession = {
        connectionId,
        session,
        subscription,
        monitoredItems: new Map(),
        isConnected: true,
        lastActivity: new Date()
      };

      this.activeSessions.set(connectionId, opcuaSession);

      // Set up session event handlers
      session.on('session_closed', () => {
        this.logger.warn(`OPC UA session closed for connection ${connectionId}`);
        this.handleSessionClosed(connectionId);
      });

      subscription.on('started', () => {
        this.logger.log(`OPC UA subscription started for connection ${connectionId}`);
      });

      subscription.on('keepalive', () => {
        opcuaSession.lastActivity = new Date();
      });

      // Broadcast connection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'opcua', {
        status: 'connected',
        message: 'Successfully connected to OPC UA server',
        serverInfo: {
          endpoint: endpointUrl,
          sessionId: session.sessionId,
          subscriptionId: subscription.subscriptionId
        }
      });

      this.logger.log(`Successfully connected to OPC UA server: ${endpointUrl}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to connect to OPC UA server: ${errorMessage}`);
      
      // Broadcast connection failure
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'opcua', {
        status: 'error',
        message: `Connection failed: ${errorMessage}`,
        error: errorMessage
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

      // Terminate subscription
      if (session.subscription) {
        await session.subscription.terminate();
      }

      // Close session
      if (session.session) {
        await session.session.close();
      }

      // Remove from active sessions
      this.activeSessions.delete(connectionId);

      // Broadcast disconnection
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'opcua', {
        status: 'disconnected',
        message: 'Disconnected from OPC UA server'
      });

      this.logger.log(`Successfully disconnected from OPC UA server: ${connectionId}`);
      return true;

    } catch (error) {
      this.logger.error(`Error disconnecting from OPC UA server: ${error.message}`);
      return false;
    }
  }

  async readDataPoints(connectionId: string, nodeIds?: string[]): Promise<OPCUADataPoint[]> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      // If no specific nodes requested, read default nodes from connection
      if (!nodeIds || nodeIds.length === 0) {
        const connection = await this.opcuaConnectionRepository.findOne({
          where: { id: connectionId }
        });
        
        if (connection && connection.defaultNodes) {
          nodeIds = connection.defaultNodes.split(',');
        } else {
          throw new Error('No nodes specified for reading');
        }
      }

      const dataPoints: OPCUADataPoint[] = [];

      // Read multiple nodes
      const nodesToRead = nodeIds.map(nodeId => ({
        nodeId: nodeId.trim(),
        attributeId: AttributeIds.Value
      }));

      const dataValues = await session.session.read(nodesToRead);

      for (let i = 0; i < dataValues.length; i++) {
        const dataValue = dataValues[i];
        const nodeId = nodeIds[i];

        if (dataValue.statusCode.isGood()) {
          dataPoints.push({
            nodeId,
            value: dataValue.value.value,
            dataType: dataValue.value.dataType ? dataValue.value.dataType.toString() : 'Unknown',
            quality: dataValue.statusCode.name,
            timestamp: dataValue.sourceTimestamp || new Date()
          });
        } else {
          this.logger.warn(`Failed to read node ${nodeId}: ${dataValue.statusCode.name}`);
        }
      }

      // Broadcast data to subscribed clients
      this.connectivityGateway.broadcastConnectionData(connectionId, 'opcua', {
        type: 'read_data',
        dataPoints,
        timestamp: new Date().toISOString()
      });

      return dataPoints;

    } catch (error) {
      this.logger.error(`Error reading OPC UA data points: ${error.message}`);
      throw error;
    }
  }

  async writeDataPoint(connectionId: string, nodeId: string, value: any, dataType?: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      // Write single node
      const nodesToWrite = [{
        nodeId,
        attributeId: AttributeIds.Value,
        value: { value, dataType }
      }];

      const statusCodes = await session.session.write(nodesToWrite);

      if (statusCodes[0].isGood()) {
        this.logger.log(`Successfully wrote value to node ${nodeId}`);
        
        // Broadcast write confirmation
        this.connectivityGateway.broadcastConnectionData(connectionId, 'opcua', {
          type: 'write_data',
          nodeId,
          value,
          status: 'success',
          timestamp: new Date().toISOString()
        });

        return true;
      } else {
        this.logger.error(`Failed to write to node ${nodeId}: ${statusCodes[0].name}`);
        return false;
      }

    } catch (error) {
      this.logger.error(`Error writing OPC UA data point: ${error.message}`);
      throw error;
    }
  }

  async subscribeToNodes(connectionId: string, nodeIds: string[]): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      for (const nodeId of nodeIds) {
        if (session.monitoredItems.has(nodeId)) {
          this.logger.warn(`Node ${nodeId} is already being monitored`);
          continue;
        }

        // Create monitored item
        const monitoredItem = await ClientMonitoredItem.create(
          session.subscription,
          { nodeId, attributeId: AttributeIds.Value },
          { samplingInterval: 1000, discardOldest: true, queueSize: 10 }
        );

        // Set up the data change handler
        monitoredItem.on('changed', (dataValue: DataValue) => {
          // Handle data change
          this.handleDataChange(connectionId, nodeId, dataValue);
        });

        session.monitoredItems.set(nodeId, monitoredItem);
        this.logger.log(`Subscribed to node ${nodeId}`);
      }

      return true;

    } catch (error) {
      this.logger.error(`Error subscribing to OPC UA nodes: ${error.message}`);
      throw error;
    }
  }

  private handleDataChange(connectionId: string, nodeId: string, dataValue: DataValue) {
    if (dataValue.statusCode.isGood()) {
      const dataPoint: OPCUADataPoint = {
        nodeId,
        value: dataValue.value.value,
        dataType: dataValue.value.dataType ? dataValue.value.dataType.toString() : 'Unknown',
        quality: dataValue.statusCode.name,
        timestamp: dataValue.sourceTimestamp || new Date()
      };

      // Broadcast real-time data
      this.connectivityGateway.broadcastConnectionData(connectionId, 'opcua', {
        type: 'data_change',
        dataPoint,
        timestamp: new Date().toISOString()
      });
    }
  }

  private handleSessionClosed(connectionId: string) {
    const session = this.activeSessions.get(connectionId);
    if (session) {
      session.isConnected = false;
      
      // Broadcast connection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'opcua', {
        status: 'disconnected',
        message: 'Session closed by server'
      });
    }
  }

  private getSecurityMode(securityMode: string): MessageSecurityMode {
    switch (securityMode?.toLowerCase()) {
      case 'sign':
        return MessageSecurityMode.Sign;
      case 'signandencrypt':
        return MessageSecurityMode.SignAndEncrypt;
      default:
        return MessageSecurityMode.None;
    }
  }

  private getSecurityPolicy(securityPolicy: string): SecurityPolicy {
    switch (securityPolicy?.toLowerCase()) {
      case 'basic128rsa15':
        return SecurityPolicy.Basic128Rsa15;
      case 'basic256':
        return SecurityPolicy.Basic256;
      case 'basic256sha256':
        return SecurityPolicy.Basic256Sha256;
      case 'aes128sha256rsaoaep':
        return SecurityPolicy.Aes128_Sha256_RsaOaep;
      case 'aes256sha256rsapss':
        return SecurityPolicy.Aes256_Sha256_RsaPss;
      default:
        return SecurityPolicy.None;
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
