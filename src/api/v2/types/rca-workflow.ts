/**
 * v2 RCA case workflow and action effectiveness views (RCA-01, SME CA1–CA4; backend
 * `src/rca-case/rca-case-workflow.service.ts`, `rca-action.view.ts`, `src/domain/rca/effectiveness.ts`).
 * Every verdict, rate and gate is computed by the server; screens only show them.
 */
import type { RcaStatus } from './rca';

/** CA7 / D-T4 consequence classes in rising severity (`significant` is the moderate tier of D-T4). */
export const RCA_CONSEQUENCE_CLASSES = ['minor', 'significant', 'major', 'critical'] as const;
export type RcaConsequenceClass = (typeof RCA_CONSEQUENCE_CLASSES)[number];

export const RCA_ACTION_TYPES = ['repair', 'design_change', 'procedure_change', 'instrument_change', 'training', 'other'] as const;
export type RcaActionType = (typeof RCA_ACTION_TYPES)[number];

export type RcaEffectivenessVerdict = 'effective' | 'not_effective' | 'insufficient_evidence';

/** One blocker or piece of advice of a gate, in the server's words. */
export interface RcaGateIssue {
  code: string;
  field: string;
  message: string;
  /** `METHOD_REQUIRED` (D-T4): the analysis methods any one of which meets the requirement */
  methods?: string[];
}

/** D-T4 investigation depth of the case's consequence class (server matrix, versioned). */
export interface RcaInvestigationDepth {
  version: string;
  /** each group needs one of its methods with content */
  methodGroups: string[][];
  teamCharter: boolean;
  codedCauses: boolean;
  independentClosure: boolean;
}

/**
 * Item 7 closure rule of the case: `coded` cases need a root cause with a catalogue code
 * (blocker `CODED_ROOT_CAUSE_MISSING`); older cases keep the free-text root cause (`ROOT_CAUSE_MISSING`).
 */
export interface RcaRootCauseRule {
  coded: boolean;
  codedRootCauses: number;
}

/** `GET /v2/rcas/{id}/readiness`: what the case screen shows about the next moves. */
export interface RcaCaseReadinessView {
  rcaId: string;
  status: RcaStatus;
  next: Array<{ to: RcaStatus; gates: string[] }>;
  investigation: { blockers: RcaGateIssue[]; advice: RcaGateIssue[] };
  closure: { blockers: RcaGateIssue[]; effectiveness: RcaEffectivenessVerdict | null; rootCauseRule?: RcaRootCauseRule };
  approver: { canApprove: boolean; reason: string | null };
  /** same-problem events linked to this case by the triggers since it opened */
  linkedRecurrences: number;
  rules: {
    fiveWhyGuidelineLevels: number;
    /** CA6: root-cause phrases the investigation gate refuses on their own (policy, e.g. "operator error") */
    fiveWhyUnsupportedRootCauses: string[];
    consequenceClass: string | null;
    /** D-T4 requirement of the class; null while unclassified (absent from older servers) */
    investigationDepth?: RcaInvestigationDepth | null;
  };
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
  /** rca-exposure-v3 (unit run time): seconds of known unit state and without data, and known / window (decimal string 0–1) */
  knownSeconds?: string;
  unknownSeconds?: string;
  coverage?: string | null;
  /** case units without any state mapping in the window (owner, 18 Oct 2026; absent on earlier windows) */
  unmappedUnitIds?: string[];
}

export interface RcaEffectivenessCriteria {
  requiredReduction: number;
  minExposureHours: number;
  zeroRepeat: boolean;
  /** 0–1 coverage the post-action window needs; absent (frozen before 18 Oct 2026) = 0.95 */
  minimumCoverage?: number;
  /** version of the RCA policy the criteria were frozen from; absent on criteria frozen before 19 Oct 2026 */
  policyVersion?: number;
}

/** Known-data coverage of both windows and the minimum the verdict applied (decimal strings). */
export interface RcaEffectivenessCoverage {
  baseline: string | null;
  post: string | null;
  minimum: string;
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
  /** owner, 18 Oct 2026 (absent on verdicts stored before) */
  coverage?: RcaEffectivenessCoverage;
}

export interface RcaCompletionAttachment {
  fileName: string;
  name: string;
}
