# EtherNet/IP Protocol - Universal Integration

This EtherNet/IP protocol implementation is production-ready for the universal integration system, using IndexedDB for all data persistence with easy migration to backend APIs.

## Features

- ✅ **No Hardcoded Data** - All configuration loaded from IndexedDB
- ✅ **Full IndexedDB Integration** - All data persists locally
- ✅ **Easy Backend Migration** - Simple export/import for backend APIs
- ✅ **Multiple Connection Support** - Manage multiple EtherNet/IP devices
- ✅ **Production Ready** - Comprehensive error handling and validation
- ✅ **Universal Integration** - Works seamlessly with the universal integration system

## Quick Start

### 1. Create a New Connection

```typescript
import { 
  globalEtherNetIPUniversalManager, 
  EtherNetIPUtils 
} from '@/services/ethernetip/EtherNetIPConnector';

// Create a minimal configuration
const config = EtherNetIPUtils.createMinimalConfig(
  'plc_001',
  'Production Line 1 PLC',
  '192.168.1.100',
  44818
);

// Create the connection
const connector = await globalEtherNetIPUniversalManager.createConnectionFromTemplate({
  ...config,
  enabled: true,
  description: 'Main production line controller'
});
```

### 2. Connect and Read Tags

```typescript
// Connect to the device
const connected = await connector.connect();
if (connected) {
  console.log('Connected to EtherNet/IP device');
  
  // Read a tag
  const temperature = await connector.readTag('Temperature');
  console.log('Temperature:', temperature);
  
  // Write to a tag
  await connector.writeTag('SetPoint', 75.5);
}
```

### 3. Monitor Connection Status

```typescript
// Get all connection statuses
const statuses = await globalEtherNetIPUniversalManager.getAllConnectionStatuses();
statuses.forEach(status => {
  console.log(`${status.name}: ${status.status}`);
  console.log(`Messages/sec: ${status.metrics.messagesPerSecond}`);
});
```

## Universal Integration Usage

### Connection Management

```typescript
// Get connection summaries for dashboard
const summaries = await globalEtherNetIPUniversalManager.getConnectionSummaries();

// Bulk operations
await globalEtherNetIPUniversalManager.enableAllConnections();
await globalEtherNetIPUniversalManager.disableAllConnections();

// Health monitoring
const health = await globalEtherNetIPUniversalManager.getConnectionHealth('plc_001');
```

### Data Export/Import

```typescript
// Export connection data for backend migration
const exportData = await globalEtherNetIPUniversalManager.exportConnectionData('plc_001');

// Import connection from external source
const importedConnector = await globalEtherNetIPUniversalManager.importConnection(exportData);
```

### Storage Management

```typescript
// Cleanup old messages (keep last 30 days)
const cleanedCount = await globalEtherNetIPUniversalManager.cleanupOldMessages(30);

// Get storage statistics
const stats = await globalEtherNetIPUniversalManager.getStorageStats();
console.log(`Total connections: ${stats.totalConnections}`);
```

## Configuration Management

### Default Configuration Template

```typescript
import { DEFAULT_ETHERNETIP_CONFIG } from '@/services/ethernetip/EtherNetIPConnector';

const config = {
  ...DEFAULT_ETHERNETIP_CONFIG,
  id: 'custom_plc',
  name: 'Custom PLC',
  host: '10.0.0.50',
  port: 44818,
  enabled: true
};
```

### Tag Configuration

```typescript
const tags = [
  {
    name: 'ProcessTemp',
    address: 'N7:10',
    dataType: 'REAL',
    readOnly: false,
    description: 'Process temperature setpoint',
    scaling: {
      rawMin: 0,
      rawMax: 100,
      scaledMin: 0,
      scaledMax: 100
    }
  },
  {
    name: 'SystemStatus',
    address: 'B3:5',
    dataType: 'BOOL',
    readOnly: true,
    description: 'System operational status'
  }
];
```

## Validation and Error Handling

### Configuration Validation

```typescript
import { EtherNetIPUtils } from '@/services/ethernetip/EtherNetIPConnector';

const validation = EtherNetIPUtils.validateConfig(config);
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

The EtherNet/IP connector integrates with the global event bus:

```typescript
import { globalEventBus } from '@/services/events/EventBus';

// Subscribe to connection events
globalEventBus.subscribe('ethernetip:connected', (data) => {
  console.log('EtherNet/IP connected:', data.config.name);
});

// Subscribe to tag events
globalEventBus.subscribe('ethernetip:tag:read', (data) => {
  console.log('Tag read:', data.message.tag, data.message.value);
});
```

## Backend Migration

When ready to migrate to backend APIs:

```typescript
// Export all connection data
const migrations = await globalEtherNetIPUniversalManager.migrateAllToBackend();

// Send to backend
for (const migration of migrations) {
  await fetch('/api/ethernetip/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(migration)
  });
}
```

## Production Considerations

### Performance
- Tag scanning rate should be appropriate for your application
- Use connection pooling for multiple devices
- Implement proper error retry logic

### Security
- Validate all tag addresses before use
- Implement proper authentication for write operations
- Use secure connections when possible

### Monitoring
- Monitor connection health regularly
- Track message rates and quality
- Set up alerts for connection failures

### Data Retention
- Configure appropriate message retention periods
- Implement data archiving for long-term storage
- Monitor storage usage

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check network connectivity
   - Verify IP address and port
   - Check firewall settings

2. **Tag Read Failures**
   - Verify tag addresses
   - Check data types
   - Ensure tags are configured

3. **Performance Issues**
   - Reduce scan rate
   - Optimize tag selection
   - Check network latency

### Debug Mode

```typescript
// Enable debug logging
const connector = await globalEtherNetIPUniversalManager.getConnection('plc_001');
if (connector) {
  // Subscribe to all events for debugging
  globalEventBus.subscribe('ethernetip:*', (data) => {
    console.log('EtherNet/IP Debug:', data);
  });
}
```

## API Reference

### EtherNetIPConnector

- `connect(): Promise<boolean>` - Connect to device
- `disconnect(): Promise<boolean>` - Disconnect from device
- `readTag(tagName: string): Promise<any>` - Read tag value
- `writeTag(tagName: string, value: any): Promise<void>` - Write tag value
- `getStatus(): ConnectionStatus` - Get connection status
- `getMetrics(): Promise<EtherNetIPMetrics>` - Get performance metrics

### EtherNetIPUniversalManager

- `createConnectionFromTemplate(template): Promise<EtherNetIPConnector>`
- `getAllConnectionStatuses(): Promise<EtherNetIPConnectionStatus[]>`
- `getConnectionSummaries(): Promise<EtherNetIPConnectionSummary[]>`
- `enableAllConnections(): Promise<void>`
- `disableAllConnections(): Promise<void>`
- `getConnectionHealth(id): Promise<any>`
- `exportConnectionData(id): Promise<any>`
- `importConnection(data): Promise<EtherNetIPConnector>`

### EtherNetIPUtils

- `validateConfig(config): { isValid: boolean; errors: string[] }`
- `generateDefaultTags(): EtherNetIPTag[]`
- `createMinimalConfig(id, name, host, port): EtherNetIPConfig`
- `formatEndpoint(host, port): string`
- `parseEndpoint(endpoint): { host: string; port: number } | null`

## Examples

See the `examples/` directory for complete working examples of:
- Basic connection setup
- Tag reading and writing
- Event handling
- Configuration management
- Error handling
- Backend migration
