import type { MicroStopPolicyBody, MicroStopPolicyView } from '@/api/v2/types/reliability';

export interface ClassThreshold {
  assetClass: string;
  seconds: string;
}

/** The micro-stop form as typed (numbers stay text until saved). */
export interface MicroStopDraft {
  microStopSeconds: string;
  classes: ClassThreshold[];
  /** trip reason codes, comma or line separated */
  tripCodes: string;
  notes: string;
}

export type MicroStopErrors = Partial<Record<'microStopSeconds' | 'classes', string>>;

/** A new version starts from the settings in force. */
export function microStopDraftOf(current: MicroStopPolicyView | undefined): MicroStopDraft {
  return {
    microStopSeconds: current ? String(current.microStopSeconds) : '',
    classes: Object.entries(current?.microStopSecondsByAssetClass ?? {}).map(([assetClass, seconds]) => ({ assetClass, seconds: String(seconds) })),
    tripCodes: (current?.tripReasonCodes ?? []).join(', '),
    notes: '',
  };
}

const seconds = (text: string): number | null => {
  const value = Number(text);
  return text.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 86400 ? value : null;
};

export const tripCodesOf = (text: string): string[] => [...new Set(text.split(/[,\n]/).map((c) => c.trim()).filter(Boolean))];

/** Field problems before sending; the server's parser checks the body again (422 INVALID_POLICY). */
export function microStopErrors(draft: MicroStopDraft): MicroStopErrors {
  const errors: MicroStopErrors = {};
  if (seconds(draft.microStopSeconds) === null) errors.microStopSeconds = 'Whole seconds from 0 to 86400';
  const names = draft.classes.map((c) => c.assetClass.trim());
  if (names.some((n) => !n) || draft.classes.some((c) => seconds(c.seconds) === null)) {
    errors.classes = 'Each row needs an asset class and whole seconds from 0 to 86400';
  } else if (new Set(names).size !== names.length) {
    errors.classes = 'Each asset class appears once';
  }
  return errors;
}

/** The POST body of a valid draft: the class map and trip codes replace the stated ones. */
export function microStopBodyOf(unitId: string, draft: MicroStopDraft): MicroStopPolicyBody {
  return {
    ...(unitId ? { unitId } : {}),
    microStopSeconds: Number(draft.microStopSeconds),
    microStopSecondsByAssetClass: Object.fromEntries(draft.classes.map((c) => [c.assetClass.trim(), Number(c.seconds)])),
    tripReasonCodes: tripCodesOf(draft.tripCodes),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
  };
}
