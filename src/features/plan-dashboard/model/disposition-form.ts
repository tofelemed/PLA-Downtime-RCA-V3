import type { BodyOf } from '@/api/v2/schema-types';
import type { LotDispositionView } from '@/api/v2/types/periods';

/** `POST /lot-dispositions` body (LotDispositionCreateDto): only these fields (the API refuses others). */
export type DispositionProposal = BodyOf<'/api/v2/lot-dispositions', 'post'>;

/** What the user enters on "Record disposition"; times are UTC instants from the date-time inputs. */
export interface DispositionFormValues {
  productId: string;
  lotCode: string;
  dispositionClass: string;
  quantity: string | null;
  productionStart: string | null;
  productionEnd: string | null;
  labReleasedAt: string | null;
  evidenceRef: string;
  reason: string;
  /** a recovery movement: reprocessed material of an earlier disposition coming back as saleable output */
  recovery: boolean;
  recoveryOfId: string;
  remeasured: boolean;
  /** a correction: the approved disposition this one replaces once approved (empty = a new record) */
  supersedesId: string;
}

export type DispositionErrors = Partial<Record<keyof DispositionFormValues, string>>;

/** The period's interval is the default production interval of the lot (aligned by production, not lab time). */
export const emptyDisposition = (period: { utcStart: string; utcEnd: string }, productId: string): DispositionFormValues => ({
  productId,
  lotCode: '',
  dispositionClass: 'downgrade',
  quantity: null,
  productionStart: period.utcStart,
  productionEnd: period.utcEnd,
  labReleasedAt: null,
  evidenceRef: '',
  reason: '',
  recovery: false,
  recoveryOfId: '',
  remeasured: true,
  supersedesId: '',
});

/** The query parameter of "Record disposition" naming the approved disposition a correction replaces. */
export const SUPERSEDES_PARAM = 'supersedes';

/** The form for correcting an approved disposition: its lot, product and interval, the new figures to enter. */
export function correctionOf(original: LotDispositionView): DispositionFormValues {
  return {
    productId: original.productId,
    lotCode: original.lotCode,
    dispositionClass: original.dispositionClass === 'recovered' ? 'downgrade' : original.dispositionClass,
    quantity: original.quantity,
    productionStart: original.productionStart,
    productionEnd: original.productionEnd,
    labReleasedAt: original.labReleasedAt,
    evidenceRef: '',
    reason: '',
    recovery: original.dispositionClass === 'recovered',
    recoveryOfId: original.recoveryOfId ?? '',
    remeasured: original.remeasured,
    supersedesId: original.id,
  };
}

/** An approved row not yet corrected, and no correction of it waiting for approval, may be corrected. */
export function canCorrect(row: LotDispositionView, rows: readonly LotDispositionView[]): boolean {
  if (row.state !== 'approved' || row.supersededAt !== null) return false;
  return !rows.some((other) => other.supersedesId === row.id && other.state === 'proposed');
}

const ZERO = /^0*(\.0*)?$/;

/** Request-shape checks; recovery bounds, scope and the future are the server's (422 with a code). */
export function validateDisposition(values: DispositionFormValues): DispositionErrors {
  const errors: DispositionErrors = {};
  if (!values.productId) errors.productId = 'Choose the product';
  if (!values.lotCode.trim()) errors.lotCode = 'Enter the lot number';
  if (!values.quantity || ZERO.test(values.quantity)) errors.quantity = 'Enter the quantity (above zero)';
  if (!values.productionStart) errors.productionStart = 'Enter when the lot was produced';
  if (!values.productionEnd || (values.productionStart && values.productionEnd <= values.productionStart)) {
    errors.productionEnd = 'The end must be after the start';
  }
  if (values.recovery && !values.recoveryOfId) errors.recoveryOfId = 'Choose the disposition this material recovers';
  return errors;
}

const text = (value: string) => value.trim() || undefined;

/** The API body: exactly the declared fields (the server refuses undeclared ones). */
export function dispositionBody(values: DispositionFormValues, scope: { unitId: string; uom: string }): DispositionProposal {
  const optional = {
    labReleasedAt: values.labReleasedAt ?? undefined,
    evidenceRef: text(values.evidenceRef),
    reason: text(values.reason),
    ...(values.recovery ? { recoveryOfId: values.recoveryOfId, remeasured: values.remeasured } : {}),
    supersedesId: text(values.supersedesId),
  };
  return {
    unitId: scope.unitId,
    productId: values.productId,
    lotCode: values.lotCode.trim(),
    dispositionClass: (values.recovery ? 'recovered' : values.dispositionClass) as DispositionProposal['dispositionClass'],
    quantity: values.quantity as string,
    uom: scope.uom,
    productionStart: values.productionStart as string,
    productionEnd: values.productionEnd as string,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  };
}
