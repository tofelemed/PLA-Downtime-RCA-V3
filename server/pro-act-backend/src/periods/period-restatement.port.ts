import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductionPeriod } from './entities/production-period.entity';

/** A baseline plan change that reached reconciled periods (2.3 `PlanVersionApproved`, `restatementRequired`). */
export interface RestatementRequest {
  planVersionId: string;
  periods: readonly ProductionPeriod[];
}

export type PeriodRestatement = (
  manager: EntityManager,
  request: RestatementRequest,
) => Promise<void>;

/**
 * Seam between the 2.4 recalculation consumer and the 2.8 workflow: reconciled periods are never
 * re-resolved here; the workflow registers a handler that opens a change proposal per period (WF04).
 * Without a handler (a process that does not load the workflow) the change is only logged. Keeps the
 * module graph acyclic, like `PeriodRecomputePort`.
 */
@Injectable()
export class PeriodRestatementPort {
  private handler: PeriodRestatement | null = null;

  register(handler: PeriodRestatement): void {
    this.handler = handler;
  }

  get registered(): PeriodRestatement | null {
    return this.handler;
  }
}
