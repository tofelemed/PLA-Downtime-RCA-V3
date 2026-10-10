import { Lightbulb } from 'lucide-react';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { recommendationText, ruleNameOf } from '../model/rca-labels';

/** `RCARecommended` badges: what fired and with which version; a person links, creates or dismisses. */
export function RecommendationBadges({ items }: { items: readonly RcaRecommendationView[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" data-testid="rca-recommendations">
      {items.map((rec) => (
        <Badge key={rec.id} variant="outline" className="gap-1 border-amber-500 text-amber-700" title={ruleNameOf(rec) ?? undefined}>
          <Lightbulb className="h-3 w-3" aria-hidden />
          RCA recommended: {recommendationText(rec)}
        </Badge>
      ))}
    </div>
  );
}
