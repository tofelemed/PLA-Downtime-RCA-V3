import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OPCUAConnection } from '../entities/opcua-connection.entity';
import { ModbusConnection } from '../entities/modbus-connection.entity';
import { EtherNetIPConnection } from '../entities/ethernetip-connection.entity';
import { MQTTConnection } from '../entities/mqtt-connection.entity';
import { SystemIntegration } from '../entities/system-integration.entity';
import { DataBinding } from '../entities/data-binding.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';

@Injectable()
export class ProtocolManagerService {
  constructor(
    @InjectRepository(OPCUAConnection)
    private opcuaConnectionRepository: Repository<OPCUAConnection>,
    @InjectRepository(ModbusConnection)
    private modbusConnectionRepository: Repository<ModbusConnection>,
    @InjectRepository(EtherNetIPConnection)
    private ethernetipConnectionRepository: Repository<EtherNetIPConnection>,
    @InjectRepository(MQTTConnection)
    private mqttConnectionRepository: Repository<MQTTConnection>,
    @InjectRepository(SystemIntegration)
    private systemIntegrationRepository: Repository<SystemIntegration>,
    @InjectRepository(DataBinding)
    private dataBindingRepository: Repository<DataBinding>,
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
  ) {}

  async getProtocolOverview(tenantId: string): Promise<any> {
    try {
      // Get all connections and their counts
      const [opcuaConnections, modbusConnections, ethernetipConnections, mqttConnections, systemIntegrations, dataBindings] = await Promise.all([
        this.opcuaConnectionRepository.find({ where: { tenantId } }),
        this.modbusConnectionRepository.find({ where: { tenantId } }),
        this.ethernetipConnectionRepository.find({ where: { tenantId } }),
        this.mqttConnectionRepository.find({ where: { tenantId } }),
        this.systemIntegrationRepository.find({ where: { tenantId } }),
        this.dataBindingRepository.find({ where: { tenantId } }),
      ]);

      // Get latest health status for all connections
      const allConnectionIds = [
        ...opcuaConnections.map(c => ({ type: 'opcua', id: c.id })),
        ...modbusConnections.map(c => ({ type: 'modbus', id: c.id })),
        ...ethernetipConnections.map(c => ({ type: 'ethernetip', id: c.id })),
        ...mqttConnections.map(c => ({ type: 'mqtt', id: c.id })),
        ...systemIntegrations.map(c => ({ type: 'system_integration', id: c.id })),
      ];

      const healthStatuses = await this.getLatestHealthStatuses(allConnectionIds);

      // Calculate protocol statistics
      const protocolStats = {
        opcua: {
          total: opcuaConnections.length,
          enabled: opcuaConnections.filter(c => c.enabled).length,
          connected: healthStatuses.filter(h => h.connectionType === 'opcua' && h.status === 'connected').length,
          dataPoints: opcuaConnections.reduce((sum, c) => sum + (c.subscriptionSize || 0), 0),
        },
        modbus: {
          total: modbusConnections.length,
          enabled: modbusConnections.filter(c => c.enabled).length,
          connected: healthStatuses.filter(h => h.connectionType === 'modbus' && h.status === 'connected').length,
          dataPoints: modbusConnections.reduce((sum, c) => sum + (c.registerCount || 0), 0),
        },
        ethernetip: {
          total: ethernetipConnections.length,
          enabled: ethernetipConnections.filter(c => c.enabled).length,
          connected: healthStatuses.filter(h => h.connectionType === 'ethernetip' && h.status === 'connected').length,
          dataPoints: ethernetipConnections.length * 10, // Estimated
        },
        mqtt: {
          total: mqttConnections.length,
          enabled: mqttConnections.filter(c => c.enabled).length,
          connected: healthStatuses.filter(h => h.connectionType === 'mqtt' && h.status === 'connected').length,
          topics: mqttConnections.reduce((sum, c) => sum + (c.subscribeTopics ? c.subscribeTopics.split(',').length : 0), 0),
        },
        systemIntegrations: {
          total: systemIntegrations.length,
          enabled: systemIntegrations.filter(c => c.enabled).length,
          connected: healthStatuses.filter(h => h.connectionType === 'system_integration' && h.status === 'connected').length,
          types: this.getSystemIntegrationTypes(systemIntegrations),
        },
      };

      const totalConnections = Object.values(protocolStats).reduce((sum, stat) => sum + stat.total, 0);
      const totalConnected = Object.values(protocolStats).reduce((sum, stat) => sum + stat.connected, 0);
      const totalDataPoints = protocolStats.opcua.dataPoints + protocolStats.modbus.dataPoints + protocolStats.ethernetip.dataPoints;

      return {
        success: true,
        overview: {
          totalConnections: totalConnections,
          totalConnected: totalConnected,
          totalDataPoints: totalDataPoints,
          totalDataBindings: dataBindings.length,
          activeDataBindings: dataBindings.filter(b => b.active).length,
          connectionHealth: totalConnections > 0 ? (totalConnected / totalConnections) * 100 : 100,
        },
        protocols: protocolStats,
        recentActivity: await this.getRecentActivity(tenantId),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get protocol overview',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getProtocolStatus(protocolType: string, tenantId: string): Promise<any> {
    try {
      let connections: any[] = [];
      let connectionType = '';

      switch (protocolType.toLowerCase()) {
        case 'opcua':
          connections = await this.opcuaConnectionRepository.find({ where: { tenantId } });
          connectionType = 'opcua';
          break;
        case 'modbus':
          connections = await this.modbusConnectionRepository.find({ where: { tenantId } });
          connectionType = 'modbus';
          break;
        case 'ethernetip':
          connections = await this.ethernetipConnectionRepository.find({ where: { tenantId } });
          connectionType = 'ethernetip';
          break;
        case 'mqtt':
          connections = await this.mqttConnectionRepository.find({ where: { tenantId } });
          connectionType = 'mqtt';
          break;
        case 'system_integration':
          connections = await this.systemIntegrationRepository.find({ where: { tenantId } });
          connectionType = 'system_integration';
          break;
        default:
          throw new Error(`Unknown protocol type: ${protocolType}`);
      }

      // Get health status for connections
      const connectionIds = connections.map(c => ({ type: connectionType, id: c.id }));
      const healthStatuses = await this.getLatestHealthStatuses(connectionIds);

      const connectionsWithHealth = connections.map(connection => {
        const health = healthStatuses.find(h => h[`${connectionType}ConnectionId`] === connection.id);
        return {
          ...connection,
          healthStatus: health ? health.status : 'unknown',
          lastChecked: health ? health.checkedAt : null,
          responseTime: health ? health.responseTimeMs : null,
          errorMessage: health ? health.errorMessage : null,
        };
      });

      return {
        success: true,
        protocolType: protocolType,
        totalConnections: connections.length,
        enabledConnections: connections.filter(c => c.enabled).length,
        connectedConnections: healthStatuses.filter(h => h.status === 'connected').length,
        connections: connectionsWithHealth,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get ${protocolType} status`,
        error: error.message,
        protocolType: protocolType,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getDataFlowOverview(tenantId: string): Promise<any> {
    try {
      const dataBindings = await this.dataBindingRepository.find({
        where: { tenantId },
        relations: [
          'sourceOPCUAConnection',
          'sourceModbusConnection',
          'sourceEtherNetIPConnection',
          'sourceMQTTConnection',
          'sourceSystemIntegration',
          'targetOPCUAConnection',
          'targetModbusConnection',
          'targetEtherNetIPConnection',
          'targetMQTTConnection',
          'targetSystemIntegration',
          'transformations',
        ],
      });

      const flowStatistics = {
        totalBindings: dataBindings.length,
        activeBindings: dataBindings.filter(b => b.active).length,
        enabledBindings: dataBindings.filter(b => b.enabled).length,
        triggerModes: {
          manual: dataBindings.filter(b => b.triggerMode === 'manual').length,
          scheduled: dataBindings.filter(b => b.triggerMode === 'scheduled').length,
          eventDriven: dataBindings.filter(b => b.triggerMode === 'event-driven').length,
        },
        sourceTypes: this.getSourceTypeCounts(dataBindings),
        targetTypes: this.getTargetTypeCounts(dataBindings),
        transformations: dataBindings.reduce((sum, b) => sum + (b.transformations?.length || 0), 0),
      };

      const dataFlowPaths = dataBindings.map(binding => ({
        id: binding.id,
        name: binding.name,
        source: this.getSourceInfo(binding),
        target: this.getTargetInfo(binding),
        status: binding.active ? 'active' : 'inactive',
        triggerMode: binding.triggerMode,
        transformations: binding.transformations?.length || 0,
        lastExecution: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      }));

      return {
        success: true,
        statistics: flowStatistics,
        dataFlowPaths: dataFlowPaths,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get data flow overview',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getPerformanceMetrics(tenantId: string, timeRange: string = '24h'): Promise<any> {
    try {
      const now = new Date();
      const timeRangeMs = timeRange === '1h' ? 60 * 60 * 1000 :
                         timeRange === '24h' ? 24 * 60 * 60 * 1000 :
                         timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                         24 * 60 * 60 * 1000;

      const startTime = new Date(now.getTime() - timeRangeMs);
      const endTime = now;

      // Get performance data from health records
      const healthRecords = await this.connectionHealthRepository
        .createQueryBuilder('health')
        .where('health.checkedAt >= :startTime', { startTime })
        .andWhere('health.checkedAt <= :endTime', { endTime })
        .orderBy('health.checkedAt', 'ASC')
        .getMany();

      // Calculate performance metrics by protocol
      const protocolMetrics = healthRecords.reduce((acc, record) => {
        if (!acc[record.connectionType]) {
          acc[record.connectionType] = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            responseTimes: [],
            errorMessages: [],
          };
        }
        
        acc[record.connectionType].totalChecks++;
        if (record.status === 'connected') acc[record.connectionType].successfulChecks++;
        if (record.status === 'error') {
          acc[record.connectionType].failedChecks++;
          if (record.errorMessage) acc[record.connectionType].errorMessages.push(record.errorMessage);
        }
        if (record.responseTimeMs) acc[record.connectionType].responseTimes.push(record.responseTimeMs);
        
        return acc;
      }, {});

      // Calculate averages and rates
      Object.keys(protocolMetrics).forEach(protocol => {
        const metrics = protocolMetrics[protocol];
        metrics.successRate = metrics.totalChecks > 0 ? (metrics.successfulChecks / metrics.totalChecks) * 100 : 0;
        metrics.errorRate = metrics.totalChecks > 0 ? (metrics.failedChecks / metrics.totalChecks) * 100 : 0;
        metrics.averageResponseTime = metrics.responseTimes.length > 0 ?
          Math.round(metrics.responseTimes.reduce((sum, time) => sum + time, 0) / metrics.responseTimes.length) : 0;
        metrics.minResponseTime = metrics.responseTimes.length > 0 ? Math.min(...metrics.responseTimes) : 0;
        metrics.maxResponseTime = metrics.responseTimes.length > 0 ? Math.max(...metrics.responseTimes) : 0;
        
        // Remove raw data
        delete metrics.responseTimes;
        delete metrics.errorMessages;
      });

      return {
        success: true,
        timeRange: timeRange,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        protocolMetrics: protocolMetrics,
        overallMetrics: {
          totalChecks: healthRecords.length,
          successfulChecks: healthRecords.filter(h => h.status === 'connected').length,
          failedChecks: healthRecords.filter(h => h.status === 'error').length,
          averageResponseTime: healthRecords.filter(h => h.responseTimeMs).length > 0 ?
            Math.round(healthRecords.filter(h => h.responseTimeMs).reduce((sum, h) => sum + h.responseTimeMs, 0) / 
                      healthRecords.filter(h => h.responseTimeMs).length) : 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get performance metrics',
        error: error.message,
        timeRange: timeRange,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async getLatestHealthStatuses(connectionIds: { type: string; id: string }[]): Promise<ConnectionHealth[]> {
    if (connectionIds.length === 0) return [];

    const healthPromises = connectionIds.map(async ({ type, id }) => {
      const connectionIdField = `${type}ConnectionId`;
      return await this.connectionHealthRepository
        .createQueryBuilder('health')
        .where(`health.connectionType = :connectionType`, { connectionType: type })
        .andWhere(`health.${connectionIdField} = :connectionId`, { connectionId: id })
        .orderBy('health.checkedAt', 'DESC')
        .getOne();
    });

    const healthStatuses = await Promise.all(healthPromises);
    return healthStatuses.filter((status): status is ConnectionHealth => status !== null);
  }

  private async getRecentActivity(tenantId: string): Promise<any[]> {
    // Simulate recent activity
    const activities = [
      {
        type: 'connection_test',
        protocol: 'OPC UA',
        connectionName: 'Production Server',
        status: 'success',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        type: 'data_sync',
        protocol: 'PI Integration',
        connectionName: 'PI Event Frames',
        status: 'success',
        recordsProcessed: 150,
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        type: 'binding_execution',
        protocol: 'Data Binding',
        connectionName: 'Modbus to PI',
        status: 'success',
        recordsTransformed: 75,
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        type: 'connection_error',
        protocol: 'MQTT',
        connectionName: 'IoT Broker',
        status: 'error',
        errorMessage: 'Connection timeout',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
    ];

    return activities;
  }

  private getSystemIntegrationTypes(integrations: SystemIntegration[]): { [key: string]: number } {
    return integrations.reduce((acc, integration) => {
      const type = integration.integrationType;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  private getSourceTypeCounts(bindings: DataBinding[]): { [key: string]: number } {
    const counts = { opcua: 0, modbus: 0, ethernetip: 0, mqtt: 0, system_integration: 0 };
    
    bindings.forEach(binding => {
      if (binding.sourceOPCUAConnectionId) counts.opcua++;
      if (binding.sourceModbusConnectionId) counts.modbus++;
      if (binding.sourceEtherNetIPConnectionId) counts.ethernetip++;
      if (binding.sourceMQTTConnectionId) counts.mqtt++;
      if (binding.sourceSystemIntegrationId) counts.system_integration++;
    });
    
    return counts;
  }

  private getTargetTypeCounts(bindings: DataBinding[]): { [key: string]: number } {
    const counts = { opcua: 0, modbus: 0, ethernetip: 0, mqtt: 0, system_integration: 0 };
    
    bindings.forEach(binding => {
      if (binding.targetOPCUAConnectionId) counts.opcua++;
      if (binding.targetModbusConnectionId) counts.modbus++;
      if (binding.targetEtherNetIPConnectionId) counts.ethernetip++;
      if (binding.targetMQTTConnectionId) counts.mqtt++;
      if (binding.targetSystemIntegrationId) counts.system_integration++;
    });
    
    return counts;
  }

  private getSourceInfo(binding: DataBinding): any {
    if (binding.sourceOPCUAConnection) {
      return { type: 'OPC UA', name: binding.sourceOPCUAConnection.name, path: binding.sourcePath };
    }
    if (binding.sourceModbusConnection) {
      return { type: 'Modbus', name: binding.sourceModbusConnection.name, path: binding.sourcePath };
    }
    if (binding.sourceEtherNetIPConnection) {
      return { type: 'EtherNet/IP', name: binding.sourceEtherNetIPConnection.name, path: binding.sourcePath };
    }
    if (binding.sourceMQTTConnection) {
      return { type: 'MQTT', name: binding.sourceMQTTConnection.name, path: binding.sourcePath };
    }
    if (binding.sourceSystemIntegration) {
      return { type: binding.sourceSystemIntegration.integrationType, name: binding.sourceSystemIntegration.name, path: binding.sourcePath };
    }
    return { type: 'Unknown', name: 'Unknown', path: binding.sourcePath };
  }

  private getTargetInfo(binding: DataBinding): any {
    if (binding.targetOPCUAConnection) {
      return { type: 'OPC UA', name: binding.targetOPCUAConnection.name, path: binding.targetPath };
    }
    if (binding.targetModbusConnection) {
      return { type: 'Modbus', name: binding.targetModbusConnection.name, path: binding.targetPath };
    }
    if (binding.targetEtherNetIPConnection) {
      return { type: 'EtherNet/IP', name: binding.targetEtherNetIPConnection.name, path: binding.targetPath };
    }
    if (binding.targetMQTTConnection) {
      return { type: 'MQTT', name: binding.targetMQTTConnection.name, path: binding.targetPath };
    }
    if (binding.targetSystemIntegration) {
      return { type: binding.targetSystemIntegration.integrationType, name: binding.targetSystemIntegration.name, path: binding.targetPath };
    }
    return { type: 'Unknown', name: 'Unknown', path: binding.targetPath };
  }
}
