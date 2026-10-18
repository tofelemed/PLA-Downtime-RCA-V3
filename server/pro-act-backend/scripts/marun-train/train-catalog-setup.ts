/**
 * Stop policy, measurement intake, source authority and finance settings of the training plant
 * (E2E_SINGLE_EXTRUDER §9–14, guide lessons 8, 9 and 21). Broker settings come from the environment, with
 * the bundled Compose broker's password listener (docker/mosquitto, read-only `proact-test` user) as the
 * default, reached from the backend container.
 */
import { BOUNDARY, TIMES } from './train-catalog';

/** Owner (DECISIONS 2026-10-18): commissioning backdate of policies that otherwise take effect now. */
export const BACKDATE_REASON =
  'Commissioning of HDPE-TRAIN before the first calculated period';

export const MICRO_STOP = {
  microStopSeconds: 60,
  tripReasonCodes: ['ELEC-TRIP'],
  notes:
    'Extruder1 micro-stop threshold 60 s; electrical trips are always availability events',
} as const;

export const STOP_ENGINE = {
  deriveFromState: true,
  autoMergeDuplicates: true,
  debounceSeconds: 5,
  restartConfirmSeconds: 10,
  duplicateToleranceSeconds: 120,
  incidentWindowSeconds: 120,
  notes: 'Extruder heartbeat policy: stops derived from unit state',
} as const;

export const TRANSITION_ALLOWANCE = {
  transitionAllowanceInPlan: 'planned',
  notes:
    'Plans already allow for standard grade changes; only the overrun counts against the plan',
} as const;

/**
 * Micro-stop and stop-engine settings are versions of one policy per unit and a backdated version must start
 * after the previous one, so the stop-engine version starts one second after the micro-stop version (both
 * before the first shift at 02:30Z).
 */
export const BACKDATE_INSTANTS = {
  microStop: TIMES.commissioningFrom,
  stopEngine: '2026-10-17T02:00:01.000Z',
  sourceAuthority: TIMES.commissioningFrom,
} as const;

export const IMPACT_RULE = {
  mode: 'full_stop',
  takeoverSeconds: 60,
  reason: 'Main drive and gearbox failure stops extrusion',
} as const;

export const TOPIC_FILTER =
  'proact/v1/HDPE/Polymer/Line1/Extruder1/measurements/#';

export interface BrokerSettings {
  url: string;
  username: string | null;
  password: string | null;
}

/** MARUN_TRAIN_MQTT_URL / _USER / _PASSWORD; defaults: the Compose broker's password listener. */
export function brokerSettings(): BrokerSettings {
  const env = process.env;
  return {
    url: env.MARUN_TRAIN_MQTT_URL ?? 'mqtt://mqtt:1885',
    username: env.MARUN_TRAIN_MQTT_USER ?? 'proact-test',
    password: env.MARUN_TRAIN_MQTT_PASSWORD ?? 'proact-test-dev',
  };
}

export const CONNECTION_NAME = 'Extruder1 MQTT measurements';

export function connectionBody(
  broker: BrokerSettings,
): Record<string, unknown> {
  const mqtt: Record<string, unknown> = {
    brokerUrl: broker.url,
    protocolVersion: 5,
    qos: 1,
    cleanStart: false,
    sessionExpirySeconds: 86_400,
    keepaliveSeconds: 60,
    connectTimeoutSeconds: 30,
    reconnect: { minSeconds: 1, maxSeconds: 60 },
    tls: { mode: 'system' },
    topics: [TOPIC_FILTER],
    maxMessageBytes: 65_536,
  };
  if (broker.username) mqtt.username = broker.username;
  const body: Record<string, unknown> = {
    sourceType: 'mqtt',
    displayName: CONNECTION_NAME,
    endpointConfig: {
      mqtt,
      payloadProfile: {
        kind: 'measurement_json',
        schemaVersion: '1.0',
        topicTemplate:
          'proact/v1/{site}/{area}/{line}/{unit}/measurements/{attribute}',
        fields: { eventTime: 'ts', sequence: 'seq', bootId: 'boot_id' },
        time: {
          unit: 'iso',
          maxFutureSkewSeconds: 300,
          maxPastSeconds: 604_800,
        },
        quality: { protocol: 'PI' },
        identityStrategy: 'seq_boot',
      },
    },
  };
  if (broker.password) body.secret = broker.password;
  return body;
}

const SIGNAL_COMMON = {
  interpolation: 'step',
  maxGapSeconds: 900,
  cadenceSeconds: 60,
  qualityPolicy: { acceptUncertain: false },
  effectiveFrom: TIMES.commissioningFrom,
} as const;

export const SIGNALS = [
  {
    ...SIGNAL_COMMON,
    name: 'EXT1-State',
    sourceKey: 'EXT1-State',
    semanticType: 'state',
    isAuthority: false,
  },
  {
    ...SIGNAL_COMMON,
    name: 'EXT1-Throughput',
    sourceKey: 'EXT1-Throughput',
    semanticType: 'counter',
    canonicalUom: 't',
    rateTimebase: 'h',
    resetPolicy: 'none',
    isAuthority: true,
  },
] as const;

export const STATE_MAPPING = {
  rules: [
    { match: 'RUN', state: 'running' },
    { match: 'STOP', state: 'internal_stop' },
    { match: 'CHANGEOVER', state: 'planned_stop' },
    { match: 'STARVED', state: 'starved' },
    { match: 'BLOCKED', state: 'blocked' },
  ],
  expectedIntervalSeconds: 60,
  jitterSeconds: 0,
  staleAfterIntervals: 3,
  isHeartbeat: true,
  effectiveFrom: TIMES.commissioningFrom,
  notes:
    'Extruder1 digital state: 60 s heartbeat, stale after 3 intervals (180 s)',
} as const;

export const SOURCE_AUTHORITY = {
  measurementHierarchy: {
    boundary: BOUNDARY,
    conditions: ['primary_stale', 'primary_bad_quality', 'primary_missing'],
    entries: [
      {
        rank: 1,
        sourceClass: 'calibrated_primary',
        source: 'mqtt',
        signalSourceKey: 'EXT1-Throughput',
        boundary: BOUNDARY,
        boundaryAdjustment: null,
      },
    ],
  },
  notes:
    'MQTT tonne counter EXT1-Throughput at the extruder outlet is the authoritative output of Extruder1',
  approvalReason:
    'One authoritative measurement at the agreed accounting boundary (guide lesson 9)',
} as const;

export const VALUATION_POLICY = {
  defaultBasis: 'contribution_margin',
  timeBasisRule: 'exclusive',
  reportingCurrencies: ['USD', 'IRR'],
  fxPolicy: 'snapshot',
  fxRateType: 'economic',
  fxDateRule: 'event_date',
  demandRule: 'demand_constrained_only',
  defaultQualityDisposition: 'downgrade',
  manualLineHours: false,
  effectiveFrom: TIMES.octoberFrom,
  // a past instant is a commissioning backdate (owner, 18 Oct 2026): it needs a reason
  backdateReason:
    'Commissioning: the training plant is valued from October 2026 (guide lesson 21)',
  notes:
    'Contribution margin view by default; economic view charges lost contribution only while the product is sold out (guide lesson 21)',
} as const;

export const FX_RATE = {
  rateType: 'economic',
  fromCurrency: 'USD',
  toCurrency: 'IRR',
  rate: '600000',
  effectiveFrom: TIMES.octoberFrom,
  source:
    'Illustrative training rate of the Marun student guide (lesson 21): 600,000 IRR per USD, not a market exchange rate',
} as const;

export const DEMAND = {
  productCode: 'HD5502',
  status: 'demand_constrained',
  effectiveFrom: TIMES.octoberFrom,
  effectiveTo: TIMES.novemberFrom,
  evidence:
    'Training assumption (guide lesson 21): unmet orders for HD5502 in October 2026, the grade is sold out, so unproduced tonnes are lost sales',
} as const;
