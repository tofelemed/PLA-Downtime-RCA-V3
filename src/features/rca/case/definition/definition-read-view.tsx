import type { ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_CONSEQUENCE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { cn } from '@/lib/utils';
import type { RcaCaseForm } from '../../model/rca-form';
import { useRcaFormat } from '../../use-rca-format';
import { useUnitNames } from '../../use-unit-names';
import { CHARTER_INFO, ROOT_CAUSE_INFO } from './definition-info';

interface ReadFieldProps {
  label: string;
  info?: string;
  wide?: boolean;
  children: ReactNode;
}

/** A label above its value, in the place the editable field takes (switching modes does not move the layout). */
function ReadField({ label, info, wide = false, children }: ReadFieldProps) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div className={cn('min-w-0 space-y-1.5', wide && 'md:col-span-2')}>
      <dt className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {label}
        {info && <KpiInfo label={label} text={info} />}
      </dt>
      <dd className="max-w-[75ch] whitespace-pre-wrap break-words text-sm">{empty ? <span className="text-muted-foreground">Not recorded</span> : children}</dd>
    </div>
  );
}

/** The definition as text for a closed investigation or a reader (no disabled inputs). */
export function DefinitionReadView({ form }: { form: RcaCaseForm }) {
  const { day } = useRcaFormat();
  const { unitName } = useUnitNames();
  return (
    <dl className="grid min-w-0 gap-4 md:grid-cols-2" data-testid="case-editor" data-mode="read">
      <ReadField label="Title" wide>
        {form.title}
      </ReadField>
      <ReadField label="Consequence class">{form.consequenceClass ? labelOf(RCA_CONSEQUENCE_LABELS, form.consequenceClass) : 'Not classified'}</ReadField>
      <ReadField label="Priority">{form.priority}</ReadField>
      <ReadField label="Target close date">{form.targetCloseDate ? day(form.targetCloseDate) : null}</ReadField>
      <ReadField label="Unit">{unitName(form.unitId)}</ReadField>
      <ReadField label="Problem statement" wide>
        {form.description}
      </ReadField>
      <ReadField label="Team charter" info={CHARTER_INFO} wide>
        {form.teamCharter}
      </ReadField>
      <ReadField label="Root cause" info={ROOT_CAUSE_INFO} wide>
        {form.rootCause}
      </ReadField>
    </dl>
  );
}
