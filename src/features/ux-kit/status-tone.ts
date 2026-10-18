/**
 * The one status vocabulary (UX_AUDIT C-2, §5.8): every badge, chip and status text picks one of these.
 * - neutral: informational or inactive (draft, retired, escalated, waiting)
 * - info: in progress or needs a look (open, submitted, under analysis)
 * - success: done or healthy (approved, coded, within tolerance)
 * - warning: data quality or provisional figures (amber)
 * - danger: overdue, above tolerance, failed (red) — never for informational states
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Text colour of a tone, for status words outside a badge (e.g. "No mapping problems."). */
export const TONE_TEXT_CLASS: Readonly<Record<StatusTone, string>> = {
  neutral: 'text-neutral',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

/** Border + 10 % tint + text of a tone (badges, notices). Text on the tint stays ≥ 4.5:1 (src/index.css). */
export const TONE_SURFACE_CLASS: Readonly<Record<StatusTone, string>> = {
  neutral: 'border-neutral/30 bg-neutral/10 text-neutral',
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-danger/40 bg-danger/10 text-danger',
};

/** The tone of a domain value from its map; an unmapped value is neutral (never guessed as an alarm). */
export function toneOf(tones: Readonly<Record<string, StatusTone>>, value: string | null | undefined): StatusTone {
  return (value && tones[value]) || 'neutral';
}
