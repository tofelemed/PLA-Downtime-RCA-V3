// Storage Services Index
// Export all storage-related services and utilities

export { 
  UniversalConnectorDB, 
  globalUniversalConnectorDB,
  type ConnectorStorageConfig,
  type DataSourceStorage,
  type DataSinkStorage,
  type StreamProcessorStorage,
  type StreamMetricsStorage,
  type StreamAlertStorage,
  type ConnectionConfigStorage
} from './UniversalConnectorDB';

export { 
  UniversalConnectorService, 
  globalUniversalConnectorService,
  type IUniversalConnectorService
} from './UniversalConnectorService';

export { 
  DemoDataSeeder, 
  globalDemoDataSeeder 
} from './DemoDataSeeder';

// Re-export existing storage services
export { 
  HistorianHistoryDB, 
  globalHistorianHistoryDB 
} from '../historian/providers/HistorianHistoryDB';
