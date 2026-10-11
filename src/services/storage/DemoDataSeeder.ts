// Demo Data Seeder for Universal Connector
// This service populates the IndexedDB with sample data for demonstration

import { globalUniversalConnectorService } from './UniversalConnectorService';
import { 
  DataSourceStorage, 
  DataSinkStorage, 
  StreamProcessorStorage,
  ConnectionConfigStorage 
} from './UniversalConnectorDB';

export class DemoDataSeeder {
  private static instance: DemoDataSeeder;
  private isSeeded: boolean = false;

  private constructor() {}

  static getInstance(): DemoDataSeeder {
    if (!DemoDataSeeder.instance) {
      DemoDataSeeder.instance = new DemoDataSeeder();
    }
    return DemoDataSeeder.instance;
  }

  // Check if demo data has already been seeded
  async isDataSeeded(): Promise<boolean> {
    try {
      const sources = await globalUniversalConnectorService.getAllDataSources();
      const sinks = await globalUniversalConnectorService.getAllDataSinks();
      const processors = await globalUniversalConnectorService.getAllStreamProcessors();
      
      return sources.length > 0 || sinks.length > 0 || processors.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Seed demo data if not already present
  async seedIfNeeded(): Promise<void> {
    if (this.isSeeded) return;

    try {
      const alreadySeeded = await this.isDataSeeded();
      if (alreadySeeded) {
        console.log('Demo data already seeded, skipping...');
        this.isSeeded = true;
        return;
      }

      await this.seedDemoData();
      this.isSeeded = true;
      console.log('Demo data seeded successfully');
    } catch (error) {
      console.error('Failed to seed demo data:', error);
    }
  }

  // Seed demo data
  private async seedDemoData(): Promise<void> {
    // Seed data sources
    await this.seedDataSources();
    
    // Seed data sinks
    await this.seedDataSinks();
    
    // Seed stream processors
    await this.seedStreamProcessors();
    
    // Seed connection configs
    await this.seedConnectionConfigs();
  }

  // Seed sample data sources
  private async seedDataSources(): Promise<void> {
    const demoSources: DataSourceStorage[] = [
      {
        id: 'demo_source_modbus_1',
        name: 'Modbus PLC 1',
        connectorType: 'ModbusConnector',
        config: {
          host: '192.168.1.100',
          port: 502,
          slaveId: 1,
          timeout: 5000,
          realTime: true,
          pollingInterval: 1000
        },
        enabled: true,
        lastData: { temperature: 25.5, pressure: 101.3, flow: 150.2 },
        lastUpdate: new Date(),
        errorCount: 0,
        status: 'active',
        metadata: {
          location: 'Production Line A',
          deviceType: 'PLC',
          manufacturer: 'Siemens'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_source_mqtt_1',
        name: 'MQTT IoT Gateway',
        connectorType: 'MQTTConnector',
        config: {
          broker: 'mqtt://192.168.1.200:1883',
          clientId: 'proact_gateway',
          username: 'admin',
          password: 'password',
          topics: ['sensors/temperature', 'sensors/pressure', 'sensors/flow'],
          realTime: true
        },
        enabled: true,
        lastData: { temperature: 23.1, pressure: 100.8, flow: 145.7 },
        lastUpdate: new Date(),
        errorCount: 0,
        status: 'active',
        metadata: {
          location: 'IoT Network',
          deviceType: 'Gateway',
          protocol: 'MQTT 3.1.1'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_source_pi_1',
        name: 'PI Historian Server',
        connectorType: 'PIConnector',
        config: {
          server: '192.168.1.50',
          port: 5460,
          username: 'piadmin',
          password: 'password',
          database: 'PI_Plant',
          realTime: true,
          queryInterval: 5000
        },
        enabled: true,
        lastData: { temperature: 26.2, pressure: 102.1, flow: 148.9 },
        lastUpdate: new Date(),
        errorCount: 0,
        status: 'active',
        metadata: {
          location: 'Data Center',
          deviceType: 'Historian',
          version: 'PI Server 2020'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const source of demoSources) {
      await globalUniversalConnectorService.saveDataSource(source);
    }
  }

  // Seed sample data sinks
  private async seedDataSinks(): Promise<void> {
    const demoSinks: DataSinkStorage[] = [
      {
        id: 'demo_sink_eventbus_1',
        name: 'Event Bus Sink',
        type: 'event_bus',
        config: {
          eventTypes: ['data_update', 'alert', 'status_change'],
          priority: 'high',
          retryAttempts: 3
        },
        enabled: true,
        lastWrite: new Date(),
        writeCount: 1250,
        errorCount: 0,
        metadata: {
          destination: 'Internal Event System',
          reliability: 'high'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_sink_database_1',
        name: 'Database Sink',
        type: 'database',
        config: {
          connectionString: 'postgresql://user:pass@localhost:5432/proact_db',
          tableName: 'streaming_data',
          batchSize: 100,
          flushInterval: 5000
        },
        enabled: true,
        lastWrite: new Date(),
        writeCount: 3420,
        errorCount: 0,
        metadata: {
          destination: 'PostgreSQL Database',
          schema: 'public'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_sink_websocket_1',
        name: 'WebSocket Sink',
        type: 'websocket',
        config: {
          url: 'ws://localhost:8080/stream',
          protocols: ['json'],
          reconnectInterval: 5000,
          maxReconnectAttempts: 10
        },
        enabled: true,
        lastWrite: new Date(),
        writeCount: 890,
        errorCount: 0,
        metadata: {
          destination: 'Real-time Dashboard',
          clients: 15
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const sink of demoSinks) {
      await globalUniversalConnectorService.saveDataSink(sink);
    }
  }

  // Seed sample stream processors
  private async seedStreamProcessors(): Promise<void> {
    const demoProcessors: StreamProcessorStorage[] = [
      {
        id: 'demo_processor_filter_1',
        name: 'Temperature Filter',
        type: 'filter',
        config: {
          field: 'temperature',
          operator: 'range',
          minValue: 20,
          maxValue: 30,
          action: 'pass'
        },
        enabled: true,
        order: 1,
        inputSchema: {
          temperature: 'number',
          pressure: 'number',
          flow: 'number',
          timestamp: 'string'
        },
        outputSchema: {
          temperature: 'number',
          pressure: 'number',
          flow: 'number',
          timestamp: 'string',
          filtered: 'boolean'
        },
        metadata: {
          description: 'Filters temperature readings within acceptable range',
          category: 'data_quality'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_processor_transform_1',
        name: 'Unit Converter',
        type: 'transform',
        config: {
          conversions: [
            { from: 'celsius', to: 'fahrenheit', field: 'temperature' },
            { from: 'bar', to: 'psi', field: 'pressure' }
          ]
        },
        enabled: true,
        order: 2,
        inputSchema: {
          temperature: 'number',
          pressure: 'number',
          flow: 'number',
          timestamp: 'string'
        },
        outputSchema: {
          temperature_f: 'number',
          pressure_psi: 'number',
          flow: 'number',
          timestamp: 'string',
          original_temperature: 'number',
          original_pressure: 'number'
        },
        metadata: {
          description: 'Converts units to standard format',
          category: 'data_standardization'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_processor_aggregate_1',
        name: '5-Minute Aggregator',
        type: 'aggregate',
        config: {
          timeWindow: 300000, // 5 minutes
          functions: {
            temperature: 'average',
            pressure: 'average',
            flow: 'sum'
          }
        },
        enabled: true,
        order: 3,
        inputSchema: {
          temperature: 'number',
          pressure: 'number',
          flow: 'number',
          timestamp: 'string'
        },
        outputSchema: {
          avg_temperature: 'number',
          avg_pressure: 'number',
          total_flow: 'number',
          record_count: 'number',
          window_start: 'string',
          window_end: 'string'
        },
        metadata: {
          description: 'Aggregates data over 5-minute windows',
          category: 'data_aggregation'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const processor of demoProcessors) {
      await globalUniversalConnectorService.saveStreamProcessor(processor);
    }
  }

  // Seed sample connection configs
  private async seedConnectionConfigs(): Promise<void> {
    const demoConfigs: ConnectionConfigStorage[] = [
      {
        id: 'demo_config_modbus_1',
        name: 'Production Line Modbus',
        type: 'modbus',
        config: {
          host: '192.168.1.100',
          port: 502,
          slaveId: 1,
          timeout: 5000,
          retryAttempts: 3
        },
        enabled: true,
        lastConnection: new Date(),
        connectionStatus: 'connected',
        errorCount: 0,
        metadata: {
          location: 'Production Line A',
          deviceType: 'PLC',
          manufacturer: 'Siemens'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_config_mqtt_1',
        name: 'IoT Network MQTT',
        type: 'mqtt',
        config: {
          broker: 'mqtt://192.168.1.200:1883',
          clientId: 'proact_gateway',
          username: 'admin',
          password: 'password',
          keepalive: 60
        },
        enabled: true,
        lastConnection: new Date(),
        connectionStatus: 'connected',
        errorCount: 0,
        metadata: {
          location: 'IoT Network',
          protocol: 'MQTT 3.1.1',
          security: 'username/password'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'demo_config_pi_1',
        name: 'PI Historian Connection',
        type: 'pi',
        config: {
          server: '192.168.1.50',
          port: 5460,
          username: 'piadmin',
          password: 'password',
          database: 'PI_Plant',
          timeout: 10000
        },
        enabled: true,
        lastConnection: new Date(),
        connectionStatus: 'connected',
        errorCount: 0,
        metadata: {
          location: 'Data Center',
          version: 'PI Server 2020',
          security: 'Windows Authentication'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const config of demoConfigs) {
      await globalUniversalConnectorService.saveConnectionConfig(config);
    }
  }

  // Clear all demo data
  async clearDemoData(): Promise<void> {
    // UniversalConnectorService has no bulk clear (the old `clearAllData()` call threw and landed here), so
    // nothing is deleted and the seeded flag stays as it is.
    console.error('Failed to clear demo data:', new Error('UniversalConnectorService has no clearAllData'));
  }

  // Reset demo data (clear and reseed)
  async resetDemoData(): Promise<void> {
    try {
      await this.clearDemoData();
      await this.seedDemoData();
      this.isSeeded = true;
      console.log('Demo data reset successfully');
    } catch (error) {
      console.error('Failed to reset demo data:', error);
    }
  }
}

// Global instance
export const globalDemoDataSeeder = DemoDataSeeder.getInstance();
export default globalDemoDataSeeder;
