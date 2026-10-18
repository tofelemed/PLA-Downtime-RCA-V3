import { Link } from 'react-router-dom';
import type { RcaRecommendationItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { labelOf, RCA_ACTION_STATUS_TONES } from '@/features/ux-kit/labels';
import { RCA_ACTION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import { ACTION_FOR_RECOMMENDATION_PARAM } from '../../actions/actions-tab';

export interface RecommendationActionsProps {
  recommendation: RcaRecommendationItem;
  basePath: string;
  readOnly: boolean;
}

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * Item 5: the actions implementing a recommendation (title and status, each opening the action) and
 * "Create action for this recommendation", which opens the action form with it chosen.
 */
export function RecommendationActions({ recommendation, basePath, readOnly }: RecommendationActionsProps) {
  const actions = recommendation.actions ?? [];
  const create = `${basePath}/actions?${ACTION_FOR_RECOMMENDATION_PARAM}=${encodeURIComponent(recommendation.id)}`;
  return (
    <div className="flex flex-col items-start gap-1" data-testid="recommendation-actions">
      {actions.length === 0 && <span className="text-muted-foreground">No action yet</span>}
      {actions.map((action) => (
        <Link key={action.id} to={`${basePath}/actions#action-${encodeURIComponent(action.id)}`} className="inline-flex items-center gap-1 hover:underline" onClick={stop} onKeyDown={stop}>
          <span>{action.title}</span>
          <StatusBadge tone={toneOf(RCA_ACTION_STATUS_TONES, action.status)}>{labelOf(RCA_ACTION_STATUS_LABELS, action.status)}</StatusBadge>
        </Link>
      ))}
      {!readOnly && (
        <Button asChild size="sm" variant="ghost" className="h-auto px-0 py-0.5">
          <Link to={create} onClick={stop} onKeyDown={stop} aria-label={`Create action for recommendation ${recommendation.title}`} data-testid="create-action-for-recommendation">
            Create action for this recommendation
          </Link>
        </Button>
      )}
    </div>
  );
}
