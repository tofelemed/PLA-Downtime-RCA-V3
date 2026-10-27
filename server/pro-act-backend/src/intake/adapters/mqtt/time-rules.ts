import { PayloadProfile, PayloadProfileKind } from './payload-profile';

/**
 * Event-time rules of the MQTT intake (design §4.2 stage 9, OT contract §3, MQ03): RFC 3339 with an
 * explicit offset is the contract; epoch integers are refused unless a profile opts into `unit: ms | s`
 * for a non-contract source. A timestamp too far in the future is always rejected
 * (`FUTURE_TIMESTAMP`); one older than `maxPastSeconds` is rejected or flagged per profile
 * (`onStale`): events default to reject (a stale downtime event would silently rewrite history),
 * samples and states default to flag (`quality.degraded`, the sample is still worth storing). A
 * missing event time becomes the receive time with `quality.degraded = true`; certified signals
 * reject such samples later, in the handler.
 */
export type TimeUnit = 'iso' | 'ms' | 's' | 'auto';
export type StaleHandling = 'reject' | 'flag';

export interface TimeRules {
  unit: TimeUnit;
  maxFutureSkewSeconds: number;
  maxPastSeconds: number;
  onStale: StaleHandling;
}

export const TIME_RULE_DEFAULTS = {
  unit: 'iso',
  maxFutureSkewSeconds: 300,
  maxPastSeconds: 7 * 24 * 3600,
} as const;

const STALE_DEFAULT_BY_KIND: Record<PayloadProfileKind, StaleHandling> = {
  interval_event_json: 'reject',
  measurement_json: 'flag',
  state_json: 'flag',
  availability: 'flag',
  feeds: 'flag',
};

/** RFC 3339 `date-time` with `T` and an explicit offset or `Z` (no local time, no space separator). */
export const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const EPOCH_MS_MIN = 100_000_000_000; // 1973-03-03 in ms; anything smaller is seconds
const EPOCH_MAX = 10_000_000_000_000; // year 2286 in ms

export type ParsedTime = { ok: true; at: Date } | { ok: false; detail: string };

export type EventTimeResolution =
  | { ok: true; at: Date; degraded: boolean; flags: string[] }
  | {
      ok: false;
      code: 'FUTURE_TIMESTAMP' | 'STALE_TIMESTAMP' | 'SCHEMA_INVALID';
      detail: string;
    };

/** The effective rules of a profile: its `time` block over the defaults, stale handling per kind. */
export function timeRulesOf(profile: PayloadProfile): TimeRules {
  const time = profile.time ?? {};
  return {
    unit: time.unit ?? TIME_RULE_DEFAULTS.unit,
    maxFutureSkewSeconds:
      time.maxFutureSkewSeconds ?? TIME_RULE_DEFAULTS.maxFutureSkewSeconds,
    maxPastSeconds: time.maxPastSeconds ?? TIME_RULE_DEFAULTS.maxPastSeconds,
    onStale: time.onStale ?? STALE_DEFAULT_BY_KIND[profile.kind],
  };
}

/** Strict RFC 3339 parse: the pattern, then a calendar-valid instant. */
export function parseRfc3339(raw: unknown): ParsedTime {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      detail: `expected an RFC 3339 string, got ${typeOf(raw)}`,
    };
  }
  if (!RFC3339.test(raw)) {
    return {
      ok: false,
      detail: `"${raw}" is not RFC 3339 with an explicit offset or Z`,
    };
  }
  const at = new Date(raw);
  return Number.isNaN(at.getTime())
    ? { ok: false, detail: `"${raw}" is not a valid instant` }
    : { ok: true, at };
}

/** A timestamp under the profile's unit: `iso` (contract), `ms` / `s` epoch opt-in, or `auto`. */
export function parseEventTime(raw: unknown, unit: TimeUnit): ParsedTime {
  if (unit === 'iso') {
    return typeof raw === 'number'
      ? {
          ok: false,
          detail:
            'epoch integers are not allowed by the contract (time.unit = iso); use ms or s for a non-contract source',
        }
      : parseRfc3339(raw);
  }
  if (typeof raw === 'string' && unit === 'auto') return parseRfc3339(raw);
  const epoch = epochOf(raw);
  if (epoch === null) {
    return {
      ok: false,
      detail: `expected an epoch number, got ${typeOf(raw)}`,
    };
  }
  const millis =
    unit === 'ms' || (unit === 'auto' && epoch >= EPOCH_MS_MIN)
      ? epoch
      : epoch * 1000;
  if (millis < 0 || millis >= EPOCH_MAX) {
    return {
      ok: false,
      detail: `epoch ${epoch} is out of range for unit ${unit}`,
    };
  }
  return { ok: true, at: new Date(millis) };
}

/**
 * The event time of a message: parsed, then checked against the receive time (future skew, past
 * window); absent → receive time, degraded (MQ03).
 */
export function resolveEventTime(
  raw: unknown,
  receivedAt: Date,
  rules: TimeRules,
): EventTimeResolution {
  if (raw === undefined || raw === null) {
    return {
      ok: true,
      at: receivedAt,
      degraded: true,
      flags: ['event_time_missing'],
    };
  }
  const parsed = parseEventTime(raw, rules.unit);
  if (!parsed.ok)
    return { ok: false, code: 'SCHEMA_INVALID', detail: parsed.detail };
  const ageSeconds = (receivedAt.getTime() - parsed.at.getTime()) / 1000;
  if (-ageSeconds > rules.maxFutureSkewSeconds) {
    return {
      ok: false,
      code: 'FUTURE_TIMESTAMP',
      detail: `event time is ${Math.round(-ageSeconds)} s ahead of the receive time (limit ${rules.maxFutureSkewSeconds} s)`,
    };
  }
  if (ageSeconds > rules.maxPastSeconds) {
    if (rules.onStale === 'reject') {
      return {
        ok: false,
        code: 'STALE_TIMESTAMP',
        detail: `event time is ${Math.round(ageSeconds)} s old (limit ${rules.maxPastSeconds} s)`,
      };
    }
    return { ok: true, at: parsed.at, degraded: true, flags: ['stale'] };
  }
  return { ok: true, at: parsed.at, degraded: false, flags: [] };
}

function epochOf(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return null;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
