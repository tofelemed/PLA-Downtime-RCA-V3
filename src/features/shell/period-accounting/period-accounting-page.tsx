import { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { usePlans } from '@/api/v2/queries/plans';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { toast } from '@/components/ui/sonner';
import { PLAN_LIST_PATH, periodAccountingTarget, singleUnitOf, type PeriodAccountingTarget } from './period-accounting-target';

const HINTS: Record<'none' | 'several', string> = {
  none: 'No plan has an approved version valid today. Choose a plan and open its "Periods".',
  several: 'Several plans have an approved version valid today. Choose one and open its "Periods".',
};

function Redirect({ target }: { target: PeriodAccountingTarget }) {
  const hint = target.kind === 'list' ? HINTS[target.reason] : null;
  useEffect(() => {
    // QA P-14: the Sonner region is a labelled list without hidden focus proxies (the Radix toast failed axe here)
    if (hint) toast('Period accounting', { description: hint });
  }, [hint]);
  return <Navigate to={target.to} replace />;
}

/**
 * `/period-accounting` (UX audit B-5): resolves the plan only when the menu entry is opened (the sidebar
 * itself fetches nothing) and redirects to its period grid, or to the plan list with a hint.
 */
export function PeriodAccountingPage() {
  const [params] = useSearchParams();
  const unitId = singleUnitOf(params);
  const plans = usePlans(unitId ?? undefined);
  const { data, hasNextPage } = plans;
  const target = useMemo((): PeriodAccountingTarget | null => {
    if (!data) return null;
    // more plans than one page holds: let the user choose instead of guessing from a partial list
    if (hasNextPage) return { kind: 'list', to: PLAN_LIST_PATH, reason: 'several' };
    return periodAccountingTarget(flattenPages(data.pages), unitId, Date.now());
  }, [data, hasNextPage, unitId]);
  if (target) return <Redirect target={target} />;
  return (
    <Page>
      <PageHeader title="Period accounting" />
      <DataState state={plans.isError ? 'error' : 'loading'} error={plans.error} onRetry={() => void plans.refetch()} />
    </Page>
  );
}
