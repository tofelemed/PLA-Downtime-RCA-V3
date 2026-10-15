import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EventFormField, EventFormValues, FieldErrors } from '../model/event-form';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

const IMPACTS: ReadonlyArray<[string, string]> = [
  ['full_stop', 'Stops the unit'],
  ['fractional', 'Reduces output (unit keeps running)'],
  ['none', 'No production impact (e.g. standby took over)'],
];

/** Plan 1.10: an impact the server derived; choosing a value here makes it the person's (the override). */
const DERIVED: Readonly<Record<string, string>> = {
  unit_rule: 'Set by the unit impact rule of the asset. Choosing a value here overrides it.',
  standby_takeover: 'Set because the standby took over in time. Choosing a value here overrides it.',
};

interface ImpactForm {
  values: EventFormValues;
  errors: FieldErrors;
  setField: (field: EventFormField, value: string) => void;
}

/**
 * SME Q5: what a stop did to production — stopped the unit, reduced output by a share (a rate loss, not
 * stopped time) or nothing (an equipment event without production loss). Downtime only.
 */
export function ImpactFields({ form }: { form: ImpactForm }) {
  const { values, errors, setField } = form;
  if (values.physicalType !== 'downtime') return null;
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="impactMode">Impact on production</Label>
        <select id="impactMode" className={SELECT_CLASS} value={values.impactMode || 'full_stop'} onChange={(e) => setField('impactMode', e.target.value)}>
          {IMPACTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {DERIVED[values.impactBasis] && <p className="text-xs text-muted-foreground" data-testid="impact-basis">{DERIVED[values.impactBasis]}</p>}
      </div>
      {values.impactMode === 'fractional' && (
        <div className="space-y-1">
          <Label htmlFor="impactPercent">Output lost (%)</Label>
          <Input
            id="impactPercent"
            inputMode="decimal"
            value={values.impactPercent}
            onChange={(e) => setField('impactPercent', e.target.value)}
            aria-invalid={Boolean(errors.impactPercent)}
            aria-describedby={errors.impactPercent ? 'impactPercent-error' : undefined}
          />
          {errors.impactPercent && <p id="impactPercent-error" className="text-xs text-destructive">{errors.impactPercent}</p>}
        </div>
      )}
    </>
  );
}
