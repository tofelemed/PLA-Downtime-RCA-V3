import type { UncertaintyBudgetView } from '@/api/v2/types/uncertainty';
import { Badge } from '@/components/ui/badge';
import { useUserNames } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { selfDecisionKindOf } from '@/features/ux-kit/self-decision-kind';
import { BudgetActions } from './budget-actions';
import { BudgetResult } from './budget-result';

const STATE_LABELS: Readonly<Record<string, string>> = {
  proposed: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** One budget: state, effective interval, the server's numbers, evidence and review, author and decision. */
export function BudgetCard({ budget, timezone }: { budget: UncertaintyBudgetView; timezone: string }) {
  const users = useUserNames();
  return (
    <article className="space-y-2 rounded-md border p-3 text-sm" data-testid="budget-card" data-state={budget.state} data-in-force={budget.inForce}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{budget.boundary}</h3>
        <Badge variant={budget.inForce ? 'default' : 'outline'}>{budget.inForce ? 'In force' : (STATE_LABELS[budget.state] ?? budget.state)}</Badge>
        {budget.reviewOverdue && budget.state === 'approved' && <Badge variant="destructive">Review overdue</Badge>}
        <span className="text-xs text-muted-foreground">
          From <PlantTime iso={budget.effectiveFrom} tz={timezone} withDate withZone={false} />
          {budget.effectiveTo && (
            <>
              {' '}
              until <PlantTime iso={budget.effectiveTo} tz={timezone} withDate withZone={false} />
            </>
          )}
        </span>
      </header>
      <BudgetResult
        combinedStandardUncertainty={budget.combinedStandardUncertainty}
        expandedUncertainty={budget.expandedUncertainty}
        coverageFactor={budget.coverageFactor}
        covarianceTerm={budget.covarianceTerm}
        contributions={budget.contributions}
        uom={budget.uom}
      />
      <p className="text-xs text-muted-foreground">
        Calibration: {budget.calibrationRef}
        {budget.evidenceRef ? ` · ${budget.evidenceRef}` : ''} · review due <PlantTime iso={budget.reviewDueAt} tz={timezone} withDate withZone={false} />
      </p>
      <p className="text-xs text-muted-foreground">
        Proposed by {users.nameOf(budget.authorId)}
        {budget.decidedBy && ` · ${budget.state === 'rejected' ? 'rejected' : 'approved'} by ${users.nameOf(budget.decidedBy)}`}
        {budget.decisionReason && `: ${budget.decisionReason}`}{' '}
        <SelfDecisionBadge selfDecided={budget.selfDecided} kind={selfDecisionKindOf(budget.state)} />
      </p>
      {budget.notes && <p className="text-xs">{budget.notes}</p>}
      <BudgetActions budget={budget} />
    </article>
  );
}
