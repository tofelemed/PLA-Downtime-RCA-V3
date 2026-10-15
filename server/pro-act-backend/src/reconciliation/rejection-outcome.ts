import { EntityManager } from 'typeorm';
import { ReconciliationSlaService } from '../close/reconciliation-sla.service';
import { loadSlaInputs } from '../close/sla-inputs';
import { slaStatus } from '../domain/close/reconciliation-sla';
import { ProductionPeriod } from '../periods/entities/production-period.entity';

/** What a rejection tells the preparer (SME R6): the new due time and whether it escalated. */
export interface RejectionOutcome {
  at: Date;
  detail: {
    resubmitDueAt: string;
    rejection: number;
    escalated: boolean;
    escalatedTo: string | null;
    slaPolicyVersion: number;
  };
}

/**
 * The SLA after this rejection: the period's inputs with one more rejection now, so the new due time is
 * the one the grid and the queue show (`resubmitWithinHours` after the rejection, never before the first
 * due time, plus any wait for data); the configured n-th rejection escalates to its role.
 */
export async function rejectionOutcome(
  manager: EntityManager,
  slas: ReconciliationSlaService,
  period: ProductionPeriod,
): Promise<RejectionOutcome> {
  const at = new Date();
  const { policy, version } = await slas.policy(manager, period.tenantId, at);
  const inputs = (await loadSlaInputs(manager, [period], at)).get(period.id);
  const rejection = (inputs?.rejections ?? 0) + 1;
  const status = slaStatus(
    {
      dayEnd: inputs?.dayEnd ?? period.utcEnd,
      asOf: at,
      workflow: 'draft',
      lastRejectedAt: at,
      rejections: rejection,
      holds: inputs?.holds ?? [],
    },
    policy,
  );
  return {
    at,
    detail: {
      resubmitDueAt: status.submitDueAt.toISOString(),
      rejection,
      escalated: status.rejectionEscalated,
      escalatedTo: status.rejectionEscalated
        ? policy.rejectionEscalationRole
        : null,
      slaPolicyVersion: version,
    },
  };
}
