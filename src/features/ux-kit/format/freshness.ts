/** "3 min ago"-style age of `asOf`; null when unknown. */
export function freshnessOf(asOf: string | null | undefined, now: number): string | null {
  if (!asOf) return null;
  const seconds = Math.max(0, Math.round((now - Date.parse(asOf)) / 1000));
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}
