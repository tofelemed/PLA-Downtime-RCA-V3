import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePlans, usePlanVersion } from '@/api/v2/queries/plans';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { copiedPlanValues, type PlanFormValues } from '../model/plan-form';

export interface CopyFromPlanProps {
  onCopy: (values: Partial<PlanFormValues>) => void;
}

/**
 * "Start from an existing plan": copies unit, basis, target, distribution and product slices of another
 * plan's current version into the new plan (replaces the v1 plan templates; the schedule now comes from
 * the published calendar and the rates from approved profiles).
 */
export function CopyFromPlan({ onCopy }: CopyFromPlanProps) {
  const plans = usePlans();
  const items = flattenPages(plans.data?.pages);
  const [planId, setPlanId] = useState('');
  const chosen = items.find((plan) => plan.id === planId) ?? null;
  const version = usePlanVersion(chosen?.id ?? null, chosen?.currentVersion ?? null);
  const options = items.map((plan) => ({ value: plan.id, label: plan.name }));
  return (
    <Section title="Start from an existing plan" collapsible defaultOpen={false} description="Optional: copy the unit, basis, target, distribution and products of another plan.">
      <div className="flex flex-wrap items-end gap-2" data-testid="plan-copy">
        <div className="w-80">
          <FormField id="planCopySource" label="Plan to copy" hint={plans.hasNextPage ? 'Only the most recent plans are listed.' : undefined}>
            <NativeSelect id="planCopySource" value={planId} options={options} placeholder="Choose a plan" onChange={setPlanId} />
          </FormField>
        </div>
        <Button type="button" variant="outline" disabled={!version.data} data-testid="plan-copy-apply" onClick={() => version.data && onCopy(copiedPlanValues(version.data))}>
          <ActionIcon.duplicate className="h-4 w-4" aria-hidden="true" />
          Copy into this plan
        </Button>
      </div>
    </Section>
  );
}
