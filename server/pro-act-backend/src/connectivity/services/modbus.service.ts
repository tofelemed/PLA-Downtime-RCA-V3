import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModbusConnection } from '../entities/modbus-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { CreateModbusConnectionDto, UpdateModbusConnectionDto, TestModbusConnectionDto } from '../dto/modbus-connection.dto';

@Injectable()
export class ModbusService {
  constructor(
    @InjectRepository(ModbusConnection)
    private modbusConnectionRepository: Repository<ModbusConnection>,
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
  ) {}

  async create(createDto: CreateModbusConnectionDto): Promise<ModbusConnection> {
    const connection = new ModbusConnection();
    connection.name = createDto.name;
    connection.connectionType = createDto.connectionType;
    connection.ipAddress = createDto.ipAddress || null;
    connection.port = createDto.port || null;
    connection.serialPort = createDto.serialPort || null;
    connection.baudRate = createDto.baudRate || null;
    connection.timeoutMs = createDto.timeoutMs || 5000;
    connection.retryCount = createDto.retryCount || 3;
    connection.unitId = createDto.unitId || 1;
    connection.pollingIntervalMs = createDto.pollingIntervalMs || 1000;
    connection.startAddress = createDto.startAddress || 0;
    connection.registerCount = createDto.registerCount || 10;
    connection.dataType = createDto.dataType || 'uint16';
    connection.byteOrdering = createDto.byteOrdering || 'big-endian';
    connection.scalingFactor = createDto.scalingFactor || 1;
    connection.unit = createDto.unit || null;
    connection.enabled = createDto.enabled !== undefined ? createDto.enabled : true;
    connection.tenantId = createDto.tenantId;
    connection.description = createDto.description || null;
    connection.organizationId = createDto.organizationId || null;
    connection.status = 'disconnected';
    connection.errorCount = 0;

    return await this.modbusConnectionRepository.save(connection);
  }

  async findAll(tenantId: string): Promise<ModbusConnection[]> {
    return await this.modbusConnectionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<ModbusConnection> {
    const connection = await this.modbusConnectionRepository.findOne({
      where: { id, tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`Modbus connection with ID ${id} not found`);
    }

    return connection;
  }

  async update(id: string, updateDto: UpdateModbusConnectionDto, tenantId: string): Promise<ModbusConnection> {
    const connection = await this.findOne(id, tenantId);

    if (updateDto.name !== undefined) connection.name = updateDto.name;
    if (updateDto.ipAddress !== undefined) connection.ipAddress = updateDto.ipAddress;
    if (updateDto.port !== undefined) connection.port = updateDto.port;
    if (updateDto.serialPort !== undefined) connection.serialPort = updateDto.serialPort;
    if (updateDto.baudRate !== undefined) connection.baudRate = updateDto.baudRate;
    if (updateDto.timeoutMs !== undefined) connection.timeoutMs = updateDto.timeoutMs;
    if (updateDto.retryCount !== undefined) connection.retryCount = updateDto.retryCount;
    if (updateDto.unitId !== undefined) connection.unitId = updateDto.unitId;
    if (updateDto.pollingIntervalMs !== undefined) connection.pollingIntervalMs = updateDto.pollingIntervalMs;
    if (updateDto.startAddress !== undefined) connection.startAddress = updateDto.startAddress;
    if (updateDto.registerCount !== undefined) connection.registerCount = updateDto.registerCount;
    if (updateDto.dataType !== undefined) connection.dataType = updateDto.dataType;
    if (updateDto.byteOrdering !== undefined) connection.byteOrdering = updateDto.byteOrdering;
    if (updateDto.scalingFactor !== undefined) connection.scalingFactor = updateDto.scalingFactor;
    if (updateDto.unit !== undefined) connection.unit = updateDto.unit;
    if (updateDto.enabled !== undefined) connection.enabled = updateDto.enabled;
    if (updateDto.description !== undefined) connection.description = updateDto.description;
    if (updateDto.organizationId !== undefined) connection.organizationId = updateDto.organizationId;

    return await this.modbusConnectionRepository.save(connection);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.modbusConnectionRepository.remove(connection);
  }

  async testConnection(id: string, testDto: TestModbusConnectionDto, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate Modbus connection test
      // In a real implementation, you would use a Modbus client library
      const testIpAddress = testDto.ipAddress || connection.ipAddress;
      const testPort = testDto.port || connection.port;
      const testSerialPort = testDto.serialPort || connection.serialPort;
      const testBaudRate = testDto.baudRate || connection.baudRate;
      const testUnitId = testDto.unitId || connection.unitId;

      // Simulate connection test with timeout
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Validate connection parameters
      if (connection.connectionType === 'tcp' && (!testIpAddress || !testPort)) {
        throw new BadRequestException('IP address and port are required for TCP connections');
      }

      if ((connection.connectionType === 'rtu' || connection.connectionType === 'ascii') && 
          (!testSerialPort || !testBaudRate)) {
        throw new BadRequestException('Serial port and baud rate are required for RTU/ASCII connections');
      }

      // Record health status
      await this.recordHealthStatus(connection, 'connected', undefined, {
        connectionType: connection.connectionType,
        ipAddress: testIpAddress,
        port: testPort,
        serialPort: testSerialPort,
        baudRate: testBaudRate,
        unitId: testUnitId,
        testTimestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Modbus connection test successful',
        details: {
          connectionType: connection.connectionType,
          ipAddress: testIpAddress,
          port: testPort,
          serialPort: testSerialPort,
          baudRate: testBaudRate,
          unitId: testUnitId,
          responseTime: Math.floor(Math.random() * 50) + 20, // Simulated response time
          deviceInfo: {
            deviceId: testUnitId,
            protocolVersion: 'Modbus TCP/IP',
            maxRegisters: 125,
            supportedFunctions: [1, 2, 3, 4, 5, 6, 15, 16],
          },
        },
      };
    } catch (error) {
      // Record health status
      await this.recordHealthStatus(connection, 'error', error.message);

      return {
        success: false,
        message: 'Modbus connection test failed',
        error: error.message,
        details: {
          connectionType: connection.connectionType,
          ipAddress: testDto.ipAddress || connection.ipAddress,
          port: testDto.port || connection.port,
          serialPort: testDto.serialPort || connection.serialPort,
          baudRate: testDto.baudRate || connection.baudRate,
          unitId: testDto.unitId || connection.unitId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async readRegisters(id: string, startAddress: number, count: number, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate Modbus register reading
      await new Promise(resolve => setTimeout(resolve, 300));

      const registers = Array.from({ length: count }, (_, index) => ({
        address: startAddress + index,
        value: Math.floor(Math.random() * 65535),
        rawValue: Math.floor(Math.random() * 65535),
        scaledValue: (Math.floor(Math.random() * 65535) * connection.scalingFactor).toFixed(4),
        dataType: connection.dataType,
        unit: connection.unit,
        timestamp: new Date().toISOString(),
      }));

      return {
        success: true,
        connectionId: id,
        startAddress: startAddress,
        count: count,
        registers: registers,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read Modbus registers',
        error: error.message,
        connectionId: id,
        startAddress: startAddress,
        count: count,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async writeRegister(id: string, address: number, value: number, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate Modbus register writing
      await new Promise(resolve => setTimeout(resolve, 200));

      return {
        success: true,
        connectionId: id,
        address: address,
        value: value,
        message: 'Register written successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to write Modbus register',
        error: error.message,
        connectionId: id,
        address: address,
        value: value,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async writeMultipleRegisters(id: string, startAddress: number, values: number[], tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate Modbus multiple register writing
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        connectionId: id,
        startAddress: startAddress,
        count: values.length,
        values: values,
        message: 'Multiple registers written successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to write multiple Modbus registers',
        error: error.message,
        connectionId: id,
        startAddress: startAddress,
        values: values,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async recordHealthStatus(
    connection: ModbusConnection,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'modbus';
    health.modbusConnectionId = connection.id;
    health.status = status;
    health.errorMessage = errorMessage || null;
    health.metrics = metrics;
    health.checkedAt = new Date();

    await this.connectionHealthRepository.save(health);
  }

  async getHealthStatus(id: string, tenantId: string): Promise<ConnectionHealth[]> {
    const connection = await this.findOne(id, tenantId);
    
    return await this.connectionHealthRepository.find({
      where: { modbusConnectionId: connection.id },
      order: { checkedAt: 'DESC' },
      take: 10,
    });
  }
}
