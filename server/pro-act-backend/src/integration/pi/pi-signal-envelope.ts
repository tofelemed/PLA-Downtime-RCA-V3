import {
  CanonicalEnvelope,
  EnvelopeQuality,
} from '../../intake/envelope/canonical-envelope';
import { payloadHash } from '../../intake/envelope/envelope-validator';
import { IntakeBinding } from '../../intake/intake.types';

/** A PI Web API timed value (`recorded`, `updates` events, `summary` values). */
export interface PiTimedValue {
  Timestamp: string;
  Value: unknown;
  UnitsAbbreviation?: string | null;
  Good?: boolean;
  Questionable?: boolean;
  Substituted?: boolean;
  Annotated?: boolean;
}

interface PiDigital {
  Name: string;
  Value: number;
  IsSystem?: boolean;
}

/** One read of one signal: who read it and when (the read time orders corrections). */
export interface PiSignalRead {
  webId: string;
  at: Date;
  correlationId: string;
}

/**
 * PI quality → canonical quality (plan 1.7 step 5): `Good = false` → bad; a system digital state on a
 * stream (`No Data` → missing, `Shutdown`, `I/O Timeout`, ... → bad); `Questionable` or `Substituted`
 * → uncertain; otherwise good. The PI flags are kept as `sourceFlags`.
 */
export function piQuality(value: PiTimedValue): EnvelopeQuality {
  const flags: string[] = [];
  if (value.Questionable) flags.push('questionable');
  if (value.Substituted) flags.push('substituted');
  if (value.Annotated) flags.push('annotated');
  const digital = digitalOf(value.Value);
  if (digital?.IsSystem) flags.push(`system:${digital.Name}`);
  const status: EnvelopeQuality['status'] =
    digital?.IsSystem && /^no data$/i.test(digital.Name)
      ? 'missing'
      : value.Good === false || digital?.IsSystem
        ? 'bad'
        : value.Questionable || value.Substituted
          ? 'uncertain'
          : 'good';
  return {
    status,
    ...(flags.length > 0 ? { sourceFlags: flags } : {}),
    degraded: status !== 'good',
  };
}

/**
 * One recorded value as a measurement envelope (§5.1 measurement identity = signal + timestamp +
 * revision): source object = `<WebId>@<timestamp>`, message id = that plus the value hash (a re-read of
 * an unchanged value is a duplicate delivery), observation time = the sample timestamp, source revision
 * = the read time in ms (an archive correction read later is a newer revision of the same sample).
 */
export function piSampleEnvelope(
  binding: IntakeBinding,
  value: PiTimedValue,
  read: PiSignalRead,
): CanonicalEnvelope {
  const at = new Date(value.Timestamp).toISOString();
  const hash = payloadHash(value);
  const digital = digitalOf(value.Value);
  return {
    ...baseEnvelope(binding, read, {
      objectId: `${read.webId}@${at}`,
      hash,
      value,
    }),
    observedAt: at,
    values: {
      sample: {
        signalRef: read.webId,
        value: digital ? null : (value.Value ?? null),
        unit: value.UnitsAbbreviation || null,
        ...(digital
          ? {
              digital: {
                name: digital.Name,
                value: digital.Value,
                ...(digital.IsSystem !== undefined
                  ? { isSystem: digital.IsSystem }
                  : {}),
              },
            }
          : {}),
      },
    },
    quality: piQuality(value),
  };
}

/** A PI `Total` (time-weighted) of a rate signal over `[start, end)` (PI09), basis validated by the caller. */
export function piSummaryEnvelope(
  binding: IntakeBinding,
  total: {
    value: PiTimedValue;
    start: string;
    end: string;
    timebase: 's' | 'min' | 'h' | 'd';
  },
  read: PiSignalRead,
): CanonicalEnvelope {
  const hash = payloadHash(total.value);
  const objectId = `${read.webId}#Total@${total.start}/${total.end}`;
  return {
    ...baseEnvelope(binding, read, { objectId, hash, value: total.value }),
    observedAt: total.end,
    startTime: total.start,
    endTime: total.end,
    values: {
      sample: {
        signalRef: read.webId,
        value: digitalOf(total.value.Value)
          ? null
          : (total.value.Value ?? null),
        unit: total.value.UnitsAbbreviation || null,
        summary: {
          summaryType: 'Total',
          calculationBasis: 'TimeWeighted',
          timebase: total.timebase,
        },
      },
    },
    quality: piQuality(total.value),
  };
}

function baseEnvelope(
  binding: IntakeBinding,
  read: PiSignalRead,
  item: { objectId: string; hash: string; value: PiTimedValue },
): Omit<CanonicalEnvelope, 'observedAt' | 'quality'> {
  return {
    schemaVersion: '1.0',
    messageId: `${item.objectId}:${item.hash}`,
    tenantId: binding.tenantId,
    connectionId: binding.connectionId,
    sourceType: 'pi_web_api',
    sourceObjectId: item.objectId,
    sourceRevision: String(read.at.getTime()),
    operation: 'observe',
    kind: 'measurement',
    receivedAt: read.at.toISOString(),
    location: { sourcePath: read.webId, sourceElementIds: [read.webId] },
    provenance: {
      rawPayload: item.value,
      payloadHash: item.hash,
      mappingVersion: 0,
      correlationId: read.correlationId,
    },
    sourceControls: { pi: { webId: read.webId } },
  };
}

function digitalOf(value: unknown): PiDigital | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  return typeof record.Name === 'string' && Number.isInteger(record.Value)
    ? {
        Name: record.Name,
        Value: record.Value as number,
        IsSystem: record.IsSystem === true,
      }
    : null;
}
