import type { KnowledgeQualityPart } from '@/api/v2/types/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { QUALITY_FACTOR_LABELS } from '../model/knowledge-filters';

/**
 * The server's record quality score (0–100); the browser never computes it. QA L11: "Record quality 80 / 100", never a bare
 * "Quality 80" that reads as product quality; `scoreOnly` ("80 / 100") under a "Record quality" column header.
 */
export function QualityBadge({ score, scoreOnly = false }: { score: number; scoreOnly?: boolean }) {
  const variant = score >= 70 ? 'default' : score >= 40 ? 'secondary' : 'outline';
  return (
    <Badge variant={variant} title="How complete the investigation record is, scored by the server" data-testid="quality-score">
      {scoreOnly ? `${score} / 100` : `Record quality ${score} / 100`}
    </Badge>
  );
}

/** How the server arrived at the score: points per factor out of its maximum. */
export function QualityBreakdown({ parts }: { parts: KnowledgeQualityPart[] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" data-testid="quality-breakdown">
      {parts.map((part) => (
        <div key={part.factor} className="contents">
          <dt className="text-muted-foreground">{QUALITY_FACTOR_LABELS[part.factor] ?? part.factor}</dt>
          <dd className="text-right tabular-nums">
            {part.points} / {part.max}
          </dd>
        </div>
      ))}
    </dl>
  );
}
