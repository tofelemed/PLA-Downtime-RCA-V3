/**
 * Contract v1 message builders for the publisher simulator (docs/MQTT_OT_CONTRACT.md Â§2â€“Â§3.5): the same
 * shapes as `test/fixtures/mqtt/*.json`, with deterministic identities when a `--seed` is given.
 */
import { createHash, randomUUID } from 'crypto';

export interface Equipment {
  site: string;
  area: string;
  line: string;
  unit: string;
}

export interface SimTopics {
  events: string;
  state: string;
  availability: string;
  measurement(attribute: string): string;
}

/** Topic families of one unit under the namespace (contract Â§2 recommended shape). */
export function topicsOf(namespace: string, equipment: Equipment): SimTopics {
  const unitPath = `${namespace}/${equipment.site}/${equipment.area}/${equipment.line}/${equipment.unit}`;
  return {
    events: `${unitPath}/events`,
    state: `${unitPath}/state`,
    availability: `${namespace}/${equipment.site}/gateway/availability`,
    measurement: (attribute) => `${unitPath}/measurements/${attribute}`,
  };
}

/** The AF element path Pro-Act's `source_mappings` key on (contract Â§2 item 2). */
export function elementPathOf(equipment: Equipment): string {
  return `\\\\PIAF\\${equipment.site}\\${equipment.area}\\${equipment.line}\\${equipment.unit}`;
}

/**
 * Delivery identity of one publisher process: `boot_id` + monotonic `seq` (contract Â§3). With a seed the
 * boot id and every event id are reproducible, so a re-run with the same seed is seen by Pro-Act as the
 * same deliveries (duplicates); without a seed each run is a fresh publisher boot.
 */
export class SimIdentity {
  readonly bootId: string;
  readonly source: string;
  private seq = -1;
  private events = 0;

  constructor(
    private readonly seed: string | null,
    source: string,
  ) {
    this.source = source;
    this.bootId = seed
      ? `${source}-boot-${digest(seed, 'boot')}`
      : `${source}-${new Date().toISOString()}`;
  }

  nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  get lastSeq(): number {
    return this.seq;
  }

  nextEventId(): string {
    this.events += 1;
    return this.seed
      ? `EF-sim-${digest(this.seed, `event:${this.events}`)}`
      : `EF-${randomUUID().slice(0, 8)}`;
  }
}

function digest(seed: string, label: string): string {
  return createHash('sha256')
    .update(`${seed}:${label}`)
    .digest('hex')
    .slice(0, 12);
}

/** Common trailer of every message: `ts`, `seq`, `boot_id`, `source` (contract Â§3). */
function envelope(ids: SimIdentity, ts: string): Record<string, unknown> {
  return {
    ts,
    seq: ids.nextSeq(),
    boot_id: ids.bootId,
    source: ids.source,
  };
}

export type AttributeNames = 'catalog' | 'contract';

/** The PI EF template every simulated event frame names. */
export const SIM_TEMPLATE_NAME = 'Production Loss';

/**
 * Code values the simulator delivers, as codes (the contract example sends `"Reason Code": "MECH-01"`):
 * Pro-Act resolves a code or a name, but a code is unique in a library while names may repeat.
 * `scripts/demo-mqtt` makes sure a tenant's libraries know them; impact and OEE are the demo
 * libraries' own entries (Equipment Failure, Unplanned Downtime).
 */
export const SIM_CODE_VALUES = {
  reasons: ['MECH-01', 'ELEC-01'],
  impact: 'IC001',
  oee: 'OEE002',
} as const;

/**
 * Event attributes of a "Production Loss" frame. `catalog` uses the attribute names Pro-Act's default
 * attribute mapping knows (`ReasonCode`, `Quantity`, `Description`); `contract` uses the spaced names
 * of the contract examples (`Reason Code`, ...), which need the alias rules `db:seed-demo-mqtt` adds.
 */
export function lossAttributes(
  names: AttributeNames,
  quantity: number,
  reason: string = SIM_CODE_VALUES.reasons[0],
): Record<string, unknown> {
  if (names === 'contract') {
    return {
      Reason: 'Belt trip',
      'Reason Code': reason,
      'Impact Code': SIM_CODE_VALUES.impact,
      'OEE Code': SIM_CODE_VALUES.oee,
      Description: 'Conveyor belt tripped on overload',
      Quantity: quantity,
      Severity: 'High',
    };
  }
  return {
    ReasonCode: reason,
    Quantity: quantity,
    Description: 'Conveyor belt tripped on overload',
  };
}

export interface EventUpsertInput {
  eventId: string;
  revision: string;
  start: string;
  end: string | null;
  attributes: Record<string, unknown>;
  elementPath: string;
  ts?: string;
}

/** Contract Â§3.1 upsert (open while `end` is null; closed otherwise). */
export function eventUpsert(
  ids: SimIdentity,
  input: EventUpsertInput,
): Record<string, unknown> {
  return {
    schema_version: '1.0',
    event_id: input.eventId,
    revision: input.revision,
    operation: 'upsert',
    template: SIM_TEMPLATE_NAME,
    element_path: input.elementPath,
    start_ts: input.start,
    end_ts: input.end,
    attributes: input.attributes,
    attribute_units: { Quantity: 't' },
    ...envelope(ids, input.ts ?? input.revision),
  };
}

/** Contract Â§3.1 delete: only identity, revision and the trailer. */
export function eventDelete(
  ids: SimIdentity,
  eventId: string,
  revision: string,
): Record<string, unknown> {
  return {
    schema_version: '1.0',
    event_id: eventId,
    revision,
    operation: 'delete',
    ...envelope(ids, revision),
  };
}

/** Contract Â§3.2 numeric sample with PI value flags. */
export function measurementNumeric(
  ids: SimIdentity,
  signal: string,
  value: number,
  uom: string,
  ts: string,
): Record<string, unknown> {
  return {
    schema_version: '1.0',
    signal,
    value,
    uom,
    quality: { good: true, questionable: false, substituted: false },
    ...envelope(ids, ts),
  };
}

/** Contract Â§3.2 digital-state sample `{ name, value }`. */
export function measurementDigital(
  ids: SimIdentity,
  signal: string,
  state: { name: string; value: number },
  ts: string,
): Record<string, unknown> {
  return {
    schema_version: '1.0',
    signal,
    value: state,
    quality: { good: true, questionable: false, substituted: false },
    ...envelope(ids, ts),
  };
}

const STATE_VALUES: Readonly<Record<string, number>> = {
  STOP: 0,
  RUN: 1,
  IDLE: 2,
};

/** Contract Â§3.3 run state (published retained by the caller). */
export function stateMessage(
  ids: SimIdentity,
  state: string,
  previous: string | null,
  ts: string,
): Record<string, unknown> {
  const digital = (name: string) => ({
    name,
    value: STATE_VALUES[name] ?? -1,
  });
  return {
    schema_version: '1.0',
    state: digital(state),
    ...(previous ? { previous: digital(previous) } : {}),
    quality: { good: true },
    ...envelope(ids, ts),
  };
}

/** Contract Â§3.5 availability (retained ONLINE on connect, OFFLINE as Last Will and on clean shutdown). */
export function availabilityMessage(
  ids: SimIdentity,
  state: 'ONLINE' | 'OFFLINE',
  ts: string,
  piConnected = true,
): Record<string, unknown> {
  return {
    schema_version: '1.0',
    state,
    ...envelope(ids, ts),
    pi_connected: piConnected,
  };
}

/**
 * The Last Will registered at CONNECT (contract §3.5): the broker publishes it as-is when the publisher
 * disappears, so it carries no `seq` (fixture `availability-offline-lwt`).
 */
export function availabilityWill(ids: SimIdentity): Record<string, unknown> {
  return {
    schema_version: '1.0',
    state: 'OFFLINE',
    ts: nowIso(),
    boot_id: ids.bootId,
    source: ids.source,
  };
}

export function nowIso(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}
