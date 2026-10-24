import { useRcaActions, useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { progressSteps } from '../../model/case-progress';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../components/case-card';
import { CaseColumns } from '../components/case-columns';
import { useScrollToWorkflow } from '../workflow/workflow-anchor';
import { WorkflowPanel } from '../workflow/workflow-panel';
import { CaseStepper } from './case-stepper';
import { DefinitionSummary } from './definition-summary';
import { ReevaluateNotice } from './reevaluate-notice';
import { TeamSummary } from './team-summary';

function Progress({ rca }: { rca: RcaCaseView }) {
  const analyses = useRcaAnalyses(rca.id);
  const actions = useRcaActions(rca.id);
  const hasRecord = Object.values(analyses.data ?? {}).some((record) => record !== null);
  return <CaseStepper status={rca.status} steps={progressSteps(rca, hasRecord, actions.isError ? 'error' : actions.data)} />;
}

/** Overview of a case: progress and the saved definition (main), workflow and team (side column from 1280 px). */
export function OverviewPage() {
  const { rca } = useCaseWorkspace();
  useScrollToWorkflow();
  return (
    <div className="space-y-4">
      <ReevaluateNotice />
      <CaseColumns
        testId="overview-layout"
        main={
          <>
            <CaseCard title="Progress" info="Where the investigation stands and what it has so far; the checklist is a guide and blocks nothing.">
              <Progress rca={rca} />
            </CaseCard>
            <DefinitionSummary />
          </>
        }
        side={
          <>
            <WorkflowPanel />
            <TeamSummary />
          </>
        }
      />
    </div>
  );
}
