import { humanize, looksLikeRawId } from '@/features/ux-kit/labels';

export interface SnapshotFigure {
  label: string;
  value: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** keys that only identify records or hashes: never shown */
const HIDDEN_KEY = /(^id$|Id$|Ids$|hash|Hash|key$|Key$|version$|Version$)/;

function shown(key: string, value: unknown): value is string | number | boolean {
  if (HIDDEN_KEY.test(key)) return false;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return typeof value === 'string' && value.length > 0 && !looksLikeRawId(value);
}

const text = (value: string | number | boolean) => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));

/**
 * The figures of a change-proposal snapshot (before / after) as label and value: top-level and one
 * nested level of plain values with humanized keys; ids, hashes and versions are left out. No JSON dump.
 */
export function snapshotFigures(snapshot: Record<string, unknown>): SnapshotFigure[] {
  const figures: SnapshotFigure[] = [];
  for (const [key, value] of Object.entries(snapshot)) {
    if (shown(key, value)) figures.push({ label: humanize(key), value: text(value) });
    if (!isRecord(value) || HIDDEN_KEY.test(key)) continue;
    for (const [inner, innerValue] of Object.entries(value)) {
      if (shown(inner, innerValue)) figures.push({ label: `${humanize(key)} · ${humanize(inner).toLowerCase()}`, value: text(innerValue) });
    }
  }
  return figures;
}
