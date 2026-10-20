import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { ApprovalState, PlanView } from '@/api/v2/types/plans';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { BASIS_SHORT_LABELS, labelOf, VERSION_STATE_LABELS } from '@/features/ux-kit/labels';
import { PlantTimeRange } from '@/features/ux-kit/plant-time-range';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon, EntityIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { usePagedPlans, usePrefetchPlanVersion } from '../hooks/use-plan-reads';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';

const STATES: ApprovalState[] = ['draft', 'submitted', 'approved', 'superseded'];

function columnsOf(refs: PlanningRefs, prefetch: (plan: PlanView) => void): DataTableColumn<PlanView>[] {
  return [
    {
      id: 'name',
      header: 'Plan',
      cell: (plan) => (
        <span className="font-medium" data-testid="plan-row" data-plan-id={plan.id} onMouseEnter={() => prefetch(plan)}>
          {plan.name}
        </span>
      ),
    },
    { id: 'unit', header: 'Unit', cell: (plan) => refs.unitName(plan.version.unitId) },
    { id: 'version', header: 'Version', nowrap: true, cell: (plan) => `Version ${plan.currentVersion ?? plan.version.version}` },
    { id: 'basis', header: 'Basis', cell: (plan) => labelOf(BASIS_SHORT_LABELS, plan.version.basis) },
    {
      id: 'window',
      header: 'Window',
      nowrap: true,
      cell: (plan) => (
        <PlantTimeRange className="text-xs" from={plan.version.validFrom} to={plan.version.validTo} tz={refs.timezone} />
      ),
    },
    { id: 'state', header: 'State', cell: (plan) => <VersionStateBadge state={plan.version.approvalState} /> },
    {
      id: 'periods',
      header: 'Period accounting',
      headerLabel: 'Period accounting',
      cell: (plan) => (
        <Link to={`/plans/${plan.id}`} className="inline-flex items-center gap-1 text-sm underline" data-testid="plan-periods-link" onClick={(event) => event.stopPropagation()}>
          <EntityIcon.plan className="h-4 w-4" aria-hidden="true" />
          Periods
        </Link>
      ),
    },
  ];
}

/**
 * Versioned plans, 20 per page: a row opens the plan (versions, preview, generation, approval) at
 * `/planning/plans/:planId`; "Periods" opens its period accounting at `/plans/:planId`.
 */
export function PlansTab() {
  const { canWritePlans } = useCapabilities();
  const refs = usePlanningRefs();
  const navigate = useNavigate();
  const prefetch = usePrefetchPlanVersion();
  const [unitId, setUnitId] = useState('');
  const [state, setState] = useState<ApprovalState | ''>('');
  const plans = usePagedPlans({ unitId, state });
  const stateOptions = STATES.map((value) => ({ value, label: labelOf(VERSION_STATE_LABELS, value) }));
  return (
    <div className="space-y-4" data-testid="plans-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <FormField id="planUnitFilter" label="Unit">
            <NativeSelect id="planUnitFilter" value={unitId} options={refs.unitOptions} placeholder="All units" onChange={setUnitId} />
          </FormField>
        </div>
        <div className="w-56">
          <FormField id="planStateFilter" label="Current version">
            <NativeSelect id="planStateFilter" value={state} options={stateOptions} placeholder="Any state" onChange={(v) => setState(v as ApprovalState | '')} />
          </FormField>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ReadOnlyHint />
          {canWritePlans && (
            <Button asChild size="sm" data-testid="plan-new">
              <Link to="/planning/plans/new">
                <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
                New plan
              </Link>
            </Button>
          )}
        </div>
      </div>
      <DataTable
        caption="Production plans"
        columns={columnsOf(refs, prefetch)}
        rows={plans.rows}
        getRowKey={(plan) => plan.id}
        pager={plans.pager}
        status={plans.status}
        empty={{ title: 'No plans', text: 'No versioned plans match these filters.' }}
        onRowClick={(plan) => navigate(`/planning/plans/${plan.id}`)}
        rowLabel={(plan) => `Open plan ${plan.name}`}
      />
    </div>
  );
}
