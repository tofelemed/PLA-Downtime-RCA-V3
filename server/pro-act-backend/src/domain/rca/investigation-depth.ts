import type { GateIssue } from './investigation-gate';
import { AnalysisMethod, ConsequenceClass } from './rca-policy-rules';

/** Version of the matrix below, shown with the readiness so a later plant matrix is told apart. */
export const INVESTIGATION_DEPTH_VERSION = 'd-t4-v1';

/** What an investigation of one consequence class needs before it is accepted (Analysis → Monitoring). */
export interface DepthRequirement {
  /** each group needs at least one of its methods with content */
  methodGroups: AnalysisMethod[][];
  /** a written team charter (scope, objective, members' roles) */
  teamCharter: boolean;
  /** at least one root cause linked to the cause catalogue */
  codedCauses: boolean;
  /** closure approved by someone independent of the investigation (enforced for every case by CA1) */
  independentClosure: boolean;
}

/** The minor / moderate methods, or a deeper one (logic tree, fault tree): rigour above the tier always counts. */
const CAUSAL_CHAIN: AnalysisMethod[] = [
  'five_why',
  'fishbone',
  'logic_tree',
  'fault_tree',
];

/**
 * D-T4 (owner, 19 Oct 2026: "standard and common practice", API RP 585 / CCPS-style tiers): the depth of
 * an investigation by its consequence class. `significant` is the moderate tier of the matrix.
 * - minor: 5-Why;
 * - significant (moderate): 5-Why or fishbone, and a team charter;
 * - major: logic tree or fault tree, a team charter and coded causes;
 * - critical: logic tree, plus FMEA or fault tree, a team charter, coded causes and independent closure.
 * As in those standards the tiers are minimum rigour: a deeper method meets a lower tier (a logic tree or
 * fault tree also satisfies the 5-Why of a minor case). It applies on top of the plant's `rca_policy` investigation tiers (CA7 method groups and team size).
 * The matrix is a code constant until the plant's own matrix is confirmed; a plant override would become a
 * section of `rca_policy`, read in place of this table.
 */
export const INVESTIGATION_DEPTH: Readonly<
  Record<ConsequenceClass, DepthRequirement>
> = {
  minor: {
    methodGroups: [CAUSAL_CHAIN],
    teamCharter: false,
    codedCauses: false,
    independentClosure: true,
  },
  significant: {
    methodGroups: [CAUSAL_CHAIN],
    teamCharter: true,
    codedCauses: false,
    independentClosure: true,
  },
  major: {
    methodGroups: [['logic_tree', 'fault_tree']],
    teamCharter: true,
    codedCauses: true,
    independentClosure: true,
  },
  critical: {
    methodGroups: [['logic_tree'], ['fmea', 'fault_tree']],
    teamCharter: true,
    codedCauses: true,
    independentClosure: true,
  },
};

/** The facts of a case the depth requirements read (methods with content as the investigation gate counts them). */
export interface DepthFacts {
  consequenceClass: ConsequenceClass | null;
  methods: readonly AnalysisMethod[];
  teamCharter: string | null;
  /** root causes of the case with a cause code (item 7 count) */
  codedRootCauses: number;
}

export const METHOD_WORDS: Readonly<Record<AnalysisMethod, string>> = {
  five_why: '5-Why',
  fishbone: 'fishbone',
  fmea: 'FMEA',
  fault_tree: 'fault tree',
  barrier: 'barrier analysis',
  change: 'change analysis',
  logic_tree: 'logic tree',
  timeline: 'timeline',
};

const methodList = (group: readonly AnalysisMethod[]): string =>
  group.map((method) => METHOD_WORDS[method]).join(' or ');

/** The D-T4 requirement of a class; null for an unclassified case (the class is asked for first). */
export function depthRequirementOf(
  consequenceClass: ConsequenceClass | null,
): DepthRequirement | null {
  return consequenceClass ? INVESTIGATION_DEPTH[consequenceClass] : null;
}

/**
 * The missing D-T4 requirements of a classified case, each with its code: `METHOD_REQUIRED` (with the
 * accepted `methods`), `TEAM_CHARTER_REQUIRED`, `CODED_CAUSE_REQUIRED`. An unclassified case gets none.
 */
export function depthIssues(facts: DepthFacts): GateIssue[] {
  const requirement = depthRequirementOf(facts.consequenceClass);
  if (!requirement) return [];
  const label = facts.consequenceClass ?? '';
  const issues: GateIssue[] = requirement.methodGroups
    .filter((group) => !group.some((method) => facts.methods.includes(method)))
    .map((group) => ({
      code: 'METHOD_REQUIRED',
      field: 'analyses',
      message: `a ${label} investigation needs a ${methodList(group)} with content`,
      methods: [...group],
    }));
  if (requirement.teamCharter && !facts.teamCharter?.trim()) {
    issues.push({
      code: 'TEAM_CHARTER_REQUIRED',
      field: 'teamCharter',
      message: `a ${label} investigation needs a written team charter`,
    });
  }
  if (requirement.codedCauses && facts.codedRootCauses === 0) {
    issues.push({
      code: 'CODED_CAUSE_REQUIRED',
      field: 'causes',
      message: `a ${label} investigation needs at least one root cause with a cause code`,
    });
  }
  return issues;
}

/**
 * True when a plant method group (CA7) is already covered by a D-T4 group of the class: every method of
 * the D-T4 group is in it, so meeting the D-T4 requirement meets it too and only the D-T4 issue is shown.
 */
export function coveredByDepth(
  consequenceClass: ConsequenceClass,
  group: readonly AnalysisMethod[],
): boolean {
  return INVESTIGATION_DEPTH[consequenceClass].methodGroups.some((depth) =>
    depth.every((method) => group.includes(method)),
  );
}
