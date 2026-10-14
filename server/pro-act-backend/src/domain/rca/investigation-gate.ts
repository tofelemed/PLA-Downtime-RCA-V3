import {
  AnalysisMethod,
  ConsequenceClass,
  FiveWhyRules,
  InvestigationRules,
} from './rca-policy-rules';

export interface GateIssue {
  code: string;
  field: string;
  message: string;
}

export interface FiveWhyFacts {
  levels: ReadonlyArray<{ answer: string; justification: string | null }>;
  rootCause: string;
}

/** What the server knows about a case's investigation when it is to be accepted (CA1 step 1). */
export interface InvestigationFacts {
  consequenceClass: ConsequenceClass | null;
  rootCause: string | null;
  /** distinct people on the case: team lead plus members */
  teamSize: number;
  /** analysis methods with content */
  methods: readonly AnalysisMethod[];
  fiveWhy: FiveWhyFacts | null;
  fmea: { complete: boolean } | null;
  actionCount: number;
}

export interface InvestigationRulesInput {
  investigation: InvestigationRules;
  fiveWhy: FiveWhyRules;
}

export interface GateResult {
  blockers: GateIssue[];
  /** guidance that never blocks (CA6: five levels are a prompt, not a rule) */
  advice: GateIssue[];
}

const METHOD_WORDS: Readonly<Record<AnalysisMethod, string>> = {
  five_why: '5-Why',
  fishbone: 'fishbone',
  fmea: 'FMEA',
  fault_tree: 'fault tree',
  barrier: 'barrier analysis',
  change: 'change analysis',
  logic_tree: 'logic tree',
  timeline: 'timeline',
};

const written = (text: string | null | undefined): boolean =>
  Boolean(text?.trim());

/** CA6: a root cause that is only "operator error" (or another listed phrase) is not a system cause. */
export function unsupportedRootCause(
  text: string | null,
  rules: FiveWhyRules,
): boolean {
  const normalized = (text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.!\s]+$/u, '')
    .replace(/\s+/g, ' ');
  return rules.unsupportedRootCauses.includes(normalized);
}

function fiveWhyIssues(fiveWhy: FiveWhyFacts, rules: FiveWhyRules): GateResult {
  const answered = fiveWhy.levels.filter((level) => written(level.answer));
  const blockers: GateIssue[] = [];
  const advice: GateIssue[] = [];
  if (answered.length < rules.minLevels) {
    blockers.push({
      code: 'FIVE_WHY_TOO_SHALLOW',
      field: 'fiveWhy.whyLevels',
      message: `answer at least ${rules.minLevels} why level(s)`,
    });
  }
  if (
    rules.evidencePerLevel &&
    answered.some((level) => !written(level.justification))
  ) {
    blockers.push({
      code: 'FIVE_WHY_EVIDENCE_MISSING',
      field: 'fiveWhy.whyLevels',
      message: 'every answered why needs the evidence that supports it',
    });
  }
  if (
    !written(fiveWhy.rootCause) ||
    unsupportedRootCause(fiveWhy.rootCause, rules)
  ) {
    blockers.push({
      code: 'FIVE_WHY_ROOT_CAUSE',
      field: 'fiveWhy.rootCause',
      message:
        'the 5-Why ends in an actionable system-level cause (not only a person’s error)',
    });
  }
  if (answered.length > 0 && answered.length < rules.guidelineLevels) {
    advice.push({
      code: 'FIVE_WHY_BELOW_GUIDELINE',
      field: 'fiveWhy.whyLevels',
      message: `${answered.length} of the ${rules.guidelineLevels} levels of the guideline; fine when the evidence supports the chain`,
    });
  }
  return { blockers, advice };
}

function tierIssues(
  facts: InvestigationFacts,
  rules: InvestigationRules,
): GateIssue[] {
  if (!facts.consequenceClass) {
    return [
      {
        code: 'CONSEQUENCE_CLASS_MISSING',
        field: 'consequenceClass',
        message:
          'set the consequence class (minor, significant, major) to know the investigation tier',
      },
    ];
  }
  const tier = rules[facts.consequenceClass];
  const issues = tier.methodGroups
    .filter((group) => !group.some((method) => facts.methods.includes(method)))
    .map((group) => ({
      code: 'METHOD_MISSING',
      field: 'analyses',
      message: `a ${facts.consequenceClass} case needs one of: ${group.map((m) => METHOD_WORDS[m]).join(', ')}`,
    }));
  if (facts.teamSize < tier.minTeamMembers) {
    issues.push({
      code: 'TEAM_TOO_SMALL',
      field: 'teamMemberIds',
      message: `a ${facts.consequenceClass} case needs a team of at least ${tier.minTeamMembers}`,
    });
  }
  return issues;
}

/**
 * CA1 "investigation accepted" gate (Analysis → Monitoring), on the server: the consequence class and
 * its method tier (CA7), a written system-level root cause, the 5-Why content checks when a 5-Why was
 * used (CA6: evidence and causal sufficiency, not a level count), a complete FMEA when one was used
 * (CA5: missing ratings block approval), and at least one corrective action.
 */
export function investigationGate(
  facts: InvestigationFacts,
  rules: InvestigationRulesInput,
): GateResult {
  const blockers = tierIssues(facts, rules.investigation);
  if (
    !written(facts.rootCause) ||
    unsupportedRootCause(facts.rootCause, rules.fiveWhy)
  ) {
    blockers.push({
      code: 'ROOT_CAUSE_MISSING',
      field: 'rootCause',
      message:
        'write down the system-level root cause (not only a person’s error)',
    });
  }
  const fiveWhy = facts.fiveWhy
    ? fiveWhyIssues(facts.fiveWhy, rules.fiveWhy)
    : { blockers: [], advice: [] };
  blockers.push(...fiveWhy.blockers);
  if (facts.fmea && !facts.fmea.complete) {
    blockers.push({
      code: 'FMEA_INCOMPLETE',
      field: 'fmea',
      message:
        'rate severity, occurrence and detection of every FMEA cause before accepting the analysis',
    });
  }
  if (facts.actionCount === 0) {
    blockers.push({
      code: 'ACTIONS_MISSING',
      field: 'actions',
      message: 'plan at least one corrective action',
    });
  }
  return { blockers, advice: fiveWhy.advice };
}
