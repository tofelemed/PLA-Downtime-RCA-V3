import { Injectable, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MQTTConnection } from '../entities/mqtt-connection.entity';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';
import { EventEmitter } from 'events';

export interface MQTTMessage {
  topic: string;
  payload: string | Buffer;
  qos: number;
  retain: boolean;
  timestamp: Date;
}

export interface MQTTSession {
  connectionId: string;
  client: mqtt.MqttClient;
  isConnected: boolean;
  lastActivity: Date;
  subscribedTopics: Set<string>;
}

@Injectable()
export class MQTTClientService {
  private readonly logger = new Logger(MQTTClientService.name);
  private activeSessions = new Map<string, MQTTSession>();
  private eventEmitter: EventEmitter;

  constructor(
    @InjectRepository(MQTTConnection)
    private mqttConnectionRepository: Repository<MQTTConnection>,
    private connectivityGateway: ConnectivityGateway,
  ) {
    this.eventEmitter = this.connectivityGateway.getEventEmitter();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for data requests from frontend
    this.eventEmitter.on('data_request', async (data) => {
      if (data.connectionId) {
        const connection = await this.mqttConnectionRepository.findOne({
          where: { id: data.connectionId }
        });
        
        if (connection) {
          // For MQTT, we can publish a request message or return last known data
          await this.publishMessage(data.connectionId, connection.publishTopic || 'request/data', 'data_request');
        }
      }
    });
  }

  async connect(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.mqttConnectionRepository.findOne({
        where: { id: connectionId }
      });

      if (!connection) {
        throw new Error(`MQTT connection not found: ${connectionId}`);
      }

      if (this.activeSessions.has(connectionId)) {
        this.logger.warn(`MQTT connection ${connectionId} already exists`);
        return true;
      }

      // Prepare connection options
      const connectUrl = `${connection.brokerUrl}:${connection.port || 1883}`;
      const clientOptions: any = {
        clientId: connection.clientId || `ProAct_${Date.now()}`,
        clean: connection.cleanSession !== undefined ? connection.cleanSession : true,
        keepalive: connection.keepAliveSeconds || 60,
        reconnectPeriod: 1000,
        connectTimeout: 30000,
      };

      if (connection.username) {
        clientOptions.username = connection.username;
      }

      if (connection.passwordHash) {
        clientOptions.password = connection.passwordHash;
      }

      this.logger.log(`Connecting to MQTT broker: ${connectUrl}`);

      // Create MQTT client
      const client = mqtt.connect(connectUrl, clientOptions);

      // Set up event handlers
      client.on('connect', () => {
        this.logger.log(`Connected to MQTT broker: ${connectUrl}`);
        this.handleConnect(connectionId, connection);
      });

      client.on('message', (topic, payload, packet) => {
        this.handleMessage(connectionId, topic, payload, packet);
      });

      client.on('error', (error) => {
        this.logger.error(`MQTT client error for connection ${connectionId}: ${error.message}`);
        this.handleConnectionError(connectionId, error);
      });

      client.on('close', () => {
        this.logger.warn(`MQTT connection closed for connection ${connectionId}`);
        this.handleDisconnect(connectionId);
      });

      client.on('reconnect', () => {
        this.logger.log(`MQTT client reconnecting for connection ${connectionId}`);
      });

      // Store session
      const mqttSession: MQTTSession = {
        connectionId,
        client,
        isConnected: false,
        lastActivity: new Date(),
        subscribedTopics: new Set()
      };

      this.activeSessions.set(connectionId, mqttSession);

      return true;

    } catch (error) {
      this.logger.error(`Failed to connect to MQTT broker: ${error.message}`);
      
      // Broadcast connection failure
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'mqtt', {
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

      // Publish disconnect message
      if (session.isConnected) {
        await this.publishMessage(connectionId, 'connectivity/status', JSON.stringify({
          clientId: session.client.options.clientId,
          status: 'disconnected',
          timestamp: new Date().toISOString()
        }));
      }

      // Close connection
      if (session.client) {
        session.client.end();
      }

      // Remove from active sessions
      this.activeSessions.delete(connectionId);

      // Broadcast disconnection
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'mqtt', {
        status: 'disconnected',
        message: 'Disconnected from MQTT broker'
      });

      this.logger.log(`Successfully disconnected from MQTT broker: ${connectionId}`);
      return true;

    } catch (error) {
      this.logger.error(`Error disconnecting from MQTT broker: ${error.message}`);
      return false;
    }
  }

  async subscribeToTopics(connectionId: string, topics: string[]): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      for (const topic of topics) {
        if (session.subscribedTopics.has(topic)) {
          this.logger.warn(`Already subscribed to topic: ${topic}`);
          continue;
        }

        await new Promise<void>((resolve, reject) => {
          session.client.subscribe(topic, { qos: 1 }, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });

        session.subscribedTopics.add(topic);
        this.logger.log(`Subscribed to topic: ${topic}`);
      }

      // Broadcast subscription status
      this.connectivityGateway.broadcastConnectionData(connectionId, 'mqtt', {
        type: 'subscription_update',
        subscribedTopics: Array.from(session.subscribedTopics),
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error(`Error subscribing to topics: ${error.message}`);
      throw error;
    }
  }

  async unsubscribeFromTopics(connectionId: string, topics: string[]): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      for (const topic of topics) {
        await new Promise<void>((resolve, reject) => {
          session.client.unsubscribe(topic, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });

        session.subscribedTopics.delete(topic);
        this.logger.log(`Unsubscribed from topic: ${topic}`);
      }

      // Broadcast subscription status
      this.connectivityGateway.broadcastConnectionData(connectionId, 'mqtt', {
        type: 'subscription_update',
        subscribedTopics: Array.from(session.subscribedTopics),
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error(`Error unsubscribing from topics: ${error.message}`);
      throw error;
    }
  }

  async publishMessage(connectionId: string, topic: string, message: string | Buffer, options?: { qos?: number; retain?: boolean }): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      const publishOptions: mqtt.IClientPublishOptions = {
        qos: (options?.qos || 1) as 0 | 1 | 2,
        retain: options?.retain || false
      };

      await new Promise<void>((resolve, reject) => {
        session.client.publish(topic, message, publishOptions, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.log(`Published message to topic ${topic}: ${message.toString().substring(0, 100)}...`);
      
      // Broadcast publish confirmation
      this.connectivityGateway.broadcastConnectionData(connectionId, 'mqtt', {
        type: 'message_published',
        topic,
        message: message.toString(),
        qos: publishOptions.qos,
        retain: publishOptions.retain,
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error(`Error publishing message: ${error.message}`);
      throw error;
    }
  }

  private handleConnect(connectionId: string, connection: MQTTConnection) {
    const session = this.activeSessions.get(connectionId);
    if (!session) return;

    session.isConnected = true;
    session.lastActivity = new Date();

    // Subscribe to default topics if configured
    if (connection.subscribeTopics) {
      const topics = connection.subscribeTopics.split(',').map(t => t.trim());
      this.subscribeToTopics(connectionId, topics).catch(error => {
        this.logger.error(`Error subscribing to default topics: ${error.message}`);
      });
    }

    // Publish connect message
    this.publishMessage(connectionId, 'connectivity/status', JSON.stringify({
      clientId: connection.clientId,
      status: 'connected',
      timestamp: new Date().toISOString()
    })).catch(error => {
      this.logger.error(`Error publishing connect message: ${error.message}`);
    });

    // Broadcast connection status
    this.connectivityGateway.broadcastConnectionStatus(connectionId, 'mqtt', {
      status: 'connected',
      message: 'Successfully connected to MQTT broker',
      brokerInfo: {
        url: connection.brokerUrl,
        port: connection.port,
        clientId: connection.clientId,
        subscribedTopics: connection.subscribeTopics ? connection.subscribeTopics.split(',') : []
      }
    });
  }

  private handleMessage(connectionId: string, topic: string, payload: Buffer, packet: mqtt.IPublishPacket) {
    const session = this.activeSessions.get(connectionId);
    if (!session) return;

    session.lastActivity = new Date();

    const message: MQTTMessage = {
      topic,
      payload: payload.toString(),
      qos: packet.qos,
      retain: packet.retain,
      timestamp: new Date()
    };

    this.logger.log(`Received MQTT message on topic ${topic}: ${payload.toString().substring(0, 100)}...`);

    // Broadcast received message
    this.connectivityGateway.broadcastConnectionData(connectionId, 'mqtt', {
      type: 'message_received',
      message,
      timestamp: new Date().toISOString()
    });
  }

  private handleConnectionError(connectionId: string, error: Error) {
    const session = this.activeSessions.get(connectionId);
    if (session) {
      session.isConnected = false;
      
      // Broadcast connection error
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'mqtt', {
        status: 'error',
        message: `Connection error: ${error.message}`,
        error: error.message
      });
    }
  }

  private handleDisconnect(connectionId: string) {
    const session = this.activeSessions.get(connectionId);
    if (session) {
      session.isConnected = false;
      
      // Broadcast disconnection
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'mqtt', {
        status: 'disconnected',
        message: 'Disconnected from MQTT broker'
      });
    }
  }

  // Get active sessions info
  getActiveSessions(): Array<{ connectionId: string; isConnected: boolean; lastActivity: Date; subscribedTopics: string[] }> {
    return Array.from(this.activeSessions.entries()).map(([connectionId, session]) => ({
      connectionId,
      isConnected: session.isConnected,
      lastActivity: session.lastActivity,
      subscribedTopics: Array.from(session.subscribedTopics)
    }));
  }

  // Check if connection is active
  isConnectionActive(connectionId: string): boolean {
    const session = this.activeSessions.get(connectionId);
    return session ? session.isConnected : false;
  }

  // Get subscribed topics for a connection
  getSubscribedTopics(connectionId: string): string[] {
    const session = this.activeSessions.get(connectionId);
    return session ? Array.from(session.subscribedTopics) : [];
  }
}
