import type { ConnectionCreateBody, ConnectionUpdateBody } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';

/**
 * MQTT connection form (plan 1.8 WP3 step 5). It produces exactly the backend's `endpoint_config`
 * shape (`mqtt` transport block + `payloadProfile`, `server/.../mqtt-config.ts`, `payload-profile.ts`).
 * The password travels once as `secret` and is never read back; profile keys the wizard does not edit
 * (`fields`, `valueMaps`, `reasonUnmapped`, `tenancy`) are carried through untouched on edit.
 */
export const PROFILE_KINDS = ['interval_event_json', 'measurement_json', 'state_json', 'availability'] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];
export const IDENTITY_STRATEGIES = ['seq_boot', 'event_id', 'payload_hash'] as const;
export type IdentityStrategy = (typeof IDENTITY_STRATEGIES)[number];
export const TIME_UNITS = ['auto', 'ms', 's', 'iso'] as const;
export const QUALITY_PROTOCOLS = ['STRING_ENUM', 'OPC_DA', 'OPC_UA', 'SPARKPLUG', 'PI', 'NONE'] as const;
export const TLS_MODES = ['system', 'caPem', 'caRef', 'insecure'] as const;
export type TlsMode = (typeof TLS_MODES)[number];

export interface MqttConnectionForm {
  // profile step
  profileKind: ProfileKind;
  topicTemplate: string;
  identityStrategy: IdentityStrategy;
  // basics step
  displayName: string;
  brokerUrl: string;
  /** one topic filter per line */
  topics: string;
  availabilityTopic: string;
  // connection step
  protocolVersion: '5' | '4';
  username: string;
  /** new password; empty = none (create) or keep the stored one (edit) */
  secret: string;
  clientId: string;
  tlsMode: TlsMode;
  caPem: string;
  caRef: string;
  servername: string;
  // advanced step
  qos: '0' | '1' | '2';
  cleanStart: boolean;
  sessionExpirySeconds: string;
  keepaliveSeconds: string;
  connectTimeoutSeconds: string;
  reconnectMinSeconds: string;
  reconnectMaxSeconds: string;
  maxMessageBytes: string;
  schemaVersion: string;
  timeUnit: (typeof TIME_UNITS)[number];
  maxFutureSkewSeconds: string;
  maxPastSeconds: string;
  onStale: '' | 'reject' | 'flag';
  qualityProtocol: '' | (typeof QUALITY_PROTOCOLS)[number];
  /** profile keys the wizard does not edit, kept as stored */
  profileExtras: Record<string, unknown>;
}

export type MqttFormField = Exclude<keyof MqttConnectionForm, 'profileExtras'>;
export type MqttFormErrors = Partial<Record<MqttFormField, string>>;

/** Contract v1 presets per profile kind (docs/MQTT_OT_CONTRACT.md §2–3): template, filters, identity. */
export const PROFILE_PRESETS: Record<ProfileKind, { label: string; topicTemplate: string; topics: string; identityStrategy: IdentityStrategy; description: string }> = {
  interval_event_json: {
    label: 'Interval events (downtime / loss with start and end)',
    topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events',
    topics: 'proact/v1/+/+/+/+/events',
    identityStrategy: 'event_id',
    description: 'PI event frames as revisions of one event (event_id + revision); delete retracts.',
  },
  measurement_json: {
    label: 'Measurements (signal samples)',
    topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/measurements/{attribute}',
    topics: 'proact/v1/+/+/+/+/measurements/#',
    identityStrategy: 'seq_boot',
    description: 'PI point values with unit and quality, keyed by the signal source key.',
  },
  state_json: {
    label: 'Machine state (state signal)',
    topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/state',
    topics: 'proact/v1/+/+/+/+/state',
    identityStrategy: 'seq_boot',
    description: 'Machine-state samples bound to a state signal by the full MQTT topic; configure Unit State to derive stops.',
  },
  availability: {
    label: 'Gateway availability (ONLINE / OFFLINE, Last Will)',
    topicTemplate: 'proact/v1/{site}/gateway/availability',
    topics: 'proact/v1/+/gateway/availability',
    identityStrategy: 'seq_boot',
    description: 'Source liveness only: OFFLINE never creates a stop.',
  },
};

/** The backend defaults (`MQTT_DEFAULTS`, design §3), as the form shows them. */
export function emptyMqttForm(): MqttConnectionForm {
  const preset = PROFILE_PRESETS.interval_event_json;
  return {
    profileKind: 'interval_event_json',
    topicTemplate: preset.topicTemplate,
    identityStrategy: preset.identityStrategy,
    displayName: '',
    brokerUrl: '',
    topics: preset.topics,
    availabilityTopic: '',
    protocolVersion: '5',
    username: '',
    secret: '',
    clientId: '',
    tlsMode: 'system',
    caPem: '',
    caRef: '',
    servername: '',
    qos: '1',
    cleanStart: false,
    sessionExpirySeconds: '86400',
    keepaliveSeconds: '60',
    connectTimeoutSeconds: '30',
    reconnectMinSeconds: '1',
    reconnectMaxSeconds: '60',
    maxMessageBytes: '65536',
    schemaVersion: '1.0',
    timeUnit: 'iso',
    maxFutureSkewSeconds: '300',
    maxPastSeconds: '604800',
    onStale: '',
    qualityProtocol: 'PI',
    profileExtras: {},
  };
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback);
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  (options as readonly string[]).includes(value as string) ? (value as T) : fallback;

const WIZARD_PROFILE_KEYS = new Set(['kind', 'topicTemplate', 'identityStrategy', 'schemaVersion', 'time', 'quality']);

/** The form of a stored MQTT connection; the secret always starts empty. */
export function mqttFormFromConnection(connection: ConnectionView): MqttConnectionForm {
  const base = emptyMqttForm();
  const mqtt = record(connection.endpointConfig.mqtt);
  const profile = record(connection.endpointConfig.payloadProfile);
  const tls = record(mqtt.tls);
  const reconnect = record(mqtt.reconnect);
  const time = record(profile.time);
  const topics = Array.isArray(mqtt.topics) ? mqtt.topics.filter((entry): entry is string => typeof entry === 'string') : [];
  const extras = Object.fromEntries(Object.entries(profile).filter(([key]) => !WIZARD_PROFILE_KEYS.has(key)));
  return {
    ...base,
    profileKind: oneOf(profile.kind, PROFILE_KINDS, base.profileKind),
    topicTemplate: text(profile.topicTemplate),
    identityStrategy: oneOf(profile.identityStrategy, IDENTITY_STRATEGIES, 'seq_boot'),
    displayName: connection.displayName,
    brokerUrl: text(mqtt.brokerUrl),
    topics: topics.join('\n'),
    availabilityTopic: text(mqtt.availabilityTopic),
    protocolVersion: mqtt.protocolVersion === 4 ? '4' : '5',
    username: text(mqtt.username),
    clientId: text(mqtt.clientId),
    tlsMode: oneOf(tls.mode, TLS_MODES, 'system'),
    caPem: text(tls.caPem),
    caRef: text(tls.caRef),
    servername: text(tls.servername),
    qos: oneOf(text(mqtt.qos, '1'), ['0', '1', '2'] as const, '1'),
    cleanStart: mqtt.cleanStart === true,
    sessionExpirySeconds: text(mqtt.sessionExpirySeconds, base.sessionExpirySeconds),
    keepaliveSeconds: text(mqtt.keepaliveSeconds, base.keepaliveSeconds),
    connectTimeoutSeconds: text(mqtt.connectTimeoutSeconds, base.connectTimeoutSeconds),
    reconnectMinSeconds: text(reconnect.minSeconds, base.reconnectMinSeconds),
    reconnectMaxSeconds: text(reconnect.maxSeconds, base.reconnectMaxSeconds),
    maxMessageBytes: text(mqtt.maxMessageBytes, base.maxMessageBytes),
    schemaVersion: text(profile.schemaVersion),
    timeUnit: oneOf(time.unit, TIME_UNITS, 'auto'),
    maxFutureSkewSeconds: text(time.maxFutureSkewSeconds),
    maxPastSeconds: text(time.maxPastSeconds),
    onStale: oneOf(time.onStale, ['', 'reject', 'flag'] as const, ''),
    qualityProtocol: oneOf(record(profile.quality).protocol, ['', ...QUALITY_PROTOCOLS] as const, ''),
    profileExtras: extras,
  };
}

/** Topic filters of the form: one per line, trimmed, blanks dropped. */
export function topicList(form: Pick<MqttConnectionForm, 'topics'>): string[] {
  return form.topics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

const int = (value: string): number => Number(value.trim());

function tlsBlock(form: MqttConnectionForm): Record<string, unknown> {
  const tls: Record<string, unknown> = { mode: form.tlsMode };
  if (form.tlsMode === 'caPem') tls.caPem = form.caPem;
  if (form.tlsMode === 'caRef') tls.caRef = form.caRef.trim();
  if (form.tlsMode !== 'system' && form.servername.trim()) tls.servername = form.servername.trim();
  return tls;
}

function profileBlock(form: MqttConnectionForm): Record<string, unknown> {
  const time: Record<string, unknown> = { unit: form.timeUnit };
  if (form.maxFutureSkewSeconds.trim()) time.maxFutureSkewSeconds = int(form.maxFutureSkewSeconds);
  if (form.maxPastSeconds.trim()) time.maxPastSeconds = int(form.maxPastSeconds);
  if (form.onStale) time.onStale = form.onStale;
  const profile: Record<string, unknown> = {
    kind: form.profileKind,
    topicTemplate: form.topicTemplate.trim(),
    identityStrategy: form.identityStrategy,
    time,
    ...form.profileExtras,
  };
  if (form.schemaVersion.trim()) profile.schemaVersion = form.schemaVersion.trim();
  if (form.qualityProtocol) profile.quality = { protocol: form.qualityProtocol };
  return profile;
}

/** `endpoint_config` exactly as the adapter validates it (credentials never inside). */
export function mqttEndpointConfig(form: MqttConnectionForm): Record<string, unknown> {
  const mqtt: Record<string, unknown> = {
    brokerUrl: form.brokerUrl.trim(),
    protocolVersion: form.protocolVersion === '4' ? 4 : 5,
    qos: int(form.qos),
    cleanStart: form.cleanStart,
    sessionExpirySeconds: int(form.sessionExpirySeconds),
    keepaliveSeconds: int(form.keepaliveSeconds),
    connectTimeoutSeconds: int(form.connectTimeoutSeconds),
    reconnect: { minSeconds: int(form.reconnectMinSeconds), maxSeconds: int(form.reconnectMaxSeconds) },
    tls: tlsBlock(form),
    topics: topicList(form),
    maxMessageBytes: int(form.maxMessageBytes),
  };
  if (form.clientId.trim()) mqtt.clientId = form.clientId.trim();
  if (form.username.trim()) mqtt.username = form.username.trim();
  if (form.availabilityTopic.trim()) mqtt.availabilityTopic = form.availabilityTopic.trim();
  return { mqtt, payloadProfile: profileBlock(form) };
}

export function mqttCreateBody(form: MqttConnectionForm): ConnectionCreateBody {
  return {
    sourceType: 'mqtt',
    displayName: form.displayName.trim(),
    endpointConfig: mqttEndpointConfig(form),
    isActive: true,
    ...(form.secret ? { secret: form.secret } : {}),
  };
}

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === 'object' && entry !== null && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : entry,
  );

/** Only what changed; null when nothing did. A typed secret replaces the stored one. */
export function mqttUpdateBody(form: MqttConnectionForm, connection: ConnectionView): ConnectionUpdateBody | null {
  const body: ConnectionUpdateBody = {};
  const config = mqttEndpointConfig(form);
  if (form.displayName.trim() !== connection.displayName) body.displayName = form.displayName.trim();
  if (canonical(config) !== canonical(connection.endpointConfig)) body.endpointConfig = config;
  if (form.secret) body.secret = form.secret;
  return Object.keys(body).length > 0 ? body : null;
}
