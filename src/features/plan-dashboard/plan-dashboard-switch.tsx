import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useFlag } from '@/api/v2/queries/feature-flags';
import type { ProductionPlan } from '@/services/MasterDataService';

const LegacyPlanDashboard = lazy(() =>
  import('@/components/production-plans/PlanDashboard').then((m) => ({ default: m.PlanDashboard })),
);

export interface PlanDashboardSwitchProps {
  plan: ProductionPlan;
  onClose: () => void;
  onPlanUpdate: (plan: ProductionPlan) => void;
}

/**
 * Which Plan Dashboard a plan opens (plan 3.5 step 5): with `v2.planDashboard` on, the period accounting
 * workspace at `/plans/:planId` (no render-time writes, no fabricated inputs); otherwise the v1 dashboard
 * (decision C4), loaded on demand.
 */
export function PlanDashboardSwitch({ plan, onClose, onPlanUpdate }: PlanDashboardSwitchProps) {
  const flag = useFlag('v2.planDashboard');
  if (flag.loading) return <Skeleton className="h-64 w-full" />;
  if (flag.enabled) return <Navigate to={`/plans/${plan.id}`} />;
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <LegacyPlanDashboard plan={plan} onClose={onClose} onPlanUpdate={onPlanUpdate} />
    </Suspense>
  );
}
