import type { RcaCaseView } from '@/api/v2/types/rca';
import type { RcaCaseReadinessView } from '@/api/v2/types/rca-workflow';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_VERDICT_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { useRcaFormat } from '../../use-rca-format';
import { CaseFact as Fact, CaseFacts } from '../components/case-facts';
import { RunHourPolicyNote } from './run-hour-policy-note';

function verdictText(rca: RcaCaseView, readiness: RcaCaseReadinessView): string {
  if (rca.effectivenessVerdict) return `${labelOf(RCA_VERDICT_LABELS, rca.effectivenessVerdict)} (frozen when closure was requested)`;
  const live = readiness.closure.effectiveness;
  return live ? `${labelOf(RCA_VERDICT_LABELS, live)} (so far, from the verified actions)` : 'Not verified yet';
}

/** Effectiveness, closure request and approval, residual risk and same-problem events of the case. */
export function WorkflowFacts({ rca, readiness }: { rca: RcaCaseView; readiness: RcaCaseReadinessView }) {
  const users = useUserNames();
  const { dateTime } = useRcaFormat();
  const who = (id: string | null, at: string | null) => (id ? `${users.nameOf(id)}${at ? `, ${dateTime(at)}` : ''}` : null);
  const requested = who(rca.closureRequestedBy, rca.closureRequestedAt);
  const approved = who(rca.closureApprovedBy, rca.closureApprovedAt);
  return (
    <CaseFacts layout="stacked" testId="workflow-facts">
      <Fact label="Effectiveness" testId="workflow-verdict">
        {verdictText(rca, readiness)}
      </Fact>
      {readiness.closure.rootCauseRule?.coded && (
        <Fact label="Root cause rule" testId="workflow-coded-root-causes">
          {`Coded root causes: ${readiness.closure.rootCauseRule.codedRootCauses}`}
        </Fact>
      )}
      <Fact label="Same-problem events" testId="workflow-recurrences">
        {readiness.linkedRecurrences === 0 ? 'None linked by the triggers' : `${readiness.linkedRecurrences} linked to this investigation by the triggers since it opened`}
      </Fact>
      {requested && <Fact label="Closure requested by">{requested}</Fact>}
      {approved && (
        <Fact label="Closure approved by" testId="workflow-closure-approved">
          {approved} <SelfDecisionBadge selfDecided={rca.selfDecided} />
        </Fact>
      )}
      {rca.residualRisk && (
        <Fact label="Residual risk">
          {rca.residualRisk}
          <RunHourPolicyNote rca={rca} />
        </Fact>
      )}
      {rca.closureNote && (
        <Fact label="Last workflow note">
          {rca.closureNote}
        </Fact>
      )}
    </CaseFacts>
  );
}
