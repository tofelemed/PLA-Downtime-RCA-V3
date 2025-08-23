# IndexedDB Implementation for Historian Query History

## Overview

The Enhanced Historian Page now uses IndexedDB instead of localStorage for persisting query history. This provides better performance, larger storage capacity, and improved data management capabilities.

## Architecture

### StorageService.ts

The `HistorianHistoryDB` class provides a unified interface for both IndexedDB and fallback storage:

```typescript
export class HistorianHistoryDB {
  private dbName = 'ProActHistorianDB';
  private version = 1;
  private db: IDBDatabase | null = null;
  private fallbackStorage: Map<string, any[]> = new Map();
  private useFallback = false;
}
```

### Key Features

1. **Automatic Fallback**: If IndexedDB is not available, the system automatically falls back to in-memory storage
2. **Tenant Isolation**: Each tenant's query history is stored separately
3. **Data Validation**: Imported data is validated and transformed to match the expected schema
4. **Storage Limits**: History is automatically limited to 20 entries per tenant
5. **Error Handling**: Comprehensive error handling with user-friendly notifications

## Database Schema

### Object Store: `queryHistory`

- **Key Path**: `id` (unique identifier)
- **Indexes**:
  - `tenantId`: For filtering by tenant
  - `timestamp`: For sorting by time

### Data Structure

```typescript
interface QueryHistoryEntry {
  id: string;
  timestamp: string;
  attributes: PIAttribute[];
  queryParams: any;
  resultCount: number;
  tenantId: string;
}
```

## API Methods

### Core Operations

- `saveQueryHistory(tenantId, history)`: Save complete history for a tenant
- `loadQueryHistory(tenantId)`: Load history for a tenant
- `addQueryHistoryEntry(tenantId, entry)`: Add a single entry
- `removeQueryHistoryEntry(id)`: Remove a specific entry
- `clearQueryHistory(tenantId)`: Clear all history for a tenant

### Import/Export

- `exportQueryHistory(tenantId)`: Export history as structured data
- `importQueryHistory(tenantId, data)`: Import history from external source

### Status

- `isIndexedDBAvailable()`: Check if IndexedDB is working
- `getStorageType()`: Get current storage method ('indexeddb' or 'fallback')

## Usage in EnhancedHistorianPage

### Initialization

```typescript
const historianDB = useMemo(() => new HistorianHistoryDB(), []);
```

### Loading History

```typescript
React.useEffect(() => {
  const loadHistory = async () => {
    const savedHistory = await loadQueryHistoryFromStorage();
    setQueryHistory(savedHistory);
  };
  loadHistory();
}, [tenantId]);
```

### Saving History

```typescript
const saveQueryHistoryToStorage = async (history) => {
  try {
    await historianDB.saveQueryHistory(tenantId, history);
  } catch (error) {
    console.warn('Failed to save query history to IndexedDB:', error);
    // Show user notification
  }
};
```

## Fallback Storage

When IndexedDB is not available, the system automatically switches to in-memory storage:

- **Storage**: Uses JavaScript Map for temporary storage
- **Persistence**: Data is lost on page refresh
- **Limitations**: Limited to current session
- **User Notification**: Shows "Limited Storage" badge

## Error Handling

### Common Scenarios

1. **IndexedDB Unavailable**: Automatically falls back to in-memory storage
2. **Storage Quota Exceeded**: Shows error notification to user
3. **Corrupted Data**: Validates imported data and filters invalid entries
4. **Network Issues**: Graceful degradation with user feedback

### User Notifications

- Success messages for successful operations
- Error messages for failed operations
- Warning messages for storage limitations
- Storage type indicator in the UI

## Performance Benefits

### IndexedDB vs localStorage

| Feature | IndexedDB | localStorage |
|---------|-----------|--------------|
| Storage Limit | ~50MB+ | ~5-10MB |
| Performance | Asynchronous, non-blocking | Synchronous, blocking |
| Data Types | Structured objects | Strings only |
| Indexing | Yes, for fast queries | No |
| Transactions | Yes, ACID compliant | No |

### Query Performance

- **Fast Retrieval**: Indexed queries by tenant and timestamp
- **Efficient Updates**: Transaction-based operations
- **Memory Management**: Automatic cleanup of old entries

## Browser Compatibility

### Supported Browsers

- Chrome 23+
- Firefox 16+
- Safari 10+
- Edge 12+

### Fallback Support

- Internet Explorer 10+ (with fallback)
- Older browsers (with fallback)
- Private/Incognito modes (with fallback)

## Testing

### Test Coverage

The implementation includes comprehensive tests covering:

- Fallback storage functionality
- Data persistence and retrieval
- Import/export operations
- Error handling scenarios
- Storage type detection

### Running Tests

```bash
npm test StorageService.test.ts
```

## Migration from localStorage

### Automatic Migration

- No manual migration required
- Data is automatically loaded from IndexedDB on first use
- Fallback to localStorage if IndexedDB fails

### Data Preservation

- Existing localStorage data remains intact
- New queries are stored in IndexedDB
- Gradual migration as users interact with the system

## Future Enhancements

### Planned Features

1. **Data Compression**: Compress stored data for better space utilization
2. **Offline Sync**: Sync data when connection is restored
3. **Advanced Queries**: Support for complex query patterns
4. **Data Analytics**: Built-in analytics on query patterns
5. **Multi-Device Sync**: Share history across devices

### Performance Optimizations

1. **Lazy Loading**: Load history on demand
2. **Pagination**: Support for large history datasets
3. **Caching**: Intelligent caching strategies
4. **Background Cleanup**: Automatic cleanup of old data

## Troubleshooting

### Common Issues

1. **Storage Not Working**: Check browser IndexedDB support
2. **Data Loss**: Verify fallback storage is working
3. **Import Failures**: Check data format and validation
4. **Performance Issues**: Monitor storage size and cleanup

### Debug Information

The UI shows storage status:
- **Storage: IndexedDB**: Full functionality available
- **Storage: Fallback**: Limited functionality, data not persistent
- **Limited Storage**: Warning about storage limitations

## Conclusion

The IndexedDB implementation provides a robust, scalable solution for historian query history persistence while maintaining backward compatibility through fallback mechanisms. This ensures a consistent user experience across different browsers and environments.
