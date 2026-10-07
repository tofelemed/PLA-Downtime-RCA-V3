import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SCADAConnection } from '../entities/scada-connection.entity';
import { CreateSCADAConnectionDto, UpdateSCADAConnectionDto, TestSCADAConnectionDto } from '../dto/scada-connection.dto';

@Injectable()
export class SCADAService {
  private readonly logger = new Logger(SCADAService.name);

  constructor(
    @InjectRepository(SCADAConnection)
    private readonly scadaConnectionRepository: Repository<SCADAConnection>,
  ) {}

  async createSCADAConnection(createDto: CreateSCADAConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = this.scadaConnectionRepository.create({
        ...createDto,
        tenantId,
        status: 'disconnected',
        errorCount: 0,
      });

      const savedConnection = await this.scadaConnectionRepository.save(connection);
      
      this.logger.log(`SCADA connection created: ${savedConnection.id}`);
      
      return {
        success: true,
        data: savedConnection,
        message: 'SCADA connection created successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to create SCADA connection: ${error.message}`);
      throw error;
    }
  }

  async getSCADAConnections(tenantId: string): Promise<any> {
    try {
      const connections = await this.scadaConnectionRepository.find({
        where: { tenantId },
        order: { createdAt: 'DESC' }
      });

      return {
        success: true,
        data: connections,
        message: 'SCADA connections retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get SCADA connections: ${error.message}`);
      throw error;
    }
  }

  async getSCADAConnection(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.scadaConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'SCADA connection not found'
        };
      }

      return {
        success: true,
        data: connection,
        message: 'SCADA connection retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get SCADA connection: ${error.message}`);
      throw error;
    }
  }

  async updateSCADAConnection(id: string, updateDto: UpdateSCADAConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = await this.scadaConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'SCADA connection not found'
        };
      }

      Object.assign(connection, updateDto);
      const updatedConnection = await this.scadaConnectionRepository.save(connection);

      this.logger.log(`SCADA connection updated: ${id}`);

      return {
        success: true,
        data: updatedConnection,
        message: 'SCADA connection updated successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to update SCADA connection: ${error.message}`);
      throw error;
    }
  }

  async deleteSCADAConnection(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.scadaConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'SCADA connection not found'
        };
      }

      await this.scadaConnectionRepository.remove(connection);

      this.logger.log(`SCADA connection deleted: ${id}`);

      return {
        success: true,
        message: 'SCADA connection deleted successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to delete SCADA connection: ${error.message}`);
      throw error;
    }
  }

  async testSCADAConnection(id: string, testDto: TestSCADAConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = await this.scadaConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'SCADA connection not found'
        };
      }

      // Simulate SCADA connection test
      const testResult = await this.performSCADATest(testDto);

      // Update connection status based on test result
      connection.status = testResult.success ? 'connected' : 'error';
      connection.lastConnected = testResult.success ? new Date() : null;
      connection.errorCount = testResult.success ? 0 : connection.errorCount + 1;
      connection.lastError = testResult.success ? null : testResult.error;

      await this.scadaConnectionRepository.save(connection);

      return {
        success: testResult.success,
        data: testResult,
        message: testResult.success ? 'SCADA connection test successful' : 'SCADA connection test failed'
      };
    } catch (error) {
      this.logger.error(`Failed to test SCADA connection: ${error.message}`);
      throw error;
    }
  }

  private async performSCADATest(testDto: TestSCADAConnectionDto): Promise<any> {
    try {
      const { ipAddress, port, protocol, unitId, timeoutMs } = testDto;

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate test result (90% success rate for demo)
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        return {
          success: true,
          protocol: protocol || 'modbus',
          unitId: unitId || 1,
          responseTime: Math.floor(Math.random() * 100) + 50,
          registers: [
            { address: 0, value: 1234, type: 'holding' },
            { address: 1, value: 5678, type: 'holding' },
            { address: 2, value: 9012, type: 'input' }
          ]
        };
      } else {
        return {
          success: false,
          error: 'Device not responding or communication timeout'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async readSCADARegisters(id: string, registerType: string, startAddress: number, count: number, tenantId: string): Promise<any> {
    try {
      const connection = await this.scadaConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'SCADA connection not found'
        };
      }

      // Simulate register reading
      const result = await this.performSCADARegisterRead(connection, registerType, startAddress, count);

      return {
        success: true,
        data: result,
        message: 'SCADA registers read successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to read SCADA registers: ${error.message}`);
      throw error;
    }
  }

  private async performSCADARegisterRead(connection: SCADAConnection, registerType: string, startAddress: number, count: number): Promise<any> {
    // Simulate register reading
    await new Promise(resolve => setTimeout(resolve, 500));

    const registers: Array<{
      address: number;
      value: number;
      type: string;
      timestamp: Date;
      quality: string;
    }> = [];
    
    for (let i = 0; i < count; i++) {
      registers.push({
        address: startAddress + i,
        value: Math.floor(Math.random() * 65535),
        type: registerType,
        timestamp: new Date(),
        quality: 'GOOD'
      });
    }

    return {
      registerType,
      startAddress,
      count,
      registers
    };
  }

  async writeSCADARegister(id: string, registerType: string, address: number, value: number, tenantId: string): Promise<any> {
    try {
      const connection = await this.scadaConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'SCADA connection not found'
        };
      }

      // Simulate register writing
      const result = await this.performSCADARegisterWrite(connection, registerType, address, value);

      return {
        success: true,
        data: result,
        message: 'SCADA register written successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to write SCADA register: ${error.message}`);
      throw error;
    }
  }

  private async performSCADARegisterWrite(connection: SCADAConnection, registerType: string, address: number, value: number): Promise<any> {
    // Simulate register writing
    await new Promise(resolve => setTimeout(resolve, 400));

    return {
      registerType,
      address,
      value,
      timestamp: new Date(),
      success: true
    };
  }

  async getSCADATags(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.scadaConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'SCADA connection not found'
        };
      }

      // Simulate tag list retrieval
      const tags = await this.performSCADATags(connection);

      return {
        success: true,
        data: tags,
        message: 'SCADA tags retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get SCADA tags: ${error.message}`);
      throw error;
    }
  }

  private async performSCADATags(connection: SCADAConnection): Promise<any> {
    // Simulate tag list retrieval
    await new Promise(resolve => setTimeout(resolve, 600));

    return {
      holdingRegisters: [
        { address: 0, name: 'Temperature Setpoint', units: '°C', dataType: 'float' },
        { address: 1, name: 'Pressure Setpoint', units: 'bar', dataType: 'float' },
        { address: 2, name: 'Flow Rate', units: 'L/min', dataType: 'float' }
      ],
      inputRegisters: [
        { address: 0, name: 'Temperature Actual', units: '°C', dataType: 'float' },
        { address: 1, name: 'Pressure Actual', units: 'bar', dataType: 'float' },
        { address: 2, name: 'Flow Rate Actual', units: 'L/min', dataType: 'float' }
      ],
      coils: [
        { address: 0, name: 'Pump Start', dataType: 'boolean' },
        { address: 1, name: 'Valve Open', dataType: 'boolean' },
        { address: 2, name: 'Alarm Reset', dataType: 'boolean' }
      ],
      discreteInputs: [
        { address: 0, name: 'Pump Running', dataType: 'boolean' },
        { address: 1, name: 'Valve Position', dataType: 'boolean' },
        { address: 2, name: 'High Pressure Alarm', dataType: 'boolean' }
      ]
    };
  }
}
