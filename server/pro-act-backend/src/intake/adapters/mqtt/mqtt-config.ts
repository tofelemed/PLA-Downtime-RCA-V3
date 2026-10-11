import { AdapterError } from '../adapter-error';
import { BrokerUrl, parseBrokerUrl } from './broker-url';
import { PayloadProfile, validatePayloadProfile } from './payload-profile';
import { validateTopicFilter } from './topic-filter';

/**
 * `integration_connections.endpoint_config` of an MQTT connection (plan 1.8 design §3): the `mqtt`
 * transport block and the required `payloadProfile`. The password is never here (it is the connection
 * secret); the CA of `tls.mode = caRef` is a `secrets:<id>` reference.
 */
export type MqttTlsMode = 'system' | 'caPem' | 'caRef' | 'insecure';
export const MQTT_TLS_MODES: readonly MqttTlsMode[] = [
  'system',
  'caPem',
  'caRef',
  'insecure',
];

export interface MqttTlsConfig {
  mode: MqttTlsMode;
  caPem?: string;
  caRef?: string;
  /** SNI / certificate name override when the certificate does not list the host */
  servername?: string;
}

export interface MqttReconnectConfig {
  minSeconds: number;
  maxSeconds: number;
}

export interface MqttTransportConfig {
  brokerUrl: string;
  protocolVersion: 4 | 5;
  /** blank = derived `proact-<connectionId>` */
  clientId?: string;
  username?: string;
  qos: 0 | 1 | 2;
  cleanStart: boolean;
  sessionExpirySeconds: number;
  keepaliveSeconds: number;
  connectTimeoutSeconds: number;
  reconnect: MqttReconnectConfig;
  tls: MqttTlsConfig;
  topics: string[];
  availabilityTopic?: string;
  maxMessageBytes: number;
}

export interface MqttConnectionConfig {
  mqtt: MqttTransportConfig;
  payloadProfile: PayloadProfile;
  broker: BrokerUrl;
}

export const MQTT_DEFAULTS = {
  protocolVersion: 5,
  qos: 1,
  cleanStart: false,
  sessionExpirySeconds: 86_400,
  keepaliveSeconds: 60,
  connectTimeoutSeconds: 30,
  reconnect: { minSeconds: 1, maxSeconds: 60 },
  tls: { mode: 'system' },
  maxMessageBytes: 65_536,
} as const satisfies Partial<MqttTransportConfig>;

export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_PEM_LENGTH = 65_536;
const MAX_TOPICS = 64;
const SERVERNAME_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;
const CA_REF_PATTERN = /^secrets:[0-9a-f-]{36}$/;
const TRANSPORT_KEYS: ReadonlySet<string> = new Set([
  'brokerUrl',
  'protocolVersion',
  'clientId',
  'username',
  'qos',
  'cleanStart',
  'sessionExpirySeconds',
  'keepaliveSeconds',
  'connectTimeoutSeconds',
  'reconnect',
  'tls',
  'topics',
  'availabilityTopic',
  'maxMessageBytes',
]);
const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(['mqtt', 'payloadProfile']);

type Problems = string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function checkInt(
  block: Record<string, unknown>,
  key: string,
  range: [number, number],
  problems: Problems,
): void {
  const value = block[key];
  if (value !== undefined && !isInt(value, range[0], range[1])) {
    problems.push(
      `mqtt.${key}: must be an integer between ${range[0]} and ${range[1]}`,
    );
  }
}

function validateIdentity(
  block: Record<string, unknown>,
  problems: Problems,
): void {
  if (
    block.protocolVersion !== undefined &&
    block.protocolVersion !== 4 &&
    block.protocolVersion !== 5
  ) {
    problems.push('mqtt.protocolVersion: must be 5 or 4');
  }
  const clientId = block.clientId;
  if (
    clientId !== undefined &&
    (typeof clientId !== 'string' ||
      (clientId !== '' && !CLIENT_ID_PATTERN.test(clientId)))
  ) {
    problems.push(
      'mqtt.clientId: must match ^[A-Za-z0-9_-]{1,64}$ (blank = derived)',
    );
  }
  if (
    block.username !== undefined &&
    (typeof block.username !== 'string' || block.username.length > 256)
  ) {
    problems.push('mqtt.username: must be a string of at most 256 characters');
  }
}

function validateSession(
  block: Record<string, unknown>,
  problems: Problems,
): void {
  if (block.qos !== undefined && ![0, 1, 2].includes(block.qos as number)) {
    problems.push('mqtt.qos: must be 0, 1 or 2');
  }
  if (block.cleanStart !== undefined && typeof block.cleanStart !== 'boolean') {
    problems.push('mqtt.cleanStart: must be a boolean');
  }
  checkInt(block, 'sessionExpirySeconds', [0, 4_294_967_295], problems);
  checkInt(block, 'keepaliveSeconds', [1, 65_535], problems);
  checkInt(block, 'connectTimeoutSeconds', [1, 300], problems);
  checkInt(block, 'maxMessageBytes', [1, 1_048_576], problems);
  const reconnect = block.reconnect;
  if (reconnect === undefined) return;
  if (
    !isRecord(reconnect) ||
    !isInt(reconnect.minSeconds, 1, 3600) ||
    !isInt(reconnect.maxSeconds, 1, 3600) ||
    reconnect.maxSeconds < reconnect.minSeconds
  ) {
    problems.push(
      'mqtt.reconnect: must be { minSeconds, maxSeconds } with 1 <= minSeconds <= maxSeconds <= 3600',
    );
  }
}

function validateTls(
  tls: unknown,
  broker: BrokerUrl | null,
  problems: Problems,
): void {
  if (tls === undefined) return;
  if (!isRecord(tls) || !MQTT_TLS_MODES.includes(tls.mode as MqttTlsMode)) {
    problems.push(`mqtt.tls.mode: must be one of ${MQTT_TLS_MODES.join(', ')}`);
    return;
  }
  const mode = tls.mode as MqttTlsMode;
  if (mode !== 'system' && broker && !broker.secure) {
    problems.push(`mqtt.tls.mode: ${mode} requires an mqtts:// broker URL`);
  }
  if (tls.caPem !== undefined && mode !== 'caPem') {
    problems.push('mqtt.tls.caPem: only allowed with mode caPem');
  }
  if (tls.caRef !== undefined && mode !== 'caRef') {
    problems.push('mqtt.tls.caRef: only allowed with mode caRef');
  }
  if (mode === 'caPem') validatePem(tls.caPem, problems);
  if (
    mode === 'caRef' &&
    (typeof tls.caRef !== 'string' || !CA_REF_PATTERN.test(tls.caRef))
  ) {
    problems.push('mqtt.tls.caRef: must be a secrets:<id> reference');
  }
  if (
    tls.servername !== undefined &&
    (typeof tls.servername !== 'string' ||
      !SERVERNAME_PATTERN.test(tls.servername))
  ) {
    problems.push('mqtt.tls.servername: must be a host name');
  }
  for (const key of Object.keys(tls)) {
    if (!['mode', 'caPem', 'caRef', 'servername'].includes(key)) {
      problems.push(`mqtt.tls.${key}: unknown setting`);
    }
  }
}

function validatePem(pem: unknown, problems: Problems): void {
  if (typeof pem !== 'string' || pem.length === 0) {
    problems.push('mqtt.tls.caPem: required with mode caPem');
    return;
  }
  if (pem.length > MAX_PEM_LENGTH) {
    problems.push(
      `mqtt.tls.caPem: must be at most ${MAX_PEM_LENGTH} characters`,
    );
  }
  if (!pem.includes('BEGIN CERTIFICATE')) {
    problems.push('mqtt.tls.caPem: must contain a BEGIN CERTIFICATE block');
  }
  if (pem.includes('PRIVATE KEY')) {
    problems.push('mqtt.tls.caPem: must not contain a private key');
  }
}

/** The valid topic filters of the block (problems for the others are appended). */
function validateTopics(
  block: Record<string, unknown>,
  problems: Problems,
): string[] {
  const topics = block.topics;
  if (!Array.isArray(topics) || topics.length === 0) {
    problems.push('mqtt.topics: at least one topic filter is required');
    return [];
  }
  if (topics.length > MAX_TOPICS) {
    problems.push(`mqtt.topics: at most ${MAX_TOPICS} topic filters`);
  }
  const valid: string[] = [];
  topics.forEach((filter: unknown, index) => {
    const problem = validateTopicFilter(filter);
    if (problem) {
      problems.push(`mqtt.topics[${index}]: ${problem}`);
    } else if (valid.includes(filter as string)) {
      problems.push(`mqtt.topics[${index}]: duplicate of an earlier filter`);
    } else {
      valid.push(filter as string);
    }
  });
  const availability = block.availabilityTopic;
  if (availability !== undefined) {
    const problem = validateTopicFilter(availability);
    if (problem) problems.push(`mqtt.availabilityTopic: ${problem}`);
  }
  return valid;
}

/**
 * Every rule of design §3 as `<path>: <message>` problems (empty = valid). Used by
 * `MqttAdapter.validateConfig` (422 INVALID_ENDPOINT_CONFIG with field errors).
 */
export function validateMqttConfig(
  config: Readonly<Record<string, unknown>>,
): string[] {
  const problems: Problems = [];
  for (const key of Object.keys(config)) {
    if (!TOP_LEVEL_KEYS.has(key)) problems.push(`${key}: unknown setting`);
  }
  const block = config.mqtt;
  if (!isRecord(block)) {
    problems.push('mqtt: required object');
    problems.push(...validatePayloadProfile(config.payloadProfile, []));
    return problems;
  }
  for (const key of Object.keys(block)) {
    if (!TRANSPORT_KEYS.has(key)) problems.push(`mqtt.${key}: unknown setting`);
  }
  const broker = parseBrokerUrl(block.brokerUrl);
  if (!broker) {
    problems.push(
      'mqtt.brokerUrl: must be mqtt://host[:port] or mqtts://host[:port] (IPv6 in brackets)',
    );
  }
  validateIdentity(block, problems);
  validateSession(block, problems);
  validateTls(block.tls, broker, problems);
  const topics = validateTopics(block, problems);
  problems.push(...validatePayloadProfile(config.payloadProfile, topics));
  return problems;
}

/** The effective MQTT client id: the configured one, or `proact-<connectionId>` when blank. */
export function effectiveClientId(
  clientId: string | undefined,
  connectionId: string,
): string {
  const trimmed = clientId?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : `proact-${connectionId}`;
}

/**
 * The typed configuration with defaults applied; throws a non-retryable `AdapterError`
 * (`INVALID_ENDPOINT_CONFIG`) when `validateMqttConfig` reports problems.
 */
export function parseMqttConfig(
  config: Readonly<Record<string, unknown>>,
): MqttConnectionConfig {
  const problems = validateMqttConfig(config);
  if (problems.length > 0) {
    throw new AdapterError(
      `Invalid MQTT endpoint configuration: ${problems.join('; ')}`,
      'INVALID_ENDPOINT_CONFIG',
      false,
      'config_invalid',
    );
  }
  const block = config.mqtt as Record<string, unknown>;
  const broker = parseBrokerUrl(block.brokerUrl) as BrokerUrl;
  const tls = (block.tls as MqttTlsConfig | undefined) ?? {
    ...MQTT_DEFAULTS.tls,
  };
  const mqtt: MqttTransportConfig = {
    brokerUrl: broker.normalized,
    protocolVersion:
      (block.protocolVersion as 4 | 5 | undefined) ??
      MQTT_DEFAULTS.protocolVersion,
    clientId: block.clientId as string | undefined,
    username: block.username as string | undefined,
    qos: (block.qos as 0 | 1 | 2 | undefined) ?? MQTT_DEFAULTS.qos,
    cleanStart:
      (block.cleanStart as boolean | undefined) ?? MQTT_DEFAULTS.cleanStart,
    sessionExpirySeconds:
      (block.sessionExpirySeconds as number | undefined) ??
      MQTT_DEFAULTS.sessionExpirySeconds,
    keepaliveSeconds:
      (block.keepaliveSeconds as number | undefined) ??
      MQTT_DEFAULTS.keepaliveSeconds,
    connectTimeoutSeconds:
      (block.connectTimeoutSeconds as number | undefined) ??
      MQTT_DEFAULTS.connectTimeoutSeconds,
    reconnect: (block.reconnect as MqttReconnectConfig | undefined) ?? {
      ...MQTT_DEFAULTS.reconnect,
    },
    tls,
    topics: [...(block.topics as string[])],
    availabilityTopic: block.availabilityTopic as string | undefined,
    maxMessageBytes:
      (block.maxMessageBytes as number | undefined) ??
      MQTT_DEFAULTS.maxMessageBytes,
  };
  return {
    mqtt,
    payloadProfile: config.payloadProfile as PayloadProfile,
    broker,
  };
}
