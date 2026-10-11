import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AdjustmentDelta,
  adjustmentViolation,
  projectActuals,
} from '../domain/actuals/period/adjustment-check';
import { toDec, ZERO } from '../domain/actuals/decimal';
import { ActualsAdjustment } from './entities/actuals-adjustment.entity';
import { ActualsResult } from './entities/actuals-result.entity';
import { ProductionPeriod } from './entities/production-period.entity';

/**
 * Refuses (422 with the violation's code) an adjustment that would make the slice's actuals impossible
 * for the accounting engine: the slice's latest actuals result plus every approved adjustment it does
 * not yet include plus `delta`. Without an actuals result there is nothing to check against yet; the
 * calculation run still validates the final figures.
 */
export async function assertAdjustmentPossible(
  manager: EntityManager,
  target: { period: ProductionPeriod; sliceId: string },
  delta: AdjustmentDelta,
): Promise<void> {
  const runId = target.period.currentActualsRunId;
  if (!runId) return;
  const result = await manager.findOneBy(ActualsResult, {
    actualsRunId: runId,
    sliceId: target.sliceId,
  });
  if (!result) return;
  const approved = await manager.findBy(ActualsAdjustment, {
    sliceId: target.sliceId,
    state: 'approved',
  });
  const included = new Set(result.adjustmentIds ?? []);
  const pending = approved
    .filter((adjustment) => !included.has(adjustment.id))
    .map((adjustment) => ({
      kind: adjustment.kind,
      quantity: toDec(adjustment.quantity) ?? ZERO,
    }));
  const projected = projectActuals(
    {
      basis: result.basis,
      gross: toDec(result.gross),
      good: toDec(result.good),
      reject: toDec(result.reject),
    },
    [...pending, delta],
  );
  const violation = adjustmentViolation(projected);
  if (violation) throw new UnprocessableEntityException(violation);
}
