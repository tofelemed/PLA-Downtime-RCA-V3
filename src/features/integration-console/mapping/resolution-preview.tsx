import { humanize, labelOf, MAPPING_TARGET_LABELS, MATCH_KIND_LABELS } from '@/features/ux-kit/labels';
import type { MappingPreviewView } from '@/api/v2/types/integration-mappings';

const STATUS_TEXT = {
  mapped: 'Resolves to a unit',
  ambiguous: 'Ambiguous: equal-precedence rules point at different targets',
  invalid_target: 'A rule points outside this plant',
  unmapped: 'Not mapped yet',
} as const;

/** How the current rules resolve the sample (server-side, exact id → path → pattern → AF binding). */
export function ResolutionPreview({ preview, nameOf }: { preview: MappingPreviewView; nameOf: (unitId: string) => string }) {
  return (
    <ul className="space-y-1 text-sm" data-testid="resolution-preview">
      {preview.results.map((result, index) => (
        <li key={index} data-status={result.status}>
          <span className="font-medium">{STATUS_TEXT[result.status]}</span>
          {result.tier && <span className="text-muted-foreground"> · matched by {labelOf(MATCH_KIND_LABELS, result.tier).toLowerCase()}</span>}
          {result.unitId && <span className="text-muted-foreground"> · unit {nameOf(result.unitId)} (rule v{result.version})</span>}
          {result.candidates.length > 0 && (
            <ul className="ml-4 list-disc text-xs">
              {result.candidates.map((candidate) => (
                <li key={candidate.mappingId}>
                  {labelOf(MAPPING_TARGET_LABELS, candidate.targetType)} {nameOf(candidate.targetId)} · precedence {candidate.precedence} · {humanize(candidate.origin)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
