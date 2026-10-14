import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { recommendationDetail, recommendationText, ruleNameOf } from '../model/rca-labels';
import { DismissRecommendation } from './dismiss-recommendation';

export interface RecommendationBadgesProps {
  items: readonly RcaRecommendationView[];
  /** RCA writers get a "Dismiss" (with reason) next to each open recommendation */
  canDismiss?: boolean;
}

/** `RCARecommended` badges: what fired and with which version; a person links, creates or dismisses. */
export function RecommendationBadges({ items, canDismiss = false }: RecommendationBadgesProps) {
  const { digits } = useCalendarPreference();
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-testid="rca-recommendations">
      {items.map((rec) => {
        const detail = recommendationDetail(rec, digits);
        return (
          <li key={rec.id} className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700" title={ruleNameOf(rec) ?? undefined}>
              <StatusIcon.info className="h-3 w-3" aria-hidden />
              RCA recommended: {recommendationText(rec)}
            </Badge>
            {detail && (
              <span className="text-xs text-muted-foreground" data-testid="recommendation-detail">
                {detail}
              </span>
            )}
            {canDismiss && rec.state === 'open' && <DismissRecommendation recommendation={rec} />}
          </li>
        );
      })}
    </ul>
  );
}
