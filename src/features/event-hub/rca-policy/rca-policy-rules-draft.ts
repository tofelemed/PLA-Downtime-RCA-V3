import type { RcaPolicyRules } from './rca-policy-api';

export const CONSEQUENCE_CLASSES = ['minor', 'significant', 'major'] as const;
export type ConsequenceClass = (typeof CONSEQUENCE_CLASSES)[number];

/** Analysis method keys the server accepts in method groups (backend `ANALYSIS_METHODS`). */
export const ANALYSIS_METHOD_KEYS = ['timeline', 'five_why', 'fishbone', 'logic_tree', 'fault_tree', 'fmea', 'barrier', 'change'] as const;

/** The workflow rule sections as typed (SME CA2–CA7); the server parser re-validates every value. */
export interface RcaRulesDraft {
  baselineLookbackDays: string;
  minExposureHours: string;
  /** percent, e.g. 50 */
  requiredReductionPercent: string;
  reviewDays: string;
  zeroRepeatClasses: ConsequenceClass[];
  /** percent, e.g. 95: state-data coverage of the window after the action a verdict needs */
  minimumCoveragePercent: string;
  fmeaMethod: 'rpn' | 'action_priority';
  rpnThreshold: string;
  severityReview: string;
  guidelineLevels: string;
  minLevels: string;
  evidencePerLevel: boolean;
  /** one refused root-cause phrase per line */
  unsupportedRootCauses: string;
  /** per class: one method group per line, methods separated by commas */
  methodGroups: Record<ConsequenceClass, string>;
  minTeamMembers: Record<ConsequenceClass, string>;
}

/** Server default of `effectiveness.minimumCoverage` (owner, 18 Oct 2026), also for versions without it. */
export const DEFAULT_MINIMUM_COVERAGE = 0.95;

const percentText = (share: number) => String(Math.round(share * 1000) / 10);

const perClass = <T>(of: (cls: ConsequenceClass) => T) =>
  Object.fromEntries(CONSEQUENCE_CLASSES.map((cls) => [cls, of(cls)])) as Record<ConsequenceClass, T>;

const asClass = (value: string): ConsequenceClass | null => CONSEQUENCE_CLASSES.find((cls) => cls === value) ?? null;

export function rulesDraftOf(rules: RcaPolicyRules): RcaRulesDraft {
  const { effectiveness, fmea, fiveWhy, investigation } = rules;
  return {
    baselineLookbackDays: String(effectiveness.baselineLookbackDays),
    minExposureHours: String(effectiveness.minExposureHours),
    requiredReductionPercent: percentText(effectiveness.requiredReduction),
    reviewDays: String(effectiveness.reviewDays),
    zeroRepeatClasses: effectiveness.zeroRepeatClasses.flatMap((value) => asClass(value) ?? []),
    minimumCoveragePercent: percentText(effectiveness.minimumCoverage ?? DEFAULT_MINIMUM_COVERAGE),
    fmeaMethod: fmea.method,
    rpnThreshold: String(fmea.rpnThreshold),
    severityReview: String(fmea.severityReview),
    guidelineLevels: String(fiveWhy.guidelineLevels),
    minLevels: String(fiveWhy.minLevels),
    evidencePerLevel: fiveWhy.evidencePerLevel,
    unsupportedRootCauses: fiveWhy.unsupportedRootCauses.join('\n'),
    methodGroups: perClass((cls) => (investigation[cls]?.methodGroups ?? []).map((group) => group.join(', ')).join('\n')),
    minTeamMembers: perClass((cls) => String(investigation[cls]?.minTeamMembers ?? 0)),
  };
}

const whole = (value: string, min: number, max = Number.MAX_SAFE_INTEGER) => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed >= min && parsed <= max ? parsed : null;
};

const groupsOf = (text: string): string[][] =>
  text
    .split('\n')
    .map((line) => line.split(',').map((method) => method.trim()).filter(Boolean))
    .filter((group) => group.length > 0);

/** A typed percent in [min, 100] (decimals allowed), else null. */
const percentOf = (value: string, allowZero: boolean): number | null => {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return (allowZero ? parsed >= 0 : parsed > 0) && parsed <= 100 ? parsed : null;
};

function effectivenessOf(draft: RcaRulesDraft): RcaPolicyRules['effectiveness'] | null {
  const baselineLookbackDays = whole(draft.baselineLookbackDays, 1);
  const minExposureHours = whole(draft.minExposureHours, 1);
  const reviewDays = whole(draft.reviewDays, 1);
  const reduction = percentOf(draft.requiredReductionPercent, false);
  const coverage = percentOf(draft.minimumCoveragePercent, true);
  if (baselineLookbackDays === null || minExposureHours === null || reviewDays === null || reduction === null || coverage === null) return null;
  return {
    baselineLookbackDays,
    minExposureHours,
    requiredReduction: reduction / 100,
    reviewDays,
    zeroRepeatClasses: draft.zeroRepeatClasses,
    minimumCoverage: Math.round(coverage * 10) / 1000,
  };
}

function investigationOf(draft: RcaRulesDraft): RcaPolicyRules['investigation'] | null {
  const tiers = perClass((cls) => ({ methodGroups: groupsOf(draft.methodGroups[cls]), minTeamMembers: whole(draft.minTeamMembers[cls], 0) }));
  if (CONSEQUENCE_CLASSES.some((cls) => tiers[cls].minTeamMembers === null)) return null;
  return perClass((cls) => ({ methodGroups: tiers[cls].methodGroups, minTeamMembers: tiers[cls].minTeamMembers ?? 0 }));
}

/**
 * The rule sections of the request, or null while a value is missing or out of range. The FMEA priority
 * rules (a table) are kept from the version in force.
 */
export function rulesInputOf(draft: RcaRulesDraft, current: RcaPolicyRules): RcaPolicyRules | null {
  const effectiveness = effectivenessOf(draft);
  const investigation = investigationOf(draft);
  const rpnThreshold = whole(draft.rpnThreshold, 1);
  const severityReview = whole(draft.severityReview, 1, 10);
  const guidelineLevels = whole(draft.guidelineLevels, 1);
  const minLevels = whole(draft.minLevels, 1);
  if (!effectiveness || !investigation || rpnThreshold === null || severityReview === null || guidelineLevels === null || minLevels === null) return null;
  return {
    effectiveness,
    fmea: { method: draft.fmeaMethod, rpnThreshold, severityReview, priorityRules: current.fmea.priorityRules },
    fiveWhy: {
      guidelineLevels,
      minLevels,
      evidencePerLevel: draft.evidencePerLevel,
      unsupportedRootCauses: draft.unsupportedRootCauses.split('\n').map((line) => line.trim()).filter(Boolean),
    },
    investigation,
  };
}
