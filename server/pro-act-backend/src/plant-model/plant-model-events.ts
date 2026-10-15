import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import { PROFILE_BASELINE_CHANGED } from '../profiles/profile-events';

/** Plant-model subjects that recalculate the periods of the unit they name (`baseline-recalc-scope.ts`). */
export type PlantModelSubject = 'unit_stream' | 'stream_run' | 'plant_flow';

export interface PlantModelChange {
  tenantId: string;
  aggregateId: string;
  rowVersion: number;
  subject: PlantModelSubject;
  change: string;
  unitId: string;
  from: Date;
  to: Date | null;
}

/**
 * A plant-model change (streams, stream runs, flow map) recalculates the open periods of its unit over
 * its interval, like an approved baseline (LA-03); approved periods get a change proposal.
 */
export async function recordPlantModelChange(
  manager: EntityManager,
  change: PlantModelChange,
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: change.tenantId,
      aggregateType: change.subject,
      aggregateId: change.aggregateId,
      type: PROFILE_BASELINE_CHANGED,
      version: change.rowVersion,
      payload: {
        change: change.change,
        id: change.aggregateId,
        subject: change.subject,
        unitId: change.unitId,
        effectiveFrom: change.from.toISOString(),
        effectiveTo: change.to ? change.to.toISOString() : null,
      },
    },
  ]);
}
