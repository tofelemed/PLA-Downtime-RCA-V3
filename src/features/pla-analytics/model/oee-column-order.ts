const ORDER = ['oee', 'availability', 'performance', 'quality'];

const rank = (metric: string) => {
  const index = ORDER.indexOf(metric.replace('reconciled_', ''));
  return index === -1 ? ORDER.length : index;
};

/**
 * The server's OEE metric keys in the Reports page order — OEE, Availability, Performance, Quality (owner,
 * 24 Oct 2026). Only the columns move (by key); any other metric keeps its place after them. Nothing is computed.
 */
export function oeeColumnOrder(metrics: readonly string[]): string[] {
  return metrics
    .map((metric, index) => ({ metric, index }))
    .sort((a, b) => rank(a.metric) - rank(b.metric) || a.index - b.index)
    .map((entry) => entry.metric);
}
