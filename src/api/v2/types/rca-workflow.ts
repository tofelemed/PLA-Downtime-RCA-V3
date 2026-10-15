/**
 * v2 RCA case workflow and action effectiveness views (RCA-01, SME CA1–CA4; backend
 * `src/rca-case/rca-case-workflow.service.ts`, `rca-action.view.ts`, `src/domain/rca/effectiveness.ts`).
 * Every verdict, rate and gate is computed by the server; screens only show them.
 */
import type { RcaStatus } from './rca';

export const RCA_CONSEQUENCE_CLASSES = ['minor', 'significant', 'major'] as const;
export type RcaConsequenceClass = (typeof RCA_CONSEQUENCE_CLASSES)[number];

export const RCA_ACTION_TYPES = ['repair', 'design_change', 'procedure_change', 'instrument_change', 'training', 'other'] as const;
export type RcaActionType = (typeof RCA_ACTION_TYPES)[number];

export type RcaEffectivenessVerdict = 'effective' | 'not_effective' | 'insufficient_evidence';

/** One blocker or piece of advice of a gate, in the server's words. */
export interface RcaGateIssue {
  code: string;
  field: string;
  message: string;
}

/** `GET /v2/rcas/{id}/readiness`: what the case screen shows about the next moves. */
export interface RcaCaseReadinessView {
  rcaId: string;
  status: RcaStatus;
  next: Array<{ to: RcaStatus; gates: string[] }>;
  investigation: { blockers: RcaGateIssue[]; advice: RcaGateIssue[] };
  closure: { blockers: RcaGateIssue[]; effectiveness: RcaEffectivenessVerdict | null };
  approver: { canApprove: boolean; reason: string | null };
  /** same-problem events linked to this case by the triggers since it opened */
  linkedRecurrences: number;
  rules: { fiveWhyGuidelineLevels: number; consequenceClass: string | null };
}

/** Same-mode unplanned incidents of a window and its run time (decimal strings in seconds). */
export interface RcaExposureWindow {
  from: string;
  to: string;
  incidents: number;
  downtimeSeconds: string;
  exposureSeconds: string;
  /** unit run time, or the standby assets' own running time (CA4); absent on windows before rca-exposure-v2 */
  exposureBasis?: 'unit_run_time' | 'standby_running_time';
}

export interface RcaEffectivenessCriteria {
  requiredReduction: number;
  minExposureHours: number;
  zeroRepeat: boolean;
}

export interface RcaBaselineCorrection {
  value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedBy: string | null;
  proposedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
}

export interface RcaActionBaseline {
  metric: string;
  windowDays: number;
  /** decimal string: the counted metric over the window */
  value: string;
  /** true for values typed before CA3 */
  declared: boolean;
  window?: RcaExposureWindow;
  criteria?: RcaEffectivenessCriteria;
  correction?: RcaBaselineCorrection | null;
}

export interface RcaEffectivenessResult {
  verdict: RcaEffectivenessVerdict;
  /** per 1,000 run hours (decimal strings); null when the exposure is zero */
  baselineRate: string | null;
  postRate: string | null;
  reduction: string | null;
  mtbfLowerBound95Hours: string | null;
  reasons: string[];
}

export interface RcaCompletionAttachment {
  fileName: string;
  name: string;
}
