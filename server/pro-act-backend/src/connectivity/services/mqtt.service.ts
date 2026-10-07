import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MQTTConnection } from '../entities/mqtt-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { CreateMQTTConnectionDto, UpdateMQTTConnectionDto, TestMQTTConnectionDto } from '../dto/mqtt-connection.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MQTTService {
  constructor(
    @InjectRepository(MQTTConnection)
    private mqttConnectionRepository: Repository<MQTTConnection>,
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
  ) {}

  async create(createDto: CreateMQTTConnectionDto): Promise<MQTTConnection> {
    const connection = new MQTTConnection();
    connection.name = createDto.name;
    connection.brokerUrl = createDto.brokerUrl;
    connection.port = createDto.port || 1883;
    connection.clientId = createDto.clientId || `ProAct_${Date.now()}`;
    connection.username = createDto.username || null;
    connection.passwordHash = createDto.password ? await bcrypt.hash(createDto.password, 10) : null;
    connection.keepAliveSeconds = createDto.keepAliveSeconds || 60;
    connection.cleanSession = createDto.cleanSession !== undefined ? createDto.cleanSession : true;
    connection.subscribeTopics = createDto.subscribeTopics || null;
    connection.publishTopic = createDto.publishTopic || null;
    connection.qosLevel = createDto.qosLevel || 1;
    connection.useTLS = createDto.useTLS || false;
    connection.caCert = createDto.caCert || null;
    connection.clientCert = createDto.clientCert || null;
    connection.clientKey = createDto.clientKey || null;
    connection.lastWillTopic = createDto.lastWillTopic || null;
    connection.lastWillMessage = createDto.lastWillMessage || null;
    connection.lastWillQos = createDto.lastWillQos || 1;
    connection.lastWillRetain = createDto.lastWillRetain || false;
    connection.enabled = createDto.enabled !== undefined ? createDto.enabled : true;
    connection.tenantId = createDto.tenantId;
    connection.description = createDto.description || null;
    connection.reconnectPeriodMs = createDto.reconnectPeriodMs || 1000;
    connection.connectTimeoutMs = createDto.connectTimeoutMs || 30000;
    connection.organizationId = createDto.organizationId || null;
    connection.status = 'disconnected';
    connection.errorCount = 0;

    return await this.mqttConnectionRepository.save(connection);
  }

  async findAll(tenantId: string): Promise<MQTTConnection[]> {
    return await this.mqttConnectionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<MQTTConnection> {
    const connection = await this.mqttConnectionRepository.findOne({
      where: { id, tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`MQTT connection with ID ${id} not found`);
    }

    return connection;
  }

  async update(id: string, updateDto: UpdateMQTTConnectionDto, tenantId: string): Promise<MQTTConnection> {
    const connection = await this.findOne(id, tenantId);

    if (updateDto.name !== undefined) connection.name = updateDto.name;
    if (updateDto.brokerUrl !== undefined) connection.brokerUrl = updateDto.brokerUrl;
    if (updateDto.port !== undefined) connection.port = updateDto.port;
    if (updateDto.clientId !== undefined) connection.clientId = updateDto.clientId;
    if (updateDto.username !== undefined) connection.username = updateDto.username;
    if (updateDto.password !== undefined) {
      connection.passwordHash = updateDto.password ? await bcrypt.hash(updateDto.password, 10) : null;
    }
    if (updateDto.keepAliveSeconds !== undefined) connection.keepAliveSeconds = updateDto.keepAliveSeconds;
    if (updateDto.cleanSession !== undefined) connection.cleanSession = updateDto.cleanSession;
    if (updateDto.subscribeTopics !== undefined) connection.subscribeTopics = updateDto.subscribeTopics;
    if (updateDto.publishTopic !== undefined) connection.publishTopic = updateDto.publishTopic;
    if (updateDto.qosLevel !== undefined) connection.qosLevel = updateDto.qosLevel;
    if (updateDto.useTLS !== undefined) connection.useTLS = updateDto.useTLS;
    if (updateDto.caCert !== undefined) connection.caCert = updateDto.caCert;
    if (updateDto.clientCert !== undefined) connection.clientCert = updateDto.clientCert;
    if (updateDto.clientKey !== undefined) connection.clientKey = updateDto.clientKey;
    if (updateDto.lastWillTopic !== undefined) connection.lastWillTopic = updateDto.lastWillTopic;
    if (updateDto.lastWillMessage !== undefined) connection.lastWillMessage = updateDto.lastWillMessage;
    if (updateDto.lastWillQos !== undefined) connection.lastWillQos = updateDto.lastWillQos;
    if (updateDto.lastWillRetain !== undefined) connection.lastWillRetain = updateDto.lastWillRetain;
    if (updateDto.enabled !== undefined) connection.enabled = updateDto.enabled;
    if (updateDto.description !== undefined) connection.description = updateDto.description;
    if (updateDto.reconnectPeriodMs !== undefined) connection.reconnectPeriodMs = updateDto.reconnectPeriodMs;
    if (updateDto.connectTimeoutMs !== undefined) connection.connectTimeoutMs = updateDto.connectTimeoutMs;
    if (updateDto.organizationId !== undefined) connection.organizationId = updateDto.organizationId;

    return await this.mqttConnectionRepository.save(connection);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.mqttConnectionRepository.remove(connection);
  }

  async testConnection(id: string, testDto: TestMQTTConnectionDto, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate MQTT connection test
      // In a real implementation, you would use an MQTT client library
      const testBrokerUrl = testDto.brokerUrl || connection.brokerUrl;
      const testPort = testDto.port || connection.port;
      const testUsername = testDto.username || connection.username;
      const testPassword = testDto.password || (connection.passwordHash ? '***' : null);
      const testClientId = testDto.clientId || connection.clientId;

      // Simulate connection test with timeout
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Validate broker URL format
      const urlRegex = /^(mqtt|mqtts|ws|wss):\/\/.+/;
      if (!urlRegex.test(testBrokerUrl)) {
        throw new BadRequestException('Invalid MQTT broker URL format');
      }

      // Record health status
      await this.recordHealthStatus(connection, 'connected', undefined, {
        connectionType: 'mqtt',
        brokerUrl: connection.brokerUrl,
        port: connection.port,
        clientId: connection.clientId,
        qosLevel: connection.qosLevel,
        testTimestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'MQTT connection test successful',
        details: {
          brokerUrl: testBrokerUrl,
          port: testPort,
          clientId: testClientId,
          username: testUsername,
          useTLS: connection.useTLS,
          responseTime: Math.floor(Math.random() * 100) + 50, // Simulated response time
          brokerInfo: {
            brokerVersion: '2.0.0',
            protocolVersion: '5.0',
            maxPacketSize: 268435456,
            maxTopicLength: 65535,
            maxQoS: 2,
            retainAvailable: true,
            wildcardSubscriptionAvailable: true,
            subscriptionIdentifiersAvailable: true,
            sharedSubscriptionAvailable: true,
          },
        },
      };
    } catch (error) {
      // Record health status
      await this.recordHealthStatus(connection, 'error', error.message);

      return {
        success: false,
        message: 'MQTT connection test failed',
        error: error.message,
        details: {
          brokerUrl: testDto.brokerUrl || connection.brokerUrl,
          port: testDto.port || connection.port,
          clientId: testDto.clientId || connection.clientId,
          username: testDto.username || connection.username,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async publishMessage(id: string, topic: string, message: string, qos: number = 1, retain: boolean = false, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate MQTT message publishing
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        connectionId: id,
        topic: topic,
        message: message,
        qos: qos,
        retain: retain,
        messageId: Math.floor(Math.random() * 65535),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to publish MQTT message',
        error: error.message,
        connectionId: id,
        topic: topic,
        publishedMessage: message,
        qos: qos,
        retain: retain,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async subscribeToTopics(id: string, topics: string[], qos: number[] = [], tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate MQTT topic subscription
      await new Promise(resolve => setTimeout(resolve, 200));

      const subscriptions = topics.map((topic, index) => ({
        topic: topic,
        qos: qos[index] || 1,
        grantedQoS: qos[index] || 1,
      }));

      return {
        success: true,
        connectionId: id,
        subscriptions: subscriptions,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to subscribe to MQTT topics',
        error: error.message,
        connectionId: id,
        topics: topics,
        qos: qos,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async unsubscribeFromTopics(id: string, topics: string[], tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate MQTT topic unsubscription
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        connectionId: id,
        unsubscribedTopics: topics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to unsubscribe from MQTT topics',
        error: error.message,
        connectionId: id,
        topics: topics,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBrokerInfo(id: string, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate MQTT broker information retrieval
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        connectionId: id,
        brokerInfo: {
          brokerUrl: connection.brokerUrl,
          port: connection.port,
          useTLS: connection.useTLS,
          clientId: connection.clientId,
          keepAlive: connection.keepAliveSeconds,
          cleanSession: connection.cleanSession,
          lastWillTopic: connection.lastWillTopic,
          lastWillMessage: connection.lastWillMessage,
          lastWillQoS: connection.lastWillQos,
          lastWillRetain: connection.lastWillRetain,
          subscribedTopics: connection.subscribeTopics ? connection.subscribeTopics.split(',') : [],
          publishTopic: connection.publishTopic,
          defaultQoS: connection.qosLevel,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get MQTT broker information',
        error: error.message,
        connectionId: id,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async recordHealthStatus(
    connection: MQTTConnection,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'mqtt';
    health.mqttConnectionId = connection.id;
    health.status = status;
    health.errorMessage = errorMessage || null;
    health.metrics = metrics;
    health.checkedAt = new Date();

    await this.connectionHealthRepository.save(health);
  }

  async getHealthStatus(id: string, tenantId: string): Promise<ConnectionHealth[]> {
    const connection = await this.findOne(id, tenantId);
    
    return await this.connectionHealthRepository.find({
      where: { mqttConnectionId: connection.id },
      order: { checkedAt: 'DESC' },
      take: 10,
    });
  }
}
