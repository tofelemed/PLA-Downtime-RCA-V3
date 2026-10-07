// Database Connector - Multi-database support (SQL, NoSQL, Time Series)
// This can be easily replaced with backend services later

import { 
  IConnector, 
  ConnectionConfig, 
  ConnectionStatus, 
  StreamConfig, 
  TransformConfig, 
  FilterConfig 
} from '../integrations/base/IConnector';
import { BaseConnector } from '../integrations/base/BaseConnector';
import { globalEventBus } from '../events/EventBus';
import { UniversalConnectorDB } from '../storage/UniversalConnectorDB';

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' | 'mongodb' | 'influxdb' | 'timescaledb' | 'clickhouse';

export interface DatabaseOptions {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionPool?: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
  timezone?: string;
  charset?: string;
  collation?: string;
  // MongoDB specific
  authSource?: string;
  authMechanism?: string;
  // InfluxDB specific
  retentionPolicy?: string;
  precision?: 'n' | 'u' | 'ms' | 's' | 'm' | 'h';
  // Time series specific
  timeColumn?: string;
  valueColumn?: string;
  tagColumns?: string[];
}

export interface DatabaseQuery {
  sql?: string;
  collection?: string; // For NoSQL
  aggregation?: any[]; // For MongoDB
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  offset?: number;
  fields?: string[];
  groupBy?: string[];
  having?: Record<string, any>;
  parameters?: any[];
  cache?: boolean;
  ttl?: number;
}

export interface DatabaseResult {
  data: any[];
  count: number;
  affectedRows?: number;
  insertId?: string | number;
  metadata?: {
    columns?: Array<{ name: string; type: string; nullable: boolean }>;
    executionTime?: number;
    cached?: boolean;
  };
}

export interface DatabaseMetrics {
  queries: number;
  inserts: number;
  updates: number;
  deletes: number;
  errors: number;
  lastQuery?: Date;
  lastInsert?: Date;
  lastUpdate?: Date;
  lastDelete?: Date;
  averageResponseTime: number;
  connectionUptime: number;
  activeConnections: number;
  poolSize: number;
}

export interface DatabaseSubscription {
  id: string;
  query: DatabaseQuery;
  callback: (data: any) => void;
  active: boolean;
  interval: number;
  lastExecution?: Date;
  executionCount: number;
}

export class DatabaseConnector extends BaseConnector implements IConnector {
  private dbClient: any = null;
  private dbOptions: DatabaseOptions;
  private activeSubscriptions: Map<string, DatabaseSubscription> = new Map();
  protected transforms: TransformConfig[] = [];
  protected filters: FilterConfig[] = [];
  private connectionStartTime: number = 0;
  private connectionPool: any[] = [];
  private maxPoolSize: number = 10;
  private streamingActive: boolean = false;
  private queryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private db: UniversalConnectorDB;

  constructor(config: ConnectionConfig, dbOptions: DatabaseOptions) {
    super(config);
    
    this.dbOptions = {
      connectionPool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      },
      timezone: 'UTC',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      ...dbOptions
    };

    this.maxPoolSize = this.dbOptions.connectionPool?.max || 10;
    this.metrics = {
      queries: 0,
      inserts: 0,
      updates: 0,
      deletes: 0,
      errors: 0,
      averageResponseTime: 0,
      connectionUptime: 0,
      activeConnections: 0,
      poolSize: 0
    };

    this.db = new UniversalConnectorDB();
  }

  // Abstract method implementations
  protected async performConnect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to ${this.dbOptions.type} database: ${this.dbOptions.host}:${this.dbOptions.port}/${this.dbOptions.database}`);
      
      // Store connection in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'database',
        config: { ...this.config, dbOptions: this.dbOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'connecting',
        errorCount: 0,
        metadata: {
          databaseType: this.dbOptions.type,
          host: this.dbOptions.host,
          port: this.dbOptions.port,
          database: this.dbOptions.database,
          protocol: 'Database'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful connection
      this.dbClient = {
        connected: true,
        query: this.simulateQuery.bind(this),
        execute: this.simulateExecute.bind(this),
        beginTransaction: this.simulateBeginTransaction.bind(this),
        commit: this.simulateCommit.bind(this),
        rollback: this.simulateRollback.bind(this),
        disconnect: this.simulateDisconnect.bind(this)
      };

      this.connectionStartTime = Date.now();
      this.metrics.activeConnections = 1;
      this.metrics.poolSize = 1;
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'database',
        config: { ...this.config, dbOptions: this.dbOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'connected',
        errorCount: 0,
        metadata: {
          databaseType: this.dbOptions.type,
          host: this.dbOptions.host,
          port: this.dbOptions.port,
          database: this.dbOptions.database,
          protocol: 'Database'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Connected to ${this.dbOptions.type} database: ${this.dbOptions.host}:${this.dbOptions.port}/${this.dbOptions.database}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to ${this.dbOptions.type} database:`, error);
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'database',
        config: { ...this.config, dbOptions: this.dbOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'error',
        errorCount: 1,
        metadata: {
          databaseType: this.dbOptions.type,
          host: this.dbOptions.host,
          port: this.dbOptions.port,
          database: this.dbOptions.database,
          protocol: 'Database'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return false;
    }
  }

  protected async performDisconnect(): Promise<boolean> {
    try {
      if (this.dbClient) {
        await this.dbClient.disconnect();
        this.dbClient = null;
      }
      
      // Stop all streaming
      await this.stopStreaming();
      
      // Clear connection pool
      this.connectionPool = [];
      this.metrics.activeConnections = 0;
      this.metrics.poolSize = 0;
      
      // Update connection status in IndexedDB
      await this.db.saveConnectionConfig({
        id: this.config.id,
        name: this.config.name,
        type: 'database',
        config: { ...this.config, dbOptions: this.dbOptions },
        enabled: this.config.enabled,
        lastConnection: new Date(),
        connectionStatus: 'disconnected',
        errorCount: this.metrics.errors,
        metadata: {
          databaseType: this.dbOptions.type,
          host: this.dbOptions.host,
          port: this.dbOptions.port,
          database: this.dbOptions.database,
          protocol: 'Database'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`🔌 Disconnected from ${this.dbOptions.type} database: ${this.dbOptions.host}:${this.dbOptions.port}/${this.dbOptions.database}`);
      return true;
    } catch (error) {
      console.error(`❌ Error disconnecting from ${this.dbOptions.type} database:`, error);
      return false;
    }
  }

  protected async performRead(path: string, options?: Record<string, any>): Promise<any> {
    const query: DatabaseQuery = {
      sql: `SELECT * FROM ${path}`,
      limit: options?.limit || 100,
      offset: options?.offset || 0
    };

    if (options?.fields) {
      query.fields = options.fields;
      query.sql = `SELECT ${options.fields.join(', ')} FROM ${path}`;
    }

    if (options?.filter) {
      query.filter = options.filter;
      // Add WHERE clause logic here
    }

    return this.executeQuery(query);
  }

  protected async performWrite(path: string, data: any, options?: Record<string, any>): Promise<void> {
    const operation = options?.operation || 'insert';
    
    if (operation === 'insert') {
      await this.insert(path, data);
    } else if (operation === 'update') {
      await this.update(path, data, options?.where);
    } else if (operation === 'delete') {
      await this.delete(path, options?.where);
    }
  }

  protected async performQuery(query: string, options?: Record<string, any>): Promise<any[]> {
    const dbQuery: DatabaseQuery = {
      sql: query,
      parameters: options?.parameters || [],
      limit: options?.limit,
      offset: options?.offset
    };

    const result = await this.executeQuery(dbQuery);
    return result.data;
  }

  // Database specific methods

  async executeQuery(query: DatabaseQuery): Promise<DatabaseResult> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    
    try {
      let result: DatabaseResult;

      if (this.dbOptions.type === 'mongodb') {
        result = await this.executeMongoQuery(query);
      } else {
        result = await this.dbClient.query(query.sql, query.parameters);
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics('query', responseTime);
      
      // Cache result if TTL is specified
      if (query.cache && query.ttl) {
        const cacheKey = this.generateCacheKey(query);
        this.queryCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl: query.ttl
        });
      }

      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async insert(table: string, data: Record<string, any>): Promise<DatabaseResult> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    
    try {
      let result: DatabaseResult;

      if (this.dbOptions.type === 'mongodb') {
        result = await this.executeMongoInsert(table, data);
      } else {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        result = await this.dbClient.execute(sql, values);
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics('insert', responseTime);
      
      globalEventBus.publish('database.insert.completed', {
        table,
        data,
        result,
        timestamp: new Date(),
        connectorId: this.config.id
      });

      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async update(table: string, data: Record<string, any>, where?: Record<string, any>): Promise<DatabaseResult> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    
    try {
      let result: DatabaseResult;

      if (this.dbOptions.type === 'mongodb') {
        result = await this.executeMongoUpdate(table, data, where);
      } else {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const whereClause = where ? Object.keys(where).map(key => `${key} = ?`).join(' AND ') : '1=1';
        
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        const parameters = [...Object.values(data), ...(where ? Object.values(where) : [])];
        
        result = await this.dbClient.execute(sql, parameters);
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics('update', responseTime);
      
      globalEventBus.publish('database.update.completed', {
        table,
        data,
        where,
        result,
        timestamp: new Date(),
        connectorId: this.config.id
      });

      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async delete(table: string, where?: Record<string, any>): Promise<DatabaseResult> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    
    try {
      let result: DatabaseResult;

      if (this.dbOptions.type === 'mongodb') {
        result = await this.executeMongoDelete(table, where);
      } else {
        const whereClause = where ? Object.keys(where).map(key => `${key} = ?`).join(' AND ') : '1=1';
        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        const parameters = where ? Object.values(where) : [];
        
        result = await this.dbClient.execute(sql, parameters);
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics('delete', responseTime);
      
      globalEventBus.publish('database.delete.completed', {
        table,
        where,
        result,
        timestamp: new Date(),
        connectorId: this.config.id
      });

      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async beginTransaction(): Promise<void> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    await this.dbClient.beginTransaction();
    
    globalEventBus.publish('database.transaction.started', {
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  async commit(): Promise<void> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    await this.dbClient.commit();
    
    globalEventBus.publish('database.transaction.committed', {
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  async rollback(): Promise<void> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    await this.dbClient.rollback();
    
    globalEventBus.publish('database.transaction.rolledback', {
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  async subscribe(topic: string, callback: (data: any) => void): Promise<string> {
    // Convert topic to DatabaseQuery for internal use
    const query: DatabaseQuery = {
      sql: topic,
      limit: 100,
      offset: 0
    };
    
    const options = {
      interval: 5000,
      cache: false,
      ttl: 300000
    };
    const subscriptionId = `db_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: DatabaseSubscription = {
      id: subscriptionId,
      query,
      callback,
      active: true,
      interval: options?.interval || 5000,
      executionCount: 0
    };

    this.activeSubscriptions.set(subscriptionId, subscription);

    // Start periodic execution
    const interval = setInterval(async () => {
      if (subscription.active) {
        try {
          const result = await this.executeQuery(query);
          subscription.callback(result.data);
          subscription.lastExecution = new Date();
          subscription.executionCount++;
        } catch (error) {
          console.error(`Error in database subscription ${subscriptionId}:`, error);
        }
      } else {
        clearInterval(interval);
      }
    }, subscription.interval);

    console.log(`📡 Created database subscription: ${subscriptionId} (interval: ${subscription.interval}ms)`);
    
    globalEventBus.publish('database.subscription.created', {
      subscriptionId,
      query,
      timestamp: new Date(),
      connectorId: this.config.id
    });

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.activeSubscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    subscription.active = false;
    this.activeSubscriptions.delete(subscriptionId);

    console.log(`🔌 Removed database subscription: ${subscriptionId}`);
    
    globalEventBus.publish('database.subscription.removed', {
      subscriptionId,
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  async getTableInfo(table: string): Promise<any> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    try {
      if (this.dbOptions.type === 'mongodb') {
        // MongoDB collection info
        return {
          name: table,
          type: 'collection',
          count: await this.executeQuery({ collection: table, limit: 1 }).then(r => r.count),
          indexes: [], // Would need to implement index listing
          stats: {} // Would need to implement collection stats
        };
      } else {
        // SQL table info
        const columnsQuery = `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA 
                             FROM INFORMATION_SCHEMA.COLUMNS 
                             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`;
        
        const columns = await this.dbClient.query(columnsQuery, [this.dbOptions.database, table]);
        
        return {
          name: table,
          type: 'table',
          columns: columns.data || [],
          rowCount: await this.executeQuery({ sql: `SELECT COUNT(*) as count FROM ${table}` }).then(r => r.data[0]?.count)
        };
      }
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async getDatabaseInfo(): Promise<any> {
    if (!this.dbClient) {
      throw new Error('Not connected to database');
    }

    try {
      if (this.dbOptions.type === 'mongodb') {
        return {
          name: this.dbOptions.database,
          type: 'mongodb',
          collections: [], // Would need to implement collection listing
          stats: {} // Would need to implement database stats
        };
      } else {
        const tablesQuery = `SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH 
                            FROM INFORMATION_SCHEMA.TABLES 
                            WHERE TABLE_SCHEMA = ?`;
        
        const tables = await this.dbClient.query(tablesQuery, [this.dbOptions.database]);
        
        return {
          name: this.dbOptions.database,
          type: this.dbOptions.type,
          tables: tables.data || [],
          size: tables.data?.reduce((acc: number, table: any) => acc + (table.DATA_LENGTH || 0) + (table.INDEX_LENGTH || 0), 0) || 0
        };
      }
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // Transform pipeline
  async addTransform(transform: TransformConfig): Promise<void> {
    this.transforms.push(transform);
    this.transforms.sort((a, b) => a.order - b.order);
    
    // Store transform in IndexedDB
    await this.db.saveStreamProcessor({
      id: transform.id,
      name: transform.name,
      type: transform.type,
      config: transform.config,
      enabled: transform.enabled,
      order: transform.order,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'Database' },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`🔧 Added database transform: ${transform.name}`);
  }

  async removeTransform(transformId: string): Promise<void> {
    this.transforms = this.transforms.filter(t => t.id !== transformId);
    
    // Remove transform from IndexedDB
    await this.db.deleteStreamProcessor(transformId);
    
    console.log(`🗑️ Removed database transform: ${transformId}`);
  }

  getTransforms(): TransformConfig[] {
    return [...this.transforms];
  }

  // Filter pipeline
  async addFilter(filter: FilterConfig): Promise<void> {
    this.filters.push(filter);
    this.filters.sort((a, b) => a.order - b.order);
    
    // Store filter in IndexedDB
    await this.db.saveStreamProcessor({
      id: filter.id,
      name: filter.name,
      type: filter.type,
      config: filter.config,
      enabled: filter.enabled,
      order: filter.order,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'Database', isFilter: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`🔍 Added database filter: ${filter.name}`);
  }

  async removeFilter(filterId: string): Promise<void> {
    this.filters = this.filters.filter(f => f.id !== filterId);
    
    // Remove filter from IndexedDB
    await this.db.deleteStreamProcessor(filterId);
    
    console.log(`🗑️ Removed database filter: ${filterId}`);
  }

  getFilters(): FilterConfig[] {
    return [...this.filters];
  }

  // Streaming support
  async startStreaming(config: StreamConfig): Promise<void> {
    if (this.isStreaming) {
      throw new Error('Streaming is already active');
    }

    if (!this.isConnected()) {
      throw new Error('Not connected to database');
    }

    this.streamingActive = true;
    console.log(`🚀 Starting database streaming for ${this.config.name}`);

    // Store streaming config in IndexedDB using stream processor
    await this.db.saveStreamProcessor({
      id: `${this.config.id}_stream`,
      name: `Database Stream ${this.config.name}`,
      type: 'stream',
      config,
      enabled: true,
      order: 0,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'Database', isStream: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    globalEventBus.publish('database.streaming.started', {
      connectorId: this.config.id,
      connectorName: this.config.name,
      timestamp: new Date()
    });
  }

  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    this.streamingActive = false;
    console.log(`🛑 Stopped database streaming for ${this.config.name}`);

    // Update streaming status in IndexedDB
    await this.db.saveStreamProcessor({
      id: `${this.config.id}_stream`,
      name: `Database Stream ${this.config.name}`,
      type: 'stream',
      config: { enabled: false },
      enabled: false,
      order: 0,
      inputSchema: {},
      outputSchema: {},
      metadata: { protocol: 'Database', isStream: true },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    globalEventBus.publish('database.streaming.stopped', {
      connectorId: this.config.id,
      connectorName: this.config.name,
      timestamp: new Date()
    });
  }

  isStreaming(): boolean {
    return this.streamingActive;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions.keys());
  }

  // Metrics and health
  async getMetrics(): Promise<Record<string, any>> {
    this.metrics.connectionUptime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
    
    // Store metrics in IndexedDB
    await this.db.saveStreamMetrics({
      id: `${this.config.id}_metrics_${Date.now()}`,
      timestamp: new Date(),
      totalEvents: this.metrics.queries + this.metrics.inserts + this.metrics.updates + this.metrics.deletes,
      processedEvents: this.metrics.queries + this.metrics.inserts + this.metrics.updates + this.metrics.deletes,
      droppedEvents: 0,
      averageLatency: this.metrics.averageResponseTime,
      throughput: (this.metrics.queries + this.metrics.inserts + this.metrics.updates + this.metrics.deletes) / Math.max(this.metrics.connectionUptime / 1000, 1),
      activeSources: 1,
      activeSinks: 0,
      activeProcessors: this.transforms.length + this.filters.length,
      errorRate: this.metrics.errors / Math.max(this.metrics.queries + this.metrics.inserts + this.metrics.updates + this.metrics.deletes, 1),
      dataQuality: {
        completeness: 100 - (this.metrics.errors / Math.max(this.metrics.queries + this.metrics.inserts + this.metrics.updates + this.metrics.deletes, 1)) * 100,
        accuracy: 100 - (this.metrics.errors / Math.max(this.metrics.queries + this.metrics.inserts + this.metrics.updates + this.metrics.deletes, 1)) * 100,
        timeliness: this.metrics.averageResponseTime,
        validity: 100,
        consistency: 100,
        lastUpdated: new Date()
      }
    });
    
    return {
      ...this.metrics,
      transforms: this.transforms.length,
      filters: this.filters.length,
      activeSubscriptions: this.activeSubscriptions.size,
      isStreaming: this.isStreaming,
      cacheSize: this.queryCache.size
    };
  }

  async getHealth(): Promise<Record<string, any>> {
    const baseHealth = await super.getHealth();
    
    return {
      ...baseHealth,
      database: {
        type: this.dbOptions.type,
        host: this.dbOptions.host,
        port: this.dbOptions.port,
        database: this.dbOptions.database,
        activeConnections: this.metrics.activeConnections,
        poolSize: this.metrics.poolSize,
        isStreaming: this.isStreaming,
        connectionUptime: this.metrics.connectionUptime
      }
    };
  }

  // Protected methods

  protected updateMetrics(operation: 'query' | 'insert' | 'update' | 'delete', responseTime: number): void {
    switch (operation) {
      case 'query':
        this.metrics.queries++;
        this.metrics.lastQuery = new Date();
        break;
      case 'insert':
        this.metrics.inserts++;
        this.metrics.lastInsert = new Date();
        break;
      case 'update':
        this.metrics.updates++;
        this.metrics.lastUpdate = new Date();
        break;
      case 'delete':
        this.metrics.deletes++;
        this.metrics.lastDelete = new Date();
        break;
    }

    // Update average response time
    const totalOperations = this.metrics.queries + this.metrics.inserts + this.metrics.updates + this.metrics.deletes;
    const totalTime = this.metrics.averageResponseTime * (totalOperations - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / totalOperations;
  }

  private handleError(error: any): void {
    this.metrics.errors++;
    this.status.errorCount++;
    this.status.lastError = error?.message || 'Unknown database error';
    
    // Store error in IndexedDB
    this.db.saveStreamAlert({
      id: `${this.config.id}_error_${Date.now()}`,
      type: 'error',
      message: error?.message || 'Unknown database error',
      timestamp: new Date(),
      source: this.config.name,
      severity: 3,
      acknowledged: false,
      metadata: { protocol: 'Database', connectorId: this.config.id },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('database.error', {
      error: error?.message || error,
      timestamp: new Date(),
      connectorId: this.config.id
    });
  }

  private generateCacheKey(query: DatabaseQuery): string {
    return JSON.stringify(query);
  }

  private async executeMongoQuery(query: DatabaseQuery): Promise<DatabaseResult> {
    // Simulate MongoDB query execution
    const mockData = Array.from({ length: Math.floor(Math.random() * 100) + 1 }, (_, i) => ({
      id: i + 1,
      name: `Document ${i + 1}`,
      value: Math.random() * 1000,
      timestamp: new Date(Date.now() - Math.random() * 86400000)
    }));

    return {
      data: mockData,
      count: mockData.length,
      metadata: {
        executionTime: Math.random() * 100,
        cached: false
      }
    };
  }

  private async executeMongoInsert(collection: string, data: Record<string, any>): Promise<DatabaseResult> {
    // Simulate MongoDB insert
    return {
      data: [],
      count: 0,
      affectedRows: 1,
      insertId: Math.random().toString(36).substr(2, 9)
    };
  }

  private async executeMongoUpdate(collection: string, data: Record<string, any>, where?: Record<string, any>): Promise<DatabaseResult> {
    // Simulate MongoDB update
    return {
      data: [],
      count: 0,
      affectedRows: Math.floor(Math.random() * 10) + 1
    };
  }

  private async executeMongoDelete(collection: string, where?: Record<string, any>): Promise<DatabaseResult> {
    // Simulate MongoDB delete
    return {
      data: [],
      count: 0,
      affectedRows: Math.floor(Math.random() * 5) + 1
    };
  }

  // Simulation methods for development/testing
  private async simulateQuery(sql: string, parameters?: any[]): Promise<DatabaseResult> {
    console.log(`📖 Simulated database query: ${sql}`);
    
    // Simulate query execution delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Generate mock data based on query type
    let mockData: any[] = [];
    let count = 0;
    
    if (sql.toLowerCase().includes('select')) {
      count = Math.floor(Math.random() * 100) + 1;
      mockData = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Record ${i + 1}`,
        value: Math.random() * 1000,
        timestamp: new Date(Date.now() - Math.random() * 86400000)
      }));
    } else if (sql.toLowerCase().includes('count')) {
      count = Math.floor(Math.random() * 1000) + 100;
      mockData = [{ count }];
    }

    return {
      data: mockData,
      count,
      metadata: {
        executionTime: Math.random() * 100,
        cached: false
      }
    };
  }

  private async simulateExecute(sql: string, parameters?: any[]): Promise<DatabaseResult> {
    console.log(`✏️ Simulated database execute: ${sql}`);
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
    
    return {
      data: [],
      count: 0,
      affectedRows: Math.floor(Math.random() * 10) + 1,
      insertId: Math.random().toString(36).substr(2, 9)
    };
  }

  private async simulateBeginTransaction(): Promise<void> {
    console.log(`🔄 Simulated database transaction begin`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async simulateCommit(): Promise<void> {
    console.log(`✅ Simulated database transaction commit`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async simulateRollback(): Promise<void> {
    console.log(`❌ Simulated database transaction rollback`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async simulateDisconnect(): Promise<void> {
    console.log(`🔌 Simulated database disconnect`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// Database Universal Manager with bulk operations
export class DatabaseUniversalManager {
  private connections: Map<string, DatabaseConnector> = new Map();
  private db: UniversalConnectorDB;

  constructor() {
    this.db = new UniversalConnectorDB();
  }

  // Create and manage connections
  async createConnection(id: string, config: ConnectionConfig, options: DatabaseOptions): Promise<DatabaseConnector> {
    const connector = new DatabaseConnector(config, options);
    this.connections.set(id, connector);
    
    // Store in IndexedDB
    await this.db.saveConnectionConfig({
      id,
      name: config.name,
      type: 'database',
      config: { ...config, dbOptions: options },
      enabled: config.enabled,
      lastConnection: undefined,
      connectionStatus: 'disconnected',
      errorCount: 0,
      metadata: {
        databaseType: options.type,
        host: options.host,
        port: options.port,
        database: options.database,
        protocol: 'Database'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    globalEventBus.publish('database.manager.connection.created', { 
      connectionId: id,
      config,
      options,
      timestamp: new Date()
    });
    
    return connector;
  }

  async getConnection(id: string): Promise<DatabaseConnector | undefined> {
    return this.connections.get(id);
  }

  async removeConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(id);
      
      // Remove from IndexedDB
      await this.db.deleteConnectionConfig(id);
      
      globalEventBus.publish('database.manager.connection.removed', { 
        connectionId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    return false;
  }

  async getAllConnections(): Promise<Map<string, DatabaseConnector>> {
    return new Map(this.connections);
  }

  // Bulk operations
  async bulkConnect(connectionIds: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      connectionIds.map(async (id) => {
        const connection = this.connections.get(id);
        if (connection) {
          try {
            results[id] = await connection.connect();
          } catch (error) {
            results[id] = false;
            console.error(`Failed to connect ${id}:`, error);
          }
        } else {
          results[id] = false;
        }
      })
    );
    
    return results;
  }

  async bulkDisconnect(connectionIds: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      connectionIds.map(async (id) => {
        const connection = this.connections.get(id);
        if (connection) {
          try {
            results[id] = await connection.disconnect();
          } catch (error) {
            results[id] = false;
            console.error(`Failed to disconnect ${id}:`, error);
          }
        } else {
          results[id] = false;
        }
      })
    );
    
    return results;
  }

  async bulkRead(operations: Array<{ connectionId: string; path: string; options?: Record<string, any> }>): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    await Promise.all(
      operations.map(async (op) => {
        const connection = this.connections.get(op.connectionId);
        if (connection && connection.isConnected()) {
          try {
            results[op.connectionId] = await connection.read(op.path, op.options);
          } catch (error) {
            results[op.connectionId] = { error: error instanceof Error ? error.message : 'Unknown error' };
          }
        } else {
          results[op.connectionId] = { error: 'Connection not available' };
        }
      })
    );
    
    return results;
  }

  async bulkWrite(operations: Array<{ connectionId: string; path: string; data: any; options?: Record<string, any> }>): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      operations.map(async (op) => {
        const connection = this.connections.get(op.connectionId);
        if (connection && connection.isConnected()) {
          try {
            await connection.write(op.path, op.data, op.options);
            results[op.connectionId] = true;
          } catch (error) {
            results[op.connectionId] = false;
            console.error(`Failed to write to ${op.connectionId}:`, error);
          }
        } else {
          results[op.connectionId] = false;
        }
      })
    );
    
    return results;
  }

  // Health monitoring
  async getSystemHealth(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      try {
        health[id] = await connection.getHealth();
      } catch (error) {
        health[id] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    return health;
  }

  async getSystemMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      try {
        metrics[id] = await connection.getMetrics();
      } catch (error) {
        metrics[id] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    return metrics;
  }

  // Data persistence
  async exportConnections(): Promise<Record<string, any>> {
    const exportData: Record<string, any> = {};
    
    for (const [id, connection] of this.connections.entries()) {
      exportData[id] = {
        config: connection.getConfig(),
        status: connection.getStatus(),
        metrics: await connection.getMetrics(),
        health: await connection.getHealth()
      };
    }
    
    return exportData;
  }

  async importConnections(importData: Record<string, any>): Promise<void> {
    for (const [id, data] of Object.entries(importData)) {
      if (data.config && data.config.type === 'database') {
        const connector = new DatabaseConnector(data.config, data.config.dbOptions || {});
        this.connections.set(id, connector);
        
        // Store in IndexedDB
        await this.db.saveConnectionConfig({
          id,
          name: data.config.name,
          type: 'database',
          config: data.config,
          enabled: data.config.enabled,
          lastConnection: undefined,
          connectionStatus: 'disconnected',
          errorCount: 0,
          metadata: data.config.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  // Cleanup
  async destroy(): Promise<void> {
    for (const connection of this.connections.values()) {
      await connection.destroy();
    }
    this.connections.clear();
  }
}

// Global database universal manager instance
export const globalDatabaseUniversalManager = new DatabaseUniversalManager();
