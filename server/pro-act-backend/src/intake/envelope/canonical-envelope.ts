/**
 * TypeScript shape of `contracts/canonical-event.schema.json` (spec §5.1). Written by hand next to the
 * checked schema copy; `canonical-event.schema.spec.ts` keeps the property names of both in step.
 */
export const SOURCE_TYPES = [
  'pi_web_api',
  'mqtt',
  'kafka',
  'opc_ua',
  'rest_import',
  'file_import',
  'db_import',
  'manual',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ENVELOPE_KINDS = [
  'interval_event',
  'measurement',
  'state',
  'output_event',
  'retraction',
] as const;
export type EnvelopeKind = (typeof ENVELOPE_KINDS)[number];

export type EnvelopeOperation = 'observe' | 'correct' | 'retract';

export type SemanticType =
  | 'rate'
  | 'counter'
  | 'state'
  | 'quality'
  | 'level'
  | 'output_increment'
  | 'other';

export interface EnvelopeLocation {
  sourcePath: string;
  sourceElementIds?: string[];
  unitId?: string | null;
  assetId?: string | null;
}

export interface EnvelopeAttribute {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'digital' | 'duration' | 'timestamp';
  value?: unknown;
  digital?: { name: string; value: number; isSystem?: boolean };
  unit?: string | null;
  semanticType?: SemanticType | null;
}

export interface EnvelopeValues {
  templateName?: string | null;
  attributes?: EnvelopeAttribute[];
  sample?: {
    signalRef: string;
    value: unknown;
    unit?: string | null;
    semanticType?: SemanticType;
    sequence?: number | null;
    /** enumeration-set value (PI digital state); `value` is null then */
    digital?: { name: string; value: number; isSystem?: boolean };
    /** a source summary over `[startTime, endTime)` (PI `Total` of a rate signal) */
    summary?: {
      summaryType: 'Total';
      calculationBasis: 'TimeWeighted';
      timebase: 's' | 'min' | 'h' | 'd';
    };
  };
  state?: {
    stateRef: string;
    value: string | number | boolean;
    previousValue?: string | number | boolean | null;
    sequence?: number | null;
  };
  output?: {
    quantity: number;
    unit?: string | null;
    productRef?: string | null;
    good?: boolean | null;
  };
}

export interface EnvelopeQuality {
  status: 'good' | 'uncertain' | 'bad' | 'missing';
  sourceFlags?: string[];
  reason?: string | null;
  degraded?: boolean;
}

export interface EnvelopeProvenance {
  rawPayload?: unknown;
  rawPayloadRef?: string | null;
  /** `sha256:<64 hex>` of the raw payload */
  payloadHash: string;
  sourceCursor?: Record<string, unknown> | null;
  mappingVersion: number;
  correlationId: string;
  replayRunId?: string | null;
}

export interface EnvelopeSourceControls {
  mqtt?: Record<string, unknown>;
  kafka?: Record<string, unknown>;
  pi?: {
    webId?: string;
    lastModified?: string | null;
    contentHash?: string | null;
    rawEndTime?: string | null;
  };
}

/** One record as an adapter hands it to `IntakeService.accept` (ING07 → FND01). */
export interface CanonicalEnvelope {
  schemaVersion: '1.0';
  messageId: string;
  tenantId: string;
  connectionId: string;
  sourceType: SourceType;
  sourceObjectId: string;
  sourceRevision?: string | null;
  operation: EnvelopeOperation;
  kind: EnvelopeKind;
  observedAt: string;
  receivedAt: string;
  startTime?: string;
  endTime?: string | null;
  sourceTimezone?: string | null;
  location: EnvelopeLocation;
  values?: EnvelopeValues;
  quality: EnvelopeQuality;
  provenance: EnvelopeProvenance;
  sourceControls?: EnvelopeSourceControls;
  retraction?: {
    reason?: string | null;
    retractsRevision?: string | null;
    confirmedDeletion?: boolean | null;
  };
}
