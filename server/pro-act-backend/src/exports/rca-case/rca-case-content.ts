import { ApprovedImpactValue } from '../../rca-case/approved-impact';
import { RcaAnalysesV2View } from '../../rca-case/rca-analysis.view';

/**
 * One RCA case as an `rca_case` export pins it when it is requested (item 2.5): names resolved, times as
 * ISO instants, decimals as strings. The PDF is drawn from this only, so re-rendering the job reproduces
 * its bytes even after the case changes.
 */
export interface RcaCaseExportContent {
  case: {
    id: string;
    title: string;
    status: string | null;
    priority: string | null;
    unitName: string | null;
    description: string | null;
    consequenceClass: string | null;
    createdAt: string;
    createdByName: string | null;
    targetCloseDate: string | null;
    actualCloseDate: string | null;
    rootCause: string | null;
  };
  team: { leadName: string | null; memberNames: string[] };
  /** status changes of the case from its History (`audit_log`), oldest first */
  timeline: RcaCaseTimelineEntry[];
  causes: Array<{
    kind: string;
    code: string | null;
    name: string | null;
    statement: string;
  }>;
  analyses: RcaCaseAnalysisSummary[];
  actions: RcaCaseExportAction[];
  outcome: {
    approved: {
      lines: number;
      basis: string;
      values: ApprovedImpactValue[];
    };
    claimed: Array<{ currency: string; amount: string; actions: number }>;
    realized: Array<{
      title: string;
      metric: string;
      expected: string;
      observed: string;
      difference: string;
      verdict: string | null;
    }>;
    note: string;
  };
  closure: {
    residualRisk: string | null;
    requestedByName: string | null;
    requestedAt: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
    note: string | null;
    effectivenessVerdict: string | null;
    /** item 1.3: approved by someone not independent of the investigation (SuperAdmin) */
    selfDecided: boolean;
  };
}

export interface RcaCaseTimelineEntry {
  at: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  reason: string | null;
}

/** One analysis method of the case: recorded or not, and what it holds. */
export interface RcaCaseAnalysisSummary {
  method: string;
  recorded: boolean;
  updatedAt: string | null;
  summary: string;
}

export interface RcaCaseExportAction {
  title: string;
  ownerName: string | null;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
  verificationStatus: string;
  verdict: string | null;
  /** item 1.3: marked done by its own owner (SuperAdmin) */
  selfDecided: boolean;
}

type Analyses = RcaAnalysesV2View;

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Method name → what its record holds (null = not recorded). */
const SUMMARIES: ReadonlyArray<
  [string, (a: Analyses) => { updatedAt: string; summary: string } | null]
> = [
  [
    '5-Why',
    ({ fiveWhy: r }) =>
      r && {
        updatedAt: r.updatedAt,
        summary: `${count(r.whyLevels.length, 'why level')}; root cause: ${r.rootCause || 'not stated'}`,
      },
  ],
  [
    'Fishbone',
    ({ fishbone: r }) =>
      r && {
        updatedAt: r.updatedAt,
        summary: `${count(r.categories.length, 'category')}, ${count(
          r.categories.reduce((n, c) => n + c.causes.length, 0),
          'cause',
        )}`,
      },
  ],
  [
    'FMEA',
    ({ fmea: r }) =>
      r && {
        updatedAt: r.updatedAt,
        summary: `${count(r.causes.length, 'cause')}; ${r.complete ? 'every rating given' : 'ratings incomplete'}`,
      },
  ],
  [
    'Fault tree',
    ({ faultTree: r }) =>
      r && {
        updatedAt: r.updatedAt,
        summary: `${count(r.nodes.length, 'node')}; top event: ${r.topEvent || 'not stated'}`,
      },
  ],
  [
    'Barrier analysis',
    ({ barrier: r }) =>
      r && {
        updatedAt: r.updatedAt,
        summary: count(r.barriers.length, 'barrier'),
      },
  ],
  [
    'Change analysis',
    ({ change: r }) =>
      r && {
        updatedAt: r.updatedAt,
        summary: count(r.changes.length, 'change'),
      },
  ],
];

/** Which analysis methods the case recorded, in a fixed order (every method listed). */
export function analysesSummary(
  analyses: RcaAnalysesV2View,
): RcaCaseAnalysisSummary[] {
  return SUMMARIES.map(([method, of]) => {
    const found = of(analyses);
    return found
      ? { method, recorded: true, ...found }
      : { method, recorded: false, updatedAt: null, summary: 'Not recorded' };
  });
}
