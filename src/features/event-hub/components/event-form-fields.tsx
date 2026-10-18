import type { ReactNode } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Textarea } from '@/components/ui/textarea';
import { FormField, type FormFieldProps } from '@/features/ux-kit/form-field';
import { labelOf, PHYSICAL_TYPE_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { PHYSICAL_TYPES, SCHEDULE_CLASSES } from '../model/event-filters';
import type { EventFormState } from '../hooks/use-event-form';
import { useSourceOverrides, type SourceOverrides } from '../hooks/use-source-overrides';
import { useEventHubEnv } from '../use-event-hub-env';
import { AssetField } from './asset-field';
import { ImpactSection } from './impact-section';
import { FailureFields } from './failure-fields';
import { IntervalFields } from './interval-fields';
import { OeeComponentField } from './oee-component-field';
import { OriginFields } from './origin-fields';
import { PlantTimeField } from './plant-time-field';
import { QualityFields } from './quality-fields';
import { ReasonFields } from './reason-fields';
import { SourceOwnedField } from './source-owned-field';

/** Kit field with the event form's historical error test id (`error-<id>`). */
function Field(props: FormFieldProps) {
  return <FormField errorTestId={`error-${props.id}`} {...props} />;
}

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

export interface EventFormFieldsProps {
  form: EventFormState;
  mode: 'create' | 'edit';
  /** edit: the stored event (its server duration is shown read-only) */
  event?: ProductionEventView | null;
}

const QUANTITY_TYPES = ['quality_loss', 'production_output', 'slowdown'];

function UnitAndType({ form, mode, overrides }: Pick<EventFormFieldsProps, 'form' | 'mode'> & { overrides: SourceOverrides }) {
  const env = useEventHubEnv();
  const { values, errors, setField } = form;
  const chooseUnit = (unitId: string) => {
    setField('unitId', unitId);
    setField('assetId', '');
  };
  return (
    <>
      {mode === 'create' && (
        <Field id="unitId" label="Unit" error={errors.unitId} required>
          <select id="unitId" className={SELECT_CLASS} value={values.unitId} onChange={(e) => chooseUnit(e.target.value)}>
            <option value="">— choose —</option>
            {env.units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </Field>
      )}
      <SourceOwnedField fields={['physicalType']} overrides={overrides}>
        <Field id="physicalType" label="Type" error={errors.physicalType}>
          <select id="physicalType" className={SELECT_CLASS} value={values.physicalType} onChange={(e) => setField('physicalType', e.target.value)}>
            {PHYSICAL_TYPES.map((type) => <option key={type} value={type}>{labelOf(PHYSICAL_TYPE_LABELS, type)}</option>)}
          </select>
        </Field>
      </SourceOwnedField>
    </>
  );
}

/**
 * Inputs of the event form; times are on the plant clock (shown in the hint). For a stop the reason code
 * comes first (E-3: coding is the main task), then the interval (end time **or** duration, E-4), the
 * asset (A-1) and the details. E-5: fields the source owns say so and unlock with "Override…"; a
 * source-owned interval is read only.
 */
export function EventFormFields({ form, mode, event = null }: EventFormFieldsProps) {
  const { values, errors, setField } = form;
  const overrides = useSourceOverrides(event, form);
  const reasonFirst = values.physicalType === 'downtime';
  const owned = (fields: readonly string[], applies: boolean, className?: string) => (children: ReactNode) =>
    applies ? <SourceOwnedField fields={fields} overrides={overrides} className={className}>{children}</SourceOwnedField> : children;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {reasonFirst && <ReasonFields form={form} />}
      <UnitAndType form={form} mode={mode} overrides={overrides} />
      <IntervalFields form={form} mode={mode} event={event} sourceName={overrides.intervalOwned ? overrides.source : null} />
      {owned(['assetId'], true)(<AssetField form={form} />)}
      {owned(['scheduleClass'], true)(
        <Field id="scheduleClass" label="Schedule class" error={errors.scheduleClass} hint="Empty = the reason code's default">
          <select id="scheduleClass" className={SELECT_CLASS} value={values.scheduleClass} onChange={(e) => setField('scheduleClass', e.target.value)}>
            <option value="">— default —</option>
            {SCHEDULE_CLASSES.map((value) => <option key={value} value={value}>{labelOf(SCHEDULE_CLASS_LABELS, value)}</option>)}
          </select>
        </Field>,
      )}
      <OeeComponentField form={form} />
      <ImpactSection form={form} overrides={overrides} event={event} />
      {values.physicalType === 'downtime' && values.scheduleClass === 'planned' && (
        <PlantTimeField field="plannedEndLocal" label="Approved planned end (time after it is overrun)" form={form} />
      )}
      <OriginFields form={form} />
      {owned(['failureMode'], values.physicalType === 'downtime', 'sm:col-span-2')(<FailureFields form={form} assetId={values.assetId || null} />)}
      {owned(['quantity', 'quantityUom'], QUANTITY_TYPES.includes(values.physicalType), 'sm:col-span-2')(<QualityFields form={form} />)}
      {!reasonFirst && <ReasonFields form={form} />}
      {owned(['description'], true, 'sm:col-span-2')(
        <div className="sm:col-span-2">
          <Field id="description" label="Description" error={errors.description}>
            <Textarea id="description" value={values.description} maxLength={4000} onChange={(e) => setField('description', e.target.value)} />
          </Field>
        </div>,
      )}
      {mode === 'edit' && (
        <div className="sm:col-span-2">
          <Field id="changeReason" label="Reason for the change (optional)" error={errors.changeReason} hint="Kept in the event history with this revision">
            <Textarea id="changeReason" value={values.changeReason} maxLength={1000} rows={2} onChange={(e) => setField('changeReason', e.target.value)} />
          </Field>
        </div>
      )}
    </div>
  );
}
