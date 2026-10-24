import { useState } from 'react';
import { useRecordTransitionAllowance, useTransitionAllowance } from '@/api/v2/queries/reliability-policies';
import type { TransitionAllowanceOption, TransitionAllowanceView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PLANT_WIDE_POLICY_MESSAGES } from '@/features/ux-kit/errors';
import { SaveFailureAlert } from '@/features/ux-kit/save-result';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { policyVersionLine } from './policy-version-line';
import { PolicySection } from './policy-section';
import { PolicySummary } from './policy-summary';
import { usePolicyEditor } from './use-policy-editor';
import type { PolicySaveFeedback } from './use-policy-save-feedback';

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
  /** the section's save feedback: its result dialog outlives this form's side panel */
  saving: PolicySaveFeedback;
  /** closes the side panel (the choice is dropped) */
  onCancel: () => void;
}

const choiceOf = (value: TransitionAllowanceOption) => TRANSITION_CHOICES.find((c) => c.value === value) ?? TRANSITION_CHOICES[0];

function ChoiceForm({ unitId, view, saving, onCancel }: ChoiceFormProps) {
  const [choice, setChoice] = useState<TransitionAllowanceOption>(view.transitionAllowanceInPlan);
  const record = useRecordTransitionAllowance();
  const body = { ...(unitId ? { unitId } : {}), transitionAllowanceInPlan: choice };
  // a refusal stays in the red alert at the top, with the choice kept
  const save = () => saving.record(() => record.submit(body)).catch(() => null);
  return (
    <div className="max-w-2xl space-y-3" data-testid="transition-allowance-form">
      <SaveFailureAlert error={saving.feedback.failure} context={PLANT_WIDE_POLICY_MESSAGES} />
      <RadioGroup value={choice} onValueChange={(v) => setChoice(v as TransitionAllowanceOption)} aria-label="Grade-change allowance">
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" className="h-9" disabled={record.isPending || choice === view.transitionAllowanceInPlan} onClick={() => void save()}>
          Record (effective from now)
        </Button>
      </div>
    </div>
  );
}

function AllowanceSummary({ view, unitId, format }: { view: TransitionAllowanceView; unitId: string; format: ReliabilityFormat }) {
  const choice = choiceOf(view.transitionAllowanceInPlan);
  const chosen = (
    <span className="inline-flex items-center gap-1.5">
      {choice.title}
      <KpiInfo label="this choice" text={choice.text} />
    </span>
  );
  return <PolicySummary rows={[{ label: 'In force', value: policyVersionLine(view, unitId, format) }, { label: 'Grade changes', value: chosen }]} testId="transition-allowance" />;
}

/** Engine 2.5.6: whether the unit's or plant's plan already allows for standard grade changes; the choice opens in a side panel. */
export function TransitionAllowanceControl({ unitId, canWrite, format }: { unitId: string; canWrite: boolean; format: ReliabilityFormat }) {
  const policy = useTransitionAllowance(unitId);
  const editor = usePolicyEditor('Grade-change allowance', unitId, format);
  const form = canWrite && policy.data ? <ChoiceForm key={`${unitId}-${policy.data.id}`} unitId={unitId} view={policy.data} saving={editor.saving} onCancel={() => editor.setOpen(false)} /> : null;
  return (
    <PolicySection title="Grade-change allowance" editor={editor} form={form}>
      <DataState state={dataStateOf(policy)} error={policy.error} onRetry={() => void policy.refetch()}>
        {policy.data && <AllowanceSummary view={policy.data} unitId={unitId} format={format} />}
      </DataState>
    </PolicySection>
  );
}
