/** The 0-based page of the row whose anchor is `anchor`, or -1 when no row has it. */
export function anchorPageOf<T>(rows: readonly T[], getRowAnchor: (row: T) => string | undefined, anchor: string, pageSize: number): number {
  if (!anchor) return -1;
  const index = rows.findIndex((row) => getRowAnchor(row) === anchor);
  return index < 0 ? -1 : Math.floor(index / pageSize);
}
