import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EtherNetIPConnection } from '../entities/ethernetip-connection.entity';
import { ConnectionHealth } from '../entities/connection-health.entity';
import { CreateEtherNetIPConnectionDto, UpdateEtherNetIPConnectionDto, TestEtherNetIPConnectionDto } from '../dto/ethernetip-connection.dto';

@Injectable()
export class EtherNetIPService {
  constructor(
    @InjectRepository(EtherNetIPConnection)
    private ethernetipConnectionRepository: Repository<EtherNetIPConnection>,
    @InjectRepository(ConnectionHealth)
    private connectionHealthRepository: Repository<ConnectionHealth>,
  ) {}

  async create(createDto: CreateEtherNetIPConnectionDto): Promise<EtherNetIPConnection> {
    const connection = new EtherNetIPConnection();
    connection.name = createDto.name;
    connection.ipAddress = createDto.ipAddress;
    connection.port = createDto.port || 44818;
    connection.timeoutMs = createDto.timeoutMs || 10000;
    connection.backplaneSlot = createDto.backplaneSlot || 0;
    connection.vendorId = createDto.vendorId || 1;
    connection.productCode = createDto.productCode || 0;
    connection.pollingIntervalMs = createDto.pollingIntervalMs || 100;
    connection.tagPaths = createDto.tagPaths || null;
    connection.dataTypes = createDto.dataTypes || null;
    connection.arraySizes = createDto.arraySizes || null;
    connection.enabled = createDto.enabled !== undefined ? createDto.enabled : true;
    connection.tenantId = createDto.tenantId;
    connection.description = createDto.description || null;
    connection.retryCount = createDto.retryCount || 3;
    connection.cipSecurity = createDto.cipSecurity || false;
    connection.organizationId = createDto.organizationId || null;
    connection.status = 'disconnected';
    connection.errorCount = 0;

    return await this.ethernetipConnectionRepository.save(connection);
  }

  async findAll(tenantId: string): Promise<EtherNetIPConnection[]> {
    return await this.ethernetipConnectionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<EtherNetIPConnection> {
    const connection = await this.ethernetipConnectionRepository.findOne({
      where: { id, tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`EtherNet/IP connection with ID ${id} not found`);
    }

    return connection;
  }

  async update(id: string, updateDto: UpdateEtherNetIPConnectionDto, tenantId: string): Promise<EtherNetIPConnection> {
    const connection = await this.findOne(id, tenantId);

    if (updateDto.name !== undefined) connection.name = updateDto.name;
    if (updateDto.ipAddress !== undefined) connection.ipAddress = updateDto.ipAddress;
    if (updateDto.port !== undefined) connection.port = updateDto.port;
    if (updateDto.timeoutMs !== undefined) connection.timeoutMs = updateDto.timeoutMs;
    if (updateDto.backplaneSlot !== undefined) connection.backplaneSlot = updateDto.backplaneSlot;
    if (updateDto.vendorId !== undefined) connection.vendorId = updateDto.vendorId;
    if (updateDto.productCode !== undefined) connection.productCode = updateDto.productCode;
    if (updateDto.pollingIntervalMs !== undefined) connection.pollingIntervalMs = updateDto.pollingIntervalMs;
    if (updateDto.tagPaths !== undefined) connection.tagPaths = updateDto.tagPaths;
    if (updateDto.dataTypes !== undefined) connection.dataTypes = updateDto.dataTypes;
    if (updateDto.arraySizes !== undefined) connection.arraySizes = updateDto.arraySizes;
    if (updateDto.enabled !== undefined) connection.enabled = updateDto.enabled;
    if (updateDto.description !== undefined) connection.description = updateDto.description;
    if (updateDto.retryCount !== undefined) connection.retryCount = updateDto.retryCount;
    if (updateDto.cipSecurity !== undefined) connection.cipSecurity = updateDto.cipSecurity;
    if (updateDto.organizationId !== undefined) connection.organizationId = updateDto.organizationId;

    return await this.ethernetipConnectionRepository.save(connection);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.ethernetipConnectionRepository.remove(connection);
  }

  async testConnection(id: string, testDto: TestEtherNetIPConnectionDto, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate EtherNet/IP connection test
      // In a real implementation, you would use an EtherNet/IP client library
      const testIpAddress = testDto.ipAddress || connection.ipAddress;
      const testPort = testDto.port || connection.port;
      const testBackplaneSlot = testDto.backplaneSlot || connection.backplaneSlot;
      const testVendorId = testDto.vendorId || connection.vendorId;
      const testProductCode = testDto.productCode || connection.productCode;

      // Simulate connection test with timeout
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate IP address format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(testIpAddress)) {
        throw new BadRequestException('Invalid IP address format');
      }

      // Record health status
      await this.recordHealthStatus(connection, 'connected', undefined, {
        connectionType: 'ethernetip',
        ipAddress: connection.ipAddress,
        port: connection.port,
        backplaneSlot: connection.backplaneSlot,
        vendorId: connection.vendorId,
        productCode: connection.productCode,
        testTimestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'EtherNet/IP connection test successful',
        details: {
          ipAddress: testIpAddress,
          port: testPort,
          backplaneSlot: testBackplaneSlot,
          vendorId: testVendorId,
          productCode: testProductCode,
          responseTime: Math.floor(Math.random() * 30) + 10, // Simulated response time
          deviceInfo: {
            deviceName: 'EtherNet/IP Device',
            vendorName: 'Rockwell Automation',
            productName: 'CompactLogix Controller',
            revision: '20.015',
            serialNumber: '12345678',
            deviceType: 'Programmable Logic Controller',
            maxConnections: 32,
            supportedServices: ['Get_Attribute_All', 'Set_Attribute_All', 'Get_Attribute_List', 'Set_Attribute_List'],
          },
        },
      };
    } catch (error) {
      // Record health status
      await this.recordHealthStatus(connection, 'error', error.message);

      return {
        success: false,
        message: 'EtherNet/IP connection test failed',
        error: error.message,
        details: {
          ipAddress: testDto.ipAddress || connection.ipAddress,
          port: testDto.port || connection.port,
          backplaneSlot: testDto.backplaneSlot || connection.backplaneSlot,
          vendorId: testDto.vendorId || connection.vendorId,
          productCode: testDto.productCode || connection.productCode,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async readTags(id: string, tagPaths: string[], tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate EtherNet/IP tag reading
      await new Promise(resolve => setTimeout(resolve, 100));

      const tagValues = tagPaths.map(tagPath => ({
        tagPath: tagPath,
        value: Math.random() * 100,
        dataType: 'REAL',
        quality: 'Good',
        timestamp: new Date().toISOString(),
      }));

      return {
        success: true,
        connectionId: id,
        tagValues: tagValues,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read EtherNet/IP tags',
        error: error.message,
        connectionId: id,
        tagPaths: tagPaths,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async writeTag(id: string, tagPath: string, value: any, dataType: string, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate EtherNet/IP tag writing
      await new Promise(resolve => setTimeout(resolve, 150));

      return {
        success: true,
        connectionId: id,
        tagPath: tagPath,
        value: value,
        dataType: dataType,
        message: 'Tag written successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to write EtherNet/IP tag',
        error: error.message,
        connectionId: id,
        tagPath: tagPath,
        value: value,
        dataType: dataType,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async browseTags(id: string, tenantId: string): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    try {
      // Simulate EtherNet/IP tag browsing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate tag structure
      const tagStructure = {
        connectionId: id,
        tags: [
          {
            tagPath: 'Program:MainProgram.Temperature',
            dataType: 'REAL',
            description: 'Main Program Temperature',
            arraySize: 1,
            access: 'Read/Write',
          },
          {
            tagPath: 'Program:MainProgram.Pressure',
            dataType: 'REAL',
            description: 'Main Program Pressure',
            arraySize: 1,
            access: 'Read/Write',
          },
          {
            tagPath: 'Program:MainProgram.Status',
            dataType: 'DINT',
            description: 'Main Program Status',
            arraySize: 1,
            access: 'Read Only',
          },
          {
            tagPath: 'Program:MainProgram.ArrayData',
            dataType: 'REAL',
            description: 'Main Program Array Data',
            arraySize: 100,
            access: 'Read/Write',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        ...tagStructure,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to browse EtherNet/IP tags',
        error: error.message,
        connectionId: id,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async recordHealthStatus(
    connection: EtherNetIPConnection,
    status: string,
    errorMessage?: string,
    metrics?: any,
  ): Promise<void> {
    const health = new ConnectionHealth();
    health.connectionType = 'ethernetip';
    health.ethernetipConnectionId = connection.id;
    health.status = status;
    health.errorMessage = errorMessage || null;
    health.metrics = metrics;
    health.checkedAt = new Date();

    await this.connectionHealthRepository.save(health);
  }

  async getHealthStatus(id: string, tenantId: string): Promise<ConnectionHealth[]> {
    const connection = await this.findOne(id, tenantId);
    
    return await this.connectionHealthRepository.find({
      where: { ethernetipConnectionId: connection.id },
      order: { checkedAt: 'DESC' },
      take: 10,
    });
  }
}
