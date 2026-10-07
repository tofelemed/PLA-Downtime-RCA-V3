import { Injectable } from '@nestjs/common';
import { OPCUAService } from './services/opcua.service';
import { ModbusService } from './services/modbus.service';
import { EtherNetIPService } from './services/ethernetip.service';
import { MQTTService } from './services/mqtt.service';
import { SystemIntegrationService } from './services/system-integration.service';
import { DataBindingService } from './services/data-binding.service';
import { HealthMonitoringService } from './services/health-monitoring.service';
import { ProtocolManagerService } from './services/protocol-manager.service';

@Injectable()
export class ConnectivityService {
  constructor(
    private readonly opcuaService: OPCUAService,
    private readonly modbusService: ModbusService,
    private readonly ethernetipService: EtherNetIPService,
    private readonly mqttService: MQTTService,
    private readonly systemIntegrationService: SystemIntegrationService,
    private readonly dataBindingService: DataBindingService,
    private readonly healthMonitoringService: HealthMonitoringService,
    private readonly protocolManagerService: ProtocolManagerService,
  ) {}

  // OPC UA methods
  async createOPCUAConnection(createDto: any, tenantId: string) {
    return await this.opcuaService.create({ ...createDto, tenantId });
  }

  async getOPCUAConnections(tenantId: string) {
    return await this.opcuaService.findAll(tenantId);
  }

  async getOPCUAConnection(id: string, tenantId: string) {
    return await this.opcuaService.findOne(id, tenantId);
  }

  async updateOPCUAConnection(id: string, updateDto: any, tenantId: string) {
    return await this.opcuaService.update(id, updateDto, tenantId);
  }

  async deleteOPCUAConnection(id: string, tenantId: string) {
    return await this.opcuaService.remove(id, tenantId);
  }

  async testOPCUAConnection(id: string, testDto: any, tenantId: string) {
    return await this.opcuaService.testConnection(id, testDto, tenantId);
  }

  async browseOPCUAAddressSpace(id: string, nodeId: string, tenantId: string) {
    return await this.opcuaService.browseAddressSpace(id, nodeId, tenantId);
  }

  async readOPCUANodeValues(id: string, nodeIds: string[], tenantId: string) {
    return await this.opcuaService.readNodeValues(id, nodeIds, tenantId);
  }

  // Modbus methods
  async createModbusConnection(createDto: any, tenantId: string) {
    return await this.modbusService.create({ ...createDto, tenantId });
  }

  async getModbusConnections(tenantId: string) {
    return await this.modbusService.findAll(tenantId);
  }

  async getModbusConnection(id: string, tenantId: string) {
    return await this.modbusService.findOne(id, tenantId);
  }

  async updateModbusConnection(id: string, updateDto: any, tenantId: string) {
    return await this.modbusService.update(id, updateDto, tenantId);
  }

  async deleteModbusConnection(id: string, tenantId: string) {
    return await this.modbusService.remove(id, tenantId);
  }

  async testModbusConnection(id: string, testDto: any, tenantId: string) {
    return await this.modbusService.testConnection(id, testDto, tenantId);
  }

  async readModbusRegisters(id: string, startAddress: number, count: number, tenantId: string) {
    return await this.modbusService.readRegisters(id, startAddress, count, tenantId);
  }

  async writeModbusRegister(id: string, address: number, value: number, tenantId: string) {
    return await this.modbusService.writeRegister(id, address, value, tenantId);
  }

  async writeModbusMultipleRegisters(id: string, startAddress: number, values: number[], tenantId: string) {
    return await this.modbusService.writeMultipleRegisters(id, startAddress, values, tenantId);
  }

  // EtherNet/IP methods
  async createEtherNetIPConnection(createDto: any, tenantId: string) {
    return await this.ethernetipService.create({ ...createDto, tenantId });
  }

  async getEtherNetIPConnections(tenantId: string) {
    return await this.ethernetipService.findAll(tenantId);
  }

  async getEtherNetIPConnection(id: string, tenantId: string) {
    return await this.ethernetipService.findOne(id, tenantId);
  }

  async updateEtherNetIPConnection(id: string, updateDto: any, tenantId: string) {
    return await this.ethernetipService.update(id, updateDto, tenantId);
  }

  async deleteEtherNetIPConnection(id: string, tenantId: string) {
    return await this.ethernetipService.remove(id, tenantId);
  }

  async testEtherNetIPConnection(id: string, testDto: any, tenantId: string) {
    return await this.ethernetipService.testConnection(id, testDto, tenantId);
  }

  async readEtherNetIPTags(id: string, tagPaths: string[], tenantId: string) {
    return await this.ethernetipService.readTags(id, tagPaths, tenantId);
  }

  async writeEtherNetIPTag(id: string, tagPath: string, value: any, dataType: string, tenantId: string) {
    return await this.ethernetipService.writeTag(id, tagPath, value, dataType, tenantId);
  }

  async browseEtherNetIPTags(id: string, tenantId: string) {
    return await this.ethernetipService.browseTags(id, tenantId);
  }

  // MQTT methods
  async createMQTTConnection(createDto: any, tenantId: string) {
    return await this.mqttService.create({ ...createDto, tenantId });
  }

  async getMQTTConnections(tenantId: string) {
    return await this.mqttService.findAll(tenantId);
  }

  async getMQTTConnection(id: string, tenantId: string) {
    return await this.mqttService.findOne(id, tenantId);
  }

  async updateMQTTConnection(id: string, updateDto: any, tenantId: string) {
    return await this.mqttService.update(id, updateDto, tenantId);
  }

  async deleteMQTTConnection(id: string, tenantId: string) {
    return await this.mqttService.remove(id, tenantId);
  }

  async testMQTTConnection(id: string, testDto: any, tenantId: string) {
    return await this.mqttService.testConnection(id, testDto, tenantId);
  }

  async publishMQTTMessage(id: string, topic: string, message: string, qos: number, retain: boolean, tenantId: string) {
    return await this.mqttService.publishMessage(id, topic, message, qos, retain, tenantId);
  }

  async subscribeToMQTTTopics(id: string, topics: string[], qos: number[], tenantId: string) {
    return await this.mqttService.subscribeToTopics(id, topics, qos, tenantId);
  }

  async unsubscribeFromMQTTTopics(id: string, topics: string[], tenantId: string) {
    return await this.mqttService.unsubscribeFromTopics(id, topics, tenantId);
  }

  async getMQTTBrokerInfo(id: string, tenantId: string) {
    return await this.mqttService.getBrokerInfo(id, tenantId);
  }

  // System Integration methods
  async createSystemIntegration(createDto: any, tenantId: string) {
    return await this.systemIntegrationService.create({ ...createDto, tenantId });
  }

  async getSystemIntegrations(tenantId: string) {
    return await this.systemIntegrationService.findAll(tenantId);
  }

  async getSystemIntegration(id: string, tenantId: string) {
    return await this.systemIntegrationService.findOne(id, tenantId);
  }

  async updateSystemIntegration(id: string, updateDto: any, tenantId: string) {
    return await this.systemIntegrationService.update(id, updateDto, tenantId);
  }

  async deleteSystemIntegration(id: string, tenantId: string) {
    return await this.systemIntegrationService.remove(id, tenantId);
  }

  async testSystemIntegration(id: string, testDto: any, tenantId: string) {
    return await this.systemIntegrationService.testConnection(id, testDto, tenantId);
  }

  async syncSystemIntegration(id: string, syncDto: any, tenantId: string) {
    return await this.systemIntegrationService.syncData(id, syncDto, tenantId);
  }

  async getSystemIntegrationStatus(id: string, tenantId: string) {
    return await this.systemIntegrationService.getIntegrationStatus(id, tenantId);
  }

  async getPIConnections(tenantId: string) {
    return await this.systemIntegrationService.getPIConnections(tenantId);
  }

  async getCMMSConnections(tenantId: string) {
    return await this.systemIntegrationService.getCMMSConnections(tenantId);
  }

  // Data Binding methods
  async createDataBinding(createDto: any, tenantId: string) {
    return await this.dataBindingService.create({ ...createDto, tenantId });
  }

  async getDataBindings(tenantId: string) {
    return await this.dataBindingService.findAll(tenantId);
  }

  async getDataBinding(id: string, tenantId: string) {
    return await this.dataBindingService.findOne(id, tenantId);
  }

  async updateDataBinding(id: string, updateDto: any, tenantId: string) {
    return await this.dataBindingService.update(id, updateDto, tenantId);
  }

  async deleteDataBinding(id: string, tenantId: string) {
    return await this.dataBindingService.remove(id, tenantId);
  }

  async activateDataBinding(id: string, activateDto: any, tenantId: string) {
    return await this.dataBindingService.activate(id, activateDto, tenantId);
  }

  async deactivateDataBinding(id: string, deactivateDto: any, tenantId: string) {
    return await this.dataBindingService.deactivate(id, deactivateDto, tenantId);
  }

  async getDataBindingStatus(id: string, tenantId: string) {
    return await this.dataBindingService.getBindingStatus(id, tenantId);
  }

  async executeDataBinding(id: string, tenantId: string) {
    return await this.dataBindingService.executeBinding(id, tenantId);
  }

  async getDataBindingMetrics(id: string, tenantId: string, timeRange?: string) {
    return await this.dataBindingService.getBindingMetrics(id, tenantId, timeRange);
  }

  // Health Monitoring methods
  async getSystemHealth(tenantId: string) {
    return await this.healthMonitoringService.getSystemHealth(tenantId);
  }

  async getConnectionHealth(connectionType: string, connectionId: string, tenantId: string) {
    return await this.healthMonitoringService.getConnectionHealth(connectionType, connectionId, tenantId);
  }

  async getPerformanceMetrics(tenantId: string, timeRange?: string) {
    return await this.healthMonitoringService.getPerformanceMetrics(tenantId, timeRange);
  }

  async performHealthCheck(tenantId: string) {
    return await this.healthMonitoringService.performHealthCheck(tenantId);
  }

  // Protocol Manager methods
  async getProtocolOverview(tenantId: string) {
    return await this.protocolManagerService.getProtocolOverview(tenantId);
  }

  async getProtocolStatus(protocolType: string, tenantId: string) {
    return await this.protocolManagerService.getProtocolStatus(protocolType, tenantId);
  }

  async getDataFlowOverview(tenantId: string) {
    return await this.protocolManagerService.getDataFlowOverview(tenantId);
  }

  async getProtocolPerformanceMetrics(tenantId: string, timeRange?: string) {
    return await this.protocolManagerService.getPerformanceMetrics(tenantId, timeRange);
  }
}
