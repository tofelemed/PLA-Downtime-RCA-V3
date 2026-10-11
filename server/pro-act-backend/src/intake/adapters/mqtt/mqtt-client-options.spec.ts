import { AdapterError } from '../adapter-error';
import { buildMqttClientOptions } from './mqtt-client-options';
import { exampleMqttConfig } from './mqtt-config.example';
import { parseMqttConfig } from './mqtt-config';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';

function build(
  overrides: Parameters<typeof exampleMqttConfig>[0] = {},
  input: Partial<Parameters<typeof buildMqttClientOptions>[0]> = {},
) {
  return buildMqttClientOptions({
    connectionId: 'conn-1',
    config: parseMqttConfig(exampleMqttConfig(overrides)),
    password: 'pw-secret',
    purpose: 'subscribe',
    ...input,
  });
}

describe('buildMqttClientOptions (one factory for test() and the subscriber)', () => {
  const env = process.env.CONNECTOR_EGRESS_ALLOWLIST;
  afterEach(() => {
    if (env === undefined) delete process.env.CONNECTOR_EGRESS_ALLOWLIST;
    else process.env.CONNECTOR_EGRESS_ALLOWLIST = env;
  });

  it('builds the persistent subscriber session with the derived client id', () => {
    const target = build();
    expect(target.url).toBe('mqtts://broker.plant.local:8883');
    expect(target.clientId).toBe('proact-conn-1');
    expect(target.options).toMatchObject({
      clientId: 'proact-conn-1',
      protocolVersion: 5,
      clean: false,
      keepalive: 60,
      connectTimeout: 30_000,
      reconnectPeriod: 1_000,
      username: 'proact-ingest',
      password: 'pw-secret',
      properties: { sessionExpiryInterval: 86_400 },
      rejectUnauthorized: true,
      resubscribe: false,
      manualConnect: true,
    });
    expect(target.insecureTls).toBe(false);
    expect(build({ mqtt: { clientId: 'line1' } }).clientId).toBe('line1');
  });

  it('builds a throwaway clean test session (CONNACK only) and omits the password when none', () => {
    const target = build(
      {},
      { purpose: 'test', now: () => 1_700_000_000_000, password: null },
    );
    expect(target.clientId).toBe('test-1700000000000');
    expect(target.options).toMatchObject({
      clean: true,
      reconnectPeriod: 0,
      properties: { sessionExpiryInterval: 0 },
    });
    expect(target.options.password).toBeUndefined();
  });

  it('refuses a stored password without a user name (3.1.1 forbids it; mqtt.js would stall)', () => {
    expect(() => build({ mqtt: { username: undefined } })).toThrow(
      expect.objectContaining({
        code: 'PASSWORD_WITHOUT_USERNAME',
        retryable: false,
      }) as Error,
    );
    expect(
      build({ mqtt: { username: undefined } }, { password: null }).options
        .username,
    ).toBeUndefined();
  });

  it('omits MQTT 5 properties for 3.1.1', () => {
    const target = build({ mqtt: { protocolVersion: 4 } });
    expect(target.options.protocolVersion).toBe(4);
    expect(target.options.properties).toBeUndefined();
  });

  it('applies exactly one TLS trust mode', () => {
    expect(build().options).not.toHaveProperty('ca');
    expect(
      build({ mqtt: { tls: { mode: 'caPem', caPem: PEM } } }).options,
    ).toMatchObject({
      ca: [PEM],
      rejectUnauthorized: true,
    });
    const ref = build(
      {
        mqtt: {
          tls: {
            mode: 'caRef',
            caRef: 'secrets:6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
          },
        },
      },
      { caPem: PEM },
    );
    expect(ref.options).toMatchObject({ ca: [PEM], rejectUnauthorized: true });
    expect(() =>
      build(
        {
          mqtt: {
            tls: {
              mode: 'caRef',
              caRef: 'secrets:6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
            },
          },
        },
        { caPem: null },
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'CA_REF_UNRESOLVED',
        retryable: false,
      }) as Error,
    );
    const insecure = build({
      mqtt: { tls: { mode: 'insecure', servername: 'mosquitto' } },
    });
    expect(insecure.options).toMatchObject({
      rejectUnauthorized: false,
      servername: 'mosquitto',
    });
    expect(insecure.insecureTls).toBe(true);
    const plain = build({ mqtt: { brokerUrl: 'mqtt://broker.plant.local' } });
    expect(plain.options).not.toHaveProperty('rejectUnauthorized');
    expect(plain.insecureTls).toBe(false);
  });

  it('refuses brokers outside the egress allowlist before any socket is opened', () => {
    process.env.CONNECTOR_EGRESS_ALLOWLIST = 'pi.plant.local';
    let caught: unknown;
    try {
      build();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AdapterError);
    expect(caught).toMatchObject({
      code: 'egress_denied',
      retryable: false,
      health: 'egress_denied',
    });
    process.env.CONNECTOR_EGRESS_ALLOWLIST = 'pi.plant.local, *.plant.local';
    expect(build().url).toBe('mqtts://broker.plant.local:8883');
  });
});
