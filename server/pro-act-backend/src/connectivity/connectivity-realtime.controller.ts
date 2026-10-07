import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectivityService } from './connectivity.service';
import { OPCUAClientService } from './services/opcua-client.service';
import { ModbusClientService } from './services/modbus-client.service';
import { MQTTClientService } from './services/mqtt-client.service';
import { CreateOPCUAConnectionDto, UpdateOPCUAConnectionDto } from './dto/opcua-connection.dto';
import { CreateModbusConnectionDto, UpdateModbusConnectionDto } from './dto/modbus-connection.dto';
import { CreateMQTTConnectionDto, UpdateMQTTConnectionDto } from './dto/mqtt-connection.dto';

@ApiTags('Connectivity Real-time')
@ApiBearerAuth()
@Controller('connectivity')
export class ConnectivityRealtimeController {
  constructor(
    private readonly connectivityService: ConnectivityService,
    private readonly opcuaClientService: OPCUAClientService,
    private readonly modbusClientService: ModbusClientService,
    private readonly mqttClientService: MQTTClientService,
  ) {}

  // ==================== OPC UA Real-time Endpoints ====================

  @Post('opcua/connections/:id/connect')
  @ApiOperation({ summary: 'Connect to OPC UA server' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'Connected to OPC UA server successfully' })
  async connectOPCUA(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const result = await this.opcuaClientService.connect(id);
    return {
      success: result,
      message: result ? 'Connected to OPC UA server' : 'Failed to connect to OPC UA server',
      connectionId: id
    };
  }

  @Post('opcua/connections/:id/disconnect')
  @ApiOperation({ summary: 'Disconnect from OPC UA server' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'Disconnected from OPC UA server successfully' })
  async disconnectOPCUA(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const result = await this.opcuaClientService.disconnect(id);
    return {
      success: result,
      message: result ? 'Disconnected from OPC UA server' : 'Failed to disconnect from OPC UA server',
      connectionId: id
    };
  }

  @Post('opcua/connections/:id/read')
  @ApiOperation({ summary: 'Read data points from OPC UA server' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'Data points read successfully' })
  async readOPCUAData(
    @Param('id') id: string,
    @Body() body: { nodeIds?: string[] },
    @Query('tenantId') tenantId: string
  ) {
    const dataPoints = await this.opcuaClientService.readDataPoints(id, body.nodeIds);
    return {
      success: true,
      data: dataPoints,
      connectionId: id,
      timestamp: new Date().toISOString()
    };
  }

  @Post('opcua/connections/:id/write')
  @ApiOperation({ summary: 'Write data point to OPC UA server' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'Data point written successfully' })
  async writeOPCUAData(
    @Param('id') id: string,
    @Body() body: { nodeId: string; value: any; dataType?: string },
    @Query('tenantId') tenantId: string
  ) {
    const result = await this.opcuaClientService.writeDataPoint(id, body.nodeId, body.value, body.dataType);
    return {
      success: result,
      message: result ? 'Data point written successfully' : 'Failed to write data point',
      connectionId: id,
      nodeId: body.nodeId,
      value: body.value
    };
  }

  @Post('opcua/connections/:id/subscribe')
  @ApiOperation({ summary: 'Subscribe to OPC UA nodes for real-time updates' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'Subscribed to nodes successfully' })
  async subscribeOPCUANodes(
    @Param('id') id: string,
    @Body() body: { nodeIds: string[] },
    @Query('tenantId') tenantId: string
  ) {
    const result = await this.opcuaClientService.subscribeToNodes(id, body.nodeIds);
    return {
      success: result,
      message: result ? 'Subscribed to nodes successfully' : 'Failed to subscribe to nodes',
      connectionId: id,
      nodeIds: body.nodeIds
    };
  }

  @Get('opcua/connections/:id/status')
  @ApiOperation({ summary: 'Get OPC UA connection status' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved successfully' })
  async getOPCUAStatus(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const isActive = this.opcuaClientService.isConnectionActive(id);
    const sessions = this.opcuaClientService.getActiveSessions();
    const session = sessions.find(s => s.connectionId === id);
    
    return {
      connectionId: id,
      isConnected: isActive,
      lastActivity: session?.lastActivity,
      protocol: 'opcua'
    };
  }

  // ==================== Modbus Real-time Endpoints ====================

  @Post('modbus/connections/:id/connect')
  @ApiOperation({ summary: 'Connect to Modbus device' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Connected to Modbus device successfully' })
  async connectModbus(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const result = await this.modbusClientService.connect(id);
    return {
      success: result,
      message: result ? 'Connected to Modbus device' : 'Failed to connect to Modbus device',
      connectionId: id
    };
  }

  @Post('modbus/connections/:id/disconnect')
  @ApiOperation({ summary: 'Disconnect from Modbus device' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Disconnected from Modbus device successfully' })
  async disconnectModbus(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const result = await this.modbusClientService.disconnect(id);
    return {
      success: result,
      message: result ? 'Disconnected from Modbus device' : 'Failed to disconnect from Modbus device',
      connectionId: id
    };
  }

  @Post('modbus/connections/:id/read-holding')
  @ApiOperation({ summary: 'Read holding registers from Modbus device' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Holding registers read successfully' })
  async readModbusHoldingRegisters(
    @Param('id') id: string,
    @Body() body: { startAddress: number; count: number },
    @Query('tenantId') tenantId: string
  ) {
    const dataPoints = await this.modbusClientService.readHoldingRegisters(id, body.startAddress, body.count);
    return {
      success: true,
      data: dataPoints,
      connectionId: id,
      timestamp: new Date().toISOString()
    };
  }

  @Post('modbus/connections/:id/read-input')
  @ApiOperation({ summary: 'Read input registers from Modbus device' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Input registers read successfully' })
  async readModbusInputRegisters(
    @Param('id') id: string,
    @Body() body: { startAddress: number; count: number },
    @Query('tenantId') tenantId: string
  ) {
    const dataPoints = await this.modbusClientService.readInputRegisters(id, body.startAddress, body.count);
    return {
      success: true,
      data: dataPoints,
      connectionId: id,
      timestamp: new Date().toISOString()
    };
  }

  @Post('modbus/connections/:id/read-coils')
  @ApiOperation({ summary: 'Read coils from Modbus device' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Coils read successfully' })
  async readModbusCoils(
    @Param('id') id: string,
    @Body() body: { startAddress: number; count: number },
    @Query('tenantId') tenantId: string
  ) {
    const dataPoints = await this.modbusClientService.readCoils(id, body.startAddress, body.count);
    return {
      success: true,
      data: dataPoints,
      connectionId: id,
      timestamp: new Date().toISOString()
    };
  }

  @Post('modbus/connections/:id/write-register')
  @ApiOperation({ summary: 'Write single register to Modbus device' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Register written successfully' })
  async writeModbusRegister(
    @Param('id') id: string,
    @Body() body: { address: number; value: number },
    @Query('tenantId') tenantId: string
  ) {
    const result = await this.modbusClientService.writeSingleRegister(id, body.address, body.value);
    return {
      success: result,
      message: result ? 'Register written successfully' : 'Failed to write register',
      connectionId: id,
      address: body.address,
      value: body.value
    };
  }

  @Post('modbus/connections/:id/write-coil')
  @ApiOperation({ summary: 'Write single coil to Modbus device' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Coil written successfully' })
  async writeModbusCoil(
    @Param('id') id: string,
    @Body() body: { address: number; value: boolean },
    @Query('tenantId') tenantId: string
  ) {
    const result = await this.modbusClientService.writeSingleCoil(id, body.address, body.value);
    return {
      success: result,
      message: result ? 'Coil written successfully' : 'Failed to write coil',
      connectionId: id,
      address: body.address,
      value: body.value
    };
  }

  @Get('modbus/connections/:id/status')
  @ApiOperation({ summary: 'Get Modbus connection status' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved successfully' })
  async getModbusStatus(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const isActive = this.modbusClientService.isConnectionActive(id);
    const sessions = this.modbusClientService.getActiveSessions();
    const session = sessions.find(s => s.connectionId === id);
    
    return {
      connectionId: id,
      isConnected: isActive,
      lastActivity: session?.lastActivity,
      protocol: 'modbus'
    };
  }

  // ==================== MQTT Real-time Endpoints ====================

  @Post('mqtt/connections/:id/connect')
  @ApiOperation({ summary: 'Connect to MQTT broker' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'Connected to MQTT broker successfully' })
  async connectMQTT(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const result = await this.mqttClientService.connect(id);
    return {
      success: result,
      message: result ? 'Connected to MQTT broker' : 'Failed to connect to MQTT broker',
      connectionId: id
    };
  }

  @Post('mqtt/connections/:id/disconnect')
  @ApiOperation({ summary: 'Disconnect from MQTT broker' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'Disconnected from MQTT broker successfully' })
  async disconnectMQTT(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const result = await this.mqttClientService.disconnect(id);
    return {
      success: result,
      message: result ? 'Disconnected from MQTT broker' : 'Failed to disconnect from MQTT broker',
      connectionId: id
    };
  }

  @Post('mqtt/connections/:id/subscribe')
  @ApiOperation({ summary: 'Subscribe to MQTT topics' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'Subscribed to topics successfully' })
  async subscribeMQTTTopics(
    @Param('id') id: string,
    @Body() body: { topics: string[] },
    @Query('tenantId') tenantId: string
  ) {
    const result = await this.mqttClientService.subscribeToTopics(id, body.topics);
    return {
      success: result,
      message: result ? 'Subscribed to topics successfully' : 'Failed to subscribe to topics',
      connectionId: id,
      topics: body.topics
    };
  }

  @Post('mqtt/connections/:id/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from MQTT topics' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'Unsubscribed from topics successfully' })
  async unsubscribeMQTTTopics(
    @Param('id') id: string,
    @Body() body: { topics: string[] },
    @Query('tenantId') tenantId: string
  ) {
    const result = await this.mqttClientService.unsubscribeFromTopics(id, body.topics);
    return {
      success: result,
      message: result ? 'Unsubscribed from topics successfully' : 'Failed to unsubscribe from topics',
      connectionId: id,
      topics: body.topics
    };
  }

  @Post('mqtt/connections/:id/publish')
  @ApiOperation({ summary: 'Publish message to MQTT topic' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'Message published successfully' })
  async publishMQTTMessage(
    @Param('id') id: string,
    @Body() body: { topic: string; message: string; qos?: number; retain?: boolean },
    @Query('tenantId') tenantId: string
  ) {
    const result = await this.mqttClientService.publishMessage(
      id, 
      body.topic, 
      body.message, 
      { qos: body.qos, retain: body.retain }
    );
    return {
      success: result,
      message: result ? 'Message published successfully' : 'Failed to publish message',
      connectionId: id,
      topic: body.topic,
      publishedMessage: body.message
    };
  }

  @Get('mqtt/connections/:id/status')
  @ApiOperation({ summary: 'Get MQTT connection status' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved successfully' })
  async getMQTTStatus(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const isActive = this.mqttClientService.isConnectionActive(id);
    const sessions = this.mqttClientService.getActiveSessions();
    const session = sessions.find(s => s.connectionId === id);
    const subscribedTopics = this.mqttClientService.getSubscribedTopics(id);
    
    return {
      connectionId: id,
      isConnected: isActive,
      lastActivity: session?.lastActivity,
      subscribedTopics,
      protocol: 'mqtt'
    };
  }

  // ==================== System Status Endpoints ====================

  @Get('status/all')
  @ApiOperation({ summary: 'Get status of all active connections' })
  @ApiResponse({ status: 200, description: 'All connection statuses retrieved successfully' })
  async getAllConnectionStatus(@Query('tenantId') tenantId: string) {
    const opcuaSessions = this.opcuaClientService.getActiveSessions();
    const modbusSessions = this.modbusClientService.getActiveSessions();
    const mqttSessions = this.mqttClientService.getActiveSessions();

    return {
      opcua: opcuaSessions,
      modbus: modbusSessions,
      mqtt: mqttSessions,
      totalConnections: opcuaSessions.length + modbusSessions.length + mqttSessions.length,
      timestamp: new Date().toISOString()
    };
  }

  @Get('status/active')
  @ApiOperation({ summary: 'Get count of active connections' })
  @ApiResponse({ status: 200, description: 'Active connection count retrieved successfully' })
  async getActiveConnectionCount(@Query('tenantId') tenantId: string) {
    const opcuaSessions = this.opcuaClientService.getActiveSessions();
    const modbusSessions = this.modbusClientService.getActiveSessions();
    const mqttSessions = this.mqttClientService.getActiveSessions();

    const activeCount = [
      ...opcuaSessions,
      ...modbusSessions,
      ...mqttSessions
    ].filter(session => session.isConnected).length;

    return {
      activeConnections: activeCount,
      totalConnections: opcuaSessions.length + modbusSessions.length + mqttSessions.length,
      protocols: {
        opcua: opcuaSessions.filter(s => s.isConnected).length,
        modbus: modbusSessions.filter(s => s.isConnected).length,
        mqtt: mqttSessions.filter(s => s.isConnected).length
      },
      timestamp: new Date().toISOString()
    };
  }
}
