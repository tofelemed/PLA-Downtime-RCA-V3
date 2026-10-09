import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { usePlanScenarios } from '@/api/v2/queries/plans';
import { DISTRIBUTIONS, PLAN_BASES, type Distribution, type PlanBasis } from '@/api/v2/types/plans';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { usePlanForm, type PlanFormMode } from '../hooks/use-plan-form';
import { SlicesEditor } from './slices-editor';

export interface PlanFormDialogProps {
  mode: PlanFormMode;
  refs: PlanningRefs;
  onClose: () => void;
  onSaved: (planId: string) => void;
}

const BASIS_LABELS: Record<PlanBasis, string> = {
  time: 'Time — schedule × planning rate',
  quantity: 'Quantity — header target distributed',
  manual: 'Manual — per-shift targets',
};
const DISTRIBUTION_LABELS: Record<Distribution, string> = {
  scheduled_capacity: 'Proportional to scheduled planning capacity',
  explicit_weights: 'Explicit slice weights',
  equal: 'Equal per eligible shift',
};
const TITLES: Record<PlanFormMode['kind'], string> = { create: 'New plan (draft version 1)', edit: 'Edit draft version', 'new-version': 'Create new version' };

/** Plan header and version content (PLAN02): no default rate — the targets come from the server preview. */
export function PlanFormDialog({ mode, refs, onClose, onSaved }: PlanFormDialogProps) {
  const form = usePlanForm(mode, refs.timezone);
  const scenarios = flattenPages(usePlanScenarios().data?.pages).map((s) => ({ value: s.id, label: `${s.name}${s.isAccountingBaseline ? ' (accounting baseline)' : ''}` }));
  const { values, set, errors } = form;
  const save = async () => {
    const planId = await form.submit();
    if (planId) onSaved(planId);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" data-testid="plan-form">
        <DialogHeader>
          <DialogTitle>{mode.kind === 'create' ? TITLES.create : `${TITLES[mode.kind]} of ${mode.plan.name}`}</DialogTitle>
          <DialogDescription>Targets per shift come from the server preview with approved rates and the published calendar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField id="planName" label="Name" error={errors.name}>
            <Input id="planName" value={values.name} disabled={mode.kind !== 'create'} onChange={(e) => set('name', e.target.value)} />
          </FormField>
          <FormField id="planUnit" label="Unit" error={errors.unitId}>
            <NativeSelect id="planUnit" value={values.unitId} options={refs.unitOptions} placeholder="Choose a unit" invalid={!!errors.unitId} onChange={(v) => set('unitId', v)} />
          </FormField>
          <FormField id="planScenario" label="Scenario" error={errors.scenarioId} hint="Default: the accounting baseline">
            <NativeSelect id="planScenario" value={values.scenarioId} options={scenarios} placeholder="Accounting baseline" disabled={mode.kind !== 'create'} onChange={(v) => set('scenarioId', v)} />
          </FormField>
          <FormField id="planFrom" label={`Window start (${refs.timezone})`} error={errors.validFrom}>
            <Input id="planFrom" type="datetime-local" value={values.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
          </FormField>
          <FormField id="planTo" label="Window end (exclusive)" error={errors.validTo}>
            <Input id="planTo" type="datetime-local" value={values.validTo} onChange={(e) => set('validTo', e.target.value)} />
          </FormField>
          <FormField id="planBasis" label="Basis">
            <NativeSelect id="planBasis" value={values.basis} options={PLAN_BASES.map((b) => ({ value: b, label: BASIS_LABELS[b] }))} onChange={(v) => set('basis', v as PlanBasis)} />
          </FormField>
          <FormField id="headerTarget" label="Header target" error={errors.headerTarget} hint={values.basis === 'time' ? 'Generated from schedule × planning rate' : 'Quantity in the profile unit'}>
            <DecimalInput id="headerTarget" value={values.basis === 'time' ? null : values.headerTarget} disabled={values.basis === 'time'} onChange={(v) => set('headerTarget', v)} aria-label="Header target" />
          </FormField>
          <FormField id="planDistribution" label="Distribution">
            <NativeSelect id="planDistribution" value={values.distribution} options={DISTRIBUTIONS.map((d) => ({ value: d, label: DISTRIBUTION_LABELS[d] }))} onChange={(v) => set('distribution', v as Distribution)} />
          </FormField>
          <FormField id="changeReason" label="Change reason" error={errors.changeReason}>
            <Input id="changeReason" value={values.changeReason} onChange={(e) => set('changeReason', e.target.value)} />
          </FormField>
        </div>
        <SlicesEditor rows={values.slices} productOptions={refs.productOptions} errors={errors} timezone={refs.timezone} onChange={(rows) => set('slices', rows)} />
        <RefusalNotice error={form.error} timezone={refs.timezone} onReload={onClose} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={form.pending} data-testid="plan-save">
            {mode.kind === 'new-version' ? 'Create version' : 'Save draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
