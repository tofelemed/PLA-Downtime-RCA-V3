/**
 * Read position of the realtime feed in the `outbox` id sequence (plan 3.1).
 *
 * Sequence ids are assigned at insert but become visible at commit, so a lower id can appear after a
 * higher one. The tail therefore keeps a `floor` (every id ≤ floor was handled or given up on) and the
 * ids seen above it; it reads `id > floor` and skips ids it already delivered. A missing id is waited
 * for `graceMs` (a slow transaction) and then given up (a rolled-back insert never appears); a client
 * that relied on it is protected by the snapshot refetch on reconnect and by query staleness.
 */
export class OutboxTail {
  private readonly seen = new Set<number>();
  private readonly gapSince = new Map<number, number>();

  constructor(
    private floorId: number,
    private readonly graceMs: number,
    /** ids further than this above the floor are never waited for (bounds the bookkeeping) */
    private readonly maxGapSpan = 10_000,
  ) {}

  get floor(): number {
    return this.floorId;
  }

  /** The ids of `ids` not delivered before (ascending); records them and advances the floor. */
  accept(ids: readonly number[], nowMs: number): number[] {
    const fresh = [...new Set(ids)]
      .filter((id) => id > this.floorId && !this.seen.has(id))
      .sort((a, b) => a - b);
    for (const id of fresh) this.seen.add(id);
    this.advance(nowMs);
    return fresh;
  }

  private advance(nowMs: number): void {
    const highest = Math.max(this.floorId, ...this.seen);
    if (highest - this.floorId > this.maxGapSpan) {
      this.jumpTo(highest - this.maxGapSpan);
    }
    for (let id = this.floorId + 1; id < highest; id += 1) {
      if (!this.seen.has(id) && !this.gapSince.has(id)) {
        this.gapSince.set(id, nowMs);
      }
    }
    let next = this.floorId + 1;
    while (next <= highest && this.settled(next, nowMs)) {
      this.seen.delete(next);
      this.gapSince.delete(next);
      this.floorId = next;
      next += 1;
    }
  }

  private settled(id: number, nowMs: number): boolean {
    if (this.seen.has(id)) return true;
    const since = this.gapSince.get(id);
    return since !== undefined && nowMs - since >= this.graceMs;
  }

  private jumpTo(id: number): void {
    for (const seenId of [...this.seen]) {
      if (seenId <= id) this.seen.delete(seenId);
    }
    for (const gapId of [...this.gapSince.keys()]) {
      if (gapId <= id) this.gapSince.delete(gapId);
    }
    this.floorId = id;
  }
}
