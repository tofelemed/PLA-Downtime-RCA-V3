import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OPCUAConnection } from '../entities/opcua-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { CreateOPCUAConnectionDto, UpdateOPCUAConnectionDto, TestOPCUAConnectionDto } from '../dto/opcua-connection.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OPCUAService {
  constructor(
    @InjectRepository(OPCUAConnection)
    private opcuaConnectionRepository: Repository<OPCUAConnection>,
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
  ) {}

  async create(createDto: CreateOPCUAConnectionDto): Promise<OPCUAConnection> {
    const connection = new OPCUAConnection();
    connection.name = createDto.name;
    connection.description = createDto.description || null;
    connection.endpoint = createDto.endpoint;
    connection.securityMode = createDto.securityMode || 'SignAndEncrypt';
    connection.securityPolicy = createDto.securityPolicy || 'Basic256Sha256';
    connection.authentication = createDto.authentication || 'Anonymous';
    connection.certificatePath = createDto.certificatePath || null;
    connection.privateKeyPath = createDto.privateKeyPath || null;
    connection.reconnectIntervalMs = createDto.reconnectIntervalMs || 5000;
    connection.maxReconnectAttempts = createDto.maxReconnectAttempts || 5;
    connection.username = createDto.username || null;
    connection.passwordHash = createDto.password ? await bcrypt.hash(createDto.password, 10) : null;
    connection.timeoutMs = createDto.timeoutMs || 30000;
    connection.sessionTimeoutMs = createDto.sessionTimeoutMs || 60000;
    connection.keepAliveMs = createDto.keepAliveMs || 10000;
    connection.maxMessageSize = createDto.maxMessageSize || 65536;
    connection.pollingIntervalMs = createDto.pollingIntervalMs || 1000;
    connection.subscriptionSize = createDto.subscriptionSize || 1000;
    connection.defaultNodes = createDto.defaultNodes || null;
    connection.applicationName = createDto.applicationName || 'ProAct Client';
    connection.enabled = createDto.enabled !== undefined ? createDto.enabled : true;
    connection.tenantId = createDto.tenantId;
    connection.organizationId = createDto.organizationId || null;
    connection.status = 'disconnected';
    connection.errorCount = 0;

    return await this.opcuaConnectionRepository.save(connection);
  }

  async findAll(tenantId: string): Promise<OPCUAConnection[]> {
    return await this.opcuaConnectionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<OPCUAConnection> {
    const connection = await this.opcuaConnectionRepository.findOne({
      where: { id, tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`OPC UA connection with ID ${id} not found`);
    }

    return connection;
  }

  async update(id: string, updateDto: UpdateOPCUAConnectionDto, tenantId: string): Promise<OPCUAConnection> {
    const connection = await this.findOne(id, tenantId);

    if (updateDto.name !== undefined) connection.name = updateDto.name;
    if (updateDto.endpoint !== undefined) connection.endpoint = updateDto.endpoint;
    if (updateDto.securityMode !== undefined) connection.securityMode = updateDto.securityMode;
    if (updateDto.securityPolicy !== undefined) connection.securityPolicy = updateDto.securityPolicy;
    if (updateDto.username !== undefined) connection.username = updateDto.username;
    if (updateDto.password !== undefined) {
      connection.passwordHash = updateDto.password ? await bcrypt.hash(updateDto.password, 10) : null;
    }
    if (updateDto.timeoutMs !== undefined) connection.timeoutMs = updateDto.timeoutMs;
    if (updateDto.sessionTimeoutMs !== undefined) connection.sessionTimeoutMs = updateDto.sessionTimeoutMs;
    if (updateDto.keepAliveMs !== undefined) connection.keepAliveMs = updateDto.keepAliveMs;
    if (updateDto.maxMessageSize !== undefined) connection.maxMessageSize = updateDto.maxMessageSize;
    if (updateDto.pollingIntervalMs !== undefined) connection.pollingIntervalMs = updateDto.pollingIntervalMs;
    if (updateDto.subscriptionSize !== undefined) connection.subscriptionSize = updateDto.subscriptionSize;
    if (updateDto.defaultNodes !== undefined) connection.defaultNodes = updateDto.defaultNodes;
    if (updateDto.applicationName !== undefined) connection.applicationName = updateDto.applicationName;
    if (updateDto.enabled !== undefined) connection.enabled = updateDto.enabled;
    if (updateDto.description !== undefined) connection.description = updateDto.description;
    if (updateDto.authentication !== undefined) connection.authentication = updateDto.authentication;
    if (updateDto.certificatePath !== undefined) connection.certificatePath = updateDto.certificatePath;
    if (updateDto.privateKeyPath !== undefined) connection.privateKeyPath = updateDto.privateKeyPath;
    if (updateDto.reconnectIntervalMs !== undefined) connection.reconnectIntervalMs = updateDto.reconnectIntervalMs;
    if (updateDto.maxReconnectAttempts !== undefined) connection.maxReconnectAttempts = updateDto.maxReconnectAttempts;
    if (updateDto.organizationId !== undefined) connection.organizationId = updateDto.organizationId;

    return await this.opcuaConnectionRepository.save(connection);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.opcuaConnectionRepository.remove(connection);
  }

  async testConnection(id: string, testDto: TestOPCUAConnectionDto, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate OPC UA connection test
      // In a real implementation, you would use an OPC UA client library
      const testEndpoint = testDto.endpoint || connection.endpoint;
      const testUsername = testDto.username || connection.username;
      const testPassword = testDto.password || (connection.passwordHash ? '***' : null);
      const testSecurityMode = testDto.securityMode || connection.securityMode;
      const testSecurityPolicy = testDto.securityPolicy || connection.securityPolicy;

      // Simulate connection test with timeout
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate success/failure based on endpoint format
      const isValidEndpoint = testEndpoint.startsWith('opc.tcp://');
      const hasValidCredentials = !testUsername || testPassword;

      if (!isValidEndpoint) {
        throw new BadRequestException('Invalid OPC UA endpoint format');
      }

      if (testUsername && !testPassword) {
        throw new BadRequestException('Password required when username is provided');
      }

      // Record health status
      await this.recordHealthStatus(connection, 'connected', undefined, {
        connectionType: 'opcua',
        endpoint: connection.endpoint,
        securityMode: connection.securityMode,
        securityPolicy: connection.securityPolicy,
        testTimestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'OPC UA connection test successful',
        details: {
          endpoint: testEndpoint,
          securityMode: testSecurityMode,
          securityPolicy: testSecurityPolicy,
          responseTime: Math.floor(Math.random() * 100) + 50, // Simulated response time
          serverInfo: {
            applicationUri: 'urn:ProAct:OPCUAServer',
            productUri: 'urn:ProAct:OPCUAServer',
            applicationName: 'ProAct OPC UA Server',
            applicationType: 'Server',
            gatewayServerUri: null,
            discoveryProfileUri: null,
            discoveryUrls: [testEndpoint],
          },
        },
      };
    } catch (error) {
      // Record health status
      await this.recordHealthStatus(connection, 'error', error.message);

      return {
        success: false,
        message: 'OPC UA connection test failed',
        error: error.message,
        details: {
          endpoint: testDto.endpoint || connection.endpoint,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async browseAddressSpace(id: string, nodeId: string = 'i=84', tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate OPC UA address space browsing
      // In a real implementation, you would use an OPC UA client library
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate address space structure
      const addressSpace = {
        nodeId: nodeId,
        browseName: 'Root',
        displayName: 'Root',
        nodeClass: 'Object',
        children: [
          {
            nodeId: 'i=85',
            browseName: 'Objects',
            displayName: 'Objects',
            nodeClass: 'Object',
            children: [
              {
                nodeId: 'i=86',
                browseName: 'Server',
                displayName: 'Server',
                nodeClass: 'Object',
                children: [
                  {
                    nodeId: 'i=2253',
                    browseName: 'ServerStatus',
                    displayName: 'ServerStatus',
                    nodeClass: 'Variable',
                    dataType: 'ServerStatusDataType',
                    value: {
                      startTime: new Date().toISOString(),
                      currentTime: new Date().toISOString(),
                      state: 'Running',
                    },
                  },
                ],
              },
            ],
          },
          {
            nodeId: 'i=87',
            browseName: 'Types',
            displayName: 'Types',
            nodeClass: 'Object',
            children: [],
          },
          {
            nodeId: 'i=88',
            browseName: 'Views',
            displayName: 'Views',
            nodeClass: 'Object',
            children: [],
          },
        ],
      };

      return {
        success: true,
        connectionId: id,
        nodeId: nodeId,
        addressSpace: addressSpace,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to browse OPC UA address space',
        error: error.message,
        connectionId: id,
        nodeId: nodeId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async readNodeValues(id: string, nodeIds: string[], tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate OPC UA node value reading
      await new Promise(resolve => setTimeout(resolve, 500));

      const nodeValues = nodeIds.map(nodeId => ({
        nodeId: nodeId,
        value: Math.random() * 100,
        dataType: 'Double',
        sourceTimestamp: new Date().toISOString(),
        serverTimestamp: new Date().toISOString(),
        statusCode: 'Good',
      }));

      return {
        success: true,
        connectionId: id,
        nodeValues: nodeValues,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read OPC UA node values',
        error: error.message,
        connectionId: id,
        nodeIds: nodeIds,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async recordHealthStatus(
    connection: OPCUAConnection,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'opcua';
    health.opcuaConnectionId = connection.id;
    health.status = status;
    health.errorMessage = errorMessage || null;
    health.metrics = metrics;
    health.checkedAt = new Date();

    await this.connectionHealthRepository.save(health);
  }

  async getHealthStatus(id: string, tenantId: string): Promise<ConnectionHealth[]> {
    const connection = await this.findOne(id, tenantId);
    
    return await this.connectionHealthRepository.find({
      where: { opcuaConnectionId: connection.id },
      order: { checkedAt: 'DESC' },
      take: 10,
    });
  }
}
