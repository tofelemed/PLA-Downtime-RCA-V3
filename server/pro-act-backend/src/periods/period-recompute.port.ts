import { Injectable } from '@nestjs/common';

export interface RecomputeTrigger {
  reason: string;
  requestedBy: string | null;
}

/** What a period recompute job records as its result. */
export type RecomputeOutcome = Record<string, unknown>;

export type PeriodRecompute = (
  periodId: string,
  trigger: RecomputeTrigger,
) => Promise<RecomputeOutcome>;

/**
 * Seam between the 2.4 recompute jobs and the 2.5 calculation run: the accounting module registers the
 * full recalculation (actuals first, then both loss ledgers in one transaction); without it — a process
 * that does not load accounting — the job runs the actuals alone, as in 2.4. Keeps the module graph
 * acyclic (accounting depends on periods, never the reverse).
 */
@Injectable()
export class PeriodRecomputePort {
  private handler: PeriodRecompute | null = null;

  register(handler: PeriodRecompute): void {
    this.handler = handler;
  }

  get registered(): PeriodRecompute | null {
    return this.handler;
  }
}
