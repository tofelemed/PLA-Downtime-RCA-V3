import { Injectable, Logger } from '@nestjs/common';
import ModbusRTU from 'modbus-serial';
import ModbusTCP from 'modbus-serial';
import { SerialPort } from 'serialport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModbusConnection } from '../entities/modbus-connection.entity';
import { ConnectivityGateway } from '../gateways/connectivity.gateway';
import { EventEmitter } from 'events';

export interface ModbusDataPoint {
  address: number;
  value: any;
  dataType: string;
  quality: string;
  timestamp: Date;
}

export interface ModbusSession {
  connectionId: string;
  client: ModbusRTU | ModbusTCP;
  isConnected: boolean;
  lastActivity: Date;
  pollingInterval?: NodeJS.Timeout;
}

@Injectable()
export class ModbusClientService {
  private readonly logger = new Logger(ModbusClientService.name);
  private activeSessions = new Map<string, ModbusSession>();
  private eventEmitter: EventEmitter;

  constructor(
    @InjectRepository(ModbusConnection)
    private modbusConnectionRepository: Repository<ModbusConnection>,
    private connectivityGateway: ConnectivityGateway,
  ) {
    this.eventEmitter = this.connectivityGateway.getEventEmitter();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for data requests from frontend
    this.eventEmitter.on('data_request', async (data) => {
      if (data.connectionId) {
        const connection = await this.modbusConnectionRepository.findOne({
          where: { id: data.connectionId }
        });
        
        if (connection) {
          await this.readRegisters(data.connectionId, connection.startAddress, connection.registerCount);
        }
      }
    });
  }

  async connect(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.modbusConnectionRepository.findOne({
        where: { id: connectionId }
      });

      if (!connection) {
        throw new Error(`Modbus connection not found: ${connectionId}`);
      }

      if (this.activeSessions.has(connectionId)) {
        this.logger.warn(`Modbus connection ${connectionId} already exists`);
        return true;
      }

      let client: ModbusRTU | ModbusTCP;

      // Create client based on connection type
      if (connection.connectionType === 'tcp') {
        client = new ModbusTCP();
        if (connection.ipAddress) {
          await client.connectTCP(connection.ipAddress, { port: connection.port || 502 });
          this.logger.log(`Connected to Modbus TCP server: ${connection.ipAddress}:${connection.port}`);
        } else {
          throw new Error('IP address is required for TCP connections');
        }
      } else if (connection.connectionType === 'rtu') {
        client = new ModbusRTU();
        
        if (connection.serialPort) {
          // Configure serial port
          const serialPort = new SerialPort({
            path: connection.serialPort,
            baudRate: connection.baudRate || 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
          });

          await client.connectRTU(connection.serialPort, {
            baudRate: connection.baudRate || 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
          });
          this.logger.log(`Connected to Modbus RTU device: ${connection.serialPort}`);
        } else {
          throw new Error('Serial port is required for RTU connections');
        }
      } else {
        throw new Error(`Unsupported Modbus connection type: ${connection.connectionType}`);
      }

      // Set client options
      client.setID(connection.unitId || 1);
      client.setTimeout(connection.timeoutMs || 5000);

      // Store session
      const modbusSession: ModbusSession = {
        connectionId,
        client,
        isConnected: true,
        lastActivity: new Date()
      };

      this.activeSessions.set(connectionId, modbusSession);

      // Set up polling if enabled
      if (connection.enabled && connection.pollingIntervalMs) {
        this.startPolling(connectionId, connection);
      }

      // Set up error handlers
      client.on('error', (error: any) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Modbus client error for connection ${connectionId}: ${errorMessage}`);
        this.handleConnectionError(connectionId, new Error(errorMessage));
      });

      // Broadcast connection status
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'modbus', {
        status: 'connected',
        message: `Successfully connected to Modbus ${connection.connectionType.toUpperCase()} device`,
        deviceInfo: {
          type: connection.connectionType,
          address: connection.connectionType === 'tcp' ? `${connection.ipAddress}:${connection.port}` : connection.serialPort,
          unitId: connection.unitId
        }
      });

      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to connect to Modbus device: ${errorMessage}`);
      
      // Broadcast connection failure
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'modbus', {
        status: 'error',
        message: `Connection failed: ${errorMessage}`,
        error: errorMessage
      });

      return false;
    }
  }

  async disconnect(connectionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session) {
        this.logger.warn(`No active session found for connection ${connectionId}`);
        return true;
      }

      // Stop polling
      if (session.pollingInterval) {
        clearInterval(session.pollingInterval);
      }

      // Close connection
      if (session.client) {
        await session.client.close();
      }

      // Remove from active sessions
      this.activeSessions.delete(connectionId);

      // Broadcast disconnection
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'modbus', {
        status: 'disconnected',
        message: 'Disconnected from Modbus device'
      });

      this.logger.log(`Successfully disconnected from Modbus device: ${connectionId}`);
      return true;

    } catch (error) {
      this.logger.error(`Error disconnecting from Modbus device: ${error.message}`);
      return false;
    }
  }

  async readHoldingRegisters(connectionId: string, startAddress: number, count: number): Promise<ModbusDataPoint[]> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      const data = await session.client.readHoldingRegisters(startAddress, count);
      const dataPoints: ModbusDataPoint[] = [];

      for (let i = 0; i < data.data.length; i++) {
        dataPoints.push({
          address: startAddress + i,
          value: data.data[i],
          dataType: 'uint16',
          quality: 'good',
          timestamp: new Date()
        });
      }

      // Broadcast data to subscribed clients
      this.connectivityGateway.broadcastConnectionData(connectionId, 'modbus', {
        type: 'holding_registers',
        dataPoints,
        timestamp: new Date().toISOString()
      });

      return dataPoints;

    } catch (error) {
      this.logger.error(`Error reading holding registers: ${error.message}`);
      throw error;
    }
  }

  async readInputRegisters(connectionId: string, startAddress: number, count: number): Promise<ModbusDataPoint[]> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      const data = await session.client.readInputRegisters(startAddress, count);
      const dataPoints: ModbusDataPoint[] = [];

      for (let i = 0; i < data.data.length; i++) {
        dataPoints.push({
          address: startAddress + i,
          value: data.data[i],
          dataType: 'uint16',
          quality: 'good',
          timestamp: new Date()
        });
      }

      // Broadcast data to subscribed clients
      this.connectivityGateway.broadcastConnectionData(connectionId, 'modbus', {
        type: 'input_registers',
        dataPoints,
        timestamp: new Date().toISOString()
      });

      return dataPoints;

    } catch (error) {
      this.logger.error(`Error reading input registers: ${error.message}`);
      throw error;
    }
  }

  async readCoils(connectionId: string, startAddress: number, count: number): Promise<ModbusDataPoint[]> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      const data = await session.client.readCoils(startAddress, count);
      const dataPoints: ModbusDataPoint[] = [];

      for (let i = 0; i < data.data.length; i++) {
        dataPoints.push({
          address: startAddress + i,
          value: data.data[i],
          dataType: 'boolean',
          quality: 'good',
          timestamp: new Date()
        });
      }

      // Broadcast data to subscribed clients
      this.connectivityGateway.broadcastConnectionData(connectionId, 'modbus', {
        type: 'coils',
        dataPoints,
        timestamp: new Date().toISOString()
      });

      return dataPoints;

    } catch (error) {
      this.logger.error(`Error reading coils: ${error.message}`);
      throw error;
    }
  }

  async readDiscreteInputs(connectionId: string, startAddress: number, count: number): Promise<ModbusDataPoint[]> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      const data = await session.client.readDiscreteInputs(startAddress, count);
      const dataPoints: ModbusDataPoint[] = [];

      for (let i = 0; i < data.data.length; i++) {
        dataPoints.push({
          address: startAddress + i,
          value: data.data[i],
          dataType: 'boolean',
          quality: 'good',
          timestamp: new Date()
        });
      }

      // Broadcast data to subscribed clients
      this.connectivityGateway.broadcastConnectionData(connectionId, 'modbus', {
        type: 'discrete_inputs',
        dataPoints,
        timestamp: new Date().toISOString()
      });

      return dataPoints;

    } catch (error) {
      this.logger.error(`Error reading discrete inputs: ${error.message}`);
      throw error;
    }
  }

  async writeSingleRegister(connectionId: string, address: number, value: number): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      await session.client.writeRegister(address, value);

      this.logger.log(`Successfully wrote value ${value} to register ${address}`);
      
      // Broadcast write confirmation
      this.connectivityGateway.broadcastConnectionData(connectionId, 'modbus', {
        type: 'write_register',
        address,
        value,
        status: 'success',
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error(`Error writing to register: ${error.message}`);
      throw error;
    }
  }

  async writeMultipleRegisters(connectionId: string, startAddress: number, values: number[]): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      await session.client.writeRegisters(startAddress, values);

      this.logger.log(`Successfully wrote ${values.length} values starting at register ${startAddress}`);
      
      // Broadcast write confirmation
      this.connectivityGateway.broadcastConnectionData(connectionId, 'modbus', {
        type: 'write_registers',
        startAddress,
        values,
        status: 'success',
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error(`Error writing to registers: ${error.message}`);
      throw error;
    }
  }

  async writeSingleCoil(connectionId: string, address: number, value: boolean): Promise<boolean> {
    try {
      const session = this.activeSessions.get(connectionId);
      if (!session || !session.isConnected) {
        throw new Error(`No active session for connection ${connectionId}`);
      }

      await session.client.writeCoil(address, value);

      this.logger.log(`Successfully wrote value ${value} to coil ${address}`);
      
      // Broadcast write confirmation
      this.connectivityGateway.broadcastConnectionData(connectionId, 'modbus', {
        type: 'write_coil',
        address,
        value,
        status: 'success',
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error(`Error writing to coil: ${error.message}`);
      throw error;
    }
  }

  private startPolling(connectionId: string, connection: ModbusConnection) {
    const session = this.activeSessions.get(connectionId);
    if (!session) return;

    const pollingInterval = setInterval(async () => {
      try {
        // Read registers based on connection configuration
        await this.readRegisters(connectionId, connection.startAddress, connection.registerCount);
        session.lastActivity = new Date();
      } catch (error) {
        this.logger.error(`Polling error for connection ${connectionId}: ${error.message}`);
      }
    }, connection.pollingIntervalMs || 1000);

    session.pollingInterval = pollingInterval;
    this.logger.log(`Started polling for connection ${connectionId} every ${connection.pollingIntervalMs}ms`);
  }

  private async readRegisters(connectionId: string, startAddress: number, count: number) {
    // Default to reading holding registers
    return await this.readHoldingRegisters(connectionId, startAddress, count);
  }

  private handleConnectionError(connectionId: string, error: Error) {
    const session = this.activeSessions.get(connectionId);
    if (session) {
      session.isConnected = false;
      
      // Broadcast connection error
      this.connectivityGateway.broadcastConnectionStatus(connectionId, 'modbus', {
        status: 'error',
        message: `Connection error: ${error.message}`,
        error: error.message
      });
    }
  }

  // Get active sessions info
  getActiveSessions(): Array<{ connectionId: string; isConnected: boolean; lastActivity: Date }> {
    return Array.from(this.activeSessions.entries()).map(([connectionId, session]) => ({
      connectionId,
      isConnected: session.isConnected,
      lastActivity: session.lastActivity
    }));
  }

  // Check if connection is active
  isConnectionActive(connectionId: string): boolean {
    const session = this.activeSessions.get(connectionId);
    return session ? session.isConnected : false;
  }
}
