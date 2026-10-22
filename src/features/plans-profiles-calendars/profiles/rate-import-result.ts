import type { RateImportView } from '@/api/v2/types/profiles';
import type { SaveLink, SaveResult } from '@/features/ux-kit/save-result';

const KIND_LABELS: Record<string, string> = { budget: 'Budget', forecast: 'Forecast', mpc: 'MPC' };

export interface RateImportResultInput {
  view: RateImportView;
  /** the plant's number format for counts */
  count: (value: number) => string;
  next: SaveLink | null;
  onAddAnother: () => void;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * The result dialog of a finished rate import: "42 rate versions imported", the document and revision, and
 * the counts of the server's job (lines read, imported, earlier versions retired).
 */
export function rateImportResult({ view, count, next, onAddAnother }: RateImportResultInput): SaveResult {
  const counts = view.counts;
  const inserted = counts?.inserted ?? 0;
  return {
    title: `${count(inserted)} ${plural(inserted, 'rate version', 'rate versions')} imported`,
    recordLabel: `${KIND_LABELS[view.kind] ?? view.kind} ${view.externalId}, revision ${view.revision}`,
    message: counts
      ? `${count(counts.rows ?? 0)} lines read · ${count(inserted)} imported · ${count(counts.retired ?? 0)} earlier ${plural(counts.retired ?? 0, 'version', 'versions')} retired.`
      : undefined,
    listPath: '/setup/profiles',
    listLabel: 'Profiles & rates',
    onAddAnother,
    next,
  };
}
