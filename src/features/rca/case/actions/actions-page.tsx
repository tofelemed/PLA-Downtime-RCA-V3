import { Section } from '@/features/ux-kit/page-layout';
import { ActionsTab } from '../../actions/actions-tab';
import { useCaseWorkspace } from '../case-context';
import { RecommendationsSection } from './recommendations-section';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

/** `/rca/:caseId/actions`: the recommendations of the analysis and the tracked actions with verification. */
export function ActionsPage() {
  const { rca } = useCaseWorkspace();
  return (
    <>
      <RecommendationsSection />
      <Section title="Actions" titleAside={<KpiInfo label="Actions" text="Owned actions with due dates, verified against a baseline after their window." />}>
        <ActionsTab rcaId={rca.id} />
      </Section>
    </>
  );
}
