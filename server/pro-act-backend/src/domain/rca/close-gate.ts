import { caseEffectiveness, EffectivenessVerdict } from './effectiveness';

export type CloseBlocker =
  | 'ROOT_CAUSE_MISSING'
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

export interface CloseCandidate {
  rootCause: string | null;
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
 * RCA-01 / CA1 closure gate (Monitoring → Closure Review): the root cause written, every action finished
 * (done with its evidence, CA4, or cancelled), effectiveness verified — at least one action verified and
 * no planned verification still pending (CA2) — and the residual risk disposed of. The verdict may be
 * not effective or insufficient evidence: the independent reviewer then decides with the residual-risk
 * statement; a case is never closed as effective merely because its tasks are done.
 */
export function closeReadiness(candidate: CloseCandidate): CloseReadiness {
  const blockers: CloseBlocker[] = [];
  const { actions } = candidate;
  if (!candidate.rootCause?.trim()) blockers.push('ROOT_CAUSE_MISSING');
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
