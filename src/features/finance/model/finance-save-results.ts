import type { DemandStatusView, FxRateView, ValuationPolicyView } from '@/api/v2/types/valuation';
import type { Capabilities } from '@/features/auth/capabilities';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import type { DigitSystem } from '@/lib/dates';
import { fxRateText } from './fx-rate-text';

export const POLICIES_PATH = '/finance?tab=policies';
export const FX_PATH = '/finance?tab=fx';
export const DEMAND_PATH = '/finance?tab=demand';

const APPROVER_NOTE = 'A finance approver other than you approves it before';

/**
 * Result dialog of a new valuation policy version (DECISIONS 2026-10-22 "Save feedback"): View policy
 * version · Back to Valuation · Next: the Setup guide step after valuation. `onDismiss` opens the version.
 */
export function policyVersionResult(policy: ValuationPolicyView, capabilities: Capabilities, onDismiss: () => void): SaveResult {
  return {
    title: `Version ${policy.version} saved (not approved)`,
    recordLabel: `Valuation policy version ${policy.version}`,
    message: `${APPROVER_NOTE} it values losses.`,
    viewPath: `/finance/policies/${policy.id}`,
    viewLabel: 'View policy version',
    listPath: POLICIES_PATH,
    listLabel: 'Valuation',
    next: nextSetupLink('/finance/policies/new', { capabilities }),
    onDismiss,
  };
}

/** Result dialog of an exchange rate draft, shown after the add dialog closes: View rate · Back to Exchange rates. */
export function fxDraftResult(rate: FxRateView, digits?: DigitSystem): SaveResult {
  return {
    title: 'Exchange rate draft saved',
    recordLabel: `${fxRateText(rate, digits)}, version ${rate.version}`,
    message: `${APPROVER_NOTE} valuation uses it.`,
    viewPath: `/finance/fx/${rate.id}`,
    viewLabel: 'View rate',
    listPath: FX_PATH,
    listLabel: 'Exchange rates',
  };
}

/**
 * Result dialog of a demand status draft, like an exchange rate draft: a status has no page of its own, so
 * "View status" opens the Demand tab at its row (`#demand-status-<id>`).
 */
export function demandDraftResult(status: DemandStatusView, recordLabel: string): SaveResult {
  return {
    title: 'Demand status draft saved',
    recordLabel,
    message: `${APPROVER_NOTE} the economic view uses it.`,
    viewPath: `${DEMAND_PATH}#demand-status-${encodeURIComponent(status.id)}`,
    viewLabel: 'View status',
    listPath: DEMAND_PATH,
    listLabel: 'Demand',
  };
}
