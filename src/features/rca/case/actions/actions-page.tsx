import { useRcaActions } from '@/api/v2/queries/rca-cases';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionsTab } from '../../actions/actions-tab';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../evidence/case-card';
import { RecommendationsSection } from './recommendations-section';

/** `/rca/:caseId/actions`: the recommendations of the analysis and the tracked actions with verification. */
export function ActionsPage() {
  const { rca } = useCaseWorkspace();
  const { number } = useNumberFormat();
  const actions = useRcaActions(rca.id);
  return (
    <div className="space-y-4">
      <RecommendationsSection />
      <CaseCard
        title="Actions"
        count={actions.data ? number(actions.data.length) : undefined}
        info="Owned actions with due dates, verified against a baseline after their window."
        testId="actions-card"
      >
        <ActionsTab rcaId={rca.id} />
      </CaseCard>
    </div>
  );
}
