import { PayloadProfile, PayloadProfileKind } from './payload-profile';

/**
 * Where each decoder reads its fields (dotted JSON paths). The defaults are the OT contract v1 names;
 * a profile's `fields` block overrides them for a non-contract source (under the v1 schemas, which
 * refuse unknown properties, the defaults are the only shapes that validate).
 */
const COMMON_FIELDS = {
  eventTime: 'ts',
  sequence: 'seq',
  bootId: 'boot_id',
  source: 'source',
  quality: 'quality',
  site: 'site',
  tenant: 'tenant',
} as const;

export const FIELD_DEFAULTS: Record<
  PayloadProfileKind,
  Record<string, string>
> = {
  interval_event_json: {
    ...COMMON_FIELDS,
    eventId: 'event_id',
    revision: 'revision',
    operation: 'operation',
    template: 'template',
    elementPath: 'element_path',
    startTime: 'start_ts',
    endTime: 'end_ts',
    attributes: 'attributes',
    attributeUnits: 'attribute_units',
    /** the attribute (by name, not a path) that `valueMaps.reason` applies to */
    reason: 'Reason Code',
  },
  measurement_json: {
    ...COMMON_FIELDS,
    signal: 'signal',
    value: 'value',
    unit: 'uom',
  },
  state_json: { ...COMMON_FIELDS, state: 'state', previous: 'previous' },
  availability: {
    ...COMMON_FIELDS,
    state: 'state',
    piConnected: 'pi_connected',
  },
};

/** Reads named fields of one message under a profile's field map. */
export class MessageFields {
  private readonly paths: Record<string, string>;

  constructor(
    kind: PayloadProfileKind,
    profile: PayloadProfile,
    private readonly json: Readonly<Record<string, unknown>>,
  ) {
    this.paths = { ...FIELD_DEFAULTS[kind], ...(profile.fields ?? {}) };
  }

  /** The configured path of a field (for diagnostics and the reason attribute name). */
  pathOf(name: string): string {
    return this.paths[name] ?? name;
  }

  get(name: string): unknown {
    return readPath(this.json, this.pathOf(name));
  }

  string(name: string): string | null {
    const value = this.get(name);
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  integer(name: string): number | null {
    const value = this.get(name);
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  }
}

/** The value at a dotted path, or undefined when any step is missing or not an object. */
export function readPath(
  json: Readonly<Record<string, unknown>>,
  path: string,
): unknown {
  let current: unknown = json;
  for (const step of path.split('.')) {
    if (
      typeof current !== 'object' ||
      current === null ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[step];
  }
  return current;
}

/** `{ name, value }` of an enumeration-set value, or null when `raw` is not one. */
export function digitalOf(
  raw: unknown,
): { name: string; value: number } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.name !== 'string' || !Number.isInteger(record.value)) {
    return null;
  }
  return { name: record.name, value: record.value as number };
}
