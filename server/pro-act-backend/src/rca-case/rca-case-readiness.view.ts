import { RcaStatus } from '../domain/rca/case-workflow';
import { CloseReadiness, RootCauseRule } from '../domain/rca/close-gate';
import {
  depthRequirementOf,
  DepthRequirement,
  INVESTIGATION_DEPTH_VERSION,
} from '../domain/rca/investigation-depth';
import {
  GateIssue,
  GateResult,
  InvestigationFacts,
} from '../domain/rca/investigation-gate';

/** What the case screen shows about the next moves (RCA-01 / CA1, computed on the server). */
export interface RcaCaseReadinessV2View {
  rcaId: string;
  status: RcaStatus;
  next: Array<{ to: RcaStatus; gates: string[] }>;
  investigation: GateResult;
  closure: {
    blockers: GateIssue[];
    effectiveness: CloseReadiness['effectiveness'];
    /** item 7: coded = a root cause linked to the cause catalogue is required (cases opened since then) */
    rootCauseRule: RootCauseRule;
  };
  /** whether the caller may approve the closure (role and independence), with the reason when not */
  approver: { canApprove: boolean; reason: string | null };
  /** same-problem events linked to this case by the triggers since it opened (CA8 escalation) */
  linkedRecurrences: number;
  rules: {
    fiveWhyGuidelineLevels: number;
    /** CA6: root-cause phrases the investigation gate refuses on their own (e.g. "operator error") */
    fiveWhyUnsupportedRootCauses: string[];
    consequenceClass: string | null;
    /**
     * D-T4: what the investigation of the case's class needs before it is accepted (the matrix version
     * with the method groups, charter, coded causes and independent closure); null while unclassified.
     */
    investigationDepth: (DepthRequirement & { version: string }) | null;
  };
}

/** D-T4 requirement of the case's class with the matrix version (null while unclassified). */
export const depthOf = (
  consequenceClass: InvestigationFacts['consequenceClass'],
): RcaCaseReadinessV2View['rules']['investigationDepth'] => {
  const requirement = depthRequirementOf(consequenceClass);
  return requirement
    ? { ...requirement, version: INVESTIGATION_DEPTH_VERSION }
    : null;
};
