import { V2ApiError } from '@/api/v2/errors';

/**
 * Commissioning backdate of a policy version (owner, 18 Oct 2026; backend `src/periods/policy-backdate.ts`):
 * an optional past effective-from with a reason. The server decides whether it is allowed (no calculated
 * period of the scope in range, after the latest approved version); the form only checks what was typed.
 */
export interface BackdateDraft {
  /** ISO UTC instant, or null = effective at approval / record time */
  effectiveFrom: string | null;
  reason: string;
}

export type BackdateErrors = Partial<Record<'effectiveFrom' | 'reason', string>>;

/** The optional request fields of the policy write DTOs (`CommissioningBackdateDto`). */
export interface BackdateBody {
  effectiveFrom?: string;
  backdateReason?: string;
}

export const EMPTY_BACKDATE: BackdateDraft = { effectiveFrom: null, reason: '' };

/** Problems with what was typed: a past instant needs a reason; a reason needs an instant. */
export function backdateErrors(draft: BackdateDraft, now: Date = new Date()): BackdateErrors {
  const reason = draft.reason.trim();
  if (!draft.effectiveFrom) return reason ? { effectiveFrom: 'Choose the effective-from, or clear the reason' } : {};
  const errors: BackdateErrors = {};
  if (new Date(draft.effectiveFrom).getTime() >= now.getTime()) errors.effectiveFrom = 'Must be in the past';
  if (!reason) errors.reason = 'Give the reason for backdating';
  return errors;
}

/** Fields to merge into the POST body; empty when the version takes effect now. */
export function backdateBodyOf(draft: BackdateDraft): BackdateBody {
  if (!draft.effectiveFrom) return {};
  return { effectiveFrom: draft.effectiveFrom, backdateReason: draft.reason.trim() };
}

/** The refusals naming overlapping periods: calculated figures, or approved figures (valuation policy). */
export const OVERLAP_CODES = ['BACKDATE_OVERLAPS_CALCULATION', 'BACKDATE_OVERLAPS_APPROVED_VALUE'] as const;
export type OverlapCode = (typeof OVERLAP_CODES)[number];

const isOverlapCode = (code: string): code is OverlapCode => (OVERLAP_CODES as readonly string[]).includes(code);

/** A period named by a 409 BACKDATE_OVERLAPS_CALCULATION / BACKDATE_OVERLAPS_APPROVED_VALUE refusal. */
export interface OverlappingPeriod {
  periodId: string;
  unitName: string;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function periodOf(value: unknown): OverlappingPeriod | null {
  if (!isRecord(value)) return null;
  const { periodId, unitName, localDate, shiftName, utcStart, utcEnd } = value;
  if (typeof periodId !== 'string' || typeof unitName !== 'string' || typeof localDate !== 'string') return null;
  if (typeof utcStart !== 'string' || typeof utcEnd !== 'string') return null;
  return { periodId, unitName, localDate, shiftName: typeof shiftName === 'string' ? shiftName : null, utcStart, utcEnd };
}

/** The code, periods and total of an overlap refusal, or null for any other failure. */
export function overlapOf(error: unknown): { code: OverlapCode; periods: OverlappingPeriod[]; total: number } | null {
  if (!(error instanceof V2ApiError) || !isOverlapCode(error.code)) return null;
  const listed = Array.isArray(error.details?.periods) ? error.details.periods : [];
  const periods = listed.map(periodOf).filter((p): p is OverlappingPeriod => p !== null);
  const total = typeof error.details?.total === 'number' ? error.details.total : periods.length;
  return { code: error.code, periods, total };
}
