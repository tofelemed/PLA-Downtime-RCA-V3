import { labelOf } from './humanize';
import { DEFAULT_BASIS_LABELS } from './planning-labels';

/**
 * The one label of the valuation view an approved figure is shown in (QA M3 re-test): "Value basis:
 * Contribution margin" on the investigation, the stop and Bad actors alike — the view's name from the
 * valuation policy's vocabulary, then where it comes from when that matters ("at link time").
 */
export function valueBasisLabel(view: string | null | undefined, note?: string): string {
  const name = labelOf(DEFAULT_BASIS_LABELS, view ?? 'contribution_margin');
  return `Value basis: ${name}${note ? ` (${note})` : ''}`;
}

/** A server basis text as a sentence: capitalised, one closing full stop. */
export function basisSentence(text: string): string {
  const trimmed = text.trim().replace(/[.]+$/, '');
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.` : '';
}
