/**
 * EtherNet/IP Protocol - Universal Integration Example
 * 
 * This example demonstrates how to use the EtherNet/IP protocol
 * in the universal integration system with IndexedDB persistence.
 */

import {
  globalEtherNetIPUniversalManager,
  EtherNetIPUtils,
  EtherNetIPConnector,
  EtherNetIPConnectionTemplate,
  EtherNetIPConfig
} from '../EtherNetIPConnector';

import { globalEventBus } from '@/services/events/EventBus';

export class EtherNetIPUniversalIntegrationExample {
  
  /**
   * Example 1: Create and manage multiple EtherNet/IP connections
   */
  async createMultipleConnections(): Promise<void> {
    console.log('Creating multiple EtherNet/IP connections...');
    
    // Create connection templates
    const connections: EtherNetIPConnectionTemplate[] = [
      {
        id: 'plc_production_1',
        name: 'Production Line 1 PLC',
        description: 'Main production line controller',
        host: '192.168.1.100',
        port: 44818,
        slot: 0,
        timeout: 5000,
        scanRate: 1000,
        enabled: true,
        tags: EtherNetIPUtils.generateDefaultTags(),
        metadata: { location: 'Building A', department: 'Production' }
      },
      {
        id: 'plc_production_2',
        name: 'Production Line 2 PLC',
        description: 'Secondary production line controller',
        host: '192.168.1.101',
        port: 44818,
        slot: 0,
        timeout: 5000,
        scanRate: 1000,
        enabled: false,
        tags: EtherNetIPUtils.generateDefaultTags(),
        metadata: { location: 'Building B', department: 'Production' }
      },
      {
        id: 'plc_quality',
        name: 'Quality Control PLC',
        description: 'Quality testing station controller',
        host: '192.168.1.102',
        port: 44818,
        slot: 0,
        timeout: 3000,
        scanRate: 500,
        enabled: true,
        tags: [
          {
            name: 'TestResult',
            address: 'N7:20',
            dataType: 'BOOL',
            readOnly: false,
            description: 'Quality test result'
          },
          {
            name: 'TestValue',
            address: 'N7:21',
            dataType: 'REAL',
            readOnly: false,
            description: 'Test measurement value'
          }
        ],
        metadata: { location: 'Building C', department: 'Quality' }
      }
    ];
    
    // Create all connections
    for (const template of connections) {
      try {
        const connector = await globalEtherNetIPUniversalManager.createConnectionFromTemplate(template);
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
    console.log('Monitoring all EtherNet/IP connections...');
    
    // Get connection summaries for dashboard
    const summaries = await globalEtherNetIPUniversalManager.getConnectionSummaries();
    console.log('Connection Summaries:', summaries);
    
    // Get detailed status for all connections
    const statuses = await globalEtherNetIPUniversalManager.getAllConnectionStatuses();
    statuses.forEach(status => {
      console.log(`${status.name}:`);
      console.log(`  Status: ${status.status}`);
      console.log(`  Error Count: ${status.errorCount}`);
      console.log(`  Messages/sec: ${status.metrics.messagesPerSecond.toFixed(2)}`);
      console.log(`  Total Messages: ${status.metrics.totalMessages}`);
      if (status.lastError) {
        console.log(`  Last Error: ${status.lastError}`);
      }
    });
    
    // Get storage statistics
    const stats = await globalEtherNetIPUniversalManager.getStorageStats();
    console.log('Storage Statistics:', stats);
  }
  
  /**
   * Example 3: Connect and interact with devices
   */
  async interactWithDevices(): Promise<void> {
    console.log('Interacting with EtherNet/IP devices...');
    
    // Get a specific connection
    const connector = await globalEtherNetIPUniversalManager.getConnection('plc_production_1');
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
        
        // Read some tags
        const temperature = await connector.readTag('Temperature');
        const pressure = await connector.readTag('Pressure');
        const status = await connector.readTag('SystemStatus');
        
        console.log('Current Values:');
        console.log(`  Temperature: ${temperature}°C`);
        console.log(`  Pressure: ${pressure} PSI`);
        console.log(`  System Status: ${status ? 'Online' : 'Offline'}`);
        
        // Write to a tag (if not read-only)
        try {
          await connector.writeTag('Temperature', 75.0);
          console.log('Successfully set temperature to 75.0°C');
        } catch (error) {
          console.log('Could not write to temperature tag (may be read-only)');
        }
        
        // Get connection health
        const health = await globalEtherNetIPUniversalManager.getConnectionHealth('plc_production_1');
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
    console.log('Setting up EtherNet/IP event handling...');
    
    // Subscribe to connection events
    globalEventBus.subscribe('ethernetip:connected', (data) => {
      console.log(`🔗 EtherNet/IP Connected: ${data.config.name} (${data.config.endpoint})`);
    });
    
    globalEventBus.subscribe('ethernetip:disconnected', (data) => {
      console.log(`🔌 EtherNet/IP Disconnected: ${data.config.name}`);
    });
    
    globalEventBus.subscribe('ethernetip:connection_failed', (data) => {
      console.error(`❌ EtherNet/IP Connection Failed: ${data.error}`);
    });
    
    // Subscribe to tag events
    globalEventBus.subscribe('ethernetip:tag:read', (data) => {
      console.log(`📖 Tag Read: ${data.message.tag} = ${data.message.value} (${data.message.quality})`);
    });
    
    globalEventBus.subscribe('ethernetip:tag:written', (data) => {
      console.log(`✏️  Tag Written: ${data.message.tag} = ${data.message.value}`);
    });
    
    globalEventBus.subscribe('ethernetip:tag:read_failed', (data) => {
      console.error(`❌ Tag Read Failed: ${data.tag} - ${data.error}`);
    });
    
    // Subscribe to manager events
    globalEventBus.subscribe('ethernetip.manager.connection.created', (data) => {
      console.log(`➕ Connection Created: ${data.connectionId}`);
    });
    
    globalEventBus.subscribe('ethernetip.manager.connection.removed', (data) => {
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
    await globalEtherNetIPUniversalManager.enableAllConnections();
    
    // Wait a moment for connections to establish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get updated summaries
    const summaries = await globalEtherNetIPUniversalManager.getConnectionSummaries();
    const enabledCount = summaries.filter(s => s.enabled).length;
    console.log(`Enabled ${enabledCount} out of ${summaries.length} connections`);
    
    // Disable all connections
    console.log('Disabling all connections...');
    await globalEtherNetIPUniversalManager.disableAllConnections();
    
    console.log('Bulk operations completed');
  }
  
  /**
   * Example 6: Data export and import
   */
  async exportAndImportData(): Promise<void> {
    console.log('Exporting and importing connection data...');
    
    // Export data for a specific connection
    const exportData = await globalEtherNetIPUniversalManager.exportConnectionData('plc_production_1');
    console.log('Exported Data Structure:', {
      connectionId: exportData.connectionId,
      config: {
        name: exportData.config.name,
        endpoint: exportData.config.endpoint,
        tagCount: exportData.tags.length
      },
      messageCount: exportData.messages.length,
      exportTimestamp: exportData.exportTimestamp
    });
    
    // Simulate importing the data (in real scenario, this would come from external source)
    try {
      const importedConnector = await globalEtherNetIPUniversalManager.importConnection(exportData);
      console.log(`Successfully imported connection: ${importedConnector.getConfig().name}`);
      
      // Clean up the imported connection
      await globalEtherNetIPUniversalManager.removeConnection(exportData.connectionId);
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
    const cleanedCount = await globalEtherNetIPUniversalManager.cleanupOldMessages(7);
    console.log(`Cleaned up ${cleanedCount} old messages`);
    
    // Get updated storage statistics
    const stats = await globalEtherNetIPUniversalManager.getStorageStats();
    console.log('Updated Storage Statistics:', stats);
  }
  
  /**
   * Example 8: Error handling and validation
   */
  async demonstrateErrorHandling(): Promise<void> {
    console.log('Demonstrating error handling...');
    
    // Try to create an invalid configuration
    const invalidConfig: Partial<EtherNetIPConfig> = {
      id: '',
      name: '',
      host: 'invalid-host',
      port: 99999
    };
    
    const validation = EtherNetIPUtils.validateConfig(invalidConfig);
    if (!validation.isValid) {
      console.log('Configuration validation failed:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Try to create a connection with invalid config
    try {
      const connector = await globalEtherNetIPUniversalManager.createConnectionFromTemplate({
        ...invalidConfig,
        slot: 0,
        timeout: 5000,
        scanRate: 1000,
        enabled: false,
        tags: []
      } as EtherNetIPConnectionTemplate);
      
      console.log('Unexpected: Invalid connection was created');
      
    } catch (error) {
      console.log('Expected error caught:', error.message);
    }
  }
  
  /**
   * Run all examples
   */
  async runAllExamples(): Promise<void> {
    console.log('🚀 Starting EtherNet/IP Universal Integration Examples\n');
    
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
      
      console.log('\n✅ All examples completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Examples failed:', error);
    }
  }
}

// Export for use in other modules
export default EtherNetIPUniversalIntegrationExample;

// Example usage:
/*
import EtherNetIPUniversalIntegrationExample from './UniversalIntegrationExample';

const example = new EtherNetIPUniversalIntegrationExample();
example.runAllExamples();
*/
