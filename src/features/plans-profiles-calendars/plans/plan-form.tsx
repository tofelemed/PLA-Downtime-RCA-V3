import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { usePlanScenarios } from '@/api/v2/queries/plans';
import { DISTRIBUTIONS, PLAN_BASES, type Distribution, type PlanBasis } from '@/api/v2/types/plans';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { BASIS_LABELS, DISTRIBUTION_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { RefusalNotice } from '../components/refusal-notice';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { usePlanForm, type PlanFormMode } from '../hooks/use-plan-form';
import { CopyFromPlan } from './copy-from-plan';
import { SlicesEditor } from './slices-editor';

export interface PlanFormProps {
  mode: PlanFormMode;
  refs: PlanningRefs;
  cancelTo: string;
  onSaved: (planId: string) => void;
}

type Form = ReturnType<typeof usePlanForm>;

function HeaderFields({ form, mode, refs }: { form: Form; mode: PlanFormMode; refs: PlanningRefs }) {
  const scenarios = flattenPages(usePlanScenarios().data?.pages).map((s) => ({ value: s.id, label: `${s.name}${s.isAccountingBaseline ? ' (accounting baseline)' : ''}` }));
  const { values, set, errors } = form;
  const creating = mode.kind === 'create';
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField id="planName" label="Name" error={errors.name}>
        <Input id="planName" value={values.name} disabled={!creating} onChange={(e) => set('name', e.target.value)} />
      </FormField>
      <FormField id="planUnit" label="Unit" error={errors.unitId}>
        <NativeSelect id="planUnit" value={values.unitId} options={refs.unitOptions} placeholder="Choose a unit" invalid={!!errors.unitId} onChange={(v) => set('unitId', v)} />
      </FormField>
      <FormField id="planScenario" label="Scenario" error={errors.scenarioId} hint="Default: the accounting baseline">
        <NativeSelect id="planScenario" value={values.scenarioId} options={scenarios} placeholder="Accounting baseline" disabled={!creating} onChange={(v) => set('scenarioId', v)} />
      </FormField>
      <PlantDateTimeField id="planFrom" label="Window start" value={values.validFrom} timezone={refs.timezone} error={errors.validFrom} onChange={(v) => set('validFrom', v)} />
      <PlantDateTimeField id="planTo" label="Window end (exclusive)" value={values.validTo} timezone={refs.timezone} error={errors.validTo} onChange={(v) => set('validTo', v)} />
      <FormField id="changeReason" label="Change reason" error={errors.changeReason}>
        <Input id="changeReason" value={values.changeReason} onChange={(e) => set('changeReason', e.target.value)} />
      </FormField>
    </div>
  );
}

function TargetFields({ form }: { form: Form }) {
  const { values, set, errors } = form;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField id="planBasis" label="Basis">
        <NativeSelect id="planBasis" value={values.basis} options={PLAN_BASES.map((b) => ({ value: b, label: BASIS_LABELS[b] }))} onChange={(v) => set('basis', v as PlanBasis)} />
      </FormField>
      <FormField id="headerTarget" label="Header target" error={errors.headerTarget} hint={values.basis === 'time' ? 'Generated from schedule × planning rate' : 'Quantity in the profile unit'}>
        <DecimalInput id="headerTarget" value={values.basis === 'time' ? null : values.headerTarget} disabled={values.basis === 'time'} onChange={(v) => set('headerTarget', v)} aria-label="Header target" />
      </FormField>
      <FormField id="planDistribution" label="Distribution">
        <NativeSelect id="planDistribution" value={values.distribution} options={DISTRIBUTIONS.map((d) => ({ value: d, label: DISTRIBUTION_LABELS[d] }))} onChange={(v) => set('distribution', v as Distribution)} />
      </FormField>
    </div>
  );
}

const SAVE_LABEL: Record<PlanFormMode['kind'], string> = { create: 'Save draft', edit: 'Save draft', 'new-version': 'Create version' };

/** Plan header and version content: no default rate anywhere — the targets come from the server preview. */
export function PlanForm({ mode, refs, cancelTo, onSaved }: PlanFormProps) {
  const form = usePlanForm(mode, refs.timezone);
  const save = async () => {
    const planId = await form.submit();
    if (planId) onSaved(planId);
  };
  return (
    <div className="space-y-6" data-testid="plan-form">
      {mode.kind === 'create' && <CopyFromPlan onCopy={form.merge} />}
      <Section title="Plan">
        <HeaderFields form={form} mode={mode} refs={refs} />
      </Section>
      <Section title="Targets" description="Targets per shift come from the server preview with approved rates and the published calendar.">
        <TargetFields form={form} />
      </Section>
      <Section title="Product slices">
        <SlicesEditor rows={form.values.slices} productOptions={refs.productOptions} errors={form.errors} timezone={refs.timezone} onChange={(rows) => form.set('slices', rows)} />
      </Section>
      <RefusalNotice error={form.error} timezone={refs.timezone} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={form.pending} data-testid="plan-save">
          {SAVE_LABEL[mode.kind]}
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
