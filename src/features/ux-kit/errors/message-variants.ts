import type { ErrorFacts } from './error-facts';
import type { ErrorMessage } from './error-message';
import { DAY_NO_COMPUTABLE_FIGURES } from './messages-close';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Whether some `details.pending[]` entry of the refusal carries `reason`. */
function pendingHasReason(details: ErrorFacts['details'], reason: string): boolean {
  const pending = details?.pending;
  return Array.isArray(pending) && pending.some((entry) => isRecord(entry) && entry.reason === reason);
}

/**
 * The wording of a code whose cause the details name: DAY_NOT_READY is either unapproved shifts (the mapped
 * text) or approved periods without computable figures. Undefined = the code's own mapped text applies.
 */
export function variantMessage(facts: ErrorFacts): ErrorMessage | undefined {
  if (facts.code === 'DAY_NOT_READY' && pendingHasReason(facts.details, 'NO_COMPUTABLE_SLICE')) return DAY_NO_COMPUTABLE_FIGURES;
  return undefined;
}
