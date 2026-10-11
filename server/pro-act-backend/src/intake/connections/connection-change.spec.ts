import { UnprocessableEntityException } from '@nestjs/common';
import { assertSecretFollowsTarget } from './connection-change';

const stored = {
  endpointConfig: {
    piWebApiUrl: 'https://pi.plant.local/piwebapi',
    pageSize: 100,
  },
  secretRef: 'secrets:1',
};

describe('assertSecretFollowsTarget', () => {
  const refuses = (change: Parameters<typeof assertSecretFollowsTarget>[1]) =>
    expect(() => assertSecretFollowsTarget(stored, change)).toThrow(
      UnprocessableEntityException,
    );
  const allows = (change: Parameters<typeof assertSecretFollowsTarget>[1]) =>
    expect(() => assertSecretFollowsTarget(stored, change)).not.toThrow();

  it('refuses a new target origin without the credential', () => {
    refuses({
      endpointConfig: {
        ...stored.endpointConfig,
        piWebApiUrl: 'https://evil.example/piwebapi',
      },
    });
    refuses({
      endpointConfig: {
        ...stored.endpointConfig,
        piWebApiUrl: 'https://pi.plant.local:8443/piwebapi',
      },
    });
  });

  it('refuses switching TLS verification off without the credential', () => {
    refuses({
      endpointConfig: { ...stored.endpointConfig, allowInsecureTls: true },
    });
  });

  it('refuses non-web schemes, username, unknown keys and removed keys without the credential', () => {
    const mqtt = {
      endpointConfig: { brokerUrl: 'mqtt://broker.plant.local' },
      secretRef: 'secrets:2',
    };
    expect(() =>
      assertSecretFollowsTarget(mqtt, {
        endpointConfig: { brokerUrl: 'mqtt://evil.example' },
      }),
    ).toThrow(UnprocessableEntityException);
    const opc = {
      endpointConfig: { endpoint: { url: 'opc.tcp://plc.plant.local:4840' } },
      secretRef: 'secrets:3',
    };
    expect(() =>
      assertSecretFollowsTarget(opc, {
        endpointConfig: { endpoint: { url: 'opc.tcp://evil.example:4840' } },
      }),
    ).toThrow(UnprocessableEntityException);
    refuses({
      endpointConfig: { ...stored.endpointConfig, username: 'other' },
    });
    refuses({
      endpointConfig: { ...stored.endpointConfig, rejectUnauthorized: false },
    });
    refuses({ endpointConfig: { pageSize: 100 } });
    refuses({
      endpointConfig: {
        ...stored.endpointConfig,
        piWebApiUrl: 'https://pi.plant.local/piwebapi/v2',
      },
    });
  });

  it('allows paging/timing edits, renames, and changes that re-enter the secret', () => {
    allows({ endpointConfig: { ...stored.endpointConfig, pageSize: 500 } });
    allows({ endpointConfig: { ...stored.endpointConfig, timeoutMs: 60000 } });
    allows({ displayName: 'renamed' });
    allows({
      endpointConfig: { piWebApiUrl: 'https://other.plant.local/piwebapi' },
      secret: 'new',
    });
  });

  describe('mqtt connections (plan 1.8 §3)', () => {
    const mqttStored = {
      sourceType: 'mqtt' as const,
      secretRef: 'secrets:9',
      endpointConfig: {
        mqtt: {
          brokerUrl: 'mqtts://broker.plant.local:8883',
          protocolVersion: 5,
          username: 'proact-ingest',
          tls: { mode: 'system' },
          topics: ['proact/v1/+/+/+/+/events'],
          qos: 1,
          keepaliveSeconds: 60,
          sessionExpirySeconds: 86400,
          connectTimeoutSeconds: 30,
          reconnect: { minSeconds: 1, maxSeconds: 60 },
          maxMessageBytes: 65536,
        },
        payloadProfile: {
          kind: 'interval_event_json',
          topicTemplate: 'a/{unit}',
        },
      },
    };
    const withMqtt = (mqtt: Record<string, unknown>) => ({
      endpointConfig: {
        ...mqttStored.endpointConfig,
        mqtt: { ...mqttStored.endpointConfig.mqtt, ...mqtt },
      },
    });
    const mqttRefuses = (
      change: Parameters<typeof assertSecretFollowsTarget>[1],
    ) =>
      expect(() => assertSecretFollowsTarget(mqttStored, change)).toThrow(
        UnprocessableEntityException,
      );
    const mqttAllows = (
      change: Parameters<typeof assertSecretFollowsTarget>[1],
    ) =>
      expect(() => assertSecretFollowsTarget(mqttStored, change)).not.toThrow();

    it('allows topic, qos, timing, reconnect, size, availability and profile edits', () => {
      mqttAllows(withMqtt({ topics: ['proact/v1/#'] }));
      mqttAllows(withMqtt({ qos: 2 }));
      mqttAllows(withMqtt({ keepaliveSeconds: 30 }));
      mqttAllows(withMqtt({ sessionExpirySeconds: 3600 }));
      mqttAllows(withMqtt({ connectTimeoutSeconds: 10 }));
      mqttAllows(withMqtt({ reconnect: { minSeconds: 2, maxSeconds: 30 } }));
      mqttAllows(withMqtt({ maxMessageBytes: 1024 }));
      mqttAllows(
        withMqtt({ availabilityTopic: 'proact/v1/+/gateway/availability' }),
      );
      mqttAllows({
        endpointConfig: {
          ...mqttStored.endpointConfig,
          payloadProfile: {
            kind: 'measurement_json',
            topicTemplate: 'b/{unit}',
          },
        },
      });
    });

    it('refuses broker, username, TLS, protocol version, client id and unknown keys without the credential', () => {
      mqttRefuses(withMqtt({ brokerUrl: 'mqtts://evil.example:8883' }));
      mqttRefuses(withMqtt({ brokerUrl: 'mqtts://broker.plant.local:8884' }));
      mqttRefuses(withMqtt({ username: 'other' }));
      mqttRefuses(withMqtt({ tls: { mode: 'insecure' } }));
      mqttRefuses(withMqtt({ protocolVersion: 4 }));
      mqttRefuses(withMqtt({ clientId: 'stolen-id' }));
      mqttRefuses(withMqtt({ proxy: 'socks://x' }));
      mqttRefuses({ endpointConfig: { payloadProfile: {} } });
      mqttAllows({
        ...withMqtt({ brokerUrl: 'mqtts://other:8883' }),
        secret: 'new',
      });
    });

    it('keeps the flat rule for other source types', () => {
      expect(() =>
        assertSecretFollowsTarget(
          { ...stored, sourceType: 'pi_web_api' },
          { endpointConfig: { ...stored.endpointConfig, pageSize: 10 } },
        ),
      ).not.toThrow();
      expect(() =>
        assertSecretFollowsTarget(
          { ...stored, sourceType: 'rest_import' },
          { endpointConfig: { ...stored.endpointConfig, topics: ['x'] } },
        ),
      ).toThrow(UnprocessableEntityException);
    });
  });

  it('does not apply when no credential is stored', () => {
    expect(() =>
      assertSecretFollowsTarget(
        { endpointConfig: stored.endpointConfig, secretRef: null },
        { endpointConfig: { piWebApiUrl: 'https://other.plant.local' } },
      ),
    ).not.toThrow();
  });
});
