import { ApprovedImpactValue } from '../../rca-case/approved-impact';
import { ExportPresentation, PdfBlock, PdfColumn } from '../pdf/pdf-model';
import {
  NO_VALUE,
  plantDate,
  plantDateTime,
  plantMoney,
  plantNumber,
  PlantFormat,
} from '../pdf/plant-format';
import { RcaCaseExportContent } from './rca-case-content';
import {
  actionStatusWords,
  CAUSE_KIND_ORDER,
  causeKindWords,
  consequenceWords,
  metricWords,
  timelineChange,
  verdictWords,
  verificationWords,
} from './rca-case-words';

type Table = Extract<PdfBlock, { kind: 'table' }>;

/** A section of the case PDF: heading, short facts, then tables (each continues across pages). */
export interface CaseSection {
  heading: string;
  facts: Array<[string, string]>;
  tables: Table[];
  /** printed when the section has nothing to show */
  empty?: string;
}

const col = (
  label: string,
  width: number,
  align: PdfColumn['align'] = 'left',
): PdfColumn => ({ label, width, align });

const table = (columns: PdfColumn[], rows: string[][]): Table => ({
  kind: 'table',
  columns,
  rows,
});

const text = (value: string | null | undefined) =>
  value && value.trim() ? value : NO_VALUE;

/** Narrative fields as a two-column table, so long text wraps inside its row. */
const narrative = (rows: Array<[string, string | null]>): Table =>
  table(
    [col('Field', 22), col('Text', 78)],
    rows.map(([label, value]) => [label, text(value)]),
  );

export const formatOf = (p: ExportPresentation): PlantFormat => ({
  timezone: p.timezone,
  calendar: p.calendar,
  digits: p.digits,
});

export function definitionSection(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): CaseSection {
  const f = formatOf(p);
  const c = content.case;
  return {
    heading: 'Investigation',
    facts: [
      ['Unit', c.unitName ?? 'Tenant-wide'],
      ['Priority', text(c.priority)],
      ['Consequence class', consequenceWords(c.consequenceClass)],
      ['Opened', plantDateTime(c.createdAt, f)],
      ['Opened by', text(c.createdByName)],
      ['Target close', plantDate(c.targetCloseDate, f)],
      ['Closed', plantDateTime(c.actualCloseDate, f)],
    ],
    tables: [
      narrative([
        ['Description', c.description],
        ['Root cause (narrative)', c.rootCause],
      ]),
    ],
  };
}

export function teamSection(content: RcaCaseExportContent): CaseSection {
  const { leadName, memberNames } = content.team;
  return {
    heading: 'Team',
    facts: [
      ['Team lead', text(leadName)],
      ['Members', memberNames.length ? String(memberNames.length) : 'None'],
    ],
    tables: memberNames.length
      ? [
          table(
            [col('Team member', 100)],
            memberNames.map((name) => [name]),
          ),
        ]
      : [],
  };
}

export function timelineSection(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): CaseSection {
  const f = formatOf(p);
  const rows = content.timeline.map((entry) => [
    plantDateTime(entry.at, f),
    timelineChange(entry),
    text(entry.actorName),
    text(entry.reason),
  ]);
  return {
    heading: 'Status timeline',
    facts: [],
    tables: rows.length
      ? [
          table(
            [
              col('When', 18),
              col('Change', 30),
              col('By', 20),
              col('Reason', 32),
            ],
            rows,
          ),
        ]
      : [],
    empty: 'No status change recorded in the History.',
  };
}

export function causesSection(content: RcaCaseExportContent): CaseSection {
  const rank = (kind: string) => {
    const index = CAUSE_KIND_ORDER.indexOf(kind);
    return index < 0 ? CAUSE_KIND_ORDER.length : index;
  };
  const rows = [...content.causes]
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .map((c) => [
      causeKindWords(c.kind),
      text(c.code),
      c.name ?? 'Not coded',
      c.statement,
    ]);
  return {
    heading: 'Causes by kind',
    facts: [],
    tables: rows.length
      ? [
          table(
            [
              col('Kind', 12),
              col('Code', 12),
              col('Cause', 26),
              col('Statement', 50),
            ],
            rows,
          ),
        ]
      : [],
    empty: 'No typed cause recorded.',
  };
}

export function analysesSection(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): CaseSection {
  const f = formatOf(p);
  const rows = content.analyses.map((a) => [
    a.method,
    a.recorded ? 'Recorded' : 'Not recorded',
    plantDateTime(a.updatedAt, f),
    a.summary,
  ]);
  return {
    heading: 'Analyses',
    facts: [],
    tables: [
      table(
        [
          col('Method', 18),
          col('Status', 14),
          col('Last saved', 18),
          col('Summary', 50),
        ],
        rows,
      ),
    ],
  };
}

const SELF_DONE = 'Self-decided (SuperAdmin)';

export function actionsSection(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): CaseSection {
  const f = formatOf(p);
  const rows = content.actions.map((a) => [
    a.title,
    text(a.ownerName),
    plantDate(a.dueDate, f),
    actionStatusWords(a.status),
    a.selfDecided
      ? `${plantDate(a.completedAt, f)} · ${SELF_DONE}`
      : plantDate(a.completedAt, f),
    verificationWords(a.verificationStatus),
    a.verdict ? verdictWords(a.verdict) : NO_VALUE,
  ]);
  const columns = [
    col('Action', 24),
    col('Owner', 14),
    col('Due', 10),
    col('Status', 10),
    col('Completed', 14),
    col('Verification', 14),
    col('Verdict', 14),
  ];
  return {
    heading: 'Actions',
    facts: [],
    tables: rows.length ? [table(columns, rows)] : [],
    empty: 'No action recorded.',
  };
}

/** The approved loss in the display currency as the ledger reported it (never converted, never estimated). */
export function approvedText(
  values: readonly ApprovedImpactValue[],
  p: ExportPresentation,
): string {
  const value = values.find((v) => v.currency === p.currency);
  if (!value) return `Not reported in ${p.currency}`;
  if (value.amount === null) return 'Not valued';
  const amount = plantMoney(value.amount, value.currency, p.digits);
  const partly = value.status === 'mixed' ? ' (partly valued)' : '';
  const fx = value.fxProvisional ? ' (provisional exchange rate)' : '';
  return `${amount}${partly}${fx}`;
}

/** The owners' claims: the display currency, then each other currency as claimed (not converted). */
export function claimedText(
  claimed: RcaCaseExportContent['outcome']['claimed'],
  p: ExportPresentation,
): string {
  if (claimed.length === 0) return 'None claimed';
  const shown = claimed.find((c) => c.currency === p.currency);
  const others = claimed
    .filter((c) => c.currency !== p.currency)
    .map(
      (c) => `${plantMoney(c.amount, c.currency, p.digits)} (not converted)`,
    );
  const first = shown
    ? plantMoney(shown.amount, shown.currency, p.digits)
    : `None in ${p.currency}`;
  return [first, ...others].join('; ');
}

export function outcomeSection(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): CaseSection {
  const { approved, claimed, realized, note } = content.outcome;
  const number = (value: string) => plantNumber(value, 2, p.digits);
  const rows = realized.map((r) => [
    r.title,
    metricWords(r.metric),
    number(r.expected),
    number(r.observed),
    number(r.difference),
    r.verdict ? verdictWords(r.verdict) : NO_VALUE,
  ]);
  const columns = [
    col('Action', 30),
    col('Metric', 18),
    col('Expected', 12, 'right'),
    col('Observed', 12, 'right'),
    col('Difference', 12, 'right'),
    col('Verdict', 16),
  ];
  return {
    heading: 'Outcome (three separate figures)',
    facts: [
      ['Approved historical loss', approvedText(approved.values, p)],
      ['Approved loss lines', plantNumber(String(approved.lines), 0, p.digits)],
      ['Claimed avoided loss', claimedText(claimed, p)],
    ],
    tables: [
      narrative([
        ['Approved loss basis', approved.basis],
        ['Note', note],
      ]),
      ...(rows.length ? [table(columns, rows)] : []),
    ],
  };
}

export function closureSection(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): CaseSection {
  const f = formatOf(p);
  const c = content.closure;
  const self: Array<[string, string]> = c.selfDecided
    ? [['Approval', 'Self-approved (SuperAdmin)']]
    : [];
  return {
    heading: 'Closure approval',
    facts: [
      ['Closure requested by', text(c.requestedByName)],
      ['Closure requested', plantDateTime(c.requestedAt, f)],
      ['Closure approved by', text(c.approvedByName)],
      ['Closure approved', plantDateTime(c.approvedAt, f)],
      ...self,
      [
        'Effectiveness',
        c.effectivenessVerdict
          ? verdictWords(c.effectivenessVerdict)
          : NO_VALUE,
      ],
    ],
    tables: [
      narrative([
        ['Residual risk', c.residualRisk],
        ['Reviewer note', c.note],
      ]),
    ],
  };
}
