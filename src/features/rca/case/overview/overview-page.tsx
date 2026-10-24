import { useRcaActions, useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { Section } from '@/features/ux-kit/page-layout';
import { progressSteps } from '../../model/case-progress';
import { useCaseWorkspace } from '../case-context';
import { WorkflowPanel } from '../workflow/workflow-panel';
import { CaseStepper } from './case-stepper';
import { DefinitionSummary } from './definition-summary';
import { ReevaluateNotice } from './reevaluate-notice';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

function Progress({ rca }: { rca: RcaCaseView }) {
  const analyses = useRcaAnalyses(rca.id);
  const actions = useRcaActions(rca.id);
  const hasRecord = Object.values(analyses.data ?? {}).some((record) => record !== null);
  return <CaseStepper status={rca.status} steps={progressSteps(rca, hasRecord, actions.isError ? 'error' : actions.data)} />;
}

/** Overview of a case: progress, workflow and saved definition/team facts. */
export function OverviewPage() {
  const { rca } = useCaseWorkspace();
  return (
    <>
      <ReevaluateNotice />
      <Section title="Progress" titleAside={<KpiInfo label="Progress" text="Where the investigation stands and what it has so far; the checklist is a guide and blocks nothing." />}>
        <Progress rca={rca} />
      </Section>
      <WorkflowPanel />
      <DefinitionSummary />
    </>
  );
}
