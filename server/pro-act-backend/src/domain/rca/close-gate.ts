import { caseEffectiveness, EffectivenessVerdict } from './effectiveness';

export type CloseBlocker =
  | 'ROOT_CAUSE_MISSING'
  | 'CODED_ROOT_CAUSE_MISSING'
  | 'ACTIONS_NOT_DONE'
  | 'ACTION_EVIDENCE_MISSING'
  | 'EFFECTIVENESS_NOT_VERIFIED'
  | 'RESIDUAL_RISK_MISSING';

export interface CloseAction {
  /** open | in_progress | done | cancelled */
  status: string;
  /** a completion evidence reference or attachment (CA4) */
  hasEvidence: boolean;
  /** the action has a baseline and verification window */
  verificationPlanned: boolean;
  /** the verification job's verdict, null until the window was evaluated */
  verdict: EffectivenessVerdict | null;
}

/**
 * Item 7: which root-cause rule the case is under. `coded` (cases opened since typed causes exist) needs
 * at least one `root` cause linked to the cause catalogue; `text` (older cases) the free-text root cause.
 */
export interface RootCauseRule {
  coded: boolean;
  /** root causes of the case with a cause code */
  codedRootCauses: number;
}

export interface CloseCandidate {
  rootCause: string | null;
  /** absent = the free-text rule (cases opened before typed causes) */
  rootCauseRule?: RootCauseRule;
  actions: readonly CloseAction[];
  /** the disposition of residual risk written for the closure review (CA1) */
  residualRisk: string | null;
}

export interface CloseReadiness {
  blockers: CloseBlocker[];
  /** the case's effectiveness from its verified actions (null = not verified yet) */
  effectiveness: EffectivenessVerdict | null;
}

const FINISHED_ACTIONS = new Set(['done', 'cancelled']);

/**
 * RCA-01 / CA1 closure gate (Monitoring → Closure Review): the root cause written (item 7: for a case
 * under the coded rule, a `root` cause with a cause code; the free text stays as the narrative), every action finished
 * (done with its evidence, CA4, or cancelled), effectiveness verified — at least one action verified and
 * no planned verification still pending (CA2) — and the residual risk disposed of. The verdict may be
 * not effective or insufficient evidence: the independent reviewer then decides with the residual-risk
 * statement; a case is never closed as effective merely because its tasks are done.
 */
export function closeReadiness(candidate: CloseCandidate): CloseReadiness {
  const blockers: CloseBlocker[] = [];
  const { actions } = candidate;
  const rule = candidate.rootCauseRule;
  if (rule?.coded) {
    if (rule.codedRootCauses === 0) blockers.push('CODED_ROOT_CAUSE_MISSING');
  } else if (!candidate.rootCause?.trim()) blockers.push('ROOT_CAUSE_MISSING');
  if (actions.some((action) => !FINISHED_ACTIONS.has(action.status)))
    blockers.push('ACTIONS_NOT_DONE');
  if (actions.some((action) => action.status === 'done' && !action.hasEvidence))
    blockers.push('ACTION_EVIDENCE_MISSING');
  const live = actions.filter((action) => action.status !== 'cancelled');
  const verdicts = live.flatMap((action) =>
    action.verdict ? [action.verdict] : [],
  );
  const pending = live.some(
    (action) => action.verificationPlanned && !action.verdict,
  );
  if (verdicts.length === 0 || pending)
    blockers.push('EFFECTIVENESS_NOT_VERIFIED');
  if (!candidate.residualRisk?.trim()) blockers.push('RESIDUAL_RISK_MISSING');
  return { blockers, effectiveness: caseEffectiveness(verdicts) };
}
