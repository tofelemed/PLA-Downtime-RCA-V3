import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemIntegration } from '../entities/system-integration.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { CreateSystemIntegrationDto, UpdateSystemIntegrationDto, TestSystemIntegrationDto, SyncSystemIntegrationDto } from '../dto/system-integration.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SystemIntegrationService {
  constructor(
    @InjectRepository(SystemIntegration)
    private systemIntegrationRepository: Repository<SystemIntegration>,
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
  ) {}

  async create(createDto: CreateSystemIntegrationDto): Promise<SystemIntegration> {
    const integration = new SystemIntegration();
    integration.name = createDto.name;
    integration.integrationType = createDto.integrationType;
    integration.endpoint = createDto.endpoint || null;
    integration.apiKey = createDto.apiKey || null;
    integration.username = createDto.username || null;
    integration.passwordHash = createDto.password ? await bcrypt.hash(createDto.password, 10) : null;
    integration.systemType = createDto.systemType || null;
    integration.database = createDto.database || null;
    integration.syncIntervalSeconds = createDto.syncIntervalSeconds || 300;
    integration.enabled = createDto.enabled !== undefined ? createDto.enabled : true;
    integration.configuration = createDto.configuration;
    integration.authentication = createDto.authentication;
    integration.description = createDto.description || null;
    integration.tenantId = createDto.tenantId;

    return await this.systemIntegrationRepository.save(integration);
  }

  async findAll(tenantId: string): Promise<SystemIntegration[]> {
    return await this.systemIntegrationRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<SystemIntegration> {
    const integration = await this.systemIntegrationRepository.findOne({
      where: { id, tenantId },
    });

    if (!integration) {
      throw new NotFoundException(`System integration with ID ${id} not found`);
    }

    return integration;
  }

  async update(id: string, updateDto: UpdateSystemIntegrationDto, tenantId: string): Promise<SystemIntegration> {
    const integration = await this.findOne(id, tenantId);

    if (updateDto.name !== undefined) integration.name = updateDto.name;
    if (updateDto.endpoint !== undefined) integration.endpoint = updateDto.endpoint;
    if (updateDto.apiKey !== undefined) integration.apiKey = updateDto.apiKey;
    if (updateDto.username !== undefined) integration.username = updateDto.username;
    if (updateDto.password !== undefined) {
      integration.passwordHash = updateDto.password ? await bcrypt.hash(updateDto.password, 10) : null;
    }
    if (updateDto.systemType !== undefined) integration.systemType = updateDto.systemType;
    if (updateDto.database !== undefined) integration.database = updateDto.database;
    if (updateDto.syncIntervalSeconds !== undefined) integration.syncIntervalSeconds = updateDto.syncIntervalSeconds;
    if (updateDto.enabled !== undefined) integration.enabled = updateDto.enabled;
    if (updateDto.configuration !== undefined) integration.configuration = updateDto.configuration;
    if (updateDto.authentication !== undefined) integration.authentication = updateDto.authentication;
    if (updateDto.description !== undefined) integration.description = updateDto.description;

    return await this.systemIntegrationRepository.save(integration);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const integration = await this.findOne(id, tenantId);
    await this.systemIntegrationRepository.remove(integration);
  }

  async testConnection(id: string, testDto: TestSystemIntegrationDto, tenantId: string): Promise<any> {
    const integration = await this.findOne(id, tenantId);

    try {
      // Simulate system integration connection test
      const testEndpoint = testDto.endpoint || integration.endpoint;
      const testApiKey = testDto.apiKey || integration.apiKey;
      const testUsername = testDto.username || integration.username;
      const testPassword = testDto.password || (integration.passwordHash ? '***' : null);
      const testDatabase = testDto.database || integration.database;

      // Simulate connection test with timeout
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate based on integration type
      if (integration.integrationType === 'PI' && !testEndpoint) {
        throw new BadRequestException('Endpoint is required for PI integration');
      }

      if (integration.integrationType === 'CMMS' && !testEndpoint && !testApiKey) {
        throw new BadRequestException('Endpoint or API key is required for CMMS integration');
      }

      if (integration.integrationType === 'Historian' && !testDatabase) {
        throw new BadRequestException('Database is required for Historian integration');
      }

      // Record health status
      await this.recordHealthStatus(integration, 'connected', undefined, {
        connectionType: 'system_integration',
        integrationType: integration.integrationType,
        systemType: integration.systemType,
        endpoint: integration.endpoint,
        testTimestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: `${integration.integrationType} integration test successful`,
        details: {
          integrationType: integration.integrationType,
          endpoint: testEndpoint,
          systemType: integration.systemType,
          database: testDatabase,
          responseTime: Math.floor(Math.random() * 200) + 100, // Simulated response time
          systemInfo: this.getSystemInfo(integration.integrationType, integration.systemType || 'unknown'),
        },
      };
    } catch (error) {
      // Record health status
      await this.recordHealthStatus(integration, 'error', error.message, {
        connectionType: 'system_integration',
        integrationType: integration.integrationType,
        systemType: integration.systemType || 'unknown',
        endpoint: integration.endpoint,
        error: error.message,
        testTimestamp: new Date().toISOString(),
      });

      return {
        success: false,
        message: `${integration.integrationType} integration test failed`,
        error: error.message,
        details: {
          integrationType: integration.integrationType,
          endpoint: testDto.endpoint || integration.endpoint,
          systemType: integration.systemType,
          database: testDto.database || integration.database,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async syncData(id: string, syncDto: SyncSystemIntegrationDto, tenantId: string): Promise<any> {
    const integration = await this.findOne(id, tenantId);

    try {
      // Simulate data synchronization
      const syncStartTime = new Date();
      await new Promise(resolve => setTimeout(resolve, 3000));

      const syncEndTime = new Date();
      const syncDuration = syncEndTime.getTime() - syncStartTime.getTime();

      // Simulate sync results based on integration type
      const syncResults = this.getSyncResults(integration.integrationType, syncDto.forceFullSync);

      return {
        success: true,
        message: `${integration.integrationType} synchronization completed`,
        details: {
          integrationId: id,
          integrationType: integration.integrationType,
          syncStartTime: syncStartTime.toISOString(),
          syncEndTime: syncEndTime.toISOString(),
          syncDuration: syncDuration,
          forceFullSync: syncDto.forceFullSync || false,
          results: syncResults,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `${integration.integrationType} synchronization failed`,
        error: error.message,
        details: {
          integrationId: id,
          integrationType: integration.integrationType,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getIntegrationStatus(id: string, tenantId: string): Promise<any> {
    const integration = await this.findOne(id, tenantId);

    try {
      // Simulate integration status check
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        integrationId: id,
        integrationType: integration.integrationType,
        status: integration.enabled ? 'active' : 'inactive',
        lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(), // Random time within last hour
        nextSync: new Date(Date.now() + integration.syncIntervalSeconds * 1000).toISOString(),
        syncInterval: integration.syncIntervalSeconds,
        healthStatus: 'healthy',
        metrics: {
          totalRecords: Math.floor(Math.random() * 10000) + 1000,
          lastSyncRecords: Math.floor(Math.random() * 100) + 10,
          errorCount: Math.floor(Math.random() * 5),
          successRate: 95 + Math.random() * 5,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get integration status',
        error: error.message,
        integrationId: id,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getPIConnections(tenantId: string): Promise<any> {
    const piIntegrations = await this.systemIntegrationRepository.find({
      where: { tenantId, integrationType: 'PI' },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      connections: piIntegrations.map(integration => ({
        id: integration.id,
        name: integration.name,
        endpoint: integration.endpoint,
        database: integration.database,
        enabled: integration.enabled,
        lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        status: integration.enabled ? 'connected' : 'disconnected',
      })),
      timestamp: new Date().toISOString(),
    };
  }

  async getCMMSConnections(tenantId: string): Promise<any> {
    const cmmsIntegrations = await this.systemIntegrationRepository.find({
      where: { tenantId, integrationType: 'CMMS' },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      connections: cmmsIntegrations.map(integration => ({
        id: integration.id,
        name: integration.name,
        systemType: integration.systemType,
        endpoint: integration.endpoint,
        enabled: integration.enabled,
        lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        status: integration.enabled ? 'connected' : 'disconnected',
      })),
      timestamp: new Date().toISOString(),
    };
  }

  private getSystemInfo(integrationType: string, systemType?: string): any {
    switch (integrationType) {
      case 'PI':
        return {
          systemName: 'Aveva PI System',
          version: '2023 R2',
          serverTime: new Date().toISOString(),
          timeZone: 'UTC',
          maxConnections: 1000,
          currentConnections: Math.floor(Math.random() * 100) + 50,
        };
      case 'CMMS':
        const cmmsInfo = {
          SAP: {
            systemName: 'SAP Plant Maintenance',
            version: 'S/4HANA 2023',
            client: '100',
            systemId: 'SAP',
          },
          Maximo: {
            systemName: 'IBM Maximo',
            version: '8.6',
            environment: 'Production',
            maximoVersion: '8.6.0.0',
          },
          Infor: {
            systemName: 'Infor EAM',
            version: '12.0',
            environment: 'Production',
            databaseVersion: 'Oracle 19c',
          },
        };
        return cmmsInfo[systemType as keyof typeof cmmsInfo] || {
          systemName: 'CMMS System',
          version: 'Unknown',
          systemType: systemType,
        };
      case 'Historian':
        return {
          systemName: 'Process Historian',
          version: '2023.1',
          databaseType: 'Time Series',
          maxDataPoints: 1000000,
          currentDataPoints: Math.floor(Math.random() * 100000) + 50000,
        };
      default:
        return {
          systemName: 'External System',
          version: 'Unknown',
          integrationType: integrationType,
        };
    }
  }

  private getSyncResults(integrationType: string, forceFullSync?: boolean): any {
    const baseResults = {
      recordsProcessed: Math.floor(Math.random() * 1000) + 100,
      recordsCreated: Math.floor(Math.random() * 100) + 10,
      recordsUpdated: Math.floor(Math.random() * 50) + 5,
      recordsDeleted: Math.floor(Math.random() * 10),
      errors: Math.floor(Math.random() * 3),
    };

    switch (integrationType) {
      case 'PI':
        return {
          ...baseResults,
          eventFramesProcessed: Math.floor(Math.random() * 100) + 20,
          attributesProcessed: Math.floor(Math.random() * 500) + 100,
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        };
      case 'CMMS':
        return {
          ...baseResults,
          workOrdersProcessed: Math.floor(Math.random() * 50) + 10,
          assetsProcessed: Math.floor(Math.random() * 200) + 50,
          maintenanceTasksProcessed: Math.floor(Math.random() * 100) + 20,
        };
      case 'Historian':
        return {
          ...baseResults,
          dataPointsProcessed: Math.floor(Math.random() * 10000) + 1000,
          timeSeriesProcessed: Math.floor(Math.random() * 100) + 20,
          compressionRatio: 0.7 + Math.random() * 0.2,
        };
      default:
        return baseResults;
    }
  }

  private async recordHealthStatus(
    integration: SystemIntegration,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'system_integration';
    health.systemIntegrationId = integration.id;
    health.status = status;
    health.errorMessage = errorMessage || null;
    health.metrics = metrics;
    health.checkedAt = new Date();

    await this.connectionHealthRepository.save(health);
  }

  async getHealthStatus(id: string, tenantId: string): Promise<ConnectionHealth[]> {
    const integration = await this.findOne(id, tenantId);
    
    return await this.connectionHealthRepository.find({
      where: { systemIntegrationId: integration.id },
      order: { checkedAt: 'DESC' },
      take: 10,
    });
  }
}
