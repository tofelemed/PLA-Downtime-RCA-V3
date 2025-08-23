# Universal Connector IndexedDB Implementation

## Overview

The Universal Connector module now includes comprehensive IndexedDB persistence for all streaming data, sources, sinks, processors, and configurations. This implementation is designed to be easily replaceable with backend APIs later.

## Architecture

### 1. Storage Layer (`UniversalConnectorDB.ts`)
- **Direct IndexedDB operations** with proper object stores and indexes
- **Fallback storage** for environments where IndexedDB is not available
- **Comprehensive CRUD operations** for all connector entities
- **Bulk operations** for easy data migration

### 2. Service Layer (`UniversalConnectorService.ts`)
- **Abstraction layer** between business logic and storage
- **Easy backend API replacement** - just change the storage type
- **Consistent interface** regardless of storage backend
- **Migration utilities** for future backend integration

### 3. Demo Data (`DemoDataSeeder.ts`)
- **Sample data population** for demonstration purposes
- **Realistic configurations** for various connector types
- **Automatic seeding** on first use

## Data Models

### DataSourceStorage
```typescript
interface DataSourceStorage {
  id: string;
  name: string;
  connectorType: string; // 'ModbusConnector', 'MQTTConnector', etc.
  config: any; // Connector-specific configuration
  enabled: boolean;
  lastData?: any;
  lastUpdate?: Date;
  errorCount: number;
  status: 'active' | 'inactive' | 'error' | 'connecting';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### DataSinkStorage
```typescript
interface DataSinkStorage {
  id: string;
  name: string;
  type: string; // 'event_bus', 'database', 'websocket', etc.
  config: Record<string, any>;
  enabled: boolean;
  lastWrite?: Date;
  writeCount: number;
  errorCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### StreamProcessorStorage
```typescript
interface StreamProcessorStorage {
  id: string;
  name: string;
  type: string; // 'filter', 'transform', 'aggregate', etc.
  config: Record<string, any>;
  enabled: boolean;
  order: number;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### StreamMetricsStorage
```typescript
interface StreamMetricsStorage {
  id: string;
  timestamp: Date;
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  averageLatency: number;
  throughput: number;
  activeSources: number;
  activeSinks: number;
  activeProcessors: number;
  errorRate: number;
  dataQuality: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    validity: number;
    consistency: number;
    lastUpdated: Date;
  };
}
```

### StreamAlertStorage
```typescript
interface StreamAlertStorage {
  id: string;
  type: 'warning' | 'error' | 'critical' | 'info';
  message: string;
  timestamp: Date;
  source: string;
  severity: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### ConnectionConfigStorage
```typescript
interface ConnectionConfigStorage {
  id: string;
  name: string;
  type: string; // 'modbus', 'mqtt', 'websocket', 'pi', 'database'
  config: any;
  enabled: boolean;
  lastConnection?: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  errorCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

## Usage Examples

### Basic Operations

```typescript
import { globalUniversalConnectorService } from '@/services/storage/UniversalConnectorService';

// Initialize the service
await globalUniversalConnectorService.initialize();

// Save a data source
const source: DataSourceStorage = {
  id: 'modbus_plc_1',
  name: 'Production Line PLC',
  connectorType: 'ModbusConnector',
  config: {
    host: '192.168.1.100',
    port: 502,
    slaveId: 1
  },
  enabled: true,
  errorCount: 0,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
};

await globalUniversalConnectorService.saveDataSource(source);

// Get all data sources
const sources = await globalUniversalConnectorService.getAllDataSources();

// Get data source by ID
const source = await globalUniversalConnectorService.getDataSource('modbus_plc_1');

// Delete a data source
await globalUniversalConnectorService.deleteDataSource('modbus_plc_1');
```

### Demo Data Seeding

```typescript
import { globalDemoDataSeeder } from '@/services/storage/DemoDataSeeder';

// Seed demo data (only if not already present)
await globalDemoDataSeeder.seedIfNeeded();

// Clear all demo data
await globalDemoDataSeeder.clearDemoData();

// Reset demo data (clear and reseed)
await globalDemoDataSeeder.resetDemoData();
```

### Bulk Operations

```typescript
// Export all data for migration
const allData = await globalUniversalConnectorService.exportAllData();

// Import data from another source
await globalUniversalConnectorService.importAllData(allData);
```

## Database Schema

### Object Stores

1. **dataSources** - Data source configurations and status
   - Indexes: connectorType, status, enabled, createdAt

2. **dataSinks** - Data sink configurations and status
   - Indexes: type, enabled, createdAt

3. **streamProcessors** - Stream processing configurations
   - Indexes: type, enabled, order, createdAt

4. **streamMetrics** - Performance and quality metrics
   - Indexes: timestamp, source

5. **streamAlerts** - System alerts and notifications
   - Indexes: type, source, acknowledged, timestamp

6. **connectionConfigs** - Connection configurations
   - Indexes: type, enabled, connectionStatus, createdAt

## Migration to Backend APIs

### Current Implementation
```typescript
// Current: Uses IndexedDB
const sources = await globalUniversalConnectorService.getAllDataSources();
```

### Future Backend Implementation
```typescript
// Future: Will use backend APIs
// The service layer will automatically switch to backend mode
// based on configuration or environment variables

// This will become:
const sources = await fetch('/api/data-sources').then(r => r.json());
```

### Migration Process
1. **Export data** from IndexedDB using `exportAllData()`
2. **Send data** to backend using migration endpoints
3. **Verify migration** success
4. **Switch storage type** to 'backend'
5. **Update configuration** to point to backend URLs

## Configuration Options

### ConnectorStorageConfig
```typescript
interface ConnectorStorageConfig {
  dbName?: string;           // Default: 'ProActUniversalConnectorDB'
  version?: number;          // Default: 1
  maxStorageSize?: number;   // Default: 100MB
  enableCompression?: boolean; // Default: false
  enableEncryption?: boolean;  // Default: false
}
```

### Environment Variables
```bash
# Future: Backend API configuration
REACT_APP_STORAGE_TYPE=backend
REACT_APP_BACKEND_URL=https://api.proact.com
REACT_APP_API_KEY=your_api_key_here
```

## Performance Considerations

### IndexedDB Benefits
- **Fast local access** - No network latency
- **Large storage capacity** - Up to 100MB+ per origin
- **Offline capability** - Works without internet
- **Real-time updates** - Immediate data persistence

### Fallback Storage
- **Memory-based storage** when IndexedDB unavailable
- **Automatic detection** of storage capabilities
- **Graceful degradation** for older browsers

### Data Cleanup
- **Automatic cleanup** of old metrics (configurable age)
- **Alert retention** - Acknowledged alerts kept for 7 days
- **Storage monitoring** - Track database size and performance

## Error Handling

### Storage Errors
```typescript
try {
  await globalUniversalConnectorService.saveDataSource(source);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Handle storage quota exceeded
    await globalUniversalConnectorService.cleanupOldData();
  } else {
    // Handle other storage errors
    console.error('Storage error:', error);
  }
}
```

### Fallback Behavior
- **Automatic fallback** to memory storage if IndexedDB fails
- **Error logging** for debugging storage issues
- **Graceful degradation** to maintain application functionality

## Testing

### Unit Tests
```typescript
// Test storage operations
describe('UniversalConnectorService', () => {
  it('should save and retrieve data sources', async () => {
    const service = new UniversalConnectorService();
    await service.initialize();
    
    const source = createTestDataSource();
    await service.saveDataSource(source);
    
    const retrieved = await service.getDataSource(source.id);
    expect(retrieved).toEqual(source);
  });
});
```

### Integration Tests
```typescript
// Test with real IndexedDB
describe('UniversalConnectorDB Integration', () => {
  it('should persist data across sessions', async () => {
    const db = new UniversalConnectorDB();
    await db.initialize();
    
    // Save data
    await db.saveDataSource(testSource);
    
    // Destroy and recreate
    await db.destroy();
    const newDb = new UniversalConnectorDB();
    await newDb.initialize();
    
    // Verify data persistence
    const retrieved = await newDb.getDataSource(testSource.id);
    expect(retrieved).toBeDefined();
  });
});
```

## Future Enhancements

### Planned Features
1. **Backend API integration** - Replace IndexedDB with REST APIs
2. **Data synchronization** - Sync local and remote data
3. **Compression** - Reduce storage footprint
4. **Encryption** - Secure sensitive configuration data
5. **Real-time sync** - WebSocket-based live updates
6. **Multi-tenant support** - Organization-based data isolation

### Migration Tools
1. **Data export/import** utilities
2. **Schema migration** scripts
3. **Backend connectivity** testers
4. **Performance comparison** tools

## Troubleshooting

### Common Issues

#### IndexedDB Not Available
```typescript
// Check storage type
const storageType = globalUniversalConnectorService.getStorageType();
console.log('Current storage:', storageType); // 'indexeddb', 'fallback', or 'backend'
```

#### Storage Quota Exceeded
```typescript
// Clean up old data
await globalUniversalConnectorService.cleanup();

// Check storage size
const size = await globalUniversalConnectorDB.getStorageSize();
console.log('Storage size:', size, 'MB');
```

#### Data Not Persisting
```typescript
// Ensure service is initialized
await globalUniversalConnectorService.initialize();

// Check for errors in console
// Verify IndexedDB permissions in browser
```

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('debug', 'universal-connector:*');

// Check browser console for detailed logs
```

## Conclusion

The Universal Connector IndexedDB implementation provides:

1. **Comprehensive persistence** for all connector data
2. **Easy migration path** to backend APIs
3. **Robust error handling** and fallback mechanisms
4. **Performance optimization** for local data access
5. **Future-proof architecture** for enterprise deployment

This implementation ensures that your universal connector module can start with local storage and seamlessly transition to backend APIs when needed, without changing the application code.
