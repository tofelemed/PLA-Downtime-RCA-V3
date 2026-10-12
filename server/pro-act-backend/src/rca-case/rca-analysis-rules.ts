/** FMEA scoring of the analysis tools (v1 rule, now on the server): RPN = severity × occurrence × detection. */
export interface FmeaEffectScores {
  severity: number;
  detection: number;
}

export interface FmeaCauseInput {
  id: string;
  description: string;
  occurrence: number;
  recommendedActions?: string[];
}

/** Neutral score (5 of 10) used when the analysis has no effect yet, as the v1 tool did. */
const NEUTRAL_SCORE = 5;

/**
 * Risk priority number of each cause: the worst severity and the worst detection over the effects
 * (a failure mode is as bad as its worst effect) times the cause's occurrence.
 */
export function withRpn(
  effects: readonly FmeaEffectScores[],
  causes: readonly FmeaCauseInput[],
): Array<FmeaCauseInput & { rpn: number; recommendedActions: string[] }> {
  const severity = effects.length
    ? Math.max(...effects.map((effect) => effect.severity))
    : NEUTRAL_SCORE;
  const detection = effects.length
    ? Math.max(...effects.map((effect) => effect.detection))
    : NEUTRAL_SCORE;
  return causes.map((cause) => ({
    ...cause,
    recommendedActions: cause.recommendedActions ?? [],
    rpn: severity * cause.occurrence * detection,
  }));
}
