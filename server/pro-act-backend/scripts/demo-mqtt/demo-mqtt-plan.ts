/**
 * What the MQTT publisher simulator (`npm run mqtt:sim`) needs from a tenant so its messages land in
 * the plant instead of the quarantine: the equipment it publishes for, the two connections (one
 * payload profile each: events and measurements), the placement rules, the attribute aliases, the
 * codes and the signals. Everything is derived from the simulator's own defaults so the two never drift.
 */
import { FieldRule } from '../../src/attribute-mapping/field-rule';
import {
  elementPathOf,
  Equipment,
  SIM_CODE_VALUES,
  SIM_TEMPLATE_NAME,
  topicsOf,
} from '../mqtt/sim-messages';

/** The simulator's default `--namespace`, `--site`, `--area`, `--line`, `--unit`. */
export const SIM_NAMESPACE = 'proact/v1';
export const SIM_EQUIPMENT: Equipment = {
  site: 'HDPE',
  area: 'Polymer',
  line: 'Line1',
  unit: 'Extruder1',
};
export const SIM_TOPICS = topicsOf(SIM_NAMESPACE, SIM_EQUIPMENT);
export const SIM_ELEMENT_PATH = elementPathOf(SIM_EQUIPMENT);
export const TEMPLATE_NAME = SIM_TEMPLATE_NAME;

/** The simulator's `--url` default: the Compose broker's anonymous listener on the host. */
export const DEFAULT_BROKER_URL = 'mqtt://localhost:1884';

export const EVENTS_CONNECTION_NAME = 'Demo: MQTT events (simulator)';
export const MEASUREMENTS_CONNECTION_NAME =
  'Demo: MQTT measurements (simulator)';

/** The unit the seeder creates when the tenant has none for the simulated equipment. */
export const DEMO_UNIT = {
  code: 'unit100',
  name: 'unit100',
  description:
    'Demo unit of the MQTT publisher simulator (scripts/demo-mqtt); safe to delete',
};

export interface CodePlan {
  code: string;
  name: string;
}

/** The simulator's code values with the names a missing code is created with. */
export const SIM_CODES: {
  reason: CodePlan[];
  impact: CodePlan;
  oee: CodePlan;
} = {
  reason: [
    { code: SIM_CODE_VALUES.reasons[0], name: 'Mechanical' },
    { code: SIM_CODE_VALUES.reasons[1], name: 'Electrical' },
  ],
  impact: { code: SIM_CODE_VALUES.impact, name: 'Equipment Failure' },
  oee: { code: SIM_CODE_VALUES.oee, name: 'Unplanned Downtime' },
};

export interface SignalPlan {
  /** the simulator's `--signal` / `--digital-signal` */
  sourceKey: string;
  name: string;
  semanticType: 'counter' | 'state';
  canonicalUom: string | null;
  /** the `{attribute}` level the simulator publishes the samples on */
  attribute: string;
}

export const SIM_SIGNALS: readonly SignalPlan[] = [
  {
    sourceKey: 'F1DPwebid-throughput',
    name: 'Demo: Extruder1 pellet totalizer',
    semanticType: 'counter',
    canonicalUom: 't',
    attribute: 'Throughput',
  },
  {
    sourceKey: 'F1DPwebid-runstate',
    name: 'Demo: Extruder1 run state',
    semanticType: 'state',
    canonicalUom: null,
    attribute: 'RunState',
  },
];

/** The catalog names and, as aliases, the spaced names of the contract examples. */
export const ALIAS_FIELD_RULES: readonly FieldRule[] = [
  {
    sourceAttr: 'ReasonCode',
    aliases: ['Reason Code'],
    targetField: 'reason',
    type: 'digital',
  },
  {
    sourceAttr: 'ImpactCode',
    aliases: ['Impact Code'],
    targetField: 'impactCode',
    type: 'digital',
  },
  {
    sourceAttr: 'OEECode',
    aliases: ['OEE Code'],
    targetField: 'oeeCode',
    type: 'digital',
  },
  { sourceAttr: 'Description', targetField: 'description', type: 'string' },
  { sourceAttr: 'Quantity', targetField: 'quantity', type: 'number' },
  { sourceAttr: 'Severity', targetField: 'severity', type: 'string' },
];

export interface PlacementPlan {
  matchKind: 'exact_path' | 'pattern';
  matchValue: string;
  description: string;
}

/** The unit prefix of the simulator's topics with the unit level as a glob (`*`, not MQTT's `+`). */
function unitTopicGlob(family: string): string {
  const { site, area, line } = SIM_EQUIPMENT;
  return `${SIM_NAMESPACE}/${site}/${area}/${line}/*/${family}`;
}

/**
 * Placement rules (`source_mappings`, source system MQTT): the AF element path every simulated event
 * carries, plus topic patterns that place an event published without `element_path` (the decoder then
 * uses the topic as the source path) and document the measurement family of the same unit.
 */
export const PLACEMENTS: readonly PlacementPlan[] = [
  {
    matchKind: 'exact_path',
    matchValue: SIM_ELEMENT_PATH,
    description: 'MQTT simulator: element_path of every simulated event',
  },
  {
    matchKind: 'pattern',
    matchValue: unitTopicGlob('events'),
    description:
      'MQTT simulator: events topic (used when an event carries no element_path)',
  },
  {
    matchKind: 'pattern',
    matchValue: unitTopicGlob('measurements/*'),
    description: 'MQTT simulator: measurements topic family of the unit',
  },
];

const SHARED_TRANSPORT = {
  protocolVersion: 5,
  qos: 1,
  cleanStart: false,
  sessionExpirySeconds: 86_400,
  keepaliveSeconds: 60,
  connectTimeoutSeconds: 30,
  reconnect: { minSeconds: 1, maxSeconds: 60 },
  tls: { mode: 'system' },
  maxMessageBytes: 65_536,
} as const;

const SHARED_PROFILE = {
  schemaVersion: '1.0',
  fields: { eventTime: 'ts', sequence: 'seq', bootId: 'boot_id' },
  quality: { protocol: 'PI' },
} as const;

/** One `+` per topic level the simulator varies (`--site`, `--area`, `--line`, `--unit`). */
const ANY_UNIT = `${SIM_NAMESPACE}/+/+/+/+`;

export interface ConnectionBody {
  sourceType: 'mqtt';
  displayName: string;
  endpointConfig: Record<string, unknown>;
}

/** Anonymous events connection: interval-event profile, events topics, the gateway availability topic. */
export function eventsConnectionBody(brokerUrl: string): ConnectionBody {
  return {
    sourceType: 'mqtt',
    displayName: EVENTS_CONNECTION_NAME,
    endpointConfig: {
      mqtt: {
        ...SHARED_TRANSPORT,
        brokerUrl,
        topics: [`${ANY_UNIT}/events`],
        availabilityTopic: SIM_TOPICS.availability,
      },
      payloadProfile: {
        ...SHARED_PROFILE,
        kind: 'interval_event_json',
        topicTemplate: `${SIM_NAMESPACE}/{site}/{area}/{line}/{unit}/events`,
        time: {
          unit: 'iso',
          maxFutureSkewSeconds: 300,
          maxPastSeconds: 604_800,
        },
        identityStrategy: 'event_id',
      },
    },
  };
}

/** Measurements connection: one payload profile per connection, so the samples need their own. */
export function measurementsConnectionBody(brokerUrl: string): ConnectionBody {
  return {
    sourceType: 'mqtt',
    displayName: MEASUREMENTS_CONNECTION_NAME,
    endpointConfig: {
      mqtt: {
        ...SHARED_TRANSPORT,
        brokerUrl,
        topics: [`${ANY_UNIT}/measurements/+`],
      },
      payloadProfile: {
        ...SHARED_PROFILE,
        kind: 'measurement_json',
        topicTemplate: `${SIM_NAMESPACE}/{site}/{area}/{line}/{unit}/measurements/{attribute}`,
        time: {
          unit: 'iso',
          maxFutureSkewSeconds: 300,
          maxPastSeconds: 604_800,
          onStale: 'flag',
        },
        identityStrategy: 'seq_boot',
      },
    },
  };
}
