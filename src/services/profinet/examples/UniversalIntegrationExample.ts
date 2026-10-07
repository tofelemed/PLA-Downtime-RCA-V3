/**
 * Profinet Protocol - Universal Integration Example
 * 
 * This example demonstrates how to use the Profinet protocol
 * in the universal integration system with IndexedDB persistence.
 */

import {
  globalProfinetUniversalManager,
  ProfinetUtils,
  ProfinetConnector,
  ProfinetConnectionTemplate,
  ProfinetConfig
} from '../ProfinetConnector';

import { globalEventBus } from '@/services/events/EventBus';

export class ProfinetUniversalIntegrationExample {
  
  /**
   * Example 1: Create and manage multiple Profinet connections
   */
  async createMultipleConnections(): Promise<void> {
    console.log('Creating multiple Profinet connections...');
    
    // Create connection templates
    const connections: ProfinetConnectionTemplate[] = [
      {
        id: 'plc_production_1',
        name: 'Production Line 1 PLC',
        description: 'Main production line controller',
        host: '192.168.1.100',
        port: 102,
        deviceId: 'PLC001',
        rack: 0,
        slot: 2,
        timeout: 5000,
        scanRate: 1000,
        enabled: true,
        blocks: ProfinetUtils.generateDefaultBlocks(),
        metadata: { location: 'Building A', department: 'Production' }
      },
      {
        id: 'plc_production_2',
        name: 'Production Line 2 PLC',
        description: 'Secondary production line controller',
        host: '192.168.1.101',
        port: 102,
        deviceId: 'PLC002',
        rack: 0,
        slot: 2,
        timeout: 5000,
        scanRate: 1000,
        enabled: false,
        blocks: ProfinetUtils.generateDefaultBlocks(),
        metadata: { location: 'Building B', department: 'Production' }
      },
      {
        id: 'plc_quality',
        name: 'Quality Control PLC',
        description: 'Quality testing station controller',
        host: '192.168.1.102',
        port: 102,
        deviceId: 'PLC003',
        rack: 0,
        slot: 2,
        timeout: 3000,
        scanRate: 500,
        enabled: true,
        blocks: [
          {
            name: 'TestResult_DB',
            number: 20,
            type: 'DB',
            dataType: 'BOOL',
            readOnly: false,
            description: 'Quality test result',
            offset: 0,
            length: 1
          },
          {
            name: 'TestValue_DB',
            number: 21,
            type: 'DB',
            dataType: 'REAL',
            readOnly: false,
            description: 'Test measurement value',
            offset: 0,
            length: 4
          }
        ],
        metadata: { location: 'Building C', department: 'Quality' }
      }
    ];
    
    // Create all connections
    for (const template of connections) {
      try {
        const connector = await globalProfinetUniversalManager.createConnectionFromTemplate(template);
        console.log(`Created connection: ${connector.getConfig().name}`);
      } catch (error) {
        console.error(`Failed to create connection ${template.name}:`, error);
      }
    }
    
    console.log('Multiple connections created successfully');
  }
  
  /**
   * Example 2: Monitor and manage all connections
   */
  async monitorAllConnections(): Promise<void> {
    console.log('Monitoring all Profinet connections...');
    
    // Get connection summaries for dashboard
    const summaries = await globalProfinetUniversalManager.getConnectionSummaries();
    console.log('Connection Summaries:', summaries);
    
    // Get detailed status for all connections
    const statuses = await globalProfinetUniversalManager.getAllConnectionStatuses();
    statuses.forEach(status => {
      console.log(`${status.name}:`);
      console.log(`  Status: ${status.status}`);
      console.log(`  Error Count: ${status.errorCount}`);
      console.log(`  Messages/sec: ${status.metrics.messagesPerSecond.toFixed(2)}`);
      console.log(`  Total Messages: ${status.metrics.totalMessages}`);
      console.log(`  Device Status: ${status.metrics.deviceStatus}`);
      if (status.lastError) {
        console.log(`  Last Error: ${status.lastError}`);
      }
    });
    
    // Get storage statistics
    const stats = await globalProfinetUniversalManager.getStorageStats();
    console.log('Storage Statistics:', stats);
  }
  
  /**
   * Example 3: Connect and interact with devices
   */
  async interactWithDevices(): Promise<void> {
    console.log('Interacting with Profinet devices...');
    
    // Get a specific connection
    const connector = await globalProfinetUniversalManager.getConnection('plc_production_1');
    if (!connector) {
      console.error('Production PLC connection not found');
      return;
    }
    
    try {
      // Connect to the device
      console.log('Connecting to production PLC...');
      const connected = await connector.connect();
      
      if (connected) {
        console.log('Successfully connected to production PLC');
        
        // Read some blocks
        const temperature = await connector.readBlock('Temperature_DB');
        const pressure = await connector.readBlock('Pressure_M');
        const status = await connector.readBlock('SystemStatus_DB');
        
        console.log('Current Values:');
        console.log(`  Temperature: ${temperature}°C`);
        console.log(`  Pressure: ${pressure} PSI`);
        console.log(`  System Status: ${status ? 'Online' : 'Offline'}`);
        
        // Write to a block (if not read-only)
        try {
          await connector.writeBlock('Temperature_DB', 75.0);
          console.log('Successfully set temperature to 75.0°C');
        } catch (error) {
          console.log('Could not write to temperature block (may be read-only)');
        }
        
        // Get connection health
        const health = await globalProfinetUniversalManager.getConnectionHealth('plc_production_1');
        console.log('Connection Health:', health);
        
        // Disconnect
        await connector.disconnect();
        console.log('Disconnected from production PLC');
      } else {
        console.error('Failed to connect to production PLC');
      }
      
    } catch (error) {
      console.error('Error interacting with production PLC:', error);
    }
  }
  
  /**
   * Example 4: Event handling and real-time monitoring
   */
  async setupEventHandling(): Promise<void> {
    console.log('Setting up Profinet event handling...');
    
    // Subscribe to connection events
    globalEventBus.subscribe('profinet:connected', (data) => {
      console.log(`🔗 Profinet Connected: ${data.config.name} (${data.config.endpoint})`);
    });
    
    globalEventBus.subscribe('profinet:disconnected', (data) => {
      console.log(`🔌 Profinet Disconnected: ${data.config.name}`);
    });
    
    globalEventBus.subscribe('profinet:connection_failed', (data) => {
      console.error(`❌ Profinet Connection Failed: ${data.error}`);
    });
    
    // Subscribe to block events
    globalEventBus.subscribe('profinet:block:read', (data) => {
      console.log(`📖 Block Read: ${data.message.block} = ${data.message.value} (${data.message.quality})`);
    });
    
    globalEventBus.subscribe('profinet:block:written', (data) => {
      console.log(`✏️  Block Written: ${data.message.block} = ${data.message.value}`);
    });
    
    globalEventBus.subscribe('profinet:block:read_failed', (data) => {
      console.error(`❌ Block Read Failed: ${data.block} - ${data.error}`);
    });
    
    // Subscribe to manager events
    globalEventBus.subscribe('profinet.manager.connection.created', (data) => {
      console.log(`➕ Connection Created: ${data.connectionId}`);
    });
    
    globalEventBus.subscribe('profinet.manager.connection.removed', (data) => {
      console.log(`➖ Connection Removed: ${data.connectionId}`);
    });
    
    console.log('Event handling setup complete');
  }
  
  /**
   * Example 5: Bulk operations and management
   */
  async performBulkOperations(): Promise<void> {
    console.log('Performing bulk operations...');
    
    // Enable all connections
    console.log('Enabling all connections...');
    await globalProfinetUniversalManager.enableAllConnections();
    
    // Wait a moment for connections to establish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get updated summaries
    const summaries = await globalProfinetUniversalManager.getConnectionSummaries();
    const enabledCount = summaries.filter(s => s.enabled).length;
    console.log(`Enabled ${enabledCount} out of ${summaries.length} connections`);
    
    // Disable all connections
    console.log('Disabling all connections...');
    await globalProfinetUniversalManager.disableAllConnections();
    
    console.log('Bulk operations completed');
  }
  
  /**
   * Example 6: Data export and import
   */
  async exportAndImportData(): Promise<void> {
    console.log('Exporting and importing connection data...');
    
    // Export data for a specific connection
    const exportData = await globalProfinetUniversalManager.exportConnectionData('plc_production_1');
    console.log('Exported Data Structure:', {
      connectionId: exportData.connectionId,
      config: {
        name: exportData.config.name,
        endpoint: exportData.config.endpoint,
        blockCount: exportData.blocks.length
      },
      messageCount: exportData.messages.length,
      exportTimestamp: exportData.exportTimestamp
    });
    
    // Simulate importing the data (in real scenario, this would come from external source)
    try {
      const importedConnector = await globalProfinetUniversalManager.importConnection(exportData);
      console.log(`Successfully imported connection: ${importedConnector.getConfig().name}`);
      
      // Clean up the imported connection
      await globalProfinetUniversalManager.removeConnection(exportData.connectionId);
      console.log('Cleaned up imported connection');
      
    } catch (error) {
      console.error('Failed to import connection:', error);
    }
  }
  
  /**
   * Example 7: Maintenance and cleanup
   */
  async performMaintenance(): Promise<void> {
    console.log('Performing maintenance tasks...');
    
    // Cleanup old messages (keep last 7 days)
    const cleanedCount = await globalProfinetUniversalManager.cleanupOldMessages(7);
    console.log(`Cleaned up ${cleanedCount} old messages`);
    
    // Get updated storage statistics
    const stats = await globalProfinetUniversalManager.getStorageStats();
    console.log('Updated Storage Statistics:', stats);
  }
  
  /**
   * Example 8: Error handling and validation
   */
  async demonstrateErrorHandling(): Promise<void> {
    console.log('Demonstrating error handling...');
    
    // Try to create an invalid configuration
    const invalidConfig: Partial<ProfinetConfig> = {
      id: '',
      name: '',
      host: 'invalid-host',
      port: 99999,
      deviceId: ''
    };
    
    const validation = ProfinetUtils.validateConfig(invalidConfig);
    if (!validation.isValid) {
      console.log('Configuration validation failed:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Try to create a connection with invalid config
    try {
      const connector = await globalProfinetUniversalManager.createConnectionFromTemplate({
        ...invalidConfig,
        rack: 0,
        slot: 0,
        timeout: 5000,
        scanRate: 1000,
        enabled: false,
        blocks: []
      } as ProfinetConnectionTemplate);
      
      console.log('Unexpected: Invalid connection was created');
      
    } catch (error) {
      console.log('Expected error caught:', error.message);
    }
  }
  
  /**
   * Example 9: Heartbeat monitoring
   */
  async demonstrateHeartbeatMonitoring(): Promise<void> {
    console.log('Demonstrating heartbeat monitoring...');
    
    const connector = await globalProfinetUniversalManager.getConnection('plc_production_1');
    if (!connector) {
      console.error('Production PLC connection not found');
      return;
    }
    
    try {
      // Connect to start heartbeat
      await connector.connect();
      
      // Monitor device status for a few minutes
      console.log('Monitoring device heartbeat for 2 minutes...');
      
      for (let i = 0; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        
        const metrics = await connector.getMetrics();
        console.log(`Device Status: ${metrics.deviceStatus}`);
        console.log(`Connection Uptime: ${Math.round(metrics.connectionUptime / 1000)}s`);
      }
      
      await connector.disconnect();
      
    } catch (error) {
      console.error('Error during heartbeat monitoring:', error);
    }
  }
  
  /**
   * Example 10: Block management
   */
  async demonstrateBlockManagement(): Promise<void> {
    console.log('Demonstrating block management...');
    
    const connector = await globalProfinetUniversalManager.getConnection('plc_production_1');
    if (!connector) {
      console.error('Production PLC connection not found');
      return;
    }
    
    try {
      // Add a new block
      const newBlock = {
        name: 'CustomBlock_DB',
        number: 100,
        type: 'DB' as const,
        dataType: 'REAL' as const,
        readOnly: false,
        description: 'Custom data block for testing',
        offset: 0,
        length: 4
      };
      
      await connector.addBlock(newBlock);
      console.log('Added new block:', newBlock.name);
      
      // Get updated block list
      const blocks = await connector.getBlockList();
      console.log(`Total blocks: ${blocks.length}`);
      
      // Remove the test block
      await connector.removeBlock('CustomBlock_DB');
      console.log('Removed test block');
      
    } catch (error) {
      console.error('Error during block management:', error);
    }
  }
  
  /**
   * Run all examples
   */
  async runAllExamples(): Promise<void> {
    console.log('🚀 Starting Profinet Universal Integration Examples\n');
    
    try {
      // Setup event handling first
      await this.setupEventHandling();
      
      // Run examples
      await this.createMultipleConnections();
      await this.monitorAllConnections();
      await this.interactWithDevices();
      await this.performBulkOperations();
      await this.exportAndImportData();
      await this.performMaintenance();
      await this.demonstrateErrorHandling();
      await this.demonstrateHeartbeatMonitoring();
      await this.demonstrateBlockManagement();
      
      console.log('\n✅ All examples completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Examples failed:', error);
    }
  }
}

// Export for use in other modules
export default ProfinetUniversalIntegrationExample;

// Example usage:
/*
import ProfinetUniversalIntegrationExample from './UniversalIntegrationExample';

const example = new ProfinetUniversalIntegrationExample();
example.runAllExamples();
*/
