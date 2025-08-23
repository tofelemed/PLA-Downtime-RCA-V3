// Example: How to use the Universal Integration streaming capabilities
// This demonstrates the frontend-first, backend-ready architecture

import { globalEventBus } from '../services/events/EventBus';
import { MQTTConnector } from '../services/mqtt/MQTTConnector';
import { 
  ConnectionConfig, 
  StreamConfig, 
  TransformConfig, 
  FilterConfig 
} from '../services/integrations/base/IConnector';

export class StreamingExample {
  private mqttConnector: MQTTConnector;
  private eventSubscriptions: string[] = [];

  constructor() {
    // Initialize MQTT connector
    const config: ConnectionConfig = {
      id: 'example-mqtt',
      name: 'Example MQTT Broker',
      type: 'mqtt',
      endpoint: 'mqtt://localhost:1883',
      enabled: true,
      authentication: {
        type: 'basic',
        username: 'demo',
        password: 'demo123'
      }
    };

    this.mqttConnector = new MQTTConnector(config);
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting streaming example...');

      // Connect to MQTT broker
      await this.mqttConnector.connect();
      console.log('✅ Connected to MQTT broker');

      // Configure streaming
      const streamConfig: StreamConfig = {
        enabled: true,
        topics: ['sensors/+/temperature', 'sensors/+/pressure'],
        realTime: true,
        bufferSize: 1000
      };

      // Start streaming
      await this.mqttConnector.startStreaming(streamConfig);
      console.log('✅ Started MQTT streaming');

      // Add data transformations
      await this.setupDataTransforms();

      // Add data filters
      await this.setupDataFilters();

      // Subscribe to specific topics
      await this.subscribeToTopics();

      // Publish some test messages
      await this.publishTestMessages();

      console.log('🎉 Streaming example is running!');

    } catch (error) {
      console.error('❌ Error starting streaming example:', error);
    }
  }

  private setupEventHandlers(): void {
    // Subscribe to MQTT events
    const mqttEvents = [
      'mqtt.streaming.started',
      'mqtt.streaming.stopped',
      'mqtt.message.published',
      'mqtt.message.processed',
      'mqtt.message.error'
    ];

    mqttEvents.forEach(topic => {
      const subscription = globalEventBus.subscribe(topic, (event) => {
        console.log(`📡 MQTT Event [${topic}]:`, event.data);
      });
      this.eventSubscriptions.push(subscription.id);
    });

    // Subscribe to general event bus events
    const generalEvents = [
      'connected',
      'disconnected',
      'error',
      'dataChanged'
    ];

    generalEvents.forEach(topic => {
      const subscription = globalEventBus.subscribe(topic, (event) => {
        console.log(`📡 General Event [${topic}]:`, event.data);
      });
      this.eventSubscriptions.push(subscription.id);
    });
  }

  private async setupDataTransforms(): Promise<void> {
    // Transform 1: Convert temperature from Celsius to Fahrenheit
    const tempTransform: TransformConfig = {
      id: 'temp-c-to-f',
      name: 'Temperature C to F',
      type: 'payload',
      enabled: true,
      config: {
        operation: 'custom',
        condition: (payload: string) => payload.includes('temperature'),
        transform: (payload: string) => {
          try {
            const data = JSON.parse(payload);
            if (data.value && data.unit === 'C') {
              data.value = (data.value * 9/5) + 32;
              data.unit = 'F';
            }
            return JSON.stringify(data);
          } catch {
            return payload;
          }
        }
      },
      order: 1
    };

    // Transform 2: Add timestamp to all messages
    const timestampTransform: TransformConfig = {
      id: 'add-timestamp',
      name: 'Add Timestamp',
      type: 'enrich',
      enabled: true,
      config: {
        timestamp: true,
        metadata: {
          processedBy: 'StreamingExample',
          version: '1.0.0'
        }
      },
      order: 2
    };

    await this.mqttConnector.addTransform(tempTransform);
    await this.mqttConnector.addTransform(timestampTransform);

    console.log('🔧 Added data transformations');
  }

  private async setupDataFilters(): Promise<void> {
    // Filter 1: Only process messages with valid JSON
    const jsonFilter: FilterConfig = {
      id: 'valid-json',
      name: 'Valid JSON Filter',
      type: 'payload',
      enabled: true,
      config: {
        condition: {
          type: 'custom',
          validator: (payload: string | Buffer) => {
            try {
              JSON.parse(payload.toString());
              return true;
            } catch {
              return false;
            }
          }
        }
      },
      order: 1
    };

    // Filter 2: Only process temperature and pressure sensors
    const sensorFilter: FilterConfig = {
      id: 'sensor-types',
      name: 'Sensor Type Filter',
      type: 'topic',
      enabled: true,
      config: {
        pattern: 'sensors/+/temperature|sensors/+/pressure'
      },
      order: 2
    };

    await this.mqttConnector.addFilter(jsonFilter);
    await this.mqttConnector.addFilter(sensorFilter);

    console.log('🔍 Added data filters');
  }

  private async subscribeToTopics(): Promise<void> {
    // Subscribe to temperature sensors
    await this.mqttConnector.subscribe('sensors/+/temperature', (message) => {
      console.log(`🌡️ Temperature reading:`, {
        topic: message.topic,
        payload: message.payload.toString(),
        qos: message.qos,
        timestamp: new Date()
      });
    });

    // Subscribe to pressure sensors
    await this.mqttConnector.subscribe('sensors/+/pressure', (message) => {
      console.log(`📊 Pressure reading:`, {
        topic: message.topic,
        payload: message.payload.toString(),
        qos: message.qos,
        timestamp: new Date()
      });
    });

    console.log('📡 Subscribed to sensor topics');
  }

  private async publishTestMessages(): Promise<void> {
    // Publish temperature readings
    const temperatureTopics = [
      'sensors/tank1/temperature',
      'sensors/tank2/temperature',
      'sensors/reactor1/temperature'
    ];

    for (const topic of temperatureTopics) {
      const message = JSON.stringify({
        value: Math.random() * 100 + 20, // 20-120°C
        unit: 'C',
        timestamp: new Date().toISOString()
      });

      await this.mqttConnector.publish(topic, message);
      console.log(`📤 Published temperature to ${topic}: ${message}`);
    }

    // Publish pressure readings
    const pressureTopics = [
      'sensors/tank1/pressure',
      'sensors/tank2/pressure',
      'sensors/reactor1/pressure'
    ];

    for (const topic of pressureTopics) {
      const message = JSON.stringify({
        value: Math.random() * 10 + 1, // 1-11 bar
        unit: 'bar',
        timestamp: new Date().toISOString()
      });

      await this.mqttConnector.publish(topic, message);
      console.log(`📤 Published pressure to ${topic}: ${message}`);
    }
  }

  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping streaming example...');

      // Stop streaming
      await this.mqttConnector.stopStreaming();

      // Disconnect from MQTT broker
      await this.mqttConnector.disconnect();

      // Unsubscribe from all events
      this.eventSubscriptions.forEach(subscriptionId => {
        globalEventBus.unsubscribe(subscriptionId);
      });

      console.log('✅ Streaming example stopped');

    } catch (error) {
      console.error('❌ Error stopping streaming example:', error);
    }
  }

  async getStatus(): Promise<void> {
    try {
      const health = await this.mqttConnector.getHealth();
      console.log('📊 MQTT Connector Health:', health);

      const metrics = globalEventBus.getMetrics();
      console.log('📊 Event Bus Metrics:', metrics);

      const subscriptions = globalEventBus.getSubscriptions();
      console.log('📡 Active Event Subscriptions:', subscriptions.length);

    } catch (error) {
      console.error('❌ Error getting status:', error);
    }
  }
}

// Usage example:
// const example = new StreamingExample();
// await example.start();
// 
// // Run for some time...
// setTimeout(async () => {
//   await example.getStatus();
//   await example.stop();
// }, 30000);
