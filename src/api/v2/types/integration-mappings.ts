/**
 * Mapping and signal views of the integration console (plan 3.7), mirrored by hand from
 * `src/v2/source-mappings/source-mapping-v2.view.ts`, `src/attribute-mapping/*`,
 * `src/v2/attribute-mappings/*` and `src/v2/signals/signal-v2.view.ts`.
 */
export type MatchKind = 'exact_id' | 'exact_path' | 'pattern' | 'af_binding';
export type MappingTargetType = 'unit' | 'asset';

export interface SourceMappingView {
  id: string;
  connectionId: string | null;
  sourceSystem: string;
  matchKind: MatchKind;
  matchValue: string;
  normalizedValue: string;
  precedence: number;
  targetType: MappingTargetType;
  targetId: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  version: number;
  rowVersion: number;
  isActive: boolean;
  description: string | null;
  legacyMappingId: string | null;
}

export interface MappingSample {
  sourceId?: string;
  sourcePath?: string;
  afElementWebIds?: string[];
}

export interface MappingCandidate {
  mappingId: string;
  origin: string;
  targetType: MappingTargetType;
  targetId: string;
  precedence: number;
}

export type MappingStatus = 'mapped' | 'ambiguous' | 'invalid_target' | 'unmapped';

export interface MappingPreviewResult {
  sample: MappingSample;
  status: MappingStatus;
  tier: MatchKind | null;
  unitId: string | null;
  assetId: string | null;
  mappingId: string | null;
  version: number | null;
  candidates: MappingCandidate[];
}

/** POST /source-mappings/preview. */
export interface MappingPreviewView {
  results: MappingPreviewResult[];
  summary: Record<MappingStatus, number>;
}

export type FieldValueType = 'number' | 'string' | 'bool' | 'digital' | 'duration' | 'timestamp';
export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'timespan';

export interface FieldRule {
  sourceAttr: string;
  aliases?: string[];
  targetField: string;
  type: FieldValueType;
  unit?: DurationUnit;
  required?: boolean;
}

export interface CatalogField {
  name: string;
  types: FieldValueType[];
  storedAs: 'column' | 'source_fact';
  resolvesTo?: string;
  templates: string[];
  description: string;
}

/** GET /field-catalog. */
export interface FieldCatalogView {
  version: number;
  noTemplateKey: string;
  fields: CatalogField[];
  templates: Array<{ name: string; eventType: string; defaultRules: FieldRule[] }>;
}

export interface AttributeMappingVersionView {
  id: string;
  templateName: string;
  connectionId: string | null;
  version: number;
  fieldRules: FieldRule[];
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** GET /attribute-mappings item: effective rules per template, with the override in force. */
export interface EffectiveTemplateMapping {
  templateName: string;
  eventType: string;
  rules: FieldRule[];
  override: AttributeMappingVersionView | null;
}

export interface MappingDiagnostic {
  code: string;
  field: string | null;
  message: string;
}

/** POST /attribute-mappings/preview. */
export interface AttributeMappingPreviewView {
  templateName: string;
  eventType: string;
  rules: FieldRule[];
  draftFields: string[];
  columns: Record<string, unknown>;
  facts: Record<string, unknown>;
  diagnostics: MappingDiagnostic[];
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
}

export interface SignalView {
  id: string;
  connectionId: string;
  name: string;
  sourceKey: string;
  sourceBinding: Record<string, unknown>;
  unitId: string;
  assetId: string | null;
  productId: string | null;
  semanticType: string;
  canonicalUom: string | null;
  rateTimebase: string | null;
  interpolation: string;
  maxGapSeconds: number;
  resetPolicy: string;
  cadenceSeconds: number | null;
  isAuthority: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  rowVersion: number;
  createdAt: string;
}

/** POST /signals/{id}/preview: the quantity engine result as the server computed it. */
export interface SignalPreviewView {
  signalId: string;
  window: { from: string; to: string };
  engine: string;
  result: unknown;
  samples: Array<{
    observedAt: string;
    value: string | null;
    stateName: string | null;
    quality: string;
    sourceRevision: string;
    revisions: number;
    inWindow: boolean;
  }>;
  piTotals: Array<{ periodStart: string; periodEnd: string; total: string | null; quality: string; timebase: string }>;
}

export interface SignalBackfillView {
  id: string;
  signalId: string;
  from: string;
  to: string;
  state: 'queued' | 'running' | 'completed' | 'failed';
  reason: string;
  ingestionJobId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
