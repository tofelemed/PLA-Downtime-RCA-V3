import { useReevaluateRecommendations } from '@/api/v2/queries/rca-reevaluations';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { RecommendationBadges } from '../../components/recommendation-badges';
import { useCaseWorkspace } from '../case-context';

/**
 * D-T3 on the case: the open "re-evaluate" recommendation of a closed investigation whose failure mode
 * recurs above its frozen baseline since the closure. Nothing reopens automatically: the Workflow below
 * offers "Reopen" to an independent manager approver, and RCA writers may dismiss it with a reason.
 */
export function ReevaluateNotice() {
  const { rca } = useCaseWorkspace();
  const { canWriteRca } = useCapabilities();
  const recommendations = useReevaluateRecommendations(rca.id, rca.status === 'Closed');
  const items = recommendations.data ?? [];
  if (rca.status !== 'Closed' || items.length === 0) return null;
  return (
    <div role="status" className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm" data-testid="reevaluate-notice">
      <p className="font-medium">The failure mode recurs above its baseline since this investigation was closed.</p>
      <RecommendationBadges items={items} canDismiss={canWriteRca} linkToCase={false} />
      <p className="text-muted-foreground">
        The investigation is not reopened automatically.{' '}
        <a href="#rca-workflow" className="underline" data-testid="reevaluate-reopen-link">
          Reopen it in the workflow
        </a>{' '}
        (an independent manager approver, with a reason), or dismiss the recommendation with a reason.
      </p>
    </div>
  );
}
