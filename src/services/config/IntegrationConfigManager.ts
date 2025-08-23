// Configuration Management Service for Universal Integration
// This can be easily replaced with backend services later

import { 
  ConnectionConfig, 
  StreamConfig, 
  TransformConfig, 
  FilterConfig,
  AuthenticationConfig 
} from '../integrations/base/IConnector';
import { globalEventBus } from '../events/EventBus';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: SystemType;
  enabled: boolean;
  connection: ConnectionConfig;
  streaming?: StreamConfig;
  transforms?: TransformConfig[];
  filters?: FilterConfig[];
  quality?: QualityConfig;
  metadata: MetadataConfig;
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

export interface SystemType {
  category: 'protocol' | 'database' | 'api' | 'historian' | 'scada' | 'custom';
  name: string;
  version?: string;
  vendor?: string;
}

export interface QualityConfig {
  minCompleteness: number;
  minAccuracy: number;
  minTimeliness: number;
  minValidity: number;
  minConsistency: number;
  alertThresholds: {
    warning: number;
    critical: number;
  };
}

export interface MetadataConfig {
  description?: string;
  tags: string[];
  environment: 'development' | 'staging' | 'production';
  owner?: string;
  department?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  maintenanceWindow?: string;
  documentation?: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  type: SystemType;
  template: Partial<IntegrationConfig>;
  tags: string[];
  usage: string;
}

export class IntegrationConfigManager {
  private configurations: Map<string, IntegrationConfig> = new Map();
  private templates: Map<string, ConfigTemplate> = new Map();
  private configHistory: Map<string, IntegrationConfig[]> = new Map();
  private validationRules: Map<string, (config: IntegrationConfig) => ConfigValidationResult> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeValidationRules();
    this.loadConfigurations();
  }

  // Configuration CRUD operations
  async createConfiguration(config: Omit<IntegrationConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<IntegrationConfig> {
    const id = this.generateConfigId();
    const now = new Date();
    
    const newConfig: IntegrationConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
      version: '1.0.0'
    };

    // Validate configuration
    const validation = await this.validateConfiguration(newConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    this.configurations.set(id, newConfig);
    this.saveConfigurations();
    
    // Emit configuration created event
    globalEventBus.publish('config.created', {
      config: newConfig,
      timestamp: now
    });

    console.log(`✅ Created configuration: ${newConfig.name} (${id})`);
    return newConfig;
  }

  async updateConfiguration(id: string, updates: Partial<IntegrationConfig>): Promise<IntegrationConfig> {
    const existingConfig = this.configurations.get(id);
    if (!existingConfig) {
      throw new Error(`Configuration not found: ${id}`);
    }

    const updatedConfig: IntegrationConfig = {
      ...existingConfig,
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: new Date(),
      version: this.incrementVersion(existingConfig.version)
    };

    // Validate updated configuration
    const validation = await this.validateConfiguration(updatedConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Store in history
    this.addToHistory(existingConfig);

    this.configurations.set(id, updatedConfig);
    this.saveConfigurations();
    
    // Emit configuration updated event
    globalEventBus.publish('config.updated', {
      oldConfig: existingConfig,
      newConfig: updatedConfig,
      timestamp: new Date()
    });

    console.log(`✅ Updated configuration: ${updatedConfig.name} (${id})`);
    return updatedConfig;
  }

  async deleteConfiguration(id: string): Promise<boolean> {
    const config = this.configurations.get(id);
    if (!config) {
      return false;
    }

    // Store in history before deletion
    this.addToHistory(config);

    this.configurations.delete(id);
    this.saveConfigurations();
    
    // Emit configuration deleted event
    globalEventBus.publish('config.deleted', {
      config,
      timestamp: new Date()
    });

    console.log(`🗑️ Deleted configuration: ${config.name} (${id})`);
    return true;
  }

  getConfiguration(id: string): IntegrationConfig | undefined {
    return this.configurations.get(id);
  }

  getAllConfigurations(): IntegrationConfig[] {
    return Array.from(this.configurations.values());
  }

  getConfigurationsByType(type: SystemType): IntegrationConfig[] {
    return Array.from(this.configurations.values()).filter(config => 
      config.type.category === type.category && config.type.name === type.name
    );
  }

  getEnabledConfigurations(): IntegrationConfig[] {
    return Array.from(this.configurations.values()).filter(config => config.enabled);
  }

  // Template management
  async createFromTemplate(templateId: string, overrides: Partial<IntegrationConfig> = {}): Promise<IntegrationConfig> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const baseConfig = template.template;
    const mergedConfig = this.mergeConfigurations(baseConfig, overrides);
    
    return this.createConfiguration(mergedConfig);
  }

  getTemplates(): ConfigTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByType(type: SystemType): ConfigTemplate[] {
    return Array.from(this.templates.values()).filter(template => 
      template.type.category === type.category && template.type.name === type.name
    );
  }

  // Configuration validation
  async validateConfiguration(config: IntegrationConfig): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Configuration name is required');
    }

    if (!config.connection || !config.connection.endpoint) {
      errors.push('Connection endpoint is required');
    }

    if (!config.type || !config.type.category || !config.type.name) {
      errors.push('System type is required');
    }

    // Connection validation
    if (config.connection) {
      const connectionValidation = this.validateConnection(config.connection);
      errors.push(...connectionValidation.errors);
      warnings.push(...connectionValidation.warnings);
    }

    // Authentication validation
    if (config.connection?.authentication) {
      const authValidation = this.validateAuthentication(config.connection.authentication);
      errors.push(...authValidation.errors);
      warnings.push(...authValidation.warnings);
    }

    // Streaming validation
    if (config.streaming) {
      const streamingValidation = this.validateStreaming(config.streaming);
      errors.push(...streamingValidation.errors);
      warnings.push(...streamingValidation.warnings);
    }

    // Type-specific validation
    const typeValidator = this.validationRules.get(`${config.type.category}.${config.type.name}`);
    if (typeValidator) {
      const typeValidation = typeValidator(config);
      errors.push(...typeValidation.errors);
      warnings.push(...typeValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Configuration import/export
  async exportConfiguration(id: string): Promise<string> {
    const config = this.configurations.get(id);
    if (!config) {
      throw new Error(`Configuration not found: ${id}`);
    }

    const exportData = {
      config,
      exportInfo: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        source: 'ProAct Universal Integration'
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importConfiguration(configData: string): Promise<IntegrationConfig> {
    try {
      const importData = JSON.parse(configData);
      const config = importData.config;

      // Validate imported configuration
      const validation = await this.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Invalid imported configuration: ${validation.errors.join(', ')}`);
      }

      // Generate new ID and timestamps
      const importedConfig: IntegrationConfig = {
        ...config,
        id: this.generateConfigId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      };

      return this.createConfiguration(importedConfig);
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Invalid format'}`);
    }
  }

  // Configuration history
  getConfigurationHistory(id: string): IntegrationConfig[] {
    return this.configHistory.get(id) || [];
  }

  async restoreConfiguration(id: string, versionIndex: number): Promise<IntegrationConfig> {
    const history = this.configHistory.get(id);
    if (!history || versionIndex < 0 || versionIndex >= history.length) {
      throw new Error('Invalid version index');
    }

    const oldConfig = history[versionIndex];
    const restoredConfig: IntegrationConfig = {
      ...oldConfig,
      id: this.generateConfigId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: this.incrementVersion(oldConfig.version)
    };

    return this.createConfiguration(restoredConfig);
  }

  // Utility methods
  private generateConfigId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const major = parseInt(parts[0]) || 1;
    const minor = parseInt(parts[1]) || 0;
    const patch = parseInt(parts[2]) || 0;
    
    return `${major}.${minor}.${patch + 1}`;
  }

  private addToHistory(config: IntegrationConfig): void {
    if (!this.configHistory.has(config.id)) {
      this.configHistory.set(config.id, []);
    }
    
    const history = this.configHistory.get(config.id)!;
    history.push({ ...config });
    
    // Keep only last 10 versions
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  private mergeConfigurations(base: Partial<IntegrationConfig>, overrides: Partial<IntegrationConfig>): Partial<IntegrationConfig> {
    return {
      ...base,
      ...overrides,
      connection: {
        ...base.connection,
        ...overrides.connection
      },
      streaming: overrides.streaming ? {
        ...base.streaming,
        ...overrides.streaming
      } : base.streaming,
      transforms: overrides.transforms || base.transforms,
      filters: overrides.filters || base.filters,
      quality: overrides.quality ? {
        ...base.quality,
        ...overrides.quality
      } : base.quality,
      metadata: {
        ...base.metadata,
        ...overrides.metadata
      }
    };
  }

  private validateConnection(connection: ConnectionConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!connection.endpoint) {
      errors.push('Connection endpoint is required');
    } else {
      try {
        new URL(connection.endpoint);
      } catch {
        errors.push('Invalid connection endpoint URL');
      }
    }

    if (connection.authentication?.type === 'basic' && (!connection.authentication.username || !connection.authentication.password)) {
      errors.push('Basic authentication requires username and password');
    }

    if (connection.authentication?.type === 'api-key' && !connection.authentication.apiKey) {
      errors.push('API key authentication requires API key');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateAuthentication(auth: AuthenticationConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (auth.type) {
      case 'oauth':
        if (!auth.clientId || !auth.clientSecret || !auth.tokenEndpoint) {
          errors.push('OAuth authentication requires client ID, client secret, and token endpoint');
        }
        break;
      case 'certificate':
        if (!auth.certificate || !auth.privateKey) {
          errors.push('Certificate authentication requires certificate and private key');
        }
        break;
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateStreaming(streaming: StreamConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (streaming.interval && streaming.interval < 100) {
      warnings.push('Streaming interval below 100ms may impact performance');
    }

    if (streaming.bufferSize && streaming.bufferSize > 100000) {
      warnings.push('Large buffer size may consume significant memory');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private initializeDefaultTemplates(): void {
    // MQTT Template
    this.templates.set('mqtt-basic', {
      id: 'mqtt-basic',
      name: 'Basic MQTT Connection',
      description: 'Standard MQTT broker connection with basic authentication',
      type: { category: 'protocol', name: 'mqtt', version: '3.1.1' },
      template: {
        type: { category: 'protocol', name: 'mqtt', version: '3.1.1' },
        enabled: false,
        connection: {
          id: '',
          name: '',
          type: 'mqtt',
          endpoint: 'mqtt://localhost:1883',
          enabled: false,
          authentication: {
            type: 'basic',
            username: '',
            password: ''
          }
        },
        streaming: {
          enabled: true,
          topics: ['sensors/+/data'],
          realTime: true,
          bufferSize: 1000
        },
        metadata: {
          tags: ['mqtt', 'iot', 'sensors'],
          environment: 'development',
          priority: 'medium'
        }
      },
      tags: ['mqtt', 'iot', 'sensors'],
      usage: 'Use for connecting to MQTT brokers for IoT sensor data collection'
    });

    // OPC UA Template
    this.templates.set('opcua-basic', {
      id: 'opcua-basic',
      name: 'Basic OPC UA Connection',
      description: 'Standard OPC UA server connection',
      type: { category: 'protocol', name: 'opcua', version: '1.04' },
      template: {
        type: { category: 'protocol', name: 'opcua', version: '1.04' },
        enabled: false,
        connection: {
          id: '',
          name: '',
          type: 'opcua',
          endpoint: 'opc.tcp://localhost:4840',
          enabled: false,
          authentication: {
            type: 'none'
          }
        },
        streaming: {
          enabled: true,
          topics: ['ns=2;s=Device1/Channel1'],
          realTime: true,
          bufferSize: 1000
        },
        metadata: {
          tags: ['opcua', 'industrial', 'automation'],
          environment: 'development',
          priority: 'medium'
        }
      },
      tags: ['opcua', 'industrial', 'automation'],
      usage: 'Use for connecting to OPC UA servers in industrial automation systems'
    });

    // REST API Template
    this.templates.set('restapi-basic', {
      id: 'restapi-basic',
      name: 'Basic REST API Connection',
      description: 'Standard REST API connection with authentication',
      type: { category: 'api', name: 'rest', version: '1.0' },
      template: {
        type: { category: 'api', name: 'rest', version: '1.0' },
        enabled: false,
        connection: {
          id: '',
          name: '',
          type: 'rest',
          endpoint: 'https://api.example.com',
          enabled: false,
          authentication: {
            type: 'api-key',
            apiKey: ''
          },
          customHeaders: {
            'Content-Type': 'application/json'
          }
        },
        metadata: {
          tags: ['rest', 'api', 'web'],
          environment: 'development',
          priority: 'medium'
        }
      },
      tags: ['rest', 'api', 'web'],
      usage: 'Use for connecting to REST APIs for data exchange'
    });
  }

  private initializeValidationRules(): void {
    // MQTT validation rules
    this.validationRules.set('protocol.mqtt', (config: IntegrationConfig) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (config.connection.endpoint && !config.connection.endpoint.startsWith('mqtt://')) {
        warnings.push('MQTT endpoint should use mqtt:// protocol');
      }

      if (config.streaming?.topics && config.streaming.topics.length === 0) {
        warnings.push('MQTT streaming should have at least one topic');
      }

      return { isValid: errors.length === 0, errors, warnings };
    });

    // OPC UA validation rules
    this.validationRules.set('protocol.opcua', (config: IntegrationConfig) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (config.connection.endpoint && !config.connection.endpoint.startsWith('opc.tcp://')) {
        warnings.push('OPC UA endpoint should use opc.tcp:// protocol');
      }

      return { isValid: errors.length === 0, errors, warnings };
    });
  }

  private loadConfigurations(): void {
    try {
      const stored = localStorage.getItem('proact-integration-configs');
      if (stored) {
        const configs = JSON.parse(stored);
        configs.forEach((config: IntegrationConfig) => {
          // Convert string dates back to Date objects
          config.createdAt = new Date(config.createdAt);
          config.updatedAt = new Date(config.updatedAt);
          this.configurations.set(config.id, config);
        });
        console.log(`📁 Loaded ${configs.length} configurations from storage`);
      }
    } catch (error) {
      console.warn('Failed to load configurations from storage:', error);
    }
  }

  private saveConfigurations(): void {
    try {
      const configs = Array.from(this.configurations.values());
      localStorage.setItem('proact-integration-configs', JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to save configurations to storage:', error);
    }
  }
}

// Export default instance
export const globalConfigManager = new IntegrationConfigManager();
export default globalConfigManager;
