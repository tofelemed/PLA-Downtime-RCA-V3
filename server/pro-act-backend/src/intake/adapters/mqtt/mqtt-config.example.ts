/**
 * The reference MQTT endpoint configuration (design §3, OT contract §2): used by the unit and
 * integration tests and as the documented example. Deep-copied on every call.
 */
export function exampleMqttConfig(
  overrides: {
    mqtt?: Record<string, unknown>;
    payloadProfile?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  return {
    mqtt: {
      brokerUrl: 'mqtts://broker.plant.local:8883',
      protocolVersion: 5,
      clientId: '',
      username: 'proact-ingest',
      qos: 1,
      cleanStart: false,
      sessionExpirySeconds: 86_400,
      keepaliveSeconds: 60,
      connectTimeoutSeconds: 30,
      reconnect: { minSeconds: 1, maxSeconds: 60 },
      tls: { mode: 'system' },
      topics: ['proact/v1/+/+/+/+/events'],
      availabilityTopic: 'proact/v1/+/gateway/availability',
      maxMessageBytes: 65_536,
      ...overrides.mqtt,
    },
    payloadProfile: {
      kind: 'interval_event_json',
      schemaVersion: '1.0',
      topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events',
      fields: { eventTime: 'ts', sequence: 'seq', bootId: 'boot_id' },
      time: { unit: 'iso', maxFutureSkewSeconds: 300, maxPastSeconds: 604_800 },
      quality: { protocol: 'PI' },
      identityStrategy: 'event_id',
      ...overrides.payloadProfile,
    },
  };
}
