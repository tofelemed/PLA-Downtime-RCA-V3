import type { AnalogThresholds } from '@/api/v2/types/reliability';

export type AnalogStopState = AnalogThresholds['stopState'];

export const ANALOG_STOP_LABELS: Readonly<Record<AnalogStopState, string>> = {
  internal_stop: 'Stopped (internal)',
  starved: 'Starved (no input)',
  blocked: 'Blocked (no output)',
};

/** The analog fields as typed (numbers stay text until saved). */
export interface AnalogDraft {
  stopBelow: string;
  reducedBelow: string;
  hysteresis: string;
  ratedValue: string;
  stopState: AnalogStopState;
}

export const EMPTY_ANALOG: AnalogDraft = { stopBelow: '', reducedBelow: '', hysteresis: '0', ratedValue: '', stopState: 'internal_stop' };

const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

/** The version in force's thresholds as a draft; null = rules only. */
export function analogDraftOf(thresholds: AnalogThresholds | null | undefined): AnalogDraft | null {
  if (!thresholds) return null;
  return {
    stopBelow: text(thresholds.stopBelow),
    reducedBelow: text(thresholds.reducedBelow),
    hysteresis: text(thresholds.hysteresis),
    ratedValue: text(thresholds.ratedValue),
    stopState: thresholds.stopState,
  };
}

export type AnalogErrors = Partial<Record<'stopBelow' | 'reducedBelow' | 'hysteresis' | 'ratedValue', string>>;

const numberOf = (value: string): number | null => (value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null);

/** An optional number field: empty is fine, else it must be a number passing `ok`. */
const optionalBad = (value: string, ok: (n: number) => boolean) => {
  if (!value.trim()) return false;
  const n = numberOf(value);
  return n === null || !ok(n);
};

/** Field problems before sending (the server re-checks them): optional fields may stay empty. */
export function analogErrors(draft: AnalogDraft): AnalogErrors {
  const errors: AnalogErrors = {};
  const stop = numberOf(draft.stopBelow);
  if (stop === null) errors.stopBelow = 'A number';
  if (optionalBad(draft.reducedBelow, (n) => stop === null || n > stop)) errors.reducedBelow = 'A number above the stop threshold';
  const hysteresis = numberOf(draft.hysteresis);
  if (hysteresis === null || hysteresis < 0) errors.hysteresis = 'A number of 0 or more';
  if (optionalBad(draft.ratedValue, (n) => n > 0)) errors.ratedValue = 'A number above 0';
  return errors;
}

/** The `thresholds` body of a valid draft. */
export function analogBody(draft: AnalogDraft): AnalogThresholds {
  return {
    stopBelow: Number(draft.stopBelow),
    reducedBelow: draft.reducedBelow.trim() ? Number(draft.reducedBelow) : null,
    hysteresis: Number(draft.hysteresis),
    stopState: draft.stopState,
    ratedValue: draft.ratedValue.trim() ? Number(draft.ratedValue) : null,
  };
}
