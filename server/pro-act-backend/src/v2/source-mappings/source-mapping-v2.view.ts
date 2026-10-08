import { MappingSample } from '../../source-mapping/mapping-resolver';
import {
  MappingCandidate,
  ResolvedMapping,
} from '../../source-mapping/source-mapping.service';
import { SourceMapping } from '../../source-mapping/source-mapping.entity';

export interface SourceMappingV2View {
  id: string;
  connectionId: string | null;
  sourceSystem: string;
  matchKind: string;
  matchValue: string;
  normalizedValue: string;
  precedence: number;
  targetType: string;
  targetId: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  version: number;
  rowVersion: number;
  isActive: boolean;
  description: string | null;
  /** set when the rule mirrors a v1 hierarchy mapping (edit it through v1 until 3.10) */
  legacyMappingId: string | null;
}

/** One sample of a preview (spec §15.2): the resolution, or why there is none. */
export interface MappingPreviewResult {
  sample: MappingSample;
  status: ResolvedMapping['status'];
  tier: string | null;
  unitId: string | null;
  assetId: string | null;
  mappingId: string | null;
  version: number | null;
  candidates: MappingCandidate[];
}

export interface MappingPreviewView {
  results: MappingPreviewResult[];
  summary: Record<ResolvedMapping['status'], number>;
}

export function toSourceMappingView(row: SourceMapping): SourceMappingV2View {
  return {
    id: row.id,
    connectionId: row.connectionId,
    sourceSystem: row.sourceSystem,
    matchKind: row.matchKind,
    matchValue: row.matchValue,
    normalizedValue: row.normalizedValue,
    precedence: row.precedence,
    targetType: row.targetType,
    targetId: row.targetId,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    version: row.version,
    rowVersion: row.rowVersion,
    isActive: row.isActive,
    description: row.description,
    legacyMappingId: row.legacyMappingId,
  };
}

export function toPreviewResult(
  sample: MappingSample,
  resolved: ResolvedMapping,
): MappingPreviewResult {
  const base: MappingPreviewResult = {
    sample,
    status: resolved.status,
    tier: resolved.status === 'unmapped' ? null : resolved.tier,
    unitId: null,
    assetId: null,
    mappingId: null,
    version: null,
    candidates: [],
  };
  if (resolved.status === 'mapped') {
    return {
      ...base,
      unitId: resolved.unitId,
      assetId: resolved.assetId,
      mappingId: resolved.mappingId,
      version: resolved.version,
    };
  }
  if (resolved.status === 'invalid_target') {
    return { ...base, mappingId: resolved.mappingId };
  }
  if (resolved.status === 'ambiguous') {
    return { ...base, candidates: resolved.candidates };
  }
  return base;
}
