import { RCA_CONSEQUENCE_CLASSES, type RcaConsequenceClass } from '@/api/v2/types/rca-workflow';
import type { RcaPolicyRules } from './rca-policy-api';

export const CONSEQUENCE_CLASSES = RCA_CONSEQUENCE_CLASSES;
export type ConsequenceClass = RcaConsequenceClass;

/**
 * D-T4: tiers a version may leave out (versions written before `critical` existed); empty fields omit the
 * tier and the server's default applies.
 */
export const OPTIONAL_TIERS: readonly ConsequenceClass[] = ['critical'];
export const isOptionalTier = (cls: ConsequenceClass) => OPTIONAL_TIERS.includes(cls);

/** Analysis method keys the server accepts in method groups (backend `ANALYSIS_METHODS`). */
export const ANALYSIS_METHOD_KEYS = ['timeline', 'five_why', 'fishbone', 'logic_tree', 'fault_tree', 'fmea', 'barrier', 'change'] as const;

/** Analysis methods in words (QA L9: never `five_why` / `logic_tree` on screen). */
export const ANALYSIS_METHOD_LABELS: Readonly<Record<string, string>> = {
  timeline: 'Timeline',
  five_why: '5-Why',
  fishbone: 'Fishbone',
  logic_tree: 'Logic tree',
  fault_tree: 'Fault tree',
  fmea: 'FMEA',
  barrier: 'Barrier analysis',
  change: 'Change analysis',
};

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
  /** per class; '' on an optional tier the version does not set */
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
    minTeamMembers: perClass((cls) => teamText(investigation[cls]?.minTeamMembers, cls)),
  };
}

const teamText = (members: number | undefined, cls: ConsequenceClass) => {
  if (members !== undefined) return String(members);
  return isOptionalTier(cls) ? '' : '0';
};

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

/** Inline error of a typed percent (QA L9: an out-of-range value says why Save is disabled), null when valid. */
export function percentError(value: string, allowZero: boolean): string | null {
  if (percentOf(value, allowZero) !== null) return null;
  return allowZero ? 'Enter a percentage from 0 to 100.' : 'Enter a percentage above 0, up to 100.';
}

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

/** An optional tier left empty (no methods, no team size) is not sent. */
const tierUnset = (draft: RcaRulesDraft, cls: ConsequenceClass) =>
  isOptionalTier(cls) && draft.methodGroups[cls].trim() === '' && draft.minTeamMembers[cls].trim() === '';

function investigationOf(draft: RcaRulesDraft): RcaPolicyRules['investigation'] | null {
  const investigation: RcaPolicyRules['investigation'] = {};
  for (const cls of CONSEQUENCE_CLASSES) {
    if (tierUnset(draft, cls)) continue;
    const minTeamMembers = whole(draft.minTeamMembers[cls], 0);
    if (minTeamMembers === null) return null;
    investigation[cls] = { methodGroups: groupsOf(draft.methodGroups[cls]), minTeamMembers };
  }
  return investigation;
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
