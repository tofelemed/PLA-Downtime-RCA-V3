import { ActionPriority, FmeaRules, PriorityRule } from './rca-policy-rules';

export type FmeaRating = 'severity' | 'occurrence' | 'detection';

export interface FmeaEffectInput {
  /** 1–10, null = not rated yet */
  severity: number | null;
}

export interface FmeaCauseInput {
  id: string;
  description: string;
  occurrence: number | null;
  /** detection of this cause / failure chain by its own control (CA5), null = not rated yet */
  detection: number | null;
  detectionControl?: string | null;
  recommendedActions?: string[];
}

export interface ScoredCause extends FmeaCauseInput {
  detectionControl: string | null;
  recommendedActions: string[];
  /** the failure mode's worst effect severity, null while any effect is unrated */
  severity: number | null;
  /** severity × occurrence × detection; null while any rating is missing (never a default score) */
  rpn: number | null;
  actionPriority: ActionPriority | null;
  /** RPN at or above the threshold, high priority, or severity at or above the review level */
  needsAction: boolean | null;
  missing: FmeaRating[];
}

export interface FmeaScoring {
  causes: ScoredCause[];
  /** every effect and cause is rated; final approval of the analysis needs it (drafts may be partial) */
  complete: boolean;
  method: FmeaRules['method'];
  rpnThreshold: number;
  severityReview: number;
}

/** Worst effect severity; null without effects or while any effect is unrated. */
export function modeSeverity(
  effects: readonly FmeaEffectInput[],
): number | null {
  if (effects.length === 0) return null;
  if (effects.some((effect) => effect.severity === null)) return null;
  return Math.max(...effects.map((effect) => effect.severity as number));
}

/** First rule whose minimums the three ratings meet; low when none does. */
export function actionPriority(
  rules: readonly PriorityRule[],
  ratings: { severity: number; occurrence: number; detection: number },
): ActionPriority {
  const rule = rules.find(
    (candidate) =>
      ratings.severity >= candidate.severityMin &&
      ratings.occurrence >= candidate.occurrenceMin &&
      ratings.detection >= candidate.detectionMin,
  );
  return rule?.priority ?? 'low';
}

function scoreCause(
  cause: FmeaCauseInput,
  severity: number | null,
  rules: FmeaRules,
): ScoredCause {
  const missing: FmeaRating[] = [];
  if (severity === null) missing.push('severity');
  if (cause.occurrence === null) missing.push('occurrence');
  if (cause.detection === null) missing.push('detection');
  const base = {
    ...cause,
    detectionControl: cause.detectionControl ?? null,
    recommendedActions: cause.recommendedActions ?? [],
    severity,
    missing,
  };
  if (
    severity === null ||
    cause.occurrence === null ||
    cause.detection === null
  ) {
    return { ...base, rpn: null, actionPriority: null, needsAction: null };
  }
  const ratings = {
    severity,
    occurrence: cause.occurrence,
    detection: cause.detection,
  };
  const rpn = severity * cause.occurrence * cause.detection;
  const priority = actionPriority(rules.priorityRules, ratings);
  return {
    ...base,
    rpn,
    actionPriority: priority,
    needsAction:
      severity >= rules.severityReview ||
      (rules.method === 'rpn'
        ? rpn >= rules.rpnThreshold
        : priority === 'high'),
  };
}

/**
 * CA5 FMEA scoring on the server: severity of the failure mode (worst effect), occurrence and detection
 * per cause (detection belongs to the cause's own control, not to an effect). A missing rating stays
 * null and makes the analysis incomplete — no neutral default. RPN and the policy's priority rules are
 * both returned; a high severity needs action whatever the RPN (the 100 cutoff alone is never the gate).
 */
export function scoreFmea(
  effects: readonly FmeaEffectInput[],
  causes: readonly FmeaCauseInput[],
  rules: FmeaRules,
): FmeaScoring {
  const severity = modeSeverity(effects);
  const scored = causes.map((cause) => scoreCause(cause, severity, rules));
  return {
    causes: scored,
    complete:
      causes.length > 0 && scored.every((cause) => cause.missing.length === 0),
    method: rules.method,
    rpnThreshold: rules.rpnThreshold,
    severityReview: rules.severityReview,
  };
}
