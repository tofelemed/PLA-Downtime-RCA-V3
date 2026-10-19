import { GLOSSARY } from '@/features/ux-kit/labels';

/** One curated figure of a change proposal: its label, unit and the server's values on each side. */
export interface ComparisonRow {
  key: string;
  label: string;
  unit: string | null;
  before: string | null;
  after: string | null;
}

/** A titled group of figures: the reconciliation, or one calculated ledger — never mixed. */
export interface ComparisonGroup {
  key: string;
  title: string;
  note: string;
  rows: ComparisonRow[];
}

type Row = Record<string, unknown>;
const isRecord = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const listOf = (snapshot: Row | null, key: string): Row[] => {
  const value = snapshot?.[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
};
const text = (row: Row | undefined, key: string): string | null => {
  const value = row?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
};

/** QA audit P-1: the reconciled figures an approver signs, in the order of the reconciliation equation. */
const RECONCILIATION_FIGURES: ReadonlyArray<[string, string]> = [
  ['target', 'Target'],
  ['actual', 'Actual (good)'],
  ['gap', 'Gap'],
  ['attributed', 'Attributed losses'],
  ['toleranceAdjustment', 'Tolerance adjustment'],
  ['residual', GLOSSARY.residual],
];

/** The calculated losses of one ledger (before review decisions); the capacity ledger starts at capacity. */
const LEDGER_FIGURES: Readonly<Record<string, ReadonlyArray<[string, string]>>> = {
  plan: [
    ['target', 'Target'],
    ['actual', 'Actual (good)'],
    ['availability', 'Availability loss'],
    ['performance', 'Performance loss'],
    ['quality', 'Quality loss'],
    ['residual', GLOSSARY.residual],
  ],
  capacity: [
    ['capacity', 'Capacity'],
    ['actual', 'Actual (good)'],
    ['availability', 'Availability loss'],
    ['performance', 'Performance loss'],
    ['quality', 'Quality loss'],
    ['residual', GLOSSARY.residual],
  ],
};

const LEDGER_TITLES: Readonly<Record<string, { title: string; note: string }>> = {
  plan: { title: 'Plan ledger (calculated)', note: 'Losses as calculated, before the review decisions.' },
  capacity: { title: 'Capacity ledger (calculated)', note: 'Against capacity at the sustained rate, before the review decisions.' },
};

/** Slices of one side matched by id; a period with several slices names them by position. */
function sliceKeys(before: Row[], after: Row[]): string[] {
  const ids = [...before, ...after].map((row) => text(row, 'sliceId') ?? '');
  return [...new Set(ids)];
}

function rowsOf(figures: ReadonlyArray<[string, string]>, before: Row[], after: Row[], prefix: string): ComparisonRow[] {
  const slices = sliceKeys(before, after);
  return slices.flatMap((sliceId, index) => {
    const b = before.find((row) => (text(row, 'sliceId') ?? '') === sliceId);
    const a = after.find((row) => (text(row, 'sliceId') ?? '') === sliceId);
    const unit = text(a, 'uom') ?? text(b, 'uom');
    const suffix = slices.length > 1 ? ` · slice ${index + 1}` : '';
    return figures.map(([key, label]) => ({ key: `${prefix}:${sliceId}:${key}`, label: `${label}${suffix}`, unit, before: text(b, key), after: text(a, key) }));
  });
}

const ledgerRows = (snapshot: Row | null, ledger: string) => listOf(snapshot, 'ledgers').filter((row) => row.ledger === ledger);

/**
 * QA audit 2026-10-19 (P-1): a change proposal's before (approved) and after (new inputs with the approved
 * decisions) as curated, labelled figures with units — the reconciliation (with {@link GLOSSARY} terms) kept
 * apart from each calculated ledger. Ids, hashes, flags and internal fields (unadjusted residual,
 * exclusion, over-accounted…) are never shown; the server's values are shown as they are, never summed.
 */
export function proposalComparison(before: Row | null, after: Row | null): ComparisonGroup[] {
  const groups: ComparisonGroup[] = [
    {
      key: 'reconciliation',
      title: 'Reconciliation',
      note: `With the review decisions: ${GLOSSARY.residual} = gap − attributed − tolerance adjustment.`,
      rows: rowsOf(RECONCILIATION_FIGURES, listOf(before, 'slices'), listOf(after, 'slices'), 'slices'),
    },
    ...Object.entries(LEDGER_FIGURES).map(([ledger, figures]) => ({
      key: ledger,
      ...LEDGER_TITLES[ledger],
      rows: rowsOf(figures, ledgerRows(before, ledger), ledgerRows(after, ledger), ledger),
    })),
  ];
  return groups.filter((group) => group.rows.some((row) => row.before !== null || row.after !== null));
}
