import { useMonthClose } from '@/api/v2/queries/month-close';
import type { MonthCloseStep, MonthCloseView } from '@/api/v2/types/month-close';
import { CloseActions } from '@/features/month-close/components/close-actions';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { InlineFormProps } from './inline-form-props';
import { useDecidedWhen } from './use-decided-when';

interface MonthStep {
  step: MonthCloseStep;
  pending: (view: MonthCloseView) => boolean;
  decided: string;
}

/** The month close step each inbox kind waits for, as the inbox query defines "pending". */
const STEPS: Readonly<Record<string, MonthStep>> = {
  'month-materiality': {
    step: 'materiality-review',
    pending: (v) => v.state === 'quantities_closed' && v.signOffs.materialityRequired && !v.signOffs.materialityReviewedBy,
    decided: 'Materiality review recorded',
  },
  'month-finance': { step: 'finance-sign-off', pending: (v) => v.state === 'quantities_closed', decided: 'Finance sign-off recorded' },
  'month-lock': { step: 'lock', pending: (v) => v.state === 'finance_signed_off', decided: 'Month locked' },
};

/**
 * One month close sign-off on the approval page: only the step this record waits for, with the month
 * close page's own confirmation (typed month for the lock) and separation-of-duties refusals.
 */
export function MonthCloseDecision({ item, onDecided }: InlineFormProps) {
  const step = STEPS[item.kind];
  const query = useMonthClose(item.target.monthKey ?? 'current');
  const view = query.data;
  useDecidedWhen(view && step ? step.pending(view) : undefined, step?.decided ?? 'Decided', onDecided);
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {view && step && (
        <div className="space-y-2" data-testid="inline-month-close">
          {!view.prerequisites.met && <p className="text-sm text-muted-foreground">Some prerequisites of this month are not met yet; open the month close page to see them.</p>}
          <CloseActions view={view} only={[step.step]} />
        </div>
      )}
    </DataState>
  );
}
