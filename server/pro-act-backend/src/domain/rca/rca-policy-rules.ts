import {
  fraction,
  integer,
  listOf,
  oneOf,
  Raw,
  record,
  RcaPolicyError,
  share,
  stringList,
} from './policy-values';

/** CA7 consequence classes of a case (actual or potential), tier 1 / 2 / 3. */
export const CONSEQUENCE_CLASSES = ['minor', 'significant', 'major'] as const;
export type ConsequenceClass = (typeof CONSEQUENCE_CLASSES)[number];

/** Analysis methods a case can show (tool records, the case's logic tree and timeline). */
export const ANALYSIS_METHODS = [
  'five_why',
  'fishbone',
  'fmea',
  'fault_tree',
  'barrier',
  'change',
  'logic_tree',
  'timeline',
] as const;
export type AnalysisMethod = (typeof ANALYSIS_METHODS)[number];

export const FMEA_METHODS = ['rpn', 'action_priority'] as const;
export const ACTION_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

/** CA2 / CA3: how an action's effectiveness is judged (criteria frozen into the action when planned). */
export interface EffectivenessRules {
  /** baseline lookback before the verification window (CA3: 90 d for frequent faults) */
  baselineLookbackDays: number;
  /** minimum run hours in the verification window; less = insufficient evidence */
  minExposureHours: number;
  /** required relative reduction of the same-mode rate (0.5 = halved) */
  requiredReduction: number;
  /** proposed review checkpoint after the action (CA2: 90 calendar days) */
  reviewDays: number;
  /** consequence classes where any repeat in the window is not effective (CA2 high consequence) */
  zeroRepeatClasses: ConsequenceClass[];
  /**
   * Owner, 18 Oct 2026: state-data coverage (known / window, 0–1) the window after the action needs for a
   * verdict; below it the action is insufficient evidence. A version written before the field = 0.95.
   */
  minimumCoverage: number;
}

/** Owner default (18 Oct 2026) of `effectiveness.minimumCoverage`, also for versions without the field. */
export const DEFAULT_MINIMUM_COVERAGE = 0.95;

/** One rule of the configurable severity / occurrence / detection → priority set (CA5). */
export interface PriorityRule {
  priority: ActionPriority;
  severityMin: number;
  occurrenceMin: number;
  detectionMin: number;
}

export interface FmeaRules {
  method: (typeof FMEA_METHODS)[number];
  /** RPN at or above this needs action (kept for RPN users; never the only gate) */
  rpnThreshold: number;
  /** severity at or above this needs review whatever the RPN (CA5) */
  severityReview: number;
  /** first matching rule wins; no match = low */
  priorityRules: PriorityRule[];
}

/** CA6: five levels are guidance; evidence and a system-level cause are the rule. */
export interface FiveWhyRules {
  guidelineLevels: number;
  minLevels: number;
  evidencePerLevel: boolean;
  /** root causes refused when they stand alone (lower-case, e.g. "operator error") */
  unsupportedRootCauses: string[];
}

/** CA7: per class, groups of methods — each group needs at least one of its methods — and team size. */
export interface InvestigationTier {
  methodGroups: AnalysisMethod[][];
  minTeamMembers: number;
}

export type InvestigationRules = Record<ConsequenceClass, InvestigationTier>;

export interface RcaRules {
  effectiveness: EffectivenessRules;
  fmea: FmeaRules;
  fiveWhy: FiveWhyRules;
  investigation: InvestigationRules;
}

/**
 * Proposed defaults (SME answers CA2–CA7, 14 Oct 2026; MNT / OPS / HSE confirm): pilot settings, not
 * universal standards. The priority rules are an illustrative severity-led set of this product, not the
 * AIAG-VDA table; a plant that adopts AP enters its approved table here.
 */
export const RCA_RULES_DEFAULT: RcaRules = {
  effectiveness: {
    baselineLookbackDays: 90,
    minExposureHours: 720,
    requiredReduction: 0.5,
    reviewDays: 90,
    zeroRepeatClasses: ['major'],
    minimumCoverage: DEFAULT_MINIMUM_COVERAGE,
  },
  fmea: {
    method: 'rpn',
    rpnThreshold: 100,
    severityReview: 9,
    priorityRules: [
      { priority: 'high', severityMin: 9, occurrenceMin: 4, detectionMin: 1 },
      { priority: 'high', severityMin: 9, occurrenceMin: 1, detectionMin: 7 },
      { priority: 'high', severityMin: 7, occurrenceMin: 7, detectionMin: 1 },
      { priority: 'high', severityMin: 7, occurrenceMin: 4, detectionMin: 7 },
      { priority: 'medium', severityMin: 9, occurrenceMin: 1, detectionMin: 1 },
      { priority: 'medium', severityMin: 7, occurrenceMin: 4, detectionMin: 1 },
      { priority: 'medium', severityMin: 7, occurrenceMin: 1, detectionMin: 7 },
      { priority: 'medium', severityMin: 4, occurrenceMin: 7, detectionMin: 1 },
      { priority: 'medium', severityMin: 4, occurrenceMin: 4, detectionMin: 7 },
    ],
  },
  fiveWhy: {
    guidelineLevels: 5,
    minLevels: 1,
    evidencePerLevel: true,
    unsupportedRootCauses: [
      'operator error',
      'human error',
      'operator mistake',
    ],
  },
  investigation: {
    minor: {
      methodGroups: [
        ['five_why', 'fishbone', 'logic_tree', 'fault_tree', 'change'],
      ],
      minTeamMembers: 0,
    },
    significant: {
      methodGroups: [
        ['timeline'],
        ['fishbone', 'logic_tree'],
        ['five_why', 'fault_tree'],
      ],
      minTeamMembers: 2,
    },
    major: {
      methodGroups: [
        ['timeline'],
        ['barrier', 'fault_tree', 'fmea'],
        ['five_why', 'fishbone', 'logic_tree'],
      ],
      minTeamMembers: 3,
    },
  },
};

const score = (value: unknown, field: string): number => {
  const parsed = integer(value, field, 1);
  if (parsed > 10) throw new RcaPolicyError(`${field} must be at most 10`);
  return parsed;
};

export function parseEffectiveness(raw: Raw): EffectivenessRules {
  return {
    baselineLookbackDays: integer(
      raw.baselineLookbackDays,
      'baselineLookbackDays',
      1,
    ),
    minExposureHours: integer(raw.minExposureHours, 'minExposureHours', 1),
    requiredReduction: share(raw.requiredReduction, 'requiredReduction'),
    reviewDays: integer(raw.reviewDays, 'reviewDays', 1),
    zeroRepeatClasses: listOf(
      raw.zeroRepeatClasses,
      CONSEQUENCE_CLASSES,
      'zeroRepeatClasses',
    ),
    // a version written before the owner decision of 18 Oct 2026 carries no minimum: the default applies
    minimumCoverage:
      raw.minimumCoverage === undefined
        ? DEFAULT_MINIMUM_COVERAGE
        : fraction(raw.minimumCoverage, 'minimumCoverage'),
  };
}

function parsePriorityRule(value: unknown, index: number): PriorityRule {
  const raw = record(value, `priorityRules[${index}]`);
  return {
    priority: oneOf(raw.priority, ACTION_PRIORITIES, 'priority'),
    severityMin: score(raw.severityMin, 'severityMin'),
    occurrenceMin: score(raw.occurrenceMin, 'occurrenceMin'),
    detectionMin: score(raw.detectionMin, 'detectionMin'),
  };
}

export function parseFmea(raw: Raw): FmeaRules {
  if (!Array.isArray(raw.priorityRules)) {
    throw new RcaPolicyError('priorityRules must be a list');
  }
  return {
    method: oneOf(raw.method, FMEA_METHODS, 'method'),
    rpnThreshold: integer(raw.rpnThreshold, 'rpnThreshold', 1),
    severityReview: score(raw.severityReview, 'severityReview'),
    priorityRules: raw.priorityRules.map(parsePriorityRule),
  };
}

export function parseFiveWhy(raw: Raw): FiveWhyRules {
  if (typeof raw.evidencePerLevel !== 'boolean') {
    throw new RcaPolicyError('evidencePerLevel must be a boolean');
  }
  return {
    guidelineLevels: integer(raw.guidelineLevels, 'guidelineLevels', 1),
    minLevels: integer(raw.minLevels, 'minLevels', 1),
    evidencePerLevel: raw.evidencePerLevel,
    unsupportedRootCauses: stringList(
      raw.unsupportedRootCauses,
      'unsupportedRootCauses',
    ).map((phrase) => phrase.trim().toLowerCase()),
  };
}

function parseTier(value: unknown, field: string): InvestigationTier {
  const raw = record(value, field);
  if (!Array.isArray(raw.methodGroups)) {
    throw new RcaPolicyError(`${field}.methodGroups must be a list`);
  }
  return {
    methodGroups: raw.methodGroups.map((group) =>
      listOf(group, ANALYSIS_METHODS, `${field}.methodGroups`),
    ),
    minTeamMembers: integer(raw.minTeamMembers, `${field}.minTeamMembers`),
  };
}

export function parseInvestigation(raw: Raw): InvestigationRules {
  return {
    minor: parseTier(raw.minor, 'minor'),
    significant: parseTier(raw.significant, 'significant'),
    major: parseTier(raw.major, 'major'),
  };
}
