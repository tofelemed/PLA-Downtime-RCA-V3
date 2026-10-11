import type { FieldError } from '@/api/v2/errors';
import type { MqttFormErrors, MqttFormField } from './mqtt-form';

/** The four wizard steps (plan 3.7 MQTT wizard: profile → basics → connection → advanced). */
export type WizardStep = 'profile' | 'basics' | 'connection' | 'advanced';
export const WIZARD_STEPS: ReadonlyArray<{ key: WizardStep; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'basics', label: 'Basics' },
  { key: 'connection', label: 'Connection' },
  { key: 'advanced', label: 'Advanced' },
];

/** Which step owns each form field (and so each inline error). */
export const FIELD_STEP: Record<MqttFormField, WizardStep> = {
  profileKind: 'profile',
  topicTemplate: 'profile',
  identityStrategy: 'profile',
  displayName: 'basics',
  brokerUrl: 'basics',
  topics: 'basics',
  availabilityTopic: 'basics',
  protocolVersion: 'connection',
  username: 'connection',
  secret: 'connection',
  clientId: 'connection',
  tlsMode: 'connection',
  caPem: 'connection',
  caRef: 'connection',
  servername: 'connection',
  qos: 'advanced',
  cleanStart: 'advanced',
  sessionExpirySeconds: 'advanced',
  keepaliveSeconds: 'advanced',
  connectTimeoutSeconds: 'advanced',
  reconnectMinSeconds: 'advanced',
  reconnectMaxSeconds: 'advanced',
  maxMessageBytes: 'advanced',
  schemaVersion: 'advanced',
  timeUnit: 'advanced',
  maxFutureSkewSeconds: 'advanced',
  maxPastSeconds: 'advanced',
  onStale: 'advanced',
  qualityProtocol: 'advanced',
};

/** Server field paths (`endpointConfig.mqtt.x`, `endpointConfig.payloadProfile.y`, `secret`) → form field. */
const SERVER_FIELDS: ReadonlyArray<[pattern: RegExp, field: MqttFormField]> = [
  [/^displayName$/, 'displayName'],
  [/^secret$/, 'secret'],
  [/^endpointConfig\.mqtt\.brokerUrl$/, 'brokerUrl'],
  [/^endpointConfig\.mqtt\.topics(\[\d+\])?$/, 'topics'],
  [/^endpointConfig\.mqtt\.availabilityTopic$/, 'availabilityTopic'],
  [/^endpointConfig\.mqtt\.protocolVersion$/, 'protocolVersion'],
  [/^endpointConfig\.mqtt\.username$/, 'username'],
  [/^endpointConfig\.mqtt\.clientId$/, 'clientId'],
  [/^endpointConfig\.mqtt\.tls\.caPem$/, 'caPem'],
  [/^endpointConfig\.mqtt\.tls\.caRef$/, 'caRef'],
  [/^endpointConfig\.mqtt\.tls\.servername$/, 'servername'],
  [/^endpointConfig\.mqtt\.tls(\.\w+)?$/, 'tlsMode'],
  [/^endpointConfig\.mqtt\.qos$/, 'qos'],
  [/^endpointConfig\.mqtt\.cleanStart$/, 'cleanStart'],
  [/^endpointConfig\.mqtt\.sessionExpirySeconds$/, 'sessionExpirySeconds'],
  [/^endpointConfig\.mqtt\.keepaliveSeconds$/, 'keepaliveSeconds'],
  [/^endpointConfig\.mqtt\.connectTimeoutSeconds$/, 'connectTimeoutSeconds'],
  [/^endpointConfig\.mqtt\.reconnect(\.\w+)?$/, 'reconnectMinSeconds'],
  [/^endpointConfig\.mqtt\.maxMessageBytes$/, 'maxMessageBytes'],
  [/^endpointConfig\.payloadProfile\.kind$/, 'profileKind'],
  [/^endpointConfig\.payloadProfile\.topicTemplate$/, 'topicTemplate'],
  [/^endpointConfig\.payloadProfile\.identityStrategy$/, 'identityStrategy'],
  [/^endpointConfig\.payloadProfile\.schemaVersion$/, 'schemaVersion'],
  [/^endpointConfig\.payloadProfile\.time\.unit$/, 'timeUnit'],
  [/^endpointConfig\.payloadProfile\.time\.maxFutureSkewSeconds$/, 'maxFutureSkewSeconds'],
  [/^endpointConfig\.payloadProfile\.time\.maxPastSeconds$/, 'maxPastSeconds'],
  [/^endpointConfig\.payloadProfile\.time(\.\w+)?$/, 'onStale'],
  [/^endpointConfig\.payloadProfile\.quality(\.\w+)?$/, 'qualityProtocol'],
  [/^endpointConfig\.payloadProfile(\..+)?$/, 'topicTemplate'],
  [/^endpointConfig\.mqtt(\..+)?$/, 'brokerUrl'],
];

/** The form field a server field error belongs to (null = not a form field; shown as a refusal). */
export function formFieldOf(serverField: string): MqttFormField | null {
  const match = SERVER_FIELDS.find(([pattern]) => pattern.test(serverField));
  return match ? match[1] : null;
}

/** Server field errors as inline form errors (first message per field wins). */
export function errorsFromServer(fieldErrors: readonly FieldError[]): MqttFormErrors {
  const errors: MqttFormErrors = {};
  for (const entry of fieldErrors) {
    const field = formFieldOf(entry.field);
    if (field && !errors[field]) errors[field] = entry.message;
  }
  return errors;
}

/** The first step (in wizard order) that has an error, or null. */
export function firstStepWithErrors(errors: MqttFormErrors): WizardStep | null {
  const fields = Object.keys(errors) as MqttFormField[];
  return WIZARD_STEPS.map((step) => step.key).find((step) => fields.some((field) => FIELD_STEP[field] === step)) ?? null;
}

/** The errors that belong to one step. */
export function errorsOfStep(errors: MqttFormErrors, step: WizardStep): MqttFormErrors {
  return Object.fromEntries(Object.entries(errors).filter(([field]) => FIELD_STEP[field as MqttFormField] === step)) as MqttFormErrors;
}
