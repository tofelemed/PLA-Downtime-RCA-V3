# Universal Integration & Streaming Events

## 🎯 Overview

This document explains how to use the Universal Integration system's streaming events capabilities. The system is designed with a **frontend-first, backend-ready** architecture, allowing you to:

1. **Develop and test** streaming capabilities locally
2. **Easily migrate** to backend services when ready
3. **Maintain** the same interfaces and functionality

## 🏗️ Architecture

### **Core Components**

```
┌─────────────────────────────────────────────────────────────┐
│                    Universal Integration                    │
├─────────────────────────────────────────────────────────────┤
│  Event Bus     │  Stream Processor  │  Config Manager     │
│  (Real-time)   │  (Data Pipeline)   │  (Settings)         │
├─────────────────────────────────────────────────────────────┤
│                    Connection Manager                       │
│              (Orchestrates All Connectors)                 │
├─────────────────────────────────────────────────────────────┤
│  MQTT │  OPC UA │  REST API │  Database │  Custom         │
│  Connector │  Connector │  Connector │  Connector │  Connector │
└─────────────────────────────────────────────────────────────┘
```

### **Key Features**

- **Real-time Event Processing**: Handle thousands of events per second
- **Data Transformation Pipeline**: Transform, filter, and enrich data
- **Quality Monitoring**: Track data completeness, accuracy, and timeliness
- **Auto-reconnection**: Automatic recovery from connection failures
- **Health Monitoring**: Real-time health checks and alerting
- **Template System**: Pre-configured templates for common protocols

## 🚀 Quick Start

### **1. Basic Event Bus Usage**

```typescript
import { globalEventBus } from './services/events/EventBus';

// Subscribe to events
const subscription = globalEventBus.subscribe('sensors.temperature', (event) => {
  console.log('Temperature reading:', event.data);
});

// Publish events
await globalEventBus.publish('sensors.temperature', {
  value: 25.5,
  unit: 'C',
  timestamp: new Date()
});

// Unsubscribe when done
globalEventBus.unsubscribe(subscription.id);
```

### **2. Create MQTT Connection**

```typescript
import { globalConfigManager } from './services/config/IntegrationConfigManager';

// Create MQTT configuration from template
const mqttConfig = await globalConfigManager.createFromTemplate('mqtt-basic', {
  name: 'Factory Sensors',
  connection: {
    endpoint: 'mqtt://mqtt.example.com:1883',
    authentication: {
      type: 'basic',
      username: 'user',
      password: 'pass'
    }
  },
  streaming: {
    topics: ['factory/+/sensors/+'],
    realTime: true
  }
});
```

### **3. Stream Processing**

```typescript
import { globalStreamProcessor } from './services/streaming/StreamProcessor';

// Add data transformation
globalStreamProcessor.addTransform({
  id: 'temp-converter',
  name: 'Temperature Converter',
  type: 'payload',
  enabled: true,
  config: {
    operation: 'custom',
    condition: (data) => data.includes('temperature'),
    transform: (data) => {
      const parsed = JSON.parse(data);
      if (parsed.unit === 'C') {
        parsed.value = (parsed.value * 9/5) + 32;
        parsed.unit = 'F';
      }
      return JSON.stringify(parsed);
    }
  },
  order: 1
});

// Add data filter
globalStreamProcessor.addFilter({
  id: 'quality-filter',
  name: 'Quality Filter',
  type: 'data',
  enabled: true,
  config: {
    condition: {
      type: 'custom',
      validator: (data) => {
        try {
          JSON.parse(data);
          return true;
        } catch {
          return false;
        }
      }
    }
  },
  order: 1
});
```

### **4. Connection Management**

```typescript
import { globalConnectionManager } from './services/integrations/base/ConnectionManager';

// Initialize the connection manager
await globalConnectionManager.initialize();

// Get connection status
const status = globalConnectionManager.getConnectionStatus('config-id');

// Check health
const health = await globalConnectionManager.checkConnectionHealth('config-id');

// Get metrics
const metrics = globalConnectionManager.getMetrics();
```

## 📊 Data Flow

### **Event Processing Pipeline**

```
Raw Data → Filters → Transforms → Quality Check → Alerts → Output
   ↓           ↓         ↓           ↓          ↓        ↓
MQTT/OPC   Validation  Convert    Metrics   Warnings  Database
Message    Rules      Units      Check      Rules     Storage
```

### **Example: Temperature Sensor Data**

```typescript
// 1. Raw MQTT message arrives
const rawMessage = {
  topic: 'sensors/tank1/temperature',
  payload: '{"value": 25.5, "unit": "C"}'
};

// 2. Event is created
const event = {
  id: 'evt_123',
  timestamp: new Date(),
  source: 'mqtt',
  type: 'temperature',
  data: rawMessage.payload,
  quality: { completeness: 95, accuracy: 98, timeliness: 90, validity: 97, consistency: 96 }
};

// 3. Process through pipeline
const processedEvent = await globalStreamProcessor.processEvent(event);

// 4. Result includes:
// - Transformed data (Celsius to Fahrenheit)
// - Applied filters
// - Quality metrics
// - Any alerts
```

## 🔧 Configuration

### **Connection Types**

| Type | Protocol | Use Case | Template |
|------|----------|----------|----------|
| **MQTT** | MQTT 3.1.1 | IoT Sensors, Device Communication | `mqtt-basic` |
| **OPC UA** | OPC UA 1.04 | Industrial Automation | `opcua-basic` |
| **REST API** | HTTP/HTTPS | Web Services, External APIs | `restapi-basic` |
| **Database** | SQL/NoSQL | Data Storage, Analytics | Custom |
| **Custom** | Any | Specialized Protocols | Custom |

### **Streaming Configuration**

```typescript
const streamingConfig = {
  enabled: true,
  topics: ['sensors/+/data'],        // MQTT topic patterns
  interval: 100,                     // Polling interval (ms)
  realTime: true,                    // Real-time vs batch
  bufferSize: 1000,                  // Event buffer size
  compression: false                  // Enable compression
};
```

### **Quality Thresholds**

```typescript
const qualityConfig = {
  minCompleteness: 80,    // Minimum data completeness %
  minAccuracy: 90,         // Minimum data accuracy %
  minTimeliness: 95,       // Minimum data timeliness %
  minValidity: 85,         // Minimum data validity %
  minConsistency: 90,      // Minimum data consistency %
  alertThresholds: {
    warning: 70,            // Warning threshold %
    critical: 50            // Critical threshold %
  }
};
```

## 📈 Monitoring & Metrics

### **Event Bus Metrics**

```typescript
const eventMetrics = globalEventBus.getMetrics();
console.log('Events per second:', eventMetrics.eventsPerSecond);
console.log('Active subscriptions:', eventMetrics.activeSubscriptions);
console.log('Average latency:', eventMetrics.averageLatency);
```

### **Stream Processing Metrics**

```typescript
const streamMetrics = globalStreamProcessor.getMetrics();
console.log('Total events processed:', streamMetrics.processedEvents);
console.log('Events dropped:', streamMetrics.droppedEvents);
console.log('Throughput:', streamMetrics.throughput);
```

### **Connection Health**

```typescript
const healthChecks = await globalConnectionManager.getConnectionHealth();
healthChecks.forEach(health => {
  console.log(`Connection ${health.connectionId}:`);
  console.log(`  - Uptime: ${health.uptime}ms`);
  console.log(`  - Data Quality: ${health.dataQuality}%`);
  console.log(`  - Performance: ${health.performance}ms`);
  console.log(`  - Alerts: ${health.alerts.join(', ')}`);
});
```

## 🔄 Backend Migration

### **Migration Strategy**

The system is designed for easy migration to backend services:

#### **Phase 1: API Layer**
```typescript
// Replace local services with API clients
const eventBus = new RemoteEventBus('ws://backend:8080/events');
const configManager = new RemoteConfigManager('http://backend:8080/api/config');
const connectionManager = new RemoteConnectionManager('http://backend:8080/api/connections');
```

#### **Phase 2: Service Migration**
```typescript
// Move business logic to backend
// Frontend becomes thin client
class FrontendConnector implements IConnector {
  async connect(): Promise<boolean> {
    const response = await fetch('/api/connections/connect', {
      method: 'POST',
      body: JSON.stringify(this.config)
    });
    return response.ok;
  }
}
```

#### **Phase 3: Real-time Updates**
```typescript
// Switch to backend WebSocket
const backendSocket = new WebSocket('ws://backend:8080/streams');
backendSocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time updates from backend
};
```

### **Migration Checklist**

- [ ] All services implement backend-ready interfaces
- [ ] Configuration schemas are backend-compatible
- [ ] Event handling can switch between local and remote
- [ ] Data storage can migrate from IndexedDB to database
- [ ] Real-time connections can switch to backend WebSockets

## 🧪 Testing

### **Unit Testing**

```typescript
import { EventBus } from './services/events/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  test('should publish and subscribe to events', async () => {
    const receivedData: any[] = [];
    
    const subscription = eventBus.subscribe('test.topic', (event) => {
      receivedData.push(event.data);
    });

    await eventBus.publish('test.topic', { message: 'Hello' });
    
    expect(receivedData).toHaveLength(1);
    expect(receivedData[0]).toEqual({ message: 'Hello' });
    
    eventBus.unsubscribe(subscription.id);
  });
});
```

### **Integration Testing**

```typescript
describe('MQTT Integration', () => {
  test('should process MQTT messages through pipeline', async () => {
    const mqttConnector = new MQTTConnector(mockConfig);
    await mqttConnector.connect();
    
    const processedEvents: any[] = [];
    globalStreamProcessor.addTransform({
      id: 'test-transform',
      name: 'Test Transform',
      type: 'payload',
      enabled: true,
      config: { operation: 'uppercase' },
      order: 1
    });
    
    // Simulate message processing
    const event = createMockEvent();
    const processed = await globalStreamProcessor.processEvent(event);
    
    expect(processed).toBeDefined();
    expect(processed.transforms).toContain('Test Transform');
  });
});
```

## 🚨 Troubleshooting

### **Common Issues**

#### **Connection Failures**
```typescript
// Check connection status
const status = globalConnectionManager.getConnectionStatus('connection-id');
console.log('Connection status:', status);

// Check for errors
if (status.lastError) {
  console.error('Last error:', status.lastError);
  console.error('Error count:', status.errorCount);
}
```

#### **High Memory Usage**
```typescript
// Check buffer utilization
const bufferStatus = globalStreamProcessor.getBufferStatus();
console.log('Buffer utilization:', bufferStatus.utilization + '%');

// Clear if needed
if (bufferStatus.utilization > 90) {
  globalStreamProcessor.clearMetrics();
}
```

#### **Slow Processing**
```typescript
// Check processing metrics
const metrics = globalStreamProcessor.getMetrics();
console.log('Average processing time:', metrics.averageProcessingTime + 'ms');
console.log('Throughput:', metrics.throughput + ' events/sec');

// Optimize transforms and filters
const transforms = globalStreamProcessor.getTransforms();
transforms.forEach(t => console.log('Transform:', t.name, t.enabled));
```

### **Debug Mode**

```typescript
// Enable debug logging
const debugEventBus = new EventBus({
  enableMetrics: true,
  enableEventHistory: true
});

// Subscribe to system events
debugEventBus.subscribe('eventbus.error', (event) => {
  console.error('Event bus error:', event.data);
});

debugEventBus.subscribe('streaming.transform.error', (event) => {
  console.error('Transform error:', event.data);
});
```

## 📚 Examples

### **Complete IoT Sensor Integration**

```typescript
class IoTSensorIntegration {
  private mqttConnector: MQTTConnector;
  private eventSubscriptions: string[] = [];

  async start() {
    // 1. Create configuration
    const config = await globalConfigManager.createFromTemplate('mqtt-basic', {
      name: 'IoT Sensors',
      connection: {
        endpoint: 'mqtt://iot.example.com:1883',
        authentication: { type: 'basic', username: 'iot', password: 'secret' }
      },
      streaming: {
        topics: ['sensors/+/+/data'],
        realTime: true
      }
    });

    // 2. Create connection
    this.mqttConnector = await globalConnectionManager.createConnection(config);

    // 3. Setup data processing
    this.setupDataProcessing();

    // 4. Subscribe to events
    this.setupEventHandlers();

    console.log('IoT Sensor Integration started');
  }

  private setupDataProcessing() {
    // Temperature conversion
    globalStreamProcessor.addTransform({
      id: 'temp-converter',
      name: 'Temperature Converter',
      type: 'payload',
      enabled: true,
      config: {
        operation: 'custom',
        condition: (data) => data.includes('temperature'),
        transform: (data) => this.convertTemperature(data)
      },
      order: 1
    });

    // Quality filter
    globalStreamProcessor.addFilter({
      id: 'quality-filter',
      name: 'Quality Filter',
      type: 'data',
      enabled: true,
      config: {
        condition: {
          type: 'custom',
          validator: (data) => this.validateSensorData(data)
        }
      },
      order: 1
    });
  }

  private setupEventHandlers() {
    const events = [
      'mqtt.message.processed',
      'streaming.event.processed',
      'streaming.alert.raised'
    ];

    events.forEach(topic => {
      const subscription = globalEventBus.subscribe(topic, (event) => {
        this.handleEvent(event);
      });
      this.eventSubscriptions.push(subscription.id);
    });
  }

  private handleEvent(event: any) {
    switch (event.topic) {
      case 'mqtt.message.processed':
        console.log('MQTT message processed:', event.data);
        break;
      case 'streaming.event.processed':
        console.log('Event processed:', event.data);
        break;
      case 'streaming.alert.raised':
        console.warn('Alert raised:', event.data);
        break;
    }
  }

  private convertTemperature(data: string): string {
    try {
      const parsed = JSON.parse(data);
      if (parsed.unit === 'C') {
        parsed.value = (parsed.value * 9/5) + 32;
        parsed.unit = 'F';
      }
      return JSON.stringify(parsed);
    } catch {
      return data;
    }
  }

  private validateSensorData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return parsed.value !== undefined && 
             parsed.unit !== undefined && 
             parsed.timestamp !== undefined;
    } catch {
      return false;
    }
  }

  async stop() {
    // Cleanup
    this.eventSubscriptions.forEach(id => {
      globalEventBus.unsubscribe(id);
    });

    await globalConnectionManager.removeConnection(this.mqttConnector.getConfig().id);
    console.log('IoT Sensor Integration stopped');
  }
}

// Usage
const integration = new IoTSensorIntegration();
await integration.start();

// Run for some time...
setTimeout(async () => {
  await integration.stop();
}, 30000);
```

## 🔗 API Reference

### **Event Bus**

- `subscribe(topic: string, handler: EventHandler): Subscription`
- `unsubscribe(subscriptionId: string): boolean`
- `publish(topic: string, data: any, source?: string, metadata?: Record<string, any>): Promise<string>`
- `getMetrics(): EventMetrics`
- `getEventHistory(filter?: EventFilter, limit?: number): Event[]`

### **Stream Processor**

- `addTransform(transform: TransformConfig): void`
- `removeTransform(transformId: string): boolean`
- `addFilter(filter: FilterConfig): void`
- `removeFilter(filterId: string): boolean`
- `processEvent(event: StreamEvent): Promise<ProcessedEvent | null>`
- `getMetrics(): ProcessingMetrics`

### **Configuration Manager**

- `createConfiguration(config: Omit<IntegrationConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<IntegrationConfig>`
- `updateConfiguration(id: string, updates: Partial<IntegrationConfig>): Promise<IntegrationConfig>`
- `deleteConfiguration(id: string): Promise<boolean>`
- `createFromTemplate(templateId: string, overrides?: Partial<IntegrationConfig>): Promise<IntegrationConfig>`
- `exportConfiguration(id: string): Promise<string>`
- `importConfiguration(configData: string): Promise<IntegrationConfig>`

### **Connection Manager**

- `initialize(): Promise<void>`
- `createConnection(config: IntegrationConfig): Promise<IConnector>`
- `connectConnection(connectionId: string): Promise<boolean>`
- `disconnectConnection(connectionId: string): Promise<boolean>`
- `removeConnection(connectionId: string): Promise<boolean>`
- `checkConnectionHealth(connectionId: string): Promise<ConnectionHealth>`
- `getMetrics(): ConnectionMetrics`

## 📝 Best Practices

### **Performance**

1. **Use appropriate buffer sizes** for your data volume
2. **Batch process events** when possible
3. **Optimize transforms** to avoid unnecessary operations
4. **Monitor memory usage** and clear buffers when needed

### **Reliability**

1. **Enable auto-reconnection** for critical connections
2. **Set appropriate timeouts** for operations
3. **Implement circuit breakers** for external services
4. **Use exponential backoff** for retry attempts

### **Monitoring**

1. **Track key metrics** like throughput and latency
2. **Set up alerts** for quality thresholds
3. **Monitor connection health** regularly
4. **Log important events** for debugging

### **Security**

1. **Use secure authentication** methods
2. **Validate all incoming data** before processing
3. **Implement rate limiting** for external connections
4. **Encrypt sensitive data** in transit and at rest

## 🎉 Conclusion

The Universal Integration system provides a robust foundation for real-time data processing with streaming events. Its frontend-first, backend-ready architecture ensures you can develop and test locally while maintaining the flexibility to migrate to backend services when needed.

The system handles the complexity of managing multiple protocol connections, data transformation pipelines, and real-time event processing, allowing you to focus on your business logic rather than infrastructure concerns.

For more information, refer to the main roadmap document: `UNIVERSAL_INTEGRATION_ROADMAP.md`
