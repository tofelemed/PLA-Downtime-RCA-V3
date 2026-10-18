import { GLOSSARY, humanize, looksLikeRawId } from '@/features/ux-kit/labels';

/** glossary names of figures whose key differs from the shown word (docs/GLOSSARY.md) */
const FIGURE_NAMES: Readonly<Record<string, string>> = { residual: GLOSSARY.residual, slices: 'Reconciliation', ledgers: 'Ledger' };
const figureName = (key: string) => FIGURE_NAMES[key] ?? humanize(key);

export interface SnapshotFigure {
  label: string;
  value: string;
}

/** the loss value per currency and the reason-code changes, shown on their own (`proposal-values.tsx`) */
const OWN_PANELS: ReadonlySet<string> = new Set(['values', 'codingChanges']);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** keys that only identify records or hashes: never shown */
const HIDDEN_KEY = /(^id$|Id$|Ids$|hash|Hash|key$|Key$|version$|Version$)/;

function shown(key: string, value: unknown): value is string | number | boolean {
  if (HIDDEN_KEY.test(key)) return false;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return typeof value === 'string' && value.length > 0 && !looksLikeRawId(value);
}

const text = (value: string | number | boolean) => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));

/** The heading of one nested group: a ledger row by its ledger, several rows of a list by their position. */
function groupName(key: string, item: Record<string, unknown>, index: number, count: number): string {
  if (typeof item.ledger === 'string') return `${humanize(item.ledger)} ledger`;
  return count > 1 ? `${figureName(key)} ${index + 1}` : figureName(key);
}

function groupFigures(group: string, item: Record<string, unknown>): SnapshotFigure[] {
  return Object.entries(item)
    .filter(([inner, value]) => inner !== 'ledger' && shown(inner, value))
    .map(([inner, value]) => ({ label: `${group} · ${figureName(inner).toLowerCase()}`, value: text(value as string | number | boolean) }));
}

/** The nested groups of one snapshot key: a record, or a list of records (the server sends slices and ledgers as lists). */
function groupsOf(key: string, value: unknown): SnapshotFigure[] {
  if (HIDDEN_KEY.test(key)) return [];
  if (isRecord(value)) return groupFigures(figureName(key), value);
  if (!Array.isArray(value)) return [];
  const items = value.filter(isRecord);
  return items.flatMap((item, i) => groupFigures(groupName(key, item, i, items.length), item));
}

/**
 * The figures of a change-proposal snapshot (before / after) as label and value: top-level and one
 * nested level of plain values (a record or a list of records, e.g. the reconciliation per slice and the
 * run ledgers) with humanized keys; ids, hashes and versions are left out. No JSON dump.
 */
export function snapshotFigures(snapshot: Record<string, unknown>): SnapshotFigure[] {
  const figures: SnapshotFigure[] = [];
  for (const [key, value] of Object.entries(snapshot)) {
    if (OWN_PANELS.has(key)) continue;
    if (shown(key, value)) figures.push({ label: figureName(key), value: text(value) });
    figures.push(...groupsOf(key, value));
  }
  return figures;
}
