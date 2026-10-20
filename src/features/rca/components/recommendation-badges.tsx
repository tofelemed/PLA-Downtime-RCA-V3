import { Link } from 'react-router-dom';
import { REEVALUATE_TRIGGER } from '@/api/v2/queries/rca-reevaluations';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { EVENT_RCA_STATE_LABELS } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { recommendationDetail, recommendationText, ruleNameOf } from '../model/rca-labels';
import { DismissRecommendation } from './dismiss-recommendation';
import { ReevaluateBadge } from './reevaluate-badge';

export interface RecommendationBadgesProps {
  items: readonly RcaRecommendationView[];
  /** RCA writers get a "Dismiss" (with reason) next to each open recommendation */
  canDismiss?: boolean;
  /** a "re-evaluate" badge links to its investigation (off where the investigation is already shown) */
  linkToCase?: boolean;
}

function ReevaluateLabel({ rec, linkToCase }: { rec: RcaRecommendationView; linkToCase: boolean }) {
  return (
    <>
      <ReevaluateBadge title={recommendationText(rec)} />
      {linkToCase && rec.rcaId && (
        <Link className="text-xs underline" to={`/rca/${encodeURIComponent(rec.rcaId)}#rca-workflow`} data-testid="reevaluate-case-link">
          Open the investigation to reopen it
        </Link>
      )}
    </>
  );
}

/**
 * `RCARecommended` badges: what fired and with which version; a person links, creates or dismisses. A
 * "re-evaluate" recommendation (D-T3: a closed case whose mode recurs above its baseline) links to the
 * investigation, where an independent manager approver may reopen it.
 */
export function RecommendationBadges({ items, canDismiss = false, linkToCase = true }: RecommendationBadgesProps) {
  const { digits } = useCalendarPreference();
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-testid="rca-recommendations">
      {items.map((rec) => {
        const detail = recommendationDetail(rec, digits);
        return (
          <li key={rec.id} className="flex flex-wrap items-center gap-1">
            {rec.trigger === REEVALUATE_TRIGGER ? (
              <ReevaluateLabel rec={rec} linkToCase={linkToCase} />
            ) : (
              <StatusBadge tone="info" icon={StatusIcon.info} title={ruleNameOf(rec) ?? undefined}>
                {EVENT_RCA_STATE_LABELS.required}: {recommendationText(rec)}
              </StatusBadge>
            )}
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
