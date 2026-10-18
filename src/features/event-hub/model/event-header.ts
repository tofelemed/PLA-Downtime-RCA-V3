/**
 * "Derived · revision 6": the newest revision the History tab lists — not the row's version counter
 * (`rowVersion`), which also moves on bookkeeping writes. Without the history yet, only the origin.
 */
export function eventHeaderDescription(sourceKindLabel: string, latestRevision: number | null): string {
  return latestRevision === null ? sourceKindLabel : `${sourceKindLabel} · revision ${latestRevision}`;
}
