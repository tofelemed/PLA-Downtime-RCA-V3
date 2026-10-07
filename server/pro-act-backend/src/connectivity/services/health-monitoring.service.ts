import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { OPCUAConnection } from '../entities/opcua-connection.entity';
import { ModbusConnection } from '../entities/modbus-connection.entity';
import { EtherNetIPConnection } from '../entities/ethernetip-connection.entity';
import { MQTTConnection } from '../entities/mqtt-connection.entity';
import { SystemIntegration } from '../entities/system-integration.entity';

@Injectable()
export class HealthMonitoringService {
  constructor(
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
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
  ) {}

  async getSystemHealth(tenantId: string): Promise<any> {
    try {
      // Get all connections for the tenant
      const [opcuaConnections, modbusConnections, ethernetipConnections, mqttConnections, systemIntegrations] = await Promise.all([
        this.opcuaConnectionRepository.find({ where: { tenantId } }),
        this.modbusConnectionRepository.find({ where: { tenantId } }),
        this.ethernetipConnectionRepository.find({ where: { tenantId } }),
        this.mqttConnectionRepository.find({ where: { tenantId } }),
        this.systemIntegrationRepository.find({ where: { tenantId } }),
      ]);

      // Get latest health status for each connection type
      const healthStatuses = await Promise.all([
        this.getLatestHealthStatus('opcua', opcuaConnections.map(c => c.id)),
        this.getLatestHealthStatus('modbus', modbusConnections.map(c => c.id)),
        this.getLatestHealthStatus('ethernetip', ethernetipConnections.map(c => c.id)),
        this.getLatestHealthStatus('mqtt', mqttConnections.map(c => c.id)),
        this.getLatestHealthStatus('system_integration', systemIntegrations.map(c => c.id)),
      ]);

      const [opcuaHealth, modbusHealth, ethernetipHealth, mqttHealth, systemHealth] = healthStatuses;

      // Calculate overall system health
      const totalConnections = opcuaConnections.length + modbusConnections.length + ethernetipConnections.length + mqttConnections.length + systemIntegrations.length;
      const connectedConnections = opcuaHealth.filter(h => h.status === 'connected').length +
                                 modbusHealth.filter(h => h.status === 'connected').length +
                                 ethernetipHealth.filter(h => h.status === 'connected').length +
                                 mqttHealth.filter(h => h.status === 'connected').length +
                                 systemHealth.filter(h => h.status === 'connected').length;

      const overallHealth = totalConnections > 0 ? (connectedConnections / totalConnections) * 100 : 100;

      return {
        success: true,
        overallHealth: Math.round(overallHealth * 100) / 100,
        totalConnections: totalConnections,
        connectedConnections: connectedConnections,
        disconnectedConnections: totalConnections - connectedConnections,
        healthByType: {
          opcua: {
            total: opcuaConnections.length,
            connected: opcuaHealth.filter(h => h.status === 'connected').length,
            disconnected: opcuaHealth.filter(h => h.status === 'disconnected').length,
            errors: opcuaHealth.filter(h => h.status === 'error').length,
          },
          modbus: {
            total: modbusConnections.length,
            connected: modbusHealth.filter(h => h.status === 'connected').length,
            disconnected: modbusHealth.filter(h => h.status === 'disconnected').length,
            errors: modbusHealth.filter(h => h.status === 'error').length,
          },
          ethernetip: {
            total: ethernetipConnections.length,
            connected: ethernetipHealth.filter(h => h.status === 'connected').length,
            disconnected: ethernetipHealth.filter(h => h.status === 'disconnected').length,
            errors: ethernetipHealth.filter(h => h.status === 'error').length,
          },
          mqtt: {
            total: mqttConnections.length,
            connected: mqttHealth.filter(h => h.status === 'connected').length,
            disconnected: mqttHealth.filter(h => h.status === 'disconnected').length,
            errors: mqttHealth.filter(h => h.status === 'error').length,
          },
          systemIntegrations: {
            total: systemIntegrations.length,
            connected: systemHealth.filter(h => h.status === 'connected').length,
            disconnected: systemHealth.filter(h => h.status === 'disconnected').length,
            errors: systemHealth.filter(h => h.status === 'error').length,
          },
        },
        lastChecked: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get system health',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getConnectionHealth(connectionType: string, connectionId: string, tenantId: string): Promise<any> {
    try {
      const healthRecords = await this.connectionHealthRepository.find({
        where: { 
          connectionType: connectionType,
          [`${connectionType}ConnectionId`]: connectionId,
        },
        order: { checkedAt: 'DESC' },
        take: 50,
      });

      if (healthRecords.length === 0) {
        return {
          success: true,
          connectionType: connectionType,
          connectionId: connectionId,
          status: 'unknown',
          message: 'No health records found',
          records: [],
          timestamp: new Date().toISOString(),
        };
      }

      const latestHealth = healthRecords[0];
      const averageResponseTime = healthRecords
        .filter(h => h.responseTimeMs)
        .reduce((sum, h) => sum + h.responseTimeMs, 0) / healthRecords.filter(h => h.responseTimeMs).length;

      const errorRate = healthRecords.filter(h => h.status === 'error').length / healthRecords.length * 100;

      return {
        success: true,
        connectionType: connectionType,
        connectionId: connectionId,
        currentStatus: latestHealth.status,
        averageResponseTime: Math.round(averageResponseTime || 0),
        errorRate: Math.round(errorRate * 100) / 100,
        totalChecks: healthRecords.length,
        lastChecked: latestHealth.checkedAt.toISOString(),
        healthHistory: healthRecords.map(record => ({
          status: record.status,
          responseTime: record.responseTimeMs,
          errorMessage: record.errorMessage,
          checkedAt: record.checkedAt.toISOString(),
          metrics: record.metrics,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get connection health',
        error: error.message,
        connectionType: connectionType,
        connectionId: connectionId,
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
                         24 * 60 * 60 * 1000; // Default to 24h

      const startTime = new Date(now.getTime() - timeRangeMs);
      const endTime = now;

      const healthRecords = await this.connectionHealthRepository
        .createQueryBuilder('health')
        .where('health.checkedAt >= :startTime', { startTime })
        .andWhere('health.checkedAt <= :endTime', { endTime })
        .orderBy('health.checkedAt', 'ASC')
        .getMany();

      // Calculate performance metrics
      const totalChecks = healthRecords.length;
      const successfulChecks = healthRecords.filter(h => h.status === 'connected').length;
      const failedChecks = healthRecords.filter(h => h.status === 'error').length;
      const disconnectedChecks = healthRecords.filter(h => h.status === 'disconnected').length;

      const averageResponseTime = healthRecords
        .filter(h => h.responseTimeMs)
        .reduce((sum, h) => sum + h.responseTimeMs, 0) / healthRecords.filter(h => h.responseTimeMs).length;

      const successRate = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
      const errorRate = totalChecks > 0 ? (failedChecks / totalChecks) * 100 : 0;

      // Group by connection type
      const metricsByType = healthRecords.reduce((acc, record) => {
        if (!acc[record.connectionType]) {
          acc[record.connectionType] = {
            total: 0,
            successful: 0,
            failed: 0,
            disconnected: 0,
            responseTimes: [],
          };
        }
        acc[record.connectionType].total++;
        if (record.status === 'connected') acc[record.connectionType].successful++;
        if (record.status === 'error') acc[record.connectionType].failed++;
        if (record.status === 'disconnected') acc[record.connectionType].disconnected++;
        if (record.responseTimeMs) acc[record.connectionType].responseTimes.push(record.responseTimeMs);
        return acc;
      }, {});

      // Calculate averages for each type
      Object.keys(metricsByType).forEach(type => {
        const typeMetrics = metricsByType[type];
        typeMetrics.averageResponseTime = typeMetrics.responseTimes.length > 0 ?
          Math.round(typeMetrics.responseTimes.reduce((sum, time) => sum + time, 0) / typeMetrics.responseTimes.length) : 0;
        typeMetrics.successRate = typeMetrics.total > 0 ? (typeMetrics.successful / typeMetrics.total) * 100 : 0;
        typeMetrics.errorRate = typeMetrics.total > 0 ? (typeMetrics.failed / typeMetrics.total) * 100 : 0;
        delete typeMetrics.responseTimes; // Remove raw data
      });

      return {
        success: true,
        timeRange: timeRange,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        overallMetrics: {
          totalChecks: totalChecks,
          successfulChecks: successfulChecks,
          failedChecks: failedChecks,
          disconnectedChecks: disconnectedChecks,
          successRate: Math.round(successRate * 100) / 100,
          errorRate: Math.round(errorRate * 100) / 100,
          averageResponseTime: Math.round(averageResponseTime || 0),
        },
        metricsByType: metricsByType,
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

  async performHealthCheck(tenantId: string): Promise<any> {
    try {
      const startTime = new Date();
      
      // Get all enabled connections
      const [opcuaConnections, modbusConnections, ethernetipConnections, mqttConnections, systemIntegrations] = await Promise.all([
        this.opcuaConnectionRepository.find({ where: { tenantId, enabled: true } }),
        this.modbusConnectionRepository.find({ where: { tenantId, enabled: true } }),
        this.ethernetipConnectionRepository.find({ where: { tenantId, enabled: true } }),
        this.mqttConnectionRepository.find({ where: { tenantId, enabled: true } }),
        this.systemIntegrationRepository.find({ where: { tenantId, enabled: true } }),
      ]);

      const allConnections = [
        ...opcuaConnections.map(c => ({ type: 'opcua', id: c.id, name: c.name })),
        ...modbusConnections.map(c => ({ type: 'modbus', id: c.id, name: c.name })),
        ...ethernetipConnections.map(c => ({ type: 'ethernetip', id: c.id, name: c.name })),
        ...mqttConnections.map(c => ({ type: 'mqtt', id: c.id, name: c.name })),
        ...systemIntegrations.map(c => ({ type: 'system_integration', id: c.id, name: c.name })),
      ];

      // Simulate health checks for all connections
      const healthCheckResults = await Promise.all(
        allConnections.map(async (connection) => {
          // Simulate health check with random results
          const isHealthy = Math.random() > 0.1; // 90% success rate
          const responseTime = Math.floor(Math.random() * 200) + 50;
          
          const health = new ConnectionHealth();
          health.connectionType = connection.type;
          health[`${connection.type}ConnectionId`] = connection.id;
          health.status = isHealthy ? 'connected' : 'error';
          health.responseTimeMs = responseTime;
          health.errorMessage = isHealthy ? null : 'Simulated connection error';
          health.checkedAt = new Date();

          await this.connectionHealthRepository.save(health);

          return {
            connectionType: connection.type,
            connectionId: connection.id,
            connectionName: connection.name,
            status: health.status,
            responseTime: responseTime,
            errorMessage: health.errorMessage,
          };
        })
      );

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      const successfulChecks = healthCheckResults.filter(r => r.status === 'connected').length;
      const failedChecks = healthCheckResults.filter(r => r.status === 'error').length;

      return {
        success: true,
        message: 'Health check completed',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalDuration: totalDuration,
        totalConnections: allConnections.length,
        successfulChecks: successfulChecks,
        failedChecks: failedChecks,
        successRate: allConnections.length > 0 ? (successfulChecks / allConnections.length) * 100 : 100,
        results: healthCheckResults,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async getLatestHealthStatus(connectionType: string, connectionIds: string[]): Promise<ConnectionHealth[]> {
    if (connectionIds.length === 0) return [];

    const connectionIdField = `${connectionType}ConnectionId`;
    
    return await this.connectionHealthRepository
      .createQueryBuilder('health')
      .where(`health.connectionType = :connectionType`, { connectionType })
      .andWhere(`health.${connectionIdField} IN (:...connectionIds)`, { connectionIds })
      .andWhere('health.id IN (' +
        'SELECT MAX(h2.id) FROM connection_health h2 ' +
        `WHERE h2.connectionType = :connectionType AND h2.${connectionIdField} = health.${connectionIdField}` +
      ')')
      .getMany();
  }
}
