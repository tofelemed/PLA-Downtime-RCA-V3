import { useState } from 'react';
import { useUncertaintyBudgets } from '@/api/v2/queries/uncertainty-budgets';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { BudgetCard } from './components/budget-card';
import { BudgetForm } from './components/budget-form';

function UnitBudgets({ unitId, timezone }: { unitId: string; timezone: string }) {
  const budgets = useUncertaintyBudgets(unitId);
  const items = budgets.data?.items ?? [];
  return (
    <DataState state={dataStateOf(budgets)} error={budgets.error} onRetry={() => void budgets.refetch()}>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No uncertainty budget for this unit yet; its reconciliation tolerance stays at zero until one is approved and adopted.</p>}
      <div className="space-y-3" data-testid="budget-list">
        {items.map((budget) => (
          <BudgetCard key={budget.id} budget={budget} timezone={timezone} />
        ))}
      </div>
    </DataState>
  );
}

function UncertaintyScreen() {
  const units = useUnits();
  const unitOptions = flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: unit.name }));
  const [unitId, setUnitId] = useState('');
  const [drafting, setDrafting] = useState(false);
  const { timezone } = usePlantTimezone();
  const { canWriteUncertaintyBudgets } = useCapabilities();
  const chosen = unitId || unitOptions[0]?.value || '';
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="measurement-uncertainty">
        <PageHeader
          title="Measurement uncertainty"
          description="Uncertainty budget per measurement boundary: meters, scales, inventory, conversion and timing. The server combines the standard uncertainties (root sum of squares, with correlations) and expands them by the coverage factor. An approved budget can justify the unit's absolute reconciliation tolerance, but only when someone adopts it; residuals are always published."
          actions={
            canWriteUncertaintyBudgets &&
            chosen && (
              <Button size="sm" onClick={() => setDrafting(true)} data-testid="budget-new">
                New budget
              </Button>
            )
          }
        />
        <div className="max-w-sm space-y-1">
          <Label htmlFor="budget-unit">Unit</Label>
          <NativeSelect id="budget-unit" testId="budget-unit" value={chosen} onChange={(v) => { setUnitId(v); setDrafting(false); }} options={unitOptions} />
        </div>
        {drafting && chosen && <BudgetForm key={chosen} unitId={chosen} timezone={timezone} onDone={() => setDrafting(false)} />}
        {chosen ? <UnitBudgets unitId={chosen} timezone={timezone} /> : <DataState state={dataStateOf(units)} error={units.error} />}
      </div>
    </Page>
  );
}

/**
 * SME E4 measurement uncertainty at `/measurement-uncertainty`: the budgets of a unit's measurement
 * boundaries, their server-computed combined and expanded uncertainty, evidence and review, maker-checker
 * by production accounting, and the explicit adoption of a budget as the unit's absolute tolerance.
 */
export function UncertaintyPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its measurement uncertainty." />;
  return <UncertaintyScreen />;
}
