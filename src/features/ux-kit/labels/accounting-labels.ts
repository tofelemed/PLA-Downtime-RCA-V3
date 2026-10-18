import { humanize, labelOf } from './humanize';

/** How a loss quantity was calculated (server `LOSS_BASES`). */
export const LOSS_BASIS_LABELS: Readonly<Record<string, string>> = {
  sustained_rate: 'Sustained rate',
  planning_rate: 'Planning rate',
  measured: 'Measured',
  declared: 'Declared',
};

/** Plain words of a loss line's basis; an unknown key is humanized, never shown as sent. */
export function lossBasisLabel(basis: string | null | undefined): string {
  return labelOf(LOSS_BASIS_LABELS, basis);
}

/** Quantity engine of a signal's actuals segment (`counter_delta/step:delta` → engine). */
export const SEGMENT_ENGINE_LABELS: Readonly<Record<string, string>> = {
  counter_delta: 'Counter difference',
  rate_integration: 'Rate integration',
  output_events: 'Output events',
  external_report: 'Daily production report',
  manual: 'Manual entry',
};

export const SEGMENT_INTERPOLATION_LABELS: Readonly<Record<string, string>> = {
  step: 'step interpolation',
  linear: 'linear interpolation',
};

/** What one actuals segment contributed (server `SegmentKind`). */
export const SEGMENT_KIND_LABELS: Readonly<Record<string, string>> = {
  delta: 'counted',
  reset: 'counter reset',
  rollover: 'counter rollover',
  gap: 'no data',
  unresolved: 'unresolved',
  integral: 'integrated',
  excluded: 'excluded',
};

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Plain words of an actuals segment method: `counter_delta/step:delta` → "Counter difference, step
 * interpolation, counted"; a plain method (`output_events`) → its label. Unknown parts are humanized.
 */
export function segmentMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  const [engineAndInterpolation, kind] = method.split(':');
  const [engine, interpolation] = engineAndInterpolation.split('/');
  const parts = [labelOf(SEGMENT_ENGINE_LABELS, engine)];
  if (interpolation) parts.push(labelOf(SEGMENT_INTERPOLATION_LABELS, interpolation));
  if (kind) parts.push(lower(labelOf(SEGMENT_KIND_LABELS, kind)));
  return parts.map((part, index) => (index === 0 ? part : lower(part))).join(', ') || humanize(method);
}
