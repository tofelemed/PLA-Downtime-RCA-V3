import { useState } from 'react';
import { useRecordTransitionAllowance, useTransitionAllowance } from '@/api/v2/queries/reliability-policies';
import type { TransitionAllowanceOption, TransitionAllowanceView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { FriendlyErrorAlert, PLANT_WIDE_POLICY_MESSAGES } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { policyVersionLine } from './policy-version-line';

const TRANSITION_CHOICES: ReadonlyArray<{ value: TransitionAllowanceOption; title: string; text: string }> = [
  {
    value: 'planned',
    title: 'Plans already allow for standard grade changes',
    text: 'The plan target already leaves time for grade changes within their standard. Only the time a change runs over its standard counts against the plan; the allowance is shown as information.',
  },
  {
    value: 'loss',
    title: 'Count the allowance against the plan',
    text: 'The plan does not deduct grade changes. The standard grade-change time is a loss against the plan, like any other stop.',
  },
];

interface ChoiceFormProps {
  unitId: string;
  view: TransitionAllowanceView;
  canWrite: boolean;
}

function ChoiceForm({ unitId, view, canWrite }: ChoiceFormProps) {
  const [choice, setChoice] = useState<TransitionAllowanceOption>(view.transitionAllowanceInPlan);
  const [failure, setFailure] = useState<unknown>(null);
  const record = useRecordTransitionAllowance();
  const { toast } = useToast();
  const save = async () => {
    setFailure(null);
    try {
      const saved = await record.submit({ ...(unitId ? { unitId } : {}), transitionAllowanceInPlan: choice });
      toast({ title: `Transition allowance version ${saved.version} in force from now` });
    } catch (error: unknown) {
      setFailure(error);
    }
  };
  return (
    <div className="max-w-2xl space-y-3">
      <RadioGroup value={choice} onValueChange={(v) => setChoice(v as TransitionAllowanceOption)} disabled={!canWrite} aria-label="Grade-change allowance">
        {TRANSITION_CHOICES.map((c) => (
          <div key={c.value} className="flex items-start gap-2 rounded border p-3">
            <RadioGroupItem id={`allowance-${c.value}`} value={c.value} className="mt-1" />
            <Label htmlFor={`allowance-${c.value}`} className="space-y-1 font-normal">
              <span className="block font-medium">{c.title}</span>
              <span className="block text-sm text-muted-foreground">{c.text}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">A change applies from now on. Periods already calculated keep the version they were calculated with.</p>
      {failure !== null && <FriendlyErrorAlert error={failure} context={PLANT_WIDE_POLICY_MESSAGES} />}
      {canWrite && (
        <Button type="button" disabled={record.isPending || choice === view.transitionAllowanceInPlan} onClick={() => void save()}>
          Record (effective from now)
        </Button>
      )}
    </div>
  );
}

/** Engine 2.5.6: whether the unit's or plant's plan already allows for standard grade changes. */
export function TransitionAllowanceControl({ unitId, canWrite, format }: { unitId: string; canWrite: boolean; format: ReliabilityFormat }) {
  const policy = useTransitionAllowance(unitId);
  return (
    <DataState state={dataStateOf(policy)} error={policy.error} onRetry={() => void policy.refetch()}>
      {policy.data && (
        <div className="space-y-3" data-testid="transition-allowance">
          <p className="text-sm text-muted-foreground">{policyVersionLine(policy.data, unitId, format)}</p>
          <ChoiceForm key={`${unitId}-${policy.data.id}`} unitId={unitId} view={policy.data} canWrite={canWrite} />
        </div>
      )}
    </DataState>
  );
}
