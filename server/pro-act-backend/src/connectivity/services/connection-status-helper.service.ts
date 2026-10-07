import { Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OPCUAConnection } from '../entities/opcua-connection.entity';
import { ModbusConnection } from '../entities/modbus-connection.entity';
import { MQTTConnection } from '../entities/mqtt-connection.entity';
import { EtherNetIPConnection } from '../entities/ethernetip-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';
export type ConnectionType = 'opcua' | 'modbus' | 'mqtt' | 'ethernetip';

@Injectable()
export class ConnectionStatusHelperService {
  constructor(
    @InjectRepository(OPCUAConnection)
    private opcuaRepository: Repository<OPCUAConnection>,
    @InjectRepository(ModbusConnection)
    private modbusRepository: Repository<ModbusConnection>,
    @InjectRepository(MQTTConnection)
    private mqttRepository: Repository<MQTTConnection>,
    @InjectRepository(EtherNetIPConnection)
    private ethernetipRepository: Repository<EtherNetIPConnection>,
    @InjectRepository(ConnectionHealth)
    private healthRepository: Repository<ConnectionHealth>,
    @Inject(forwardRef(() => ConnectivityGateway))
    @Optional()
    private connectivityGateway?: ConnectivityGateway,
  ) {}

  /**
   * Update connection status in database
   */
  async updateConnectionStatus(
    type: ConnectionType,
    connectionId: string,
    status: ConnectionStatus,
    error?: string,
  ): Promise<void> {
    const updateData: any = {
      status,
      lastConnected: status === 'connected' ? new Date() : undefined,
    };

    if (error) {
      updateData.lastError = error;
      updateData.errorCount = () => 'error_count + 1'; // Increment error count
    } else if (status === 'connected') {
      updateData.lastError = null;
      updateData.errorCount = 0; // Reset error count on successful connection
    }

    switch (type) {
      case 'opcua':
        await this.opcuaRepository.update(connectionId, updateData);
        break;
      case 'modbus':
        await this.modbusRepository.update(connectionId, updateData);
        break;
      case 'mqtt':
        await this.mqttRepository.update(connectionId, updateData);
        break;
      case 'ethernetip':
        await this.ethernetipRepository.update(connectionId, updateData);
        break;
    }

    // Record health status
    await this.recordHealthStatus(type, connectionId, status, error);
    
    // Broadcast status update via WebSocket
    if (this.connectivityGateway) {
      this.connectivityGateway.broadcastConnectionStatus(connectionId, type, {
        status,
        error,
      });
    }
  }

  /**
   * Record health status
   */
  private async recordHealthStatus(
    type: ConnectionType,
    connectionId: string,
    status: ConnectionStatus,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = type;
    health.status = status;
    health.errorMessage = errorMessage || null;
    health.metrics = metrics;
    health.checkedAt = new Date();

    switch (type) {
      case 'opcua':
        health.opcuaConnectionId = connectionId;
        break;
      case 'modbus':
        health.modbusConnectionId = connectionId;
        break;
      case 'mqtt':
        health.mqttConnectionId = connectionId;
        break;
      case 'ethernetip':
        health.ethernetipConnectionId = connectionId;
        break;
    }

    await this.healthRepository.save(health);
    
    // Broadcast health update via WebSocket
    if (this.connectivityGateway) {
      const connectionId = health.opcuaConnectionId || 
                          health.modbusConnectionId || 
                          health.mqttConnectionId || 
                          health.ethernetipConnectionId;
      
      if (connectionId) {
        this.connectivityGateway.broadcastConnectionHealth(connectionId, type, {
          status: health.status,
          errorMessage: health.errorMessage,
          metrics: health.metrics,
          checkedAt: health.checkedAt,
        });
      }
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(type: ConnectionType, connectionId: string): Promise<ConnectionStatus | null> {
    let connection: any = null;

    switch (type) {
      case 'opcua':
        connection = await this.opcuaRepository.findOne({ where: { id: connectionId }, select: ['id', 'status'] });
        break;
      case 'modbus':
        connection = await this.modbusRepository.findOne({ where: { id: connectionId }, select: ['id', 'status'] });
        break;
      case 'mqtt':
        connection = await this.mqttRepository.findOne({ where: { id: connectionId }, select: ['id', 'status'] });
        break;
      case 'ethernetip':
        connection = await this.ethernetipRepository.findOne({ where: { id: connectionId }, select: ['id', 'status'] });
        break;
    }

    return connection?.status || null;
  }
}

