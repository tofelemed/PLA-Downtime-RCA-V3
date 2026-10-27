import { topicList, type MqttConnectionForm, type MqttFormErrors } from './mqtt-form';
import { feedErrorSummary, feedErrors } from './feeds';
import { parseTopicTemplate, topicFiltersOverlap, validateTopicFilter } from './topic-rules';

/**
 * Client-side mirror of the adapter's validation (`mqtt-config.ts`, `payload-profile.ts`, design §3)
 * for instant feedback. The server stays the judge: its 422 field errors are mapped onto the same
 * fields (`mqtt-steps.ts`).
 */
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const BROKER_URL = new RegExp(`^(mqtts?)://(?:\\[[0-9A-Fa-f:.]+\\]|${LABEL}(?:\\.${LABEL})*)(?::(\\d{1,5}))?$`);
export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SERVERNAME_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;
const CA_REF_PATTERN = /^secrets:[0-9a-f-]{36}$/;
const MAX_PEM_LENGTH = 65_536;
const MAX_TOPICS = 64;

export function isSecureBrokerUrl(brokerUrl: string): boolean {
  return /^mqtts:\/\//i.test(brokerUrl.trim());
}

/** The problem with a broker URL, or null (mirror of `parseBrokerUrl`). */
export function brokerUrlProblem(value: string): string | null {
  const match = BROKER_URL.exec(value.trim());
  if (!match) return 'Enter mqtt://host[:port] or mqtts://host[:port] (IPv6 in brackets; no path)';
  const port = match[2] === undefined ? 1883 : Number(match[2]);
  return port >= 1 && port <= 65535 ? null : 'Port must be between 1 and 65535';
}

function intProblem(value: string, min: number, max: number): string | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return `Must be an integer between ${min} and ${max}`;
  const number = Number(trimmed);
  return number >= min && number <= max ? null : `Must be an integer between ${min} and ${max}`;
}

/** The problems with the topic filter list (one line each), keyed like the server: `topics[i]`. */
export function topicsProblem(form: Pick<MqttConnectionForm, 'topics'>): string | null {
  const topics = topicList(form);
  if (topics.length === 0) return 'At least one topic filter is required';
  if (topics.length > MAX_TOPICS) return `At most ${MAX_TOPICS} topic filters`;
  const seen = new Set<string>();
  for (const [index, filter] of topics.entries()) {
    const problem = validateTopicFilter(filter);
    if (problem) return `Line ${index + 1}: ${problem}`;
    if (seen.has(filter)) return `Line ${index + 1}: duplicate of an earlier filter`;
    seen.add(filter);
  }
  return null;
}

export function pemProblem(pem: string): string | null {
  if (pem.length === 0) return 'Paste the CA certificate (PEM) for mode caPem';
  if (pem.length > MAX_PEM_LENGTH) return `At most ${MAX_PEM_LENGTH} characters`;
  if (!pem.includes('BEGIN CERTIFICATE')) return 'Must contain a BEGIN CERTIFICATE block';
  if (pem.includes('PRIVATE KEY')) return 'Must not contain a private key';
  return null;
}

/** Exactly one trust mode; anything but `system` needs mqtts://; the PEM and reference checks. */
export function tlsProblems(form: Pick<MqttConnectionForm, 'brokerUrl' | 'tlsMode' | 'caPem' | 'caRef' | 'servername'>): MqttFormErrors {
  const errors: MqttFormErrors = {};
  const secure = isSecureBrokerUrl(form.brokerUrl);
  if (form.tlsMode !== 'system' && !secure) errors.tlsMode = `${form.tlsMode} requires an mqtts:// broker URL`;
  if (form.tlsMode === 'caPem') {
    const problem = pemProblem(form.caPem);
    if (problem) errors.caPem = problem;
  }
  if (form.tlsMode === 'caRef' && !CA_REF_PATTERN.test(form.caRef.trim())) errors.caRef = 'Must be a secrets:<id> reference';
  if (form.servername.trim() && !SERVERNAME_PATTERN.test(form.servername.trim())) errors.servername = 'Must be a host name';
  return errors;
}

export interface ValidationOptions {
  /** off while the Profile step is filled before the Basics step holds the final topic filters */
  checkTopicOverlap?: boolean;
}

/** Template captures, the equipment capture for equipment profiles, and overlap with a topic filter. */
export function topicTemplateProblem(form: Pick<MqttConnectionForm, 'topicTemplate' | 'profileKind' | 'topics'>, options: ValidationOptions = {}): string | null {
  const parsed = parseTopicTemplate(form.topicTemplate.trim());
  if (typeof parsed === 'string') return parsed;
  if (form.profileKind !== 'availability' && !parsed.captures.some((name) => name === 'machine' || name === 'unit')) {
    return `Must capture the equipment level as {machine} or {unit} for ${form.profileKind}`;
  }
  if (options.checkTopicOverlap === false) return null;
  const topics = topicList(form).filter((filter) => validateTopicFilter(filter) === null);
  if (topics.length > 0 && !topics.some((filter) => topicFiltersOverlap(filter, parsed.filter))) {
    return 'No topic filter can match this template';
  }
  return null;
}

const INT_RANGES: ReadonlyArray<[keyof MqttConnectionForm & string, number, number]> = [
  ['sessionExpirySeconds', 0, 4_294_967_295],
  ['keepaliveSeconds', 1, 65_535],
  ['connectTimeoutSeconds', 1, 300],
  ['maxMessageBytes', 1, 1_048_576],
  ['reconnectMinSeconds', 1, 3600],
  ['reconnectMaxSeconds', 1, 3600],
];

function advancedProblems(form: MqttConnectionForm): MqttFormErrors {
  const errors: MqttFormErrors = {};
  for (const [field, min, max] of INT_RANGES) {
    const problem = intProblem(String(form[field]), min, max);
    if (problem) errors[field as keyof MqttFormErrors] = problem;
  }
  if (!errors.reconnectMinSeconds && !errors.reconnectMaxSeconds && Number(form.reconnectMaxSeconds) < Number(form.reconnectMinSeconds)) {
    errors.reconnectMaxSeconds = 'Must be at least the minimum';
  }
  for (const field of ['maxFutureSkewSeconds', 'maxPastSeconds'] as const) {
    if (form[field].trim() && intProblem(form[field], 0, Number.MAX_SAFE_INTEGER)) errors[field] = 'Must be an integer >= 0';
  }
  return errors;
}

/** Every rule the server applies, as inline messages per form field (empty = nothing to fix). */
export function mqttFormErrors(form: MqttConnectionForm, options: ValidationOptions = {}): MqttFormErrors {
  const errors: MqttFormErrors = { ...tlsProblems(form), ...advancedProblems(form) };
  if (form.displayName.trim() === '') errors.displayName = 'Name is required';
  const url = brokerUrlProblem(form.brokerUrl);
  if (url) errors.brokerUrl = url;
  if (form.profileKind === 'feeds') return { ...errors, ...feedsModeProblems(form) };
  const topics = topicsProblem(form);
  if (topics) errors.topics = topics;
  const template = topicTemplateProblem(form, options);
  if (template) errors.topicTemplate = template;
  return { ...errors, ...sharedProblems(form) };
}

/** Feeds mode: the feed rules instead of the topic filter and template rules (extra filters stay optional). */
function feedsModeProblems(form: MqttConnectionForm): MqttFormErrors {
  const errors: MqttFormErrors = sharedProblems(form);
  const extra = topicList(form);
  if (extra.length > 0) {
    const topics = topicsProblem(form);
    if (topics) errors.topics = topics;
  }
  const feeds = feedErrorSummary(feedErrors(form.feeds));
  if (feeds) errors.feeds = feeds;
  return errors;
}

function sharedProblems(form: MqttConnectionForm): MqttFormErrors {
  const errors: MqttFormErrors = {};
  const availability = form.availabilityTopic.trim() ? validateTopicFilter(form.availabilityTopic.trim()) : null;
  if (availability) errors.availabilityTopic = availability;
  if (form.clientId.trim() && !CLIENT_ID_PATTERN.test(form.clientId.trim())) errors.clientId = 'Must match ^[A-Za-z0-9_-]{1,64}$ (blank = derived proact-<connection id>)';
  if (form.username.length > 256) errors.username = 'At most 256 characters';
  if (!['0', '1', '2'].includes(form.qos)) errors.qos = 'Must be 0, 1 or 2';
  return errors;
}
