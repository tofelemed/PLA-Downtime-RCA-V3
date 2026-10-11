import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { usePlans } from '@/api/v2/queries/plans';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { FormField } from '../components/form-field';
import { LoadMore } from '../components/load-more';
import { NativeSelect } from '../components/native-select';
import { VersionStateBadge } from '../components/version-state-badge';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import type { PlanFormMode } from '../hooks/use-plan-form';
import { PlanDetail } from './plan-detail';
import { PlanFormDialog } from './plan-form-dialog';

/**
 * Versioned plans (plan 3.4 step 3, PLAN02–PLAN04): header and slices, preview of the exact per-shift
 * targets, generation, server-gated approval, new versions after approval and the version history.
 */
export function PlansTab() {
  const { canWritePlans } = useCapabilities();
  const refs = usePlanningRefs();
  const [unitId, setUnitId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanFormMode | null>(null);
  const plans = usePlans(unitId || undefined);
  const items = flattenPages(plans.data?.pages);
  const selected = items.find((plan) => plan.id === selectedId) ?? null;
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]" data-testid="plans-tab">
      <section className="space-y-3">
        {canWritePlans ? (
          <Button size="sm" onClick={() => setForm({ kind: 'create' })} data-testid="plan-new">
            New plan
          </Button>
        ) : (
          <ReadOnlyHint />
        )}
        <FormField id="planUnitFilter" label="Unit">
          <NativeSelect id="planUnitFilter" value={unitId} options={refs.unitOptions} placeholder="All units" onChange={setUnitId} />
        </FormField>
        <DataState state={dataStateOf(plans, { isEmpty: items.length === 0 })} error={plans.error} detail="No versioned plans for this filter.">
          <ul className="max-h-[32rem] space-y-1 overflow-auto" data-testid="plan-list">
            {items.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted ${plan.id === selectedId ? 'border-primary bg-muted' : ''}`}
                  aria-pressed={plan.id === selectedId}
                  data-testid="plan-row"
                  data-plan-id={plan.id}
                  onClick={() => setSelectedId(plan.id)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{plan.name}</span>
                    <VersionStateBadge state={plan.version.approvalState} />
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {refs.unitName(plan.version.unitId)} · v{plan.currentVersion} · {plan.version.basis}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <LoadMore hasNextPage={plans.hasNextPage} isFetchingNextPage={plans.isFetchingNextPage} fetchNextPage={plans.fetchNextPage} />
        </DataState>
      </section>
      <section>
        {selected ? (
          <PlanDetail
            key={selected.id}
            plan={selected}
            refs={refs}
            onEdit={(version) => setForm({ kind: 'edit', plan: selected, version })}
            onNewVersion={(version) => setForm({ kind: 'new-version', plan: selected, version })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Select a plan to preview its periods, approve it or see its versions.</p>
        )}
      </section>
      {form && (
        <PlanFormDialog
          mode={form}
          refs={refs}
          onClose={() => setForm(null)}
          onSaved={(planId) => {
            setForm(null);
            setSelectedId(planId);
          }}
        />
      )}
    </div>
  );
}
