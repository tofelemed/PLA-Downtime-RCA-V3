/** One CMMS work-order operation linked to a stop (SME D10). */
export interface RepairOperation {
  kind: 'diagnosis' | 'repair' | 'test' | 'other';
  start: Date;
  /** null = still running */
  end: Date | null;
  /** waiting for parts, permit or crew inside the operation (seconds) */
  waitingSeconds: number;
}

/** Active-repair evidence of one failure: null when an operation is still open (the repair is censored). */
export interface RepairEvidence {
  repairStart: Date;
  repairEnd: Date;
  /** Σ (operation length − waiting) of diagnosis, repair and test operations, overlaps counted once */
  activeRepairSeconds: number;
}

const ACTIVE = new Set(['diagnosis', 'repair', 'test']);

/**
 * SME D10 worked example: trip 08:00, work 10:00–13:00 (verified repair and test), production back 14:00
 * → active repair 3 h, restoration 5 h, production downtime 6 h. Active repair sums the verified
 * diagnosis, repair and functional-test operations minus their waiting; overlapping operations (two
 * crafts at once) count their wall-clock time once. Work-order creation / closure is never evidence.
 */
export function repairEvidence(
  operations: readonly RepairOperation[],
): RepairEvidence | null {
  const active = operations.filter((o) => ACTIVE.has(o.kind));
  if (active.length === 0 || active.some((o) => o.end === null)) return null;
  const sorted = [...active].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  let seconds = 0;
  let coveredUntil = 0;
  for (const op of sorted) {
    const start = Math.max(op.start.getTime(), coveredUntil);
    const end = (op.end as Date).getTime();
    if (end > start) seconds += (end - start) / 1000;
    coveredUntil = Math.max(coveredUntil, end);
  }
  const waiting = sorted.reduce((sum, op) => sum + op.waitingSeconds, 0);
  return {
    repairStart: sorted[0].start,
    repairEnd: new Date(
      Math.max(...sorted.map((o) => (o.end as Date).getTime())),
    ),
    activeRepairSeconds: Math.max(0, seconds - waiting),
  };
}
