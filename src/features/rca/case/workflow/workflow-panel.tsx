import { useRcaReadiness } from '@/api/v2/queries/rca-cases';
import type { RcaCaseReadinessView } from '@/api/v2/types/rca-workflow';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { RCA_CASE_STATUS_TONES } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import { statusLabel } from '../../model/rca-labels';
import { useCaseWorkspace } from '../case-context';
import { CAUSES_ANCHOR } from '../../model/cause-form';
import { GateList } from './gate-list';
import { MoveControls } from './move-controls';
import { WorkflowFacts } from './workflow-facts';

const offersMove = (readiness: RcaCaseReadinessView, to: string) => readiness.next.some((move) => move.to === to);

function Gates({ readiness, causesPath }: { readiness: RcaCaseReadinessView; causesPath: string }) {
  const accepting = offersMove(readiness, 'Monitoring') && readiness.status !== 'Closure Review';
  const closing = offersMove(readiness, 'Closure Review') || offersMove(readiness, 'Closed');
  return (
    <div className="space-y-3">
      {accepting && <GateList title="Needed to accept the investigation" issues={readiness.investigation.blockers} tone="blocker" testId="investigation-blockers" />}
      <GateList title="Advice (does not block)" issues={readiness.investigation.advice} tone="advice" testId="investigation-advice" />
      {closing && <GateList title="Needed for closure" issues={readiness.closure.blockers} tone="blocker" testId="closure-blockers" causesPath={causesPath} />}
    </div>
  );
}

function ApproverNote({ readiness }: { readiness: RcaCaseReadinessView }) {
  if (readiness.status !== 'Closure Review' || readiness.approver.canApprove) return null;
  return (
    <p role="note" className="text-sm text-muted-foreground" data-testid="approver-reason">
      Waiting for an independent manager approver{readiness.approver.reason ? `: you cannot decide (${readiness.approver.reason}).` : '.'}
    </p>
  );
}

/**
 * RCA-01 / SME CA1 workflow of the case: the status, the moves the server offers with their blockers and
 * advice, the effectiveness verdict, the closure request and approval and the same-problem events.
 */
export function WorkflowPanel() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const readiness = useRcaReadiness(rca.id);
  return (
    <Section title="Workflow" description="Investigation → monitoring of the actions → closure approval. SuperAdmin may approve their own investigation; other approvers must be independent.">
      <DataState state={dataStateOf(readiness)} error={readiness.error} onRetry={() => readiness.refetch()}>
        {readiness.data && (
          <div className="space-y-4" data-testid="workflow-panel">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Status{' '}
              <StatusBadge tone={toneOf(RCA_CASE_STATUS_TONES, readiness.data.status)} data-testid="workflow-status">
                {statusLabel(readiness.data.status)}
              </StatusBadge>
            </div>
            <WorkflowFacts rca={rca} readiness={readiness.data} />
            <Gates readiness={readiness.data} causesPath={`${basePath}/analysis#${CAUSES_ANCHOR}`} />
            <ApproverNote readiness={readiness.data} />
            {!readOnly && <MoveControls key={`${rca.id}:${rca.rowVersion}`} readiness={readiness.data} />}
          </div>
        )}
      </DataState>
    </Section>
  );
}
