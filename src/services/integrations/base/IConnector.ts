// Base interface for all data source connectors
// This interface is designed to be implemented by both frontend and backend services

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
  errorCount: number;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface ConnectionConfig {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  enabled: boolean;
  authentication?: AuthenticationConfig;
  customHeaders?: Record<string, string>;
  options?: Record<string, any>;
}

export interface AuthenticationConfig {
  type: 'none' | 'basic' | 'api-key' | 'bearer' | 'oauth' | 'certificate';
  username?: string;
  password?: string;
  apiKey?: string;
  certificate?: string;
  privateKey?: string;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface DataQualityMetrics {
  completeness: number; // 0-100
  accuracy: number; // 0-100
  timeliness: number; // 0-100
  validity: number; // 0-100
  consistency: number; // 0-100
  lastUpdated: Date;
}

export interface StreamConfig {
  enabled: boolean;
  topics?: string[];
  interval?: number; // milliseconds
  realTime: boolean;
  bufferSize?: number;
  compression?: boolean;
}

export interface TransformConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
  order: number;
}

export interface FilterConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
  order: number;
}

export interface IConnector {
  // Basic connection management
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  isConnected(): boolean;
  getStatus(): ConnectionStatus;
  
  // Configuration management
  getConfig(): ConnectionConfig;
  updateConfig(config: Partial<ConnectionConfig>): Promise<void>;
  validateConfig(config: ConnectionConfig): Promise<boolean>;
  
  // Data operations
  read(path: string, options?: Record<string, any>): Promise<any>;
  write(path: string, data: any, options?: Record<string, any>): Promise<void>;
  query(query: string, options?: Record<string, any>): Promise<any[]>;
  
  // Streaming operations
  subscribe(topic: string, callback: (data: any) => void): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  publish(topic: string, data: any): Promise<void>;
  
  // Data quality and monitoring
  getDataQuality(): Promise<DataQualityMetrics>;
  getMetrics(): Promise<Record<string, any>>;
  getHealth(): Promise<Record<string, any>>;
  
  // Lifecycle management
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  reset(): Promise<void>;
}

// Extended interface for connectors that support real-time streaming
export interface IStreamingConnector extends IConnector {
  // Advanced streaming capabilities
  startStreaming(config: StreamConfig): Promise<void>;
  stopStreaming(): Promise<void>;
  isStreaming(): boolean;
  
  // Stream management
  getActiveStreams(): string[];
  pauseStream(streamId: string): Promise<void>;
  resumeStream(streamId: string): Promise<void>;
  
  // Data transformation pipeline
  addTransform(transform: TransformConfig): Promise<void>;
  removeTransform(transformId: string): Promise<void>;
  getTransforms(): TransformConfig[];
  
  // Filtering pipeline
  addFilter(filter: FilterConfig): Promise<void>;
  removeFilter(filterId: string): Promise<void>;
  getFilters(): FilterConfig[];
}

// Interface for connectors that support batch operations
export interface IBatchConnector extends IConnector {
  // Batch operations
  batchRead(paths: string[]): Promise<Record<string, any>>;
  batchWrite(operations: Array<{ path: string; data: any }>): Promise<void>;
  batchQuery(queries: string[]): Promise<any[][]>;
  
  // Batch configuration
  setBatchSize(size: number): void;
  getBatchSize(): number;
  setBatchTimeout(timeout: number): void;
  getBatchTimeout(): number;
}

// Interface for connectors that support historical data
export interface IHistoricalConnector extends IConnector {
  // Historical data operations
  readHistorical(
    path: string, 
    startTime: Date, 
    endTime: Date, 
    interval?: string
  ): Promise<any[]>;
  
  // Data aggregation
  aggregate(
    path: string,
    startTime: Date,
    endTime: Date,
    aggregation: 'min' | 'max' | 'avg' | 'sum' | 'count',
    interval: string
  ): Promise<any[]>;
  
  // Data compression
  compress(
    path: string,
    startTime: Date,
    endTime: Date,
    algorithm: 'linear' | 'swing' | 'deadband'
  ): Promise<void>;
}

// Interface for connectors that support alarms and events
export interface IAlarmConnector extends IConnector {
  // Alarm management
  getActiveAlarms(): Promise<any[]>;
  acknowledgeAlarm(alarmId: string, user: string): Promise<void>;
  clearAlarm(alarmId: string, user: string): Promise<void>;
  
  // Event management
  getEvents(
    startTime: Date,
    endTime: Date,
    severity?: string[]
  ): Promise<any[]>;
  
  // Alarm configuration
  setAlarmLimits(
    path: string,
    highLimit: number,
    lowLimit: number,
    deadband: number
  ): Promise<void>;
}

// Union type for all connector capabilities
export type ConnectorCapabilities = 
  | IConnector 
  | IStreamingConnector 
  | IBatchConnector 
  | IHistoricalConnector 
  | IAlarmConnector;

// Type guard functions to check connector capabilities
export function isStreamingConnector(connector: IConnector): connector is IStreamingConnector {
  return 'startStreaming' in connector && 'stopStreaming' in connector;
}

export function isBatchConnector(connector: IConnector): connector is IBatchConnector {
  return 'batchRead' in connector && 'batchWrite' in connector;
}

export function isHistoricalConnector(connector: IConnector): connector is IHistoricalConnector {
  return 'readHistorical' in connector && 'aggregate' in connector;
}

export function isAlarmConnector(connector: IConnector): connector is IAlarmConnector {
  return 'getActiveAlarms' in connector && 'acknowledgeAlarm' in connector;
}
