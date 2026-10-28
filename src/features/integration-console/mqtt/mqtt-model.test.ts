import { describe, expect, it } from 'vitest';
import type { ConnectionView, IngestionJobView } from '@/api/v2/types/integrations';
import { emptyMqttForm, mqttCreateBody, mqttEndpointConfig, mqttFormFromConnection, mqttUpdateBody, PROFILE_PRESETS } from './model/mqtt-form';
import { awaitsSubscribeJob, mqttHealthOf, secondsSince, subscribeJobOf, subscriptionStatus } from './model/mqtt-health';
import { errorsFromServer, firstStepWithErrors, formFieldOf } from './model/mqtt-steps';
import { brokerUrlProblem, mqttFormErrors, pemProblem, tlsProblems, topicsProblem, topicTemplateProblem } from './model/mqtt-validation';
import { profileDraftErrors, profileDraftOf, profilePatchOf } from './model/profile-draft';
import { parseTopicTemplate, topicFiltersOverlap, validateTopicFilter } from './model/topic-rules';
import { classifyToken, stateMapProblem, tokenOfInput } from './model/value-map-classify';

/** the contract v1 interval preset (the wizard's default is the feeds profile since 26 Oct 2026) */
const contractForm = () => ({ ...emptyMqttForm(), profileKind: 'interval_event_json' as const, topics: PROFILE_PRESETS.interval_event_json.topics });
const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
const NOW = Date.parse('2026-10-11T08:00:00Z');

const connection = (patch: Partial<ConnectionView> = {}): ConnectionView => ({
  id: 'c1',
  sourceType: 'mqtt',
  displayName: 'Lab',
  endpointConfig: {
    mqtt: { brokerUrl: 'mqtt://mqtt:1883', protocolVersion: 5, username: 'lab', qos: 1, cleanStart: false, sessionExpirySeconds: 86400, keepaliveSeconds: 60, connectTimeoutSeconds: 30, reconnect: { minSeconds: 1, maxSeconds: 60 }, tls: { mode: 'system' }, topics: ['proact/v1/+/+/+/+/events'], maxMessageBytes: 65536 },
    payloadProfile: { kind: 'interval_event_json', schemaVersion: '1.0', topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events', fields: { eventTime: 'ts', sequence: 'seq', bootId: 'boot_id' }, time: { unit: 'iso', maxFutureSkewSeconds: 300, maxPastSeconds: 604800 }, quality: { protocol: 'PI' }, identityStrategy: 'event_id' },
  },
  hasSecret: true,
  effectiveClientId: 'proact-c1',
  capabilities: {},
  configVersion: 1,
  isActive: true,
  rowVersion: 1,
  createdAt: '2026-10-11T00:00:00Z',
  updatedAt: null,
  ...patch,
});

const job = (patch: Partial<IngestionJobView> = {}): IngestionJobView => ({
  id: 'j1', connectionId: 'c1', scope: { mode: 'subscribe' }, state: 'running', leaseOwner: 'w1', leaseExpiry: '2026-10-11T08:01:00Z', heartbeatAt: '2026-10-11T07:59:50Z',
  committedCursor: null, lastObservationAt: null, lastSuccessAt: null, retryCount: 0, lastError: null, cadence: null, nextRunAt: null, health: {}, rowVersion: 1, createdAt: '2026-10-11T07:00:00Z', updatedAt: null, ...patch,
});

describe('MQTT form → endpoint_config (plan 1.8 step 5)', () => {
  it('produces exactly the adapter shape with the defaults and the contract v1 preset', () => {
    const form = { ...contractForm(), displayName: ' Lab ', brokerUrl: ' mqtt://mqtt:1883 ', username: 'lab', secret: 'pw' };
    const body = mqttCreateBody(form);
    expect(body).toEqual({
      sourceType: 'mqtt',
      displayName: 'Lab',
      isActive: true,
      secret: 'pw',
      endpointConfig: {
        mqtt: { brokerUrl: 'mqtt://mqtt:1883', protocolVersion: 5, username: 'lab', qos: 1, cleanStart: false, sessionExpirySeconds: 86400, keepaliveSeconds: 60, connectTimeoutSeconds: 30, reconnect: { minSeconds: 1, maxSeconds: 60 }, tls: { mode: 'system' }, topics: ['proact/v1/+/+/+/+/events'], maxMessageBytes: 65536 },
        payloadProfile: { kind: 'interval_event_json', schemaVersion: '1.0', topicTemplate: PROFILE_PRESETS.interval_event_json.topicTemplate, identityStrategy: 'event_id', time: { unit: 'iso', maxFutureSkewSeconds: 300, maxPastSeconds: 604800 }, quality: { protocol: 'PI' } },
      },
    });
    expect(JSON.stringify(body.endpointConfig)).not.toContain('pw');
    expect(mqttCreateBody({ ...form, secret: '' })).not.toHaveProperty('secret');
  });

  it('round-trips a stored connection, keeps profile keys the wizard does not edit, and sends only what changed', () => {
    const stored = connection();
    const form = mqttFormFromConnection(stored);
    expect(form.secret).toBe('');
    expect(form.profileExtras).toEqual({ fields: { eventTime: 'ts', sequence: 'seq', bootId: 'boot_id' } });
    expect(mqttUpdateBody(form, stored)).toBeNull();
    expect(mqttUpdateBody({ ...form, secret: 'rotated' }, stored)).toEqual({ secret: 'rotated' });
    const changed = mqttUpdateBody({ ...form, topics: 'proact/v1/+/+/+/+/events\nproact/v1/+/+/+/+/state' }, stored);
    expect(changed?.endpointConfig).toMatchObject({ mqtt: { topics: ['proact/v1/+/+/+/+/events', 'proact/v1/+/+/+/+/state'] }, payloadProfile: { fields: { bootId: 'boot_id' } } });
    expect(changed).not.toHaveProperty('displayName');
  });

  it('TLS block only carries the keys of its mode; servername only off system', () => {
    const base = { ...emptyMqttForm(), brokerUrl: 'mqtts://b:8883', caPem: PEM, caRef: 'secrets:x', servername: 'mosquitto' };
    const mqtt = (form: typeof base) => (mqttEndpointConfig(form).mqtt as { tls: unknown }).tls;
    expect(mqtt({ ...base, tlsMode: 'system' })).toEqual({ mode: 'system' });
    expect(mqtt({ ...base, tlsMode: 'caPem' })).toEqual({ mode: 'caPem', caPem: PEM, servername: 'mosquitto' });
    expect(mqtt({ ...base, tlsMode: 'caRef' })).toEqual({ mode: 'caRef', caRef: 'secrets:x', servername: 'mosquitto' });
    expect(mqtt({ ...base, tlsMode: 'insecure' })).toEqual({ mode: 'insecure', servername: 'mosquitto' });
  });
});

describe('validation mirrors of mqtt-config.ts / payload-profile.ts', () => {
  it('broker URL: scheme, host, port, no path; IPv6 in brackets', () => {
    expect(brokerUrlProblem('mqtt://broker.plant.local')).toBeNull();
    expect(brokerUrlProblem('mqtts://192.168.1.9:8883')).toBeNull();
    expect(brokerUrlProblem('mqtt://[::1]:1883')).toBeNull();
    expect(brokerUrlProblem('http://broker')).not.toBeNull();
    expect(brokerUrlProblem('mqtt://broker/path')).not.toBeNull();
    expect(brokerUrlProblem('mqtt://broker:70000')).not.toBeNull();
  });

  it('topic filters: + whole level, # last level only, duplicates, at least one', () => {
    expect(validateTopicFilter('a/+/b/#')).toBeNull();
    expect(validateTopicFilter('a/#/b')).toBe('# is only allowed as the last level');
    expect(validateTopicFilter('a/b#')).toBe('# must be a whole level');
    expect(validateTopicFilter('a/b+/c')).toBe('+ must be a whole level');
    expect(topicsProblem({ topics: '' })).toBe('At least one topic filter is required');
    expect(topicsProblem({ topics: 'a/b\n\na/b' })).toBe('Line 2: duplicate of an earlier filter');
    expect(topicsProblem({ topics: 'a/b\na/#/c' })).toMatch(/^Line 2: #/);
    expect(topicFiltersOverlap('proact/v1/+/+/+/+/events', 'proact/v1/HDPE/#')).toBe(true);
    expect(topicFiltersOverlap('a/+/c', 'a/b/d')).toBe(false);
  });

  it('topic template: captures, equipment capture, overlap with a filter', () => {
    expect(parseTopicTemplate('p/{site}/{unit}/events')).toEqual({ captures: ['site', 'unit'], filter: 'p/+/+/events' });
    expect(parseTopicTemplate('p/{site}/{site}')).toBe('captures {site} more than once');
    expect(parseTopicTemplate('p/+/x')).toMatch(/must be a literal or a \{capture\}/);
    expect(topicTemplateProblem({ topicTemplate: 'p/{site}/events', profileKind: 'interval_event_json', topics: 'p/+/events' })).toMatch(/\{machine\} or \{unit\}/);
    expect(topicTemplateProblem({ topicTemplate: 'p/{site}/gateway/availability', profileKind: 'availability', topics: 'p/+/gateway/availability' })).toBeNull();
    expect(topicTemplateProblem({ topicTemplate: 'p/{unit}/events', profileKind: 'state_json', topics: 'other/#' })).toBe('No topic filter can match this template');
    expect(topicTemplateProblem({ topicTemplate: 'p/{unit}/events', profileKind: 'state_json', topics: 'other/#' }, { checkTopicOverlap: false })).toBeNull();
  });

  it('TLS: one mode, mqtts:// required off system, PEM checks', () => {
    expect(tlsProblems({ brokerUrl: 'mqtt://b', tlsMode: 'caPem', caPem: PEM, caRef: '', servername: '' })).toMatchObject({ tlsMode: 'caPem requires an mqtts:// broker URL' });
    expect(pemProblem('')).toMatch(/Paste/);
    expect(pemProblem('nothing')).toBe('Must contain a BEGIN CERTIFICATE block');
    expect(pemProblem(`${PEM}\n-----BEGIN PRIVATE KEY-----`)).toBe('Must not contain a private key');
    expect(pemProblem('x'.repeat(70_000))).toMatch(/At most 65536/);
    expect(tlsProblems({ brokerUrl: 'mqtts://b', tlsMode: 'caRef', caPem: '', caRef: 'nope', servername: 'bad name' })).toEqual({ caRef: 'Must be a secrets:<id> reference', servername: 'Must be a host name' });
    expect(tlsProblems({ brokerUrl: 'mqtts://b', tlsMode: 'insecure', caPem: '', caRef: '', servername: '' })).toEqual({});
  });

  it('whole form: required name, client id pattern, QoS, integer ranges, reconnect order', () => {
    const ok = { ...contractForm(), displayName: 'x', brokerUrl: 'mqtt://b' };
    expect(mqttFormErrors(ok)).toEqual({});
    const errors = mqttFormErrors({ ...ok, displayName: ' ', clientId: 'pro act', keepaliveSeconds: '0', reconnectMinSeconds: '30', reconnectMaxSeconds: '5', maxPastSeconds: '-1', sessionExpirySeconds: '1.5' });
    expect(Object.keys(errors).sort()).toEqual(['clientId', 'displayName', 'keepaliveSeconds', 'maxPastSeconds', 'reconnectMaxSeconds', 'sessionExpirySeconds']);
    expect(errors.reconnectMaxSeconds).toBe('Must be at least the minimum');
  });
});

describe('server field errors → form field → wizard step', () => {
  it('maps every documented path onto the owning step', () => {
    expect(formFieldOf('endpointConfig.mqtt.brokerUrl')).toBe('brokerUrl');
    expect(formFieldOf('endpointConfig.mqtt.topics[2]')).toBe('topics');
    expect(formFieldOf('endpointConfig.mqtt.tls.caPem')).toBe('caPem');
    expect(formFieldOf('endpointConfig.mqtt.tls.mode')).toBe('tlsMode');
    expect(formFieldOf('endpointConfig.mqtt.reconnect')).toBe('reconnectMinSeconds');
    expect(formFieldOf('endpointConfig.payloadProfile.topicTemplate')).toBe('topicTemplate');
    expect(formFieldOf('endpointConfig.payloadProfile.time.maxPastSeconds')).toBe('maxPastSeconds');
    expect(formFieldOf('endpointConfig.payloadProfile.valueMaps.state')).toBe('topicTemplate');
    expect(formFieldOf('secret')).toBe('secret');
    expect(formFieldOf('somethingElse')).toBeNull();
    const errors = errorsFromServer([
      { field: 'endpointConfig.mqtt.qos', message: 'must be 0, 1 or 2' },
      { field: 'endpointConfig.mqtt.brokerUrl', message: 'bad' },
      { field: 'endpointConfig.mqtt.brokerUrl', message: 'ignored second' },
    ]);
    expect(errors).toEqual({ qos: 'must be 0, 1 or 2', brokerUrl: 'bad' });
    expect(firstStepWithErrors(errors)).toBe('basics');
    expect(firstStepWithErrors({ qos: 'x' })).toBe('advanced');
    expect(firstStepWithErrors({ secret: 'required when the endpoint changes' })).toBe('connection');
    expect(firstStepWithErrors({})).toBeNull();
  });
});

describe('value-map classification (mirror of value-maps.ts)', () => {
  const map = { RUN: 'running', '2': 'stopped', Idle: 'idle', idle: 'idle' };

  it('tokens: integers as integer strings, booleans, {"name"} objects, text itself; fractions have none', () => {
    expect(tokenOfInput('4.0')).toBe('4');
    expect(tokenOfInput('4.5')).toBeNull();
    expect(tokenOfInput('true')).toBe('true');
    expect(tokenOfInput('{"name":"RUN","value":1}')).toBe('RUN');
    expect(tokenOfInput('{"value":1}')).toBeNull();
    expect(tokenOfInput('  STOP ')).toBe('STOP');
    expect(tokenOfInput('')).toBeNull();
  });

  it('exact first, then case-insensitive when unambiguous, else unmapped → quarantined', () => {
    expect(classifyToken(map, 'RUN', { kind: 'state' })).toEqual({ outcome: 'mapped', token: 'RUN', value: 'running', exact: true });
    expect(classifyToken(map, 'run', { kind: 'state' })).toEqual({ outcome: 'mapped', token: 'run', value: 'running', exact: false });
    expect(classifyToken(map, '2.0', { kind: 'state' })).toMatchObject({ outcome: 'mapped', value: 'stopped' });
    expect(classifyToken(map, 'IDLE', { kind: 'state' })).toMatchObject({ outcome: 'unmapped', reason: '"IDLE" matches several map keys by case', consequence: 'quarantined' });
    expect(classifyToken(map, 'STOP', { kind: 'state' })).toMatchObject({ outcome: 'unmapped', consequence: 'quarantined' });
    expect(classifyToken({ E1: 'MECH-01' }, 'E9', { kind: 'reason', keepUnmappedReason: true })).toMatchObject({ outcome: 'unmapped', consequence: 'kept_raw' });
    expect(classifyToken({}, 'E9', { kind: 'reason' })).toEqual({ outcome: 'passthrough', token: 'E9' });
    expect(classifyToken(map, '1.5', { kind: 'state' })).toMatchObject({ outcome: 'no_token' });
  });

  it('a state map must keep running or stopped reachable', () => {
    expect(stateMapProblem(undefined)).toBeNull();
    expect(stateMapProblem({ RUN: 'running' })).toBeNull();
    expect(stateMapProblem({ RUN: 'idle' })).toMatch(/running or stopped/);
    expect(stateMapProblem({})).toMatch(/running or stopped/);
  });
});

describe('profile draft → merge patch', () => {
  it('sends only the changed keys, nulls for removed ones, never the transport block', () => {
    const stored = connection();
    const draft = profileDraftOf(stored);
    expect(profilePatchOf(stored, draft)).toBeNull();
    const edited = {
      ...draft,
      fields: draft.fields.filter((row) => row.token !== 'bootId'),
      maxPastSeconds: '86400',
      qualityProtocol: '' as const,
      stateMap: [{ token: 'RUN', value: 'running' }, { token: 'STOP', value: 'stopped' }],
    };
    expect(profilePatchOf(stored, edited)).toEqual({
      fields: { bootId: null },
      time: { maxPastSeconds: 86400 },
      quality: null,
      valueMaps: { state: { RUN: 'running', STOP: 'stopped' } },
    });
    expect(profileDraftErrors(edited)).toEqual({});
    expect(profileDraftErrors({ ...edited, stateMap: [{ token: 'RUN', value: 'idle' }] }).stateMap).toMatch(/running or stopped/);
    expect(profileDraftErrors({ ...edited, stateMap: [{ token: 'RUN', value: '' }] }).stateMap).toMatch(/no silent default/);
    expect(profileDraftErrors({ ...edited, topicTemplate: 'x/{site}' }).topicTemplate).toMatch(/\{machine\} or \{unit\}/);
    expect(profileDraftErrors({ ...edited, fields: [{ token: 'eventTime', value: 'a b' }] }).fields).toMatch(/dotted JSON path/);
  });

  it('an untouched profile stored with another key order is clean: no patch, no undefined keys (INT-05d)', () => {
    const serverOrder = connection({
      endpointConfig: {
        ...connection().endpointConfig,
        payloadProfile: {
          time: { maxPastSeconds: 604800, unit: 'iso', maxFutureSkewSeconds: 300 },
          valueMaps: { state: { STOP: 'stopped', RUN: 'running' } },
          quality: { protocol: 'PI' },
          fields: { bootId: 'boot_id', sequence: 'seq', eventTime: 'ts' },
          identityStrategy: 'event_id',
          topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events',
          schemaVersion: '1.0',
          kind: 'interval_event_json',
        },
      },
    });
    const draft = profileDraftOf(serverOrder);
    expect(profilePatchOf(serverOrder, draft)).toBeNull();
    expect(profilePatchOf(serverOrder, { ...draft, stateMap: [...draft.stateMap].reverse() })).toBeNull();
    const changed = profilePatchOf(serverOrder, { ...draft, maxFutureSkewSeconds: '600' });
    expect(changed).toEqual({ time: { maxFutureSkewSeconds: 600 } });
    expect(Object.values(changed ?? {})).not.toContain(undefined);
  });

  it('removing every state mapping removes the map; clearing the time block removes it', () => {
    const stored = connection({ endpointConfig: { ...connection().endpointConfig, payloadProfile: { kind: 'state_json', topicTemplate: 'p/{unit}/state', valueMaps: { state: { RUN: 'running' } }, time: { unit: 'iso' } } } });
    const draft = profileDraftOf(stored);
    expect(profilePatchOf(stored, { ...draft, stateMap: [], timeUnit: '' })).toEqual({ valueMaps: { state: null }, time: null });
  });
});

describe('subscription health and status (design §8)', () => {
  it('parses the heartbeat keys and tolerates missing ones', () => {
    const health = mqttHealthOf({ connected: true, reconnects: 2, counters: { received: 5, accepted: 4, quarantined: 1 }, subscribedTopics: ['a/#', 7], persistFailed: null, sourceAvailable: false, effectiveClientId: 'proact-x' });
    expect(health).toMatchObject({ connected: true, reconnects: 2, subscribedTopics: ['a/#'], sourceAvailable: false, effectiveClientId: 'proact-x', counters: { received: 5, accepted: 4, quarantined: 1, duplicate: 0, parked: 0 } });
    expect(mqttHealthOf(undefined).connected).toBe(false);
  });

  it('waits for the worker until the subscribe job exists and has left "created"', () => {
    expect(awaitsSubscribeJob([])).toBe(true);
    expect(awaitsSubscribeJob([job({ scope: { mode: 'window' } })])).toBe(true);
    expect(awaitsSubscribeJob([job({ state: 'created' })])).toBe(true);
    expect(awaitsSubscribeJob([job()])).toBe(false);
    expect(awaitsSubscribeJob([job({ state: 'paused' })])).toBe(false);
  });

  it('picks the live subscribe job and never says healthy when persisting fails', () => {
    expect(subscribeJobOf([job({ id: 'old', state: 'stopped' }), job({ id: 'live' }), job({ id: 'pull', scope: { mode: 'window' } })])?.id).toBe('live');
    expect(subscribeJobOf([])).toBeNull();
    const connected = mqttHealthOf({ connected: true });
    expect(subscriptionStatus(job(), connected, NOW).status).toBe('connected');
    expect(subscriptionStatus(job(), mqttHealthOf({ connected: true, persistFailed: { at: 'x', error: 'db down' } }), NOW)).toMatchObject({ status: 'persist_failed', tone: 'error', detail: 'db down' });
    expect(subscriptionStatus(job(), mqttHealthOf({ connected: true, parkedReason: 'duplicate_feed', parkedDetail: 'other wins' }), NOW)).toMatchObject({ status: 'parked', tone: 'warning' });
    expect(subscriptionStatus(job(), mqttHealthOf({ connected: false, connectionError: 'ECONNREFUSED' }), NOW)).toMatchObject({ status: 'disconnected', detail: 'ECONNREFUSED' });
    expect(subscriptionStatus(job({ leaseExpiry: '2026-10-11T07:00:00Z' }), connected, NOW).status).toBe('no_lease');
    expect(subscriptionStatus(job({ state: 'paused' }), connected, NOW)).toMatchObject({ status: 'paused', tone: 'idle' });
    expect(subscriptionStatus(null, connected, NOW).status).toBe('no_job');
  });
});

describe('secondsSince', () => {
  const now = Date.parse('2026-10-11T08:00:00Z');
  it('is signed: positive in the past, negative when the source clock is ahead, null for never', () => {
    expect(secondsSince('2026-10-11T07:59:50Z', now)).toBe(10);
    expect(secondsSince('2026-10-11T08:00:42Z', now)).toBe(-42);
    expect(secondsSince(null, now)).toBeNull();
  });
});
