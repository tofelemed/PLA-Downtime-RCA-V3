import { AdapterRegistry } from '../adapter-registry';
import { IntegrationConnectionService } from '../../connections/integration-connection.service';
import { IntegrationConnection } from '../../entities/integration-connection.entity';
import { exampleMqttConfig } from './mqtt-config.example';
import { MqttAdapter } from './mqtt.adapter';

function connection(
  endpointConfig: Record<string, unknown>,
): IntegrationConnection {
  return Object.assign(new IntegrationConnection(), {
    id: 'conn-1',
    tenantId: 'tenant-1',
    sourceType: 'mqtt' as const,
    displayName: 'Lab broker',
    endpointConfig,
    secretRef: 'secrets:1',
    capabilities: {},
    configVersion: 1,
    isActive: true,
  });
}

describe('MqttAdapter (plan 1.8 step 1 skeleton)', () => {
  const registry = new AdapterRegistry();
  const connections = {
    revealSecret: jest.fn().mockResolvedValue('pw-secret'),
    revealSecretRef: jest.fn().mockResolvedValue(null),
  } as unknown as IntegrationConnectionService;
  const adapter = new MqttAdapter(registry, connections);
  const env = process.env.CONNECTOR_EGRESS_ALLOWLIST;
  afterEach(() => {
    if (env === undefined) delete process.env.CONNECTOR_EGRESS_ALLOWLIST;
    else process.env.CONNECTOR_EGRESS_ALLOWLIST = env;
  });

  it('registers itself for mqtt and declares its capabilities', () => {
    adapter.onModuleInit();
    expect(registry.find('mqtt')).toBe(adapter);
    expect(adapter.capabilities()).toMatchObject({
      replay: false,
      corrections: true,
      sequence: true,
    });
    expect(adapter.validateConfig(exampleMqttConfig())).toEqual([]);
    expect(adapter.validateConfig({})).not.toEqual([]);
  });

  it('is never a pull job', async () => {
    await expect(adapter.read()).rejects.toMatchObject({
      code: 'NOT_PULLABLE',
      retryable: false,
    });
  });

  it('discovers the configured topic filters without touching the broker', async () => {
    await expect(
      adapter.discover(connection(exampleMqttConfig())),
    ).resolves.toEqual({
      broker: 'mqtts://broker.plant.local:8883',
      protocolVersion: 5,
      topics: [{ filter: 'proact/v1/+/+/+/+/events', qos: 1 }],
      availabilityTopic: 'proact/v1/+/gateway/availability',
      payloadProfile: 'interval_event_json',
      topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events',
    });
  });

  it('reports an invalid configuration and a denied egress as failed tests without opening a socket', async () => {
    const invalid = await adapter.test(
      connection({ mqtt: { brokerUrl: 'nope' } }),
    );
    expect(invalid).toMatchObject({
      connected: false,
      diagnostics: { prepare: 'INVALID_ENDPOINT_CONFIG' },
    });
    expect(invalid.message).toContain('mqtt.brokerUrl');
    process.env.CONNECTOR_EGRESS_ALLOWLIST = 'pi.plant.local';
    const denied = await adapter.test(connection(exampleMqttConfig()));
    expect(denied).toMatchObject({
      connected: false,
      diagnostics: { prepare: 'egress_denied' },
    });
    expect(JSON.stringify(denied)).not.toContain('pw-secret');
    await expect(
      adapter.health(connection(exampleMqttConfig())),
    ).resolves.toMatchObject({ status: 'down' });
  });

  it('refuses a duplicate feed among peers and closes without live clients', async () => {
    expect(() =>
      adapter.validateAmongPeers(
        exampleMqttConfig(),
        [
          {
            id: 'p1',
            displayName: 'Other',
            endpointConfig: exampleMqttConfig(),
          },
        ],
        null,
      ),
    ).toThrow(expect.objectContaining({ code: 'DUPLICATE_FEED' }) as Error);
    await expect(adapter.close()).resolves.toBeUndefined();
  });
});
