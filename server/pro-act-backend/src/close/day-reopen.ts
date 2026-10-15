import { EntityManager } from 'typeorm';
import { appendAudit } from '../common/audit/audit-trail';
import { DayCertification } from './entities/day-certification.entity';

/**
 * SME R2 / owner decision: a certified production day is un-certified only through the correction path —
 * a revise of one of its shift periods (direct, or by an accepted change proposal) reopens the
 * certification in the same transaction, with the revise reason. Returns whether a day was reopened.
 */
export async function reopenCertifiedDay(
  manager: EntityManager,
  input: {
    period: { tenantId: string; unitId: string; localDate: string };
    actorId: string | null;
    reason: string;
    correlationId: string | null;
  },
): Promise<boolean> {
  const { period } = input;
  const certified = await manager.findOneBy(DayCertification, {
    tenantId: period.tenantId,
    unitId: period.unitId,
    localDate: period.localDate,
    state: 'certified',
  });
  if (!certified) return false;
  await manager.update(DayCertification, certified.id, {
    state: 'reopened',
    reopenedBy: input.actorId,
    reopenedAt: new Date(),
    reopenReason: input.reason,
    updatedBy: input.actorId,
  });
  await appendAudit(manager, [
    {
      tenantId: period.tenantId,
      actorId: input.actorId,
      action: 'production_day.reopened',
      entityType: 'production_day_certification',
      entityId: certified.id,
      reason: input.reason,
      correlationId: input.correlationId,
      detail: { unitId: period.unitId, localDate: period.localDate },
    },
  ]);
  return true;
}
