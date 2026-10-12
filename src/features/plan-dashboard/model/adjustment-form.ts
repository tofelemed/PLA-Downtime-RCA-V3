import type { AdjustmentProposal } from '../hooks/use-adjustment-commands';

/** What the user types on "Propose adjustment"; times are UTC instants from the date-time inputs. */
export interface AdjustmentFormValues {
  sliceId: string;
  kind: AdjustmentProposal['kind'];
  quantity: string | null;
  basis: AdjustmentProposal['basis'];
  reason: string;
  evidenceRef: string;
  windowFrom: string | null;
  windowTo: string | null;
}

export type AdjustmentErrors = Partial<Record<keyof AdjustmentFormValues, string>>;

export const emptyAdjustment = (sliceId: string): AdjustmentFormValues => ({
  sliceId,
  kind: 'good',
  quantity: null,
  basis: 'measured',
  reason: '',
  evidenceRef: '',
  windowFrom: null,
  windowTo: null,
});

const ZERO = /^[-+]?0*(\.0*)?$/;

/**
 * The request shape the API checks first (required fields, a non-zero signed quantity, a half-open
 * measurement window); whether the slice is active, in scope and the window inside it is the server's.
 */
export function validateAdjustment(values: AdjustmentFormValues): AdjustmentErrors {
  const errors: AdjustmentErrors = {};
  if (!values.sliceId) errors.sliceId = 'Choose the product';
  if (!values.quantity || ZERO.test(values.quantity)) errors.quantity = 'Enter the correction, e.g. -5 (not zero)';
  if (!values.reason.trim()) errors.reason = 'Enter a reason';
  if (!values.evidenceRef.trim()) errors.evidenceRef = 'Enter the evidence, e.g. the weighbridge ticket';
  if (Boolean(values.windowFrom) !== Boolean(values.windowTo)) errors.windowTo = 'Enter both ends of the measurement window, or neither';
  if (values.windowFrom && values.windowTo && values.windowTo <= values.windowFrom) errors.windowTo = 'The end must be after the start';
  return errors;
}

/** The API body: exactly the declared fields (the server refuses undeclared ones). */
export function adjustmentBody(values: AdjustmentFormValues): AdjustmentProposal {
  return {
    sliceId: values.sliceId,
    kind: values.kind,
    quantity: values.quantity as string,
    basis: values.basis,
    reason: values.reason.trim(),
    evidenceRef: values.evidenceRef.trim(),
    ...(values.windowFrom && values.windowTo ? { windowFrom: values.windowFrom, windowTo: values.windowTo } : {}),
  };
}
