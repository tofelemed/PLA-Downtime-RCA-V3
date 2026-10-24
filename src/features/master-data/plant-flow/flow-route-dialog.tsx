import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { Input } from '@/components/ui/input';
import { useCreateFlowRoute } from '@/api/v2/queries/plant-model';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { focusFirstFieldOf } from '@/features/ux-kit/focus-first-field';
import { FormField } from '@/features/plans-profiles-calendars/components/form-field';
import { NativeSelect, type Option } from '@/features/plans-profiles-calendars/components/native-select';
import type { FieldErrors } from '@/features/plans-profiles-calendars/model/profile-form';
import { refusalOf } from '@/features/plans-profiles-calendars/model/refusal';
import { FlowDateTimeField } from './flow-date-time-field';
import { PlantFlowSaveAlert } from './plant-flow-save-alert';
import { emptyFlowRouteForm, flowRouteCreateBody, type FlowRouteFormValues, validateFlowRouteForm } from './plant-flow-form-model';

export interface FlowRouteDialogProps {
  unitOptions: Option[];
  timezone: string;
  onDone: () => void;
}

const ROLE_OPTIONS: Option[] = [
  { value: 'feed', label: 'Feed (required supply)' },
  { value: 'alternate', label: 'Alternate (can supply on its own)' },
];

interface FieldsProps {
  values: FlowRouteFormValues;
  set: <K extends keyof FlowRouteFormValues>(key: K, value: FlowRouteFormValues[K]) => void;
  fieldError: (key: string) => string | undefined;
  unitOptions: Option[];
}

function UnitFields({ values, set, fieldError, unitOptions }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField id="routeFrom" label="From unit (supplies)" error={fieldError('fromUnitId')}>
        <NativeSelect id="routeFrom" value={values.fromUnitId} options={unitOptions} placeholder="Choose…" onChange={(v) => set('fromUnitId', v)} />
      </FormField>
      <FormField id="routeTo" label="To unit (is supplied)" error={fieldError('toUnitId')}>
        <NativeSelect id="routeTo" value={values.toUnitId} options={unitOptions} placeholder="Choose…" onChange={(v) => set('toUnitId', v)} />
      </FormField>
      <FormField id="routeRole" label="Role" error={fieldError('routeRole')}>
        <NativeSelect id="routeRole" value={values.routeRole} options={ROLE_OPTIONS} onChange={(v) => set('routeRole', v === 'alternate' ? 'alternate' : 'feed')} />
      </FormField>
    </div>
  );
}

function BufferFields({ values, set, fieldError }: Omit<FieldsProps, 'unitOptions'>) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField id="routeBuffer" label="Buffer (optional)" error={fieldError('bufferName')}>
        <Input id="routeBuffer" value={values.bufferName} placeholder="Silo S-1" onChange={(e) => set('bufferName', e.target.value)} />
      </FormField>
      <FormField id="routeUsable" label="Usable inventory" error={fieldError('usableInventory')}>
        <DecimalInput id="routeUsable" value={values.usableInventory} onChange={(v) => set('usableInventory', v)} aria-label="Usable inventory" />
      </FormField>
      <FormField id="routeUom" label="Inventory unit" error={fieldError('inventoryUom')}>
        <Input id="routeUom" value={values.inventoryUom} onChange={(e) => set('inventoryUom', e.target.value)} />
      </FormField>
      <FormField id="routeMin" label="Lowest operating level" error={fieldError('minOperatingLevel')}>
        <DecimalInput id="routeMin" value={values.minOperatingLevel} onChange={(v) => set('minOperatingLevel', v)} aria-label="Lowest operating level" />
      </FormField>
      <FormField id="routeMax" label="Highest operating level" error={fieldError('maxOperatingLevel')}>
        <DecimalInput id="routeMax" value={values.maxOperatingLevel} onChange={(v) => set('maxOperatingLevel', v)} aria-label="Highest operating level" />
      </FormField>
      <FormField id="routeDraw" label="Downstream draw per hour" error={fieldError('drawRatePerHour')}>
        <DecimalInput id="routeDraw" value={values.drawRatePerHour} onChange={(v) => set('drawRatePerHour', v)} aria-label="Downstream draw per hour" />
      </FormField>
    </div>
  );
}

function useFlowRouteSave(timezone: string, onDone: () => void) {
  const [values, setValues] = useState<FlowRouteFormValues>(emptyFlowRouteForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateFlowRoute();
  const feedback = useSaveFeedback();
  const set = <K extends keyof FlowRouteFormValues>(key: K, value: FlowRouteFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(feedback.failure)?.fieldErrors[key];
  const save = async () => {
    const found = validateFlowRouteForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await feedback.run(() => create.submit(flowRouteCreateBody(values, timezone)), 'Draft route added').catch(() => null);
    if (saved) onDone();
  };
  return { values, set, fieldError, save, failure: feedback.failure, busy: create.isPending };
}

/**
 * "Add route" dialog: a draft route — supplying and supplied unit, role, the buffer between them and its
 * downstream draw. Success is a toast and the dialog closes (the draft appears in the table); a refusal is
 * the red alert at the top, the input kept.
 */
export function FlowRouteDialog({ unitOptions, timezone, onDone }: FlowRouteDialogProps) {
  const { values, set, fieldError, save, failure, busy } = useFlowRouteSave(timezone, onDone);
  const fields = { values, set, fieldError };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onDone()}>
      <DialogContent className="sm:max-w-2xl" aria-describedby={undefined} onOpenAutoFocus={focusFirstFieldOf}>
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>Add route</DialogTitle>
            <KpiInfo label="Add route" text="A draft route; another user approves it before stops propagate along it." />
          </div>
        </DialogHeader>
        <form noValidate className="space-y-3 [&_input]:h-9" data-testid="flow-route-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <PlantFlowSaveAlert error={failure} timezone={timezone} />
          <UnitFields {...fields} unitOptions={unitOptions} />
          <BufferFields {...fields} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FlowDateTimeField id="routeEffectiveFrom" label="Effective from" value={values.effectiveFrom} timezone={timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
            <FlowDateTimeField id="routeEffectiveTo" label="Effective to (optional)" value={values.effectiveTo} timezone={timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" onClick={onDone} disabled={busy}>Cancel</Button>
            <Button type="submit" className="h-9" disabled={busy}>Add draft route</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
