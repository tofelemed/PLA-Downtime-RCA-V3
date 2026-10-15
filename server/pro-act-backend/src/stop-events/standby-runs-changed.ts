import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';

/** Outbox message: runs of a standby asset were recorded or replaced (`standby_records`, SME D9). */
export const STANDBY_RUNS_CHANGED = 'StandbyRunsChanged';

export interface StandbyRunSpan {
  assetId: string;
  start: Date;
  /** null = still running */
  end: Date | null;
}

/**
 * One `StandbyRunsChanged` per standby asset over its earliest start to latest end (open = open-ended):
 * plan 1.10 step 4 resolves again the stops of the assets whose unit impact rule names that standby.
 */
export async function recordStandbyRunsChanged(
  manager: EntityManager,
  tenantId: string,
  runs: readonly StandbyRunSpan[],
): Promise<void> {
  const byAsset = new Map<string, { from: Date; to: Date | null }>();
  for (const run of runs) {
    const known = byAsset.get(run.assetId);
    if (!known) {
      byAsset.set(run.assetId, { from: run.start, to: run.end });
      continue;
    }
    if (run.start < known.from) known.from = run.start;
    if (known.to && (!run.end || run.end > known.to)) known.to = run.end;
  }
  await enqueueOutbox(
    manager,
    [...byAsset.entries()].map(([assetId, span]) => ({
      tenantId,
      aggregateType: 'standby_asset',
      aggregateId: assetId,
      type: STANDBY_RUNS_CHANGED,
      payload: {
        assetId,
        from: span.from.toISOString(),
        to: span.to ? span.to.toISOString() : null,
      },
    })),
  );
}
