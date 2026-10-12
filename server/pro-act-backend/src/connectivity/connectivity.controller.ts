import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectivityService } from './connectivity.service';
import { CreateOPCUAConnectionDto, UpdateOPCUAConnectionDto, TestOPCUAConnectionDto } from './dto/opcua-connection.dto';
import { CreateModbusConnectionDto, UpdateModbusConnectionDto, TestModbusConnectionDto } from './dto/modbus-connection.dto';
import { CreateEtherNetIPConnectionDto, UpdateEtherNetIPConnectionDto, TestEtherNetIPConnectionDto } from './dto/ethernetip-connection.dto';
import { CreateMQTTConnectionDto, UpdateMQTTConnectionDto, TestMQTTConnectionDto } from './dto/mqtt-connection.dto';
import { CreateSystemIntegrationDto, UpdateSystemIntegrationDto, TestSystemIntegrationDto, SyncSystemIntegrationDto } from './dto/system-integration.dto';
import { CreateDataBindingDto, UpdateDataBindingDto, ActivateDataBindingDto, DeactivateDataBindingDto } from './dto/data-binding.dto';
import { UnifiedEventPullService, UnifiedPullEventsRequest } from './services/unified-event-pull.service';

@ApiTags('Connectivity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connectivity')
export class ConnectivityController {
  constructor(
    private readonly connectivityService: ConnectivityService,
    private readonly unifiedEventPullService: UnifiedEventPullService,
  ) {}

  // ==================== OPC UA Endpoints ====================

  @Get('opcua/connections')
  @ApiOperation({ summary: 'Get all OPC UA connections' })
  @ApiResponse({ status: 200, description: 'OPC UA connections retrieved successfully' })
  async getOPCUAConnections(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getOPCUAConnections(tenantId);
  }

  @Post('opcua/connections')
  @ApiOperation({ summary: 'Create new OPC UA connection' })
  @ApiResponse({ status: 201, description: 'OPC UA connection created successfully' })
  async createOPCUAConnection(@Body() createDto: CreateOPCUAConnectionDto) {
    return await this.connectivityService.createOPCUAConnection(createDto, createDto.tenantId);
  }

  @Get('opcua/connections/:id')
  @ApiOperation({ summary: 'Get OPC UA connection by ID' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'OPC UA connection retrieved successfully' })
  async getOPCUAConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getOPCUAConnection(id, tenantId);
  }

  @Patch('opcua/connections/:id')
  @Put('opcua/connections/:id')
  @ApiOperation({ summary: 'Update OPC UA connection' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'OPC UA connection updated successfully' })
  async updateOPCUAConnection(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateOPCUAConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.updateOPCUAConnection(id, updateDto, tenantId);
  }

  @Delete('opcua/connections/:id')
  @ApiOperation({ summary: 'Delete OPC UA connection' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'OPC UA connection deleted successfully' })
  async deleteOPCUAConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.deleteOPCUAConnection(id, tenantId);
  }

  @Post('opcua/connections/:id/test')
  @ApiOperation({ summary: 'Test OPC UA connection' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'OPC UA connection test completed' })
  async testOPCUAConnection(@Param('id', ParseUUIDPipe) id: string, @Body() testDto: TestOPCUAConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.testOPCUAConnection(id, testDto, tenantId);
  }

  @Get('opcua/connections/:id/browse')
  @ApiOperation({ summary: 'Browse OPC UA address space' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiQuery({ name: 'nodeId', required: false, description: 'Starting node ID' })
  @ApiResponse({ status: 200, description: 'OPC UA address space browsed successfully' })
  async browseOPCUAAddressSpace(@Param('id', ParseUUIDPipe) id: string, @Query('nodeId') nodeId: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.browseOPCUAAddressSpace(id, nodeId, tenantId);
  }

  @Post('opcua/connections/:id/read')
  @ApiOperation({ summary: 'Read OPC UA node values' })
  @ApiParam({ name: 'id', description: 'OPC UA connection ID' })
  @ApiResponse({ status: 200, description: 'OPC UA node values read successfully' })
  async readOPCUANodeValues(@Param('id', ParseUUIDPipe) id: string, @Body() body: { nodeIds: string[] }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.readOPCUANodeValues(id, body.nodeIds, tenantId);
  }

  // ==================== Modbus Endpoints ====================

  @Get('modbus/connections')
  @ApiOperation({ summary: 'Get all Modbus connections' })
  @ApiResponse({ status: 200, description: 'Modbus connections retrieved successfully' })
  async getModbusConnections(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getModbusConnections(tenantId);
  }

  @Post('modbus/connections')
  @ApiOperation({ summary: 'Create new Modbus connection' })
  @ApiResponse({ status: 201, description: 'Modbus connection created successfully' })
  async createModbusConnection(@Body() createDto: CreateModbusConnectionDto) {
    return await this.connectivityService.createModbusConnection(createDto, createDto.tenantId);
  }

  @Get('modbus/connections/:id')
  @ApiOperation({ summary: 'Get Modbus connection by ID' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Modbus connection retrieved successfully' })
  async getModbusConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getModbusConnection(id, tenantId);
  }

  @Patch('modbus/connections/:id')
  @Put('modbus/connections/:id')
  @ApiOperation({ summary: 'Update Modbus connection' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Modbus connection updated successfully' })
  async updateModbusConnection(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateModbusConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.updateModbusConnection(id, updateDto, tenantId);
  }

  @Delete('modbus/connections/:id')
  @ApiOperation({ summary: 'Delete Modbus connection' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Modbus connection deleted successfully' })
  async deleteModbusConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.deleteModbusConnection(id, tenantId);
  }

  @Post('modbus/connections/:id/test')
  @ApiOperation({ summary: 'Test Modbus connection' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Modbus connection test completed' })
  async testModbusConnection(@Param('id', ParseUUIDPipe) id: string, @Body() testDto: TestModbusConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.testModbusConnection(id, testDto, tenantId);
  }

  @Get('modbus/connections/:id/registers')
  @ApiOperation({ summary: 'Read Modbus registers' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiQuery({ name: 'startAddress', description: 'Start address' })
  @ApiQuery({ name: 'count', description: 'Number of registers to read' })
  @ApiResponse({ status: 200, description: 'Modbus registers read successfully' })
  async readModbusRegisters(@Param('id', ParseUUIDPipe) id: string, @Query('startAddress') startAddress: number, @Query('count') count: number, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.readModbusRegisters(id, startAddress, count, tenantId);
  }

  @Post('modbus/connections/:id/registers')
  @ApiOperation({ summary: 'Write Modbus register' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Modbus register written successfully' })
  async writeModbusRegister(@Param('id', ParseUUIDPipe) id: string, @Body() body: { address: number; value: number }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.writeModbusRegister(id, body.address, body.value, tenantId);
  }

  @Post('modbus/connections/:id/registers/multiple')
  @ApiOperation({ summary: 'Write multiple Modbus registers' })
  @ApiParam({ name: 'id', description: 'Modbus connection ID' })
  @ApiResponse({ status: 200, description: 'Multiple Modbus registers written successfully' })
  async writeModbusMultipleRegisters(@Param('id', ParseUUIDPipe) id: string, @Body() body: { startAddress: number; values: number[] }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.writeModbusMultipleRegisters(id, body.startAddress, body.values, tenantId);
  }

  // ==================== EtherNet/IP Endpoints ====================

  @Get('ethernetip/connections')
  @ApiOperation({ summary: 'Get all EtherNet/IP connections' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP connections retrieved successfully' })
  async getEtherNetIPConnections(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getEtherNetIPConnections(tenantId);
  }

  @Post('ethernetip/connections')
  @ApiOperation({ summary: 'Create new EtherNet/IP connection' })
  @ApiResponse({ status: 201, description: 'EtherNet/IP connection created successfully' })
  async createEtherNetIPConnection(@Body() createDto: CreateEtherNetIPConnectionDto) {
    return await this.connectivityService.createEtherNetIPConnection(createDto, createDto.tenantId);
  }

  @Get('ethernetip/connections/:id')
  @ApiOperation({ summary: 'Get EtherNet/IP connection by ID' })
  @ApiParam({ name: 'id', description: 'EtherNet/IP connection ID' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP connection retrieved successfully' })
  async getEtherNetIPConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getEtherNetIPConnection(id, tenantId);
  }

  @Patch('ethernetip/connections/:id')
  @Put('ethernetip/connections/:id')
  @ApiOperation({ summary: 'Update EtherNet/IP connection' })
  @ApiParam({ name: 'id', description: 'EtherNet/IP connection ID' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP connection updated successfully' })
  async updateEtherNetIPConnection(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateEtherNetIPConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.updateEtherNetIPConnection(id, updateDto, tenantId);
  }

  @Delete('ethernetip/connections/:id')
  @ApiOperation({ summary: 'Delete EtherNet/IP connection' })
  @ApiParam({ name: 'id', description: 'EtherNet/IP connection ID' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP connection deleted successfully' })
  async deleteEtherNetIPConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.deleteEtherNetIPConnection(id, tenantId);
  }

  @Post('ethernetip/connections/:id/test')
  @ApiOperation({ summary: 'Test EtherNet/IP connection' })
  @ApiParam({ name: 'id', description: 'EtherNet/IP connection ID' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP connection test completed' })
  async testEtherNetIPConnection(@Param('id', ParseUUIDPipe) id: string, @Body() testDto: TestEtherNetIPConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.testEtherNetIPConnection(id, testDto, tenantId);
  }

  @Post('ethernetip/connections/:id/tags/read')
  @ApiOperation({ summary: 'Read EtherNet/IP tags' })
  @ApiParam({ name: 'id', description: 'EtherNet/IP connection ID' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP tags read successfully' })
  async readEtherNetIPTags(@Param('id', ParseUUIDPipe) id: string, @Body() body: { tagPaths: string[] }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.readEtherNetIPTags(id, body.tagPaths, tenantId);
  }

  @Post('ethernetip/connections/:id/tags/write')
  @ApiOperation({ summary: 'Write EtherNet/IP tag' })
  @ApiParam({ name: 'id', description: 'EtherNet/IP connection ID' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP tag written successfully' })
  async writeEtherNetIPTag(@Param('id', ParseUUIDPipe) id: string, @Body() body: { tagPath: string; value: any; dataType: string }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.writeEtherNetIPTag(id, body.tagPath, body.value, body.dataType, tenantId);
  }

  @Get('ethernetip/connections/:id/tags/browse')
  @ApiOperation({ summary: 'Browse EtherNet/IP tags' })
  @ApiParam({ name: 'id', description: 'EtherNet/IP connection ID' })
  @ApiResponse({ status: 200, description: 'EtherNet/IP tags browsed successfully' })
  async browseEtherNetIPTags(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.browseEtherNetIPTags(id, tenantId);
  }

  // ==================== MQTT Endpoints ====================

  @Get('mqtt/connections')
  @ApiOperation({ summary: 'Get all MQTT connections' })
  @ApiResponse({ status: 200, description: 'MQTT connections retrieved successfully' })
  async getMQTTConnections(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getMQTTConnections(tenantId);
  }

  @Post('mqtt/connections')
  @ApiOperation({ summary: 'Create new MQTT connection' })
  @ApiResponse({ status: 201, description: 'MQTT connection created successfully' })
  async createMQTTConnection(@Body() createDto: CreateMQTTConnectionDto) {
    return await this.connectivityService.createMQTTConnection(createDto, createDto.tenantId);
  }

  @Get('mqtt/connections/:id')
  @ApiOperation({ summary: 'Get MQTT connection by ID' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT connection retrieved successfully' })
  async getMQTTConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getMQTTConnection(id, tenantId);
  }

  @Patch('mqtt/connections/:id')
  @Put('mqtt/connections/:id')
  @ApiOperation({ summary: 'Update MQTT connection' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT connection updated successfully' })
  async updateMQTTConnection(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateMQTTConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.updateMQTTConnection(id, updateDto, tenantId);
  }

  @Delete('mqtt/connections/:id')
  @ApiOperation({ summary: 'Delete MQTT connection' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT connection deleted successfully' })
  async deleteMQTTConnection(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.deleteMQTTConnection(id, tenantId);
  }

  @Post('mqtt/connections/:id/test')
  @ApiOperation({ summary: 'Test MQTT connection' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT connection test completed' })
  async testMQTTConnection(@Param('id', ParseUUIDPipe) id: string, @Body() testDto: TestMQTTConnectionDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.testMQTTConnection(id, testDto, tenantId);
  }

  @Post('mqtt/connections/:id/publish')
  @ApiOperation({ summary: 'Publish MQTT message' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT message published successfully' })
  async publishMQTTMessage(@Param('id', ParseUUIDPipe) id: string, @Body() body: { topic: string; message: string; qos?: number; retain?: boolean }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.publishMQTTMessage(id, body.topic, body.message, body.qos || 1, body.retain || false, tenantId);
  }

  @Post('mqtt/connections/:id/subscribe')
  @ApiOperation({ summary: 'Subscribe to MQTT topics' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT topics subscribed successfully' })
  async subscribeToMQTTTopics(@Param('id', ParseUUIDPipe) id: string, @Body() body: { topics: string[]; qos?: number[] }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.subscribeToMQTTTopics(id, body.topics, body.qos || [], tenantId);
  }

  @Post('mqtt/connections/:id/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from MQTT topics' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT topics unsubscribed successfully' })
  async unsubscribeFromMQTTTopics(@Param('id', ParseUUIDPipe) id: string, @Body() body: { topics: string[] }, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.unsubscribeFromMQTTTopics(id, body.topics, tenantId);
  }

  @Get('mqtt/connections/:id/info')
  @ApiOperation({ summary: 'Get MQTT broker information' })
  @ApiParam({ name: 'id', description: 'MQTT connection ID' })
  @ApiResponse({ status: 200, description: 'MQTT broker information retrieved successfully' })
  async getMQTTBrokerInfo(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getMQTTBrokerInfo(id, tenantId);
  }

  // ==================== System Integration Endpoints ====================

  @Get('integrations')
  @ApiOperation({ summary: 'Get all system integrations' })
  @ApiResponse({ status: 200, description: 'System integrations retrieved successfully' })
  async getSystemIntegrations(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getSystemIntegrations(tenantId);
  }

  @Post('integrations')
  @ApiOperation({ summary: 'Create new system integration' })
  @ApiResponse({ status: 201, description: 'System integration created successfully' })
  async createSystemIntegration(@Body() createDto: CreateSystemIntegrationDto) {
    return await this.connectivityService.createSystemIntegration(createDto, createDto.tenantId);
  }

  @Get('integrations/pi')
  @ApiOperation({ summary: 'Get PI connections' })
  @ApiResponse({ status: 200, description: 'PI connections retrieved successfully' })
  async getPIConnections(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getPIConnections(tenantId);
  }

  @Get('integrations/cmms')
  @ApiOperation({ summary: 'Get CMMS connections' })
  @ApiResponse({ status: 200, description: 'CMMS connections retrieved successfully' })
  async getCMMSConnections(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getCMMSConnections(tenantId);
  }

  @Get('integrations/:id')
  @ApiOperation({ summary: 'Get system integration by ID' })
  @ApiParam({ name: 'id', description: 'System integration ID' })
  @ApiResponse({ status: 200, description: 'System integration retrieved successfully' })
  async getSystemIntegration(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getSystemIntegration(id, tenantId);
  }

  @Put('integrations/:id')
  @ApiOperation({ summary: 'Update system integration' })
  @ApiParam({ name: 'id', description: 'System integration ID' })
  @ApiResponse({ status: 200, description: 'System integration updated successfully' })
  async updateSystemIntegration(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateSystemIntegrationDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.updateSystemIntegration(id, updateDto, tenantId);
  }

  @Delete('integrations/:id')
  @ApiOperation({ summary: 'Delete system integration' })
  @ApiParam({ name: 'id', description: 'System integration ID' })
  @ApiResponse({ status: 200, description: 'System integration deleted successfully' })
  async deleteSystemIntegration(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.deleteSystemIntegration(id, tenantId);
  }

  @Post('integrations/:id/test')
  @ApiOperation({ summary: 'Test system integration' })
  @ApiParam({ name: 'id', description: 'System integration ID' })
  @ApiResponse({ status: 200, description: 'System integration test completed' })
  async testSystemIntegration(@Param('id', ParseUUIDPipe) id: string, @Body() testDto: TestSystemIntegrationDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.testSystemIntegration(id, testDto, tenantId);
  }

  @Post('integrations/:id/sync')
  @ApiOperation({ summary: 'Sync system integration data' })
  @ApiParam({ name: 'id', description: 'System integration ID' })
  @ApiResponse({ status: 200, description: 'System integration sync completed' })
  async syncSystemIntegration(@Param('id', ParseUUIDPipe) id: string, @Body() syncDto: SyncSystemIntegrationDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.syncSystemIntegration(id, syncDto, tenantId);
  }

  @Get('integrations/:id/status')
  @ApiOperation({ summary: 'Get system integration status' })
  @ApiParam({ name: 'id', description: 'System integration ID' })
  @ApiResponse({ status: 200, description: 'System integration status retrieved successfully' })
  async getSystemIntegrationStatus(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getSystemIntegrationStatus(id, tenantId);
  }

  // ==================== Data Binding Endpoints ====================

  @Get('bindings')
  @ApiOperation({ summary: 'Get all data bindings' })
  @ApiResponse({ status: 200, description: 'Data bindings retrieved successfully' })
  async getDataBindings(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getDataBindings(tenantId);
  }

  @Post('bindings')
  @ApiOperation({ summary: 'Create new data binding' })
  @ApiResponse({ status: 201, description: 'Data binding created successfully' })
  async createDataBinding(@Body() createDto: CreateDataBindingDto) {
    return await this.connectivityService.createDataBinding(createDto, createDto.tenantId);
  }

  @Get('bindings/:id')
  @ApiOperation({ summary: 'Get data binding by ID' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiResponse({ status: 200, description: 'Data binding retrieved successfully' })
  async getDataBinding(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getDataBinding(id, tenantId);
  }

  @Put('bindings/:id')
  @ApiOperation({ summary: 'Update data binding' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiResponse({ status: 200, description: 'Data binding updated successfully' })
  async updateDataBinding(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateDataBindingDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.updateDataBinding(id, updateDto, tenantId);
  }

  @Delete('bindings/:id')
  @ApiOperation({ summary: 'Delete data binding' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiResponse({ status: 200, description: 'Data binding deleted successfully' })
  async deleteDataBinding(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.deleteDataBinding(id, tenantId);
  }

  @Post('bindings/:id/activate')
  @ApiOperation({ summary: 'Activate data binding' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiResponse({ status: 200, description: 'Data binding activated successfully' })
  async activateDataBinding(@Param('id', ParseUUIDPipe) id: string, @Body() activateDto: ActivateDataBindingDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.activateDataBinding(id, activateDto, tenantId);
  }

  @Post('bindings/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate data binding' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiResponse({ status: 200, description: 'Data binding deactivated successfully' })
  async deactivateDataBinding(@Param('id', ParseUUIDPipe) id: string, @Body() deactivateDto: DeactivateDataBindingDto, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.deactivateDataBinding(id, deactivateDto, tenantId);
  }

  @Get('bindings/:id/status')
  @ApiOperation({ summary: 'Get data binding status' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiResponse({ status: 200, description: 'Data binding status retrieved successfully' })
  async getDataBindingStatus(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getDataBindingStatus(id, tenantId);
  }

  @Post('bindings/:id/execute')
  @ApiOperation({ summary: 'Execute data binding' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiResponse({ status: 200, description: 'Data binding executed successfully' })
  async executeDataBinding(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.executeDataBinding(id, tenantId);
  }

  @Get('bindings/:id/metrics')
  @ApiOperation({ summary: 'Get data binding metrics' })
  @ApiParam({ name: 'id', description: 'Data binding ID' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for metrics' })
  @ApiResponse({ status: 200, description: 'Data binding metrics retrieved successfully' })
  async getDataBindingMetrics(@Param('id', ParseUUIDPipe) id: string, @Query('timeRange') timeRange: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getDataBindingMetrics(id, tenantId, timeRange);
  }

  // ==================== Health Monitoring Endpoints ====================

  @Get('health')
  @ApiOperation({ summary: 'Get system health overview' })
  @ApiResponse({ status: 200, description: 'System health retrieved successfully' })
  async getSystemHealth(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getSystemHealth(tenantId);
  }

  @Get('health/connections/:type/:id')
  @ApiOperation({ summary: 'Get connection health status' })
  @ApiParam({ name: 'type', description: 'Connection type' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'Connection health retrieved successfully' })
  async getConnectionHealth(@Param('type') type: string, @Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getConnectionHealth(type, id, tenantId);
  }

  @Get('health/performance')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  async getPerformanceMetrics(@Query('timeRange') timeRange: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getPerformanceMetrics(tenantId, timeRange);
  }

  @Post('health/check')
  @ApiOperation({ summary: 'Perform health check on all connections' })
  @ApiResponse({ status: 200, description: 'Health check completed successfully' })
  async performHealthCheck(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.performHealthCheck(tenantId);
  }

  // ==================== Protocol Manager Endpoints ====================

  @Get('overview')
  @ApiOperation({ summary: 'Get protocol overview' })
  @ApiResponse({ status: 200, description: 'Protocol overview retrieved successfully' })
  async getProtocolOverview(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getProtocolOverview(tenantId);
  }

  @Get('protocols/:type/status')
  @ApiOperation({ summary: 'Get protocol status' })
  @ApiParam({ name: 'type', description: 'Protocol type' })
  @ApiResponse({ status: 200, description: 'Protocol status retrieved successfully' })
  async getProtocolStatus(@Param('type') type: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getProtocolStatus(type, tenantId);
  }

  @Get('dataflow/overview')
  @ApiOperation({ summary: 'Get data flow overview' })
  @ApiResponse({ status: 200, description: 'Data flow overview retrieved successfully' })
  async getDataFlowOverview(@Query('tenantId') tenantId: string) {
    return await this.connectivityService.getDataFlowOverview(tenantId);
  }

  @Get('performance/metrics')
  @ApiOperation({ summary: 'Get protocol performance metrics' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for metrics' })
  @ApiResponse({ status: 200, description: 'Protocol performance metrics retrieved successfully' })
  async getProtocolPerformanceMetrics(@Query('timeRange') timeRange: string, @Query('tenantId') tenantId: string) {
    return await this.connectivityService.getProtocolPerformanceMetrics(tenantId, timeRange);
  }

  // ==================== Event Pulling Endpoints ====================

  @Post('events/pull')
  @ApiOperation({ summary: 'Pull events from any configured source (PI, OPC UA, Modbus, MQTT, etc.)' })
  @ApiResponse({ status: 200, description: 'Events pulled successfully' })
  async pullEvents(@Body() request: UnifiedPullEventsRequest) {
    return await this.unifiedEventPullService.pullEvents(request);
  }

  @Get('events/sources')
  @ApiOperation({ summary: 'Get all available event sources for pulling' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiResponse({ status: 200, description: 'Available sources retrieved successfully' })
  async getAvailableEventSources(@Query('tenantId') tenantId: string) {
    return await this.unifiedEventPullService.getAvailableSources(tenantId);
  }
}
