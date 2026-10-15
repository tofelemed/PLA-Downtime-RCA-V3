import { Label } from '@/components/ui/label';
import { TextField } from '../../components/text-field';
import { SELECT_CLASS } from '../shared/use-asset-lookup';
import { ANALOG_STOP_LABELS, type AnalogDraft, type AnalogErrors, type AnalogStopState, EMPTY_ANALOG } from './analog-thresholds-model';

const STOP_STATES = Object.keys(ANALOG_STOP_LABELS) as AnalogStopState[];

export interface AnalogFieldsProps {
  analog: AnalogDraft | null;
  errors: AnalogErrors | undefined;
  onChange: (analog: AnalogDraft | null) => void;
}

/**
 * Plan 1.10 analog mapping: a numeric value no rule matches is banded stopped / reduced rate / running by
 * thresholds with a hysteresis band; reduced-rate spans become slowdown events (the server derives them).
 */
export function AnalogFields({ analog, errors, onChange }: AnalogFieldsProps) {
  const set = (change: Partial<AnalogDraft>) => analog && onChange({ ...analog, ...change });
  return (
    <fieldset className="space-y-3" data-testid="analog-thresholds">
      <legend className="mb-1 text-sm font-medium">Analog signal</legend>
      <div className="flex items-center gap-2">
        <input id="map-analog" type="checkbox" className="h-4 w-4" checked={analog !== null} onChange={(e) => onChange(e.target.checked ? { ...EMPTY_ANALOG } : null)} />
        <Label htmlFor="map-analog">Band numeric values (throughput, motor current) by thresholds</Label>
      </div>
      {analog && (
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField id="map-stop-below" label="Stopped below" value={analog.stopBelow} inputMode="decimal" onChange={(v) => set({ stopBelow: v })} error={errors?.stopBelow} required />
          <TextField id="map-reduced-below" label="Reduced rate below (optional)" value={analog.reducedBelow} inputMode="decimal" onChange={(v) => set({ reducedBelow: v })} error={errors?.reducedBelow} />
          <TextField id="map-hysteresis" label="Hysteresis" value={analog.hysteresis} inputMode="decimal" onChange={(v) => set({ hysteresis: v })} error={errors?.hysteresis} hint="A lower band is left only above its threshold + this" />
          <TextField id="map-rated" label="Rated value (optional)" value={analog.ratedValue} inputMode="decimal" onChange={(v) => set({ ratedValue: v })} error={errors?.ratedValue} hint="Value at the full rate: a slowdown loses 1 − mean ÷ rated" />
          <div className="space-y-1.5">
            <Label htmlFor="map-stop-state">An analog stop is</Label>
            <select id="map-stop-state" className={SELECT_CLASS} value={analog.stopState} onChange={(e) => set({ stopState: e.target.value as AnalogStopState })}>
              {STOP_STATES.map((s) => <option key={s} value={s}>{ANALOG_STOP_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
      )}
    </fieldset>
  );
}
