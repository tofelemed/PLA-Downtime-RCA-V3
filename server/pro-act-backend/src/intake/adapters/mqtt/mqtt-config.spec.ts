import { exampleMqttConfig } from './mqtt-config.example';
import {
  effectiveClientId,
  parseMqttConfig,
  validateMqttConfig,
} from './mqtt-config';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
const KEY = `${PEM}\n-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----`;

type Overrides = Parameters<typeof exampleMqttConfig>[0];

/** Every rule of design §3 as a table: override → expected field in the first problem. */
const CASES: Array<[string, Overrides, string]> = [
  [
    'brokerUrl: wrong scheme',
    { mqtt: { brokerUrl: 'http://b' } },
    'mqtt.brokerUrl:',
  ],
  ['brokerUrl: path', { mqtt: { brokerUrl: 'mqtt://b/x' } }, 'mqtt.brokerUrl:'],
  ['brokerUrl: missing', { mqtt: { brokerUrl: undefined } }, 'mqtt.brokerUrl:'],
  [
    'protocolVersion 3',
    { mqtt: { protocolVersion: 3 } },
    'mqtt.protocolVersion:',
  ],
  ['clientId with space', { mqtt: { clientId: 'pro act' } }, 'mqtt.clientId:'],
  [
    'clientId too long',
    { mqtt: { clientId: 'x'.repeat(65) } },
    'mqtt.clientId:',
  ],
  ['username not a string', { mqtt: { username: 7 } }, 'mqtt.username:'],
  ['qos 3', { mqtt: { qos: 3 } }, 'mqtt.qos:'],
  ['qos as string', { mqtt: { qos: '1' } }, 'mqtt.qos:'],
  ['cleanStart string', { mqtt: { cleanStart: 'no' } }, 'mqtt.cleanStart:'],
  [
    'sessionExpirySeconds negative',
    { mqtt: { sessionExpirySeconds: -1 } },
    'mqtt.sessionExpirySeconds:',
  ],
  [
    'sessionExpirySeconds fraction',
    { mqtt: { sessionExpirySeconds: 1.5 } },
    'mqtt.sessionExpirySeconds:',
  ],
  [
    'keepaliveSeconds 0',
    { mqtt: { keepaliveSeconds: 0 } },
    'mqtt.keepaliveSeconds:',
  ],
  [
    'connectTimeoutSeconds 0',
    { mqtt: { connectTimeoutSeconds: 0 } },
    'mqtt.connectTimeoutSeconds:',
  ],
  [
    'maxMessageBytes 0',
    { mqtt: { maxMessageBytes: 0 } },
    'mqtt.maxMessageBytes:',
  ],
  [
    'reconnect max < min',
    { mqtt: { reconnect: { minSeconds: 10, maxSeconds: 5 } } },
    'mqtt.reconnect:',
  ],
  [
    'reconnect min 0',
    { mqtt: { reconnect: { minSeconds: 0, maxSeconds: 5 } } },
    'mqtt.reconnect:',
  ],
  ['tls unknown mode', { mqtt: { tls: { mode: 'yolo' } } }, 'mqtt.tls.mode:'],
  [
    'tls two trust sources',
    { mqtt: { tls: { mode: 'caPem', caPem: PEM, caRef: 'secrets:x' } } },
    'mqtt.tls.caRef:',
  ],
  [
    'tls caPem without mode',
    { mqtt: { tls: { mode: 'system', caPem: PEM } } },
    'mqtt.tls.caPem:',
  ],
  [
    'tls caPem missing',
    { mqtt: { tls: { mode: 'caPem' } } },
    'mqtt.tls.caPem:',
  ],
  [
    'tls caPem not a certificate',
    { mqtt: { tls: { mode: 'caPem', caPem: 'hello' } } },
    'mqtt.tls.caPem:',
  ],
  [
    'tls caPem with private key',
    { mqtt: { tls: { mode: 'caPem', caPem: KEY } } },
    'mqtt.tls.caPem:',
  ],
  [
    'tls caPem too large',
    { mqtt: { tls: { mode: 'caPem', caPem: `${PEM}${'x'.repeat(65_536)}` } } },
    'mqtt.tls.caPem:',
  ],
  [
    'tls caRef malformed',
    { mqtt: { tls: { mode: 'caRef', caRef: 'file:/etc/ca.pem' } } },
    'mqtt.tls.caRef:',
  ],
  [
    'tls servername invalid',
    { mqtt: { tls: { mode: 'system', servername: 'a b' } } },
    'mqtt.tls.servername:',
  ],
  [
    'tls unknown key',
    { mqtt: { tls: { mode: 'system', rejectUnauthorized: false } } },
    'mqtt.tls.rejectUnauthorized:',
  ],
  [
    'tls insecure on plain mqtt',
    { mqtt: { brokerUrl: 'mqtt://b', tls: { mode: 'insecure' } } },
    'mqtt.tls.mode:',
  ],
  ['topics empty', { mqtt: { topics: [] } }, 'mqtt.topics:'],
  ['topics missing', { mqtt: { topics: undefined } }, 'mqtt.topics:'],
  [
    'topics bad # placement',
    { mqtt: { topics: ['a/#/b'] } },
    'mqtt.topics[0]:',
  ],
  ['topics bad +', { mqtt: { topics: ['a/b+'] } }, 'mqtt.topics[0]:'],
  ['topics duplicate', { mqtt: { topics: ['a/#', 'a/#'] } }, 'mqtt.topics[1]:'],
  [
    'availabilityTopic invalid',
    { mqtt: { availabilityTopic: 'a#' } },
    'mqtt.availabilityTopic:',
  ],
  ['unknown transport key', { mqtt: { password: 'x' } }, 'mqtt.password:'],
  [
    'profile kind unknown',
    { payloadProfile: { kind: 'csv' } },
    'payloadProfile.kind:',
  ],
  [
    'profile template without equipment capture',
    { payloadProfile: { topicTemplate: 'proact/v1/{site}/x/y/z/events' } },
    'payloadProfile.topicTemplate:',
  ],
  [
    'profile template with wildcard',
    { payloadProfile: { topicTemplate: 'proact/v1/+/{unit}/events' } },
    'payloadProfile.topicTemplate:',
  ],
  [
    'profile template duplicate capture',
    { payloadProfile: { topicTemplate: 'a/{unit}/{unit}' } },
    'payloadProfile.topicTemplate:',
  ],
  [
    'profile template not covered by any filter',
    { payloadProfile: { topicTemplate: 'other/{unit}/events' } },
    'payloadProfile.topicTemplate:',
  ],
  [
    'profile time unit',
    { payloadProfile: { time: { unit: 'ns' } } },
    'payloadProfile.time.unit:',
  ],
  [
    'profile time skew negative',
    { payloadProfile: { time: { maxFutureSkewSeconds: -1 } } },
    'payloadProfile.time.maxFutureSkewSeconds:',
  ],
  [
    'profile quality protocol',
    { payloadProfile: { quality: { protocol: 'MODBUS' } } },
    'payloadProfile.quality.protocol:',
  ],
  [
    'profile identity strategy',
    { payloadProfile: { identityStrategy: 'packet_id' } },
    'payloadProfile.identityStrategy:',
  ],
  [
    'profile field path',
    { payloadProfile: { fields: { eventTime: 'a..b' } } },
    'payloadProfile.fields.eventTime:',
  ],
  [
    'profile value map unknown',
    { payloadProfile: { valueMaps: { colour: {} } } },
    'payloadProfile.valueMaps.colour:',
  ],
  [
    'profile value map entry',
    { payloadProfile: { valueMaps: { state: { '1': 2 } } } },
    'payloadProfile.valueMaps.state.1:',
  ],
  [
    'profile unknown key',
    { payloadProfile: { decoder: 'x' } },
    'payloadProfile.decoder:',
  ],
];

describe('validateMqttConfig (design §3 rules)', () => {
  it('accepts the reference configuration and its variants', () => {
    expect(validateMqttConfig(exampleMqttConfig())).toEqual([]);
    expect(
      validateMqttConfig(
        exampleMqttConfig({
          mqtt: {
            brokerUrl: 'mqtt://[::1]:1884',
            protocolVersion: 4,
            clientId: 'proact-line1',
            tls: undefined,
            topics: ['proact/v1/#'],
          },
          payloadProfile: {
            kind: 'availability',
            topicTemplate: 'proact/v1/{site}/gateway/availability',
          },
        }),
      ),
    ).toEqual([]);
    expect(
      validateMqttConfig(
        exampleMqttConfig({
          mqtt: { tls: { mode: 'caPem', caPem: PEM, servername: 'mosquitto' } },
        }),
      ),
    ).toEqual([]);
    expect(
      validateMqttConfig(
        exampleMqttConfig({
          mqtt: {
            tls: {
              mode: 'caRef',
              caRef: 'secrets:6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
            },
          },
        }),
      ),
    ).toEqual([]);
    expect(
      validateMqttConfig(
        exampleMqttConfig({ mqtt: { tls: { mode: 'insecure' } } }),
      ),
    ).toEqual([]);
  });

  it.each(CASES)('refuses %s', (_name, overrides, field) => {
    const problems = validateMqttConfig(exampleMqttConfig(overrides));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((problem) => problem.startsWith(field))).toBe(true);
  });

  it('reports the blocks when they are missing and unknown top-level keys', () => {
    expect(validateMqttConfig({})).toEqual(
      expect.arrayContaining([
        'mqtt: required object',
        'payloadProfile: required object',
      ]),
    );
    expect(
      validateMqttConfig({ ...exampleMqttConfig(), brokerUrl: 'x' }),
    ).toEqual(['brokerUrl: unknown setting']);
  });

  it('parses with defaults and the normalised broker URL', () => {
    const parsed = parseMqttConfig(
      exampleMqttConfig({
        mqtt: {
          brokerUrl: 'mqtts://Broker.Plant.Local',
          qos: undefined,
          keepaliveSeconds: undefined,
          reconnect: undefined,
          tls: undefined,
          sessionExpirySeconds: undefined,
        },
      }),
    );
    expect(parsed.mqtt).toMatchObject({
      brokerUrl: 'mqtts://broker.plant.local:8883',
      qos: 1,
      keepaliveSeconds: 60,
      sessionExpirySeconds: 86_400,
      reconnect: { minSeconds: 1, maxSeconds: 60 },
      tls: { mode: 'system' },
    });
    expect(parsed.broker).toMatchObject({
      host: 'broker.plant.local',
      port: 8883,
      secure: true,
    });
    expect(() => parseMqttConfig({})).toThrow(
      /Invalid MQTT endpoint configuration/,
    );
  });

  it('derives the client id from the connection when blank', () => {
    expect(effectiveClientId('', 'c1')).toBe('proact-c1');
    expect(effectiveClientId(undefined, 'c1')).toBe('proact-c1');
    expect(effectiveClientId('  ', 'c1')).toBe('proact-c1');
    expect(effectiveClientId('line1', 'c1')).toBe('line1');
  });
});
