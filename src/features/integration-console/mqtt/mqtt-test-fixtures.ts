import type { ConnectionView } from '@/api/v2/types/integrations';

export const MQTT_CONNECTION: ConnectionView = {
  id: 'c1',
  sourceType: 'mqtt',
  displayName: 'Lab',
  endpointConfig: {
    mqtt: { brokerUrl: 'mqtt://mqtt:1883', protocolVersion: 5, username: 'lab', qos: 1, cleanStart: false, sessionExpirySeconds: 86400, keepaliveSeconds: 60, connectTimeoutSeconds: 30, reconnect: { minSeconds: 1, maxSeconds: 60 }, tls: { mode: 'system' }, topics: ['proact/v1/+/+/+/+/events'], maxMessageBytes: 65536 },
    payloadProfile: { kind: 'interval_event_json', schemaVersion: '1.0', topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events', identityStrategy: 'event_id', time: { unit: 'iso', maxFutureSkewSeconds: 300, maxPastSeconds: 604800 }, quality: { protocol: 'PI' } },
  },
  hasSecret: true,
  effectiveClientId: 'proact-c1',
  capabilities: {},
  configVersion: 1,
  isActive: true,
  rowVersion: 1,
  createdAt: '2026-10-11T00:00:00Z',
  updatedAt: null,
};

