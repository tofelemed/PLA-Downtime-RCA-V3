import type { LineDeltaView } from '@/api/v2/types/restatement';

/** A loss line whose quantity moved from one reason code to another (same kind and unit). */
export interface ReasonChange {
  kind: string;
  uom: string | null;
  from: string | null;
  to: string | null;
  /** the moved quantity, as the server stated it (the old figure of the line that went away) */
  quantity: string;
}

const isZero = (value: string | null) => value === null || /^-?0*(\.0*)?$/.test(value);

/**
 * Marun E2E note E: a reason-only correction shows as one line that went to zero and one that came from
 * zero with the same kind, unit and quantity; such a pair is a reason change. Only exact pairs are read
 * this way (quantities compared as the server's strings); anything else stays two rows.
 */
export function reasonChangesOf(lines: readonly LineDeltaView[]): { changes: ReasonChange[]; rest: LineDeltaView[] } {
  const removed = lines.filter((l) => !isZero(l.old) && isZero(l.new));
  const added = lines.filter((l) => isZero(l.old) && !isZero(l.new));
  const paired = new Set<LineDeltaView>();
  const changes: ReasonChange[] = [];
  for (const gone of removed) {
    const match = added.find((l) => !paired.has(l) && l.kind === gone.kind && l.uom === gone.uom && Number(l.new) === Number(gone.old));
    if (!match) continue;
    paired.add(match).add(gone);
    changes.push({ kind: gone.kind, uom: gone.uom, from: gone.reasonCodeId, to: match.reasonCodeId, quantity: gone.old ?? '0' });
  }
  return { changes, rest: lines.filter((l) => !paired.has(l)) };
}
