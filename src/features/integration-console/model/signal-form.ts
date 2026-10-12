import type { SignalCreateBody } from '@/api/v2/queries/signals';

/**
 * A new signal definition as typed (plan 1.7): where it lives at the source, which unit it measures,
 * what kind of measurement it is, and the optional engine settings. Converted to the POST body on save.
 */
export interface SignalForm {
  name: string;
  sourceKey: string;
  sourcePath: string;
  unitId: string;
  semanticType: string;
  canonicalUom: string;
  rateTimebase: string;
  interpolation: string;
  maxGapSeconds: string;
  resetPolicy: string;
  rolloverModulus: string;
  expectedMin: string;
  expectedMax: string;
  cadenceSeconds: string;
  acceptUncertain: boolean;
  isAuthority: boolean;
  effectiveFrom: string | null;
}

export type SignalFormErrors = Partial<Record<keyof SignalForm, string>>;

export function emptySignalForm(): SignalForm {
  return {
    name: '',
    sourceKey: '',
    sourcePath: '',
    unitId: '',
    semanticType: 'rate',
    canonicalUom: '',
    rateTimebase: 'h',
    interpolation: 'step',
    maxGapSeconds: '900',
    resetPolicy: 'none',
    rolloverModulus: '',
    expectedMin: '',
    expectedMax: '',
    cadenceSeconds: '',
    acceptUncertain: false,
    isAuthority: false,
    effectiveFrom: null,
  };
}

const DECIMAL = /^-?\d{1,16}(\.\d{1,8})?$/;
const isInt = (value: string, min: number, max: number) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;

function numberErrors(form: SignalForm): SignalFormErrors {
  const errors: SignalFormErrors = {};
  if (!isInt(form.maxGapSeconds, 1, 604_800)) errors.maxGapSeconds = 'Enter whole seconds from 1 to 604800.';
  if (form.cadenceSeconds && !isInt(form.cadenceSeconds, 1, 86_400)) errors.cadenceSeconds = 'Enter whole seconds from 1 to 86400.';
  for (const field of ['rolloverModulus', 'expectedMin', 'expectedMax'] as const) {
    if (form[field] && !DECIMAL.test(form[field])) errors[field] = 'Enter a number (up to 8 decimals).';
  }
  return errors;
}

/** Client checks mirroring the server's DTO; the server stays the judge (422 RATE_TIMEBASE_REQUIRED …). */
export function signalFormErrors(form: SignalForm): SignalFormErrors {
  const errors = numberErrors(form);
  if (!form.name.trim()) errors.name = 'Enter a name.';
  if (!form.sourceKey.trim()) errors.sourceKey = 'Enter the source stream id (PI WebId or topic).';
  if (!form.unitId) errors.unitId = 'Choose the production unit.';
  if (form.semanticType === 'rate' && !form.rateTimebase) errors.rateTimebase = 'A rate needs its time base.';
  return errors;
}

const optional = (value: string) => (value.trim() ? value.trim() : undefined);

export function signalBody(form: SignalForm, connectionId: string): SignalCreateBody {
  return {
    connectionId,
    name: form.name.trim(),
    sourceKey: form.sourceKey.trim(),
    sourcePath: optional(form.sourcePath),
    unitId: form.unitId,
    semanticType: form.semanticType as SignalCreateBody['semanticType'],
    canonicalUom: optional(form.canonicalUom),
    rateTimebase: form.semanticType === 'rate' || form.semanticType === 'counter' ? (form.rateTimebase as SignalCreateBody['rateTimebase']) : undefined,
    interpolation: form.interpolation as SignalCreateBody['interpolation'],
    maxGapSeconds: Number(form.maxGapSeconds),
    resetPolicy: form.semanticType === 'counter' ? (form.resetPolicy as SignalCreateBody['resetPolicy']) : undefined,
    rolloverModulus: form.semanticType === 'counter' ? optional(form.rolloverModulus) : undefined,
    expectedMin: optional(form.expectedMin),
    expectedMax: optional(form.expectedMax),
    cadenceSeconds: form.cadenceSeconds ? Number(form.cadenceSeconds) : undefined,
    qualityPolicy: { acceptUncertain: form.acceptUncertain },
    isAuthority: form.isAuthority,
    effectiveFrom: form.effectiveFrom ?? undefined,
  };
}
