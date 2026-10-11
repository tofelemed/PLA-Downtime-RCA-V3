import type { KnowledgeQualityPart } from '@/api/v2/types/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { QUALITY_FACTOR_LABELS } from '../model/knowledge-filters';

/** The server's quality score (0–100); the browser never computes it. */
export function QualityBadge({ score }: { score: number }) {
  const variant = score >= 70 ? 'default' : score >= 40 ? 'secondary' : 'outline';
  return (
    <Badge variant={variant} title="Quality score computed by the server" data-testid="quality-score">
      Quality {score}
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
