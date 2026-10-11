# Profinet Protocol - Universal Integration

This Profinet protocol implementation is production-ready for the universal integration system, using IndexedDB for all data persistence with easy migration to backend APIs.

## Features

- ✅ **No Hardcoded Data** - All configuration loaded from IndexedDB
- ✅ **Full IndexedDB Integration** - All data persists locally
- ✅ **Easy Backend Migration** - Simple export/import for backend APIs
- ✅ **Multiple Connection Support** - Manage multiple Profinet devices
- ✅ **Production Ready** - Comprehensive error handling and validation
- ✅ **Universal Integration** - Works seamlessly with the universal integration system
- ✅ **Heartbeat Monitoring** - Built-in device health monitoring
- ✅ **Block-based Architecture** - Supports DB, M, I, Q, PIW, PQW block types

## Quick Start

### 1. Create a New Connection

```typescript
import { 
  globalProfinetUniversalManager, 
  ProfinetUtils 
} from '@/services/profinet/ProfinetConnector';

// Create a minimal configuration
const config = ProfinetUtils.createMinimalConfig(
  'plc_001',
  'Production Line 1 PLC',
  '192.168.1.100',
  102,
  'PLC001'
);

// Create the connection
const connector = await globalProfinetUniversalManager.createConnectionFromTemplate({
  ...config,
  enabled: true,
  description: 'Main production line controller',
  rack: 0,
  slot: 2
});
```

### 2. Connect and Read Blocks

```typescript
// Connect to the device
const connected = await connector.connect();
if (connected) {
  console.log('Connected to Profinet device');
  
  // Read a block
  const temperature = await connector.readBlock('Temperature_DB');
  console.log('Temperature:', temperature);
  
  // Write to a block
  await connector.writeBlock('SetPoint_DB', 75.5);
}
```

### 3. Monitor Connection Status

```typescript
// Get all connection statuses
const statuses = await globalProfinetUniversalManager.getAllConnectionStatuses();
statuses.forEach(status => {
  console.log(`${status.name}: ${status.status}`);
  console.log(`Messages/sec: ${status.metrics.messagesPerSecond}`);
  console.log(`Device Status: ${status.metrics.deviceStatus}`);
});
```

## Universal Integration Usage

### Connection Management

```typescript
// Get connection summaries for dashboard
const summaries = await globalProfinetUniversalManager.getConnectionSummaries();

// Bulk operations
await globalProfinetUniversalManager.enableAllConnections();
await globalProfinetUniversalManager.disableAllConnections();

// Health monitoring
const health = await globalProfinetUniversalManager.getConnectionHealth('plc_001');
```

### Data Export/Import

```typescript
// Export connection data for backend migration
const exportData = await globalProfinetUniversalManager.exportConnectionData('plc_001');

// Import connection from external source
const importedConnector = await globalProfinetUniversalManager.importConnection(exportData);
```

### Storage Management

```typescript
// Cleanup old messages (keep last 30 days)
const cleanedCount = await globalProfinetUniversalManager.cleanupOldMessages(30);

// Get storage statistics
const stats = await globalProfinetUniversalManager.getStorageStats();
console.log(`Total connections: ${stats.totalConnections}`);
console.log(`Total blocks: ${stats.totalBlocks}`);
```

## Configuration Management

### Default Configuration Template

```typescript
import { DEFAULT_PROFINET_CONFIG } from '@/services/profinet/ProfinetConnector';

const config = {
  ...DEFAULT_PROFINET_CONFIG,
  id: 'custom_plc',
  name: 'Custom PLC',
  host: '10.0.0.50',
  port: 102,
  deviceId: 'PLC002',
  enabled: true
};
```

### Block Configuration

```typescript
const blocks = [
  {
    name: 'ProcessTemp_DB',
    number: 10,
    type: 'DB',
    dataType: 'REAL',
    readOnly: false,
    description: 'Process temperature setpoint',
    offset: 0,
    length: 4,
    scaling: {
      rawMin: 0,
      rawMax: 100,
      scaledMin: 0,
      scaledMax: 100
    }
  },
  {
    name: 'SystemStatus_I',
    number: 0,
    type: 'I',
    dataType: 'BOOL',
    readOnly: true,
    description: 'System operational status',
    offset: 0,
    length: 1
  }
];
```

## Block Types and Data Types

### Supported Block Types

- **DB** - Data Block (read/write)
- **M** - Memory (read/write)
- **I** - Input (read-only)
- **Q** - Output (read/write)
- **PIW** - Process Input Word (read-only)
- **PQW** - Process Output Word (read/write)

### Supported Data Types

- **BOOL** - Boolean (true/false)
- **BYTE** - 8-bit unsigned integer
- **CHAR** - Character
- **WORD** - 16-bit unsigned integer
- **INT** - 16-bit signed integer
- **DWORD** - 32-bit unsigned integer
- **DINT** - 32-bit signed integer
- **LWORD** - 64-bit unsigned integer
- **LINT** - 64-bit signed integer
- **REAL** - 32-bit floating point
- **LREAL** - 64-bit floating point
- **STRING** - String
- **TIME** - Time duration
- **DATE** - Date
- **TIME_OF_DAY** - Time of day

## Validation and Error Handling

### Configuration Validation

```typescript
import { ProfinetUtils } from '@/services/profinet/ProfinetConnector';

const validation = ProfinetUtils.validateConfig(config);
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
  return;
}
```

### Error Handling

```typescript
try {
  await connector.connect();
} catch (error) {
  console.error('Connection failed:', error.message);
  
  // Check connection status
  const status = connector.getStatus();
  if (status.errorCount > 0) {
    console.log(`Error count: ${status.errorCount}`);
    console.log(`Last error: ${status.lastError}`);
  }
}
```

## Event System Integration

The Profinet connector integrates with the global event bus:

```typescript
import { globalEventBus } from '@/services/events/EventBus';

// Subscribe to connection events
globalEventBus.subscribe('profinet:connected', (data) => {
  console.log('Profinet connected:', data.config.name);
});

// Subscribe to block events
globalEventBus.subscribe('profinet:block:read', (data) => {
  console.log('Block read:', data.message.block, data.message.value);
});

// Subscribe to heartbeat events
globalEventBus.subscribe('profinet:heartbeat', (data) => {
  console.log('Device heartbeat:', data.deviceStatus);
});
```

## Heartbeat Monitoring

The Profinet connector includes built-in heartbeat monitoring:

```typescript
// Heartbeat is automatically started when connecting
// It runs every 30 seconds by default

// Check device status
const metrics = await connector.getMetrics();
console.log('Device Status:', metrics.deviceStatus);

// Subscribe to heartbeat events
globalEventBus.subscribe('profinet:heartbeat', (data) => {
  if (data.deviceStatus === 'error') {
    console.warn('Device heartbeat failed');
  }
});
```

## Backend Migration

When ready to migrate to backend APIs:

```typescript
// Export all connection data
const migrations = await globalProfinetUniversalManager.migrateAllToBackend();

// Send to backend
for (const migration of migrations) {
  await fetch('/api/profinet/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(migration)
  });
}
```

## Production Considerations

### Performance
- Block scanning rate should be appropriate for your application
- Use connection pooling for multiple devices
- Implement proper error retry logic
- Monitor heartbeat frequency

### Security
- Validate all block addresses before use
- Implement proper authentication for write operations
- Use secure connections when possible
- Monitor device status changes

### Monitoring
- Monitor connection health regularly
- Track message rates and quality
- Set up alerts for connection failures
- Monitor heartbeat failures

### Data Retention
- Configure appropriate message retention periods
- Implement data archiving for long-term storage
- Monitor storage usage
- Clean up old messages periodically

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check network connectivity
   - Verify IP address and port
   - Check firewall settings
   - Verify device ID and rack/slot configuration

2. **Block Read Failures**
   - Verify block names and numbers
   - Check data types
   - Ensure blocks are configured
   - Verify offset and length values

3. **Heartbeat Failures**
   - Check device network stability
   - Verify device configuration
   - Check for network congestion
   - Monitor device status

4. **Performance Issues**
   - Reduce scan rate
   - Optimize block selection
   - Check network latency
   - Monitor device response times

### Debug Mode

```typescript
// Enable debug logging
const connector = await globalProfinetUniversalManager.getConnection('plc_001');
if (connector) {
  // Subscribe to all events for debugging
  globalEventBus.subscribe('profinet:*', (data) => {
    console.log('Profinet Debug:', data);
  });
}
```

## API Reference

### ProfinetConnector

- `connect(): Promise<boolean>` - Connect to device
- `disconnect(): Promise<boolean>` - Disconnect from device
- `readBlock(blockName: string): Promise<any>` - Read block value
- `writeBlock(blockName: string, value: any): Promise<void>` - Write block value
- `getStatus(): ConnectionStatus` - Get connection status
- `getMetrics(): Promise<ProfinetMetrics>` - Get performance metrics
- `getBlockList(): Promise<ProfinetBlock[]>` - Get configured blocks

### ProfinetUniversalManager

- `createConnectionFromTemplate(template): Promise<ProfinetConnector>`
- `getAllConnectionStatuses(): Promise<ProfinetConnectionStatus[]>`
- `getConnectionSummaries(): Promise<ProfinetConnectionSummary[]>`
- `enableAllConnections(): Promise<void>`
- `disableAllConnections(): Promise<void>`
- `getConnectionHealth(id): Promise<any>`
- `exportConnectionData(id): Promise<any>`
- `importConnection(data): Promise<ProfinetConnector>`

### ProfinetUtils

- `validateConfig(config): { isValid: boolean; errors: string[] }`
- `generateDefaultBlocks(): ProfinetBlock[]`
- `createMinimalConfig(id, name, host, port, deviceId): ProfinetConfig`
- `formatEndpoint(host, port): string`
- `parseEndpoint(endpoint): { host: string; port: number } | null`
