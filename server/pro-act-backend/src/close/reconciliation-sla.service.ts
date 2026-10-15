import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  SlaInputs,
  slaStatus,
  SlaStatus,
} from '../domain/close/reconciliation-sla';
import { ReconciliationSlaPolicy } from '../domain/close/sla-policy';
import { loadSlaInputs, SlaPeriod } from './sla-inputs';
import {
  PolicyInForce,
  WorkflowPoliciesService,
} from './workflow-policies.service';

/** A period's SLA status with the inputs it was computed from. */
export interface PeriodSla {
  status: SlaStatus;
  inputs: SlaInputs;
  onHold: boolean;
  policyVersion: number;
}

/**
 * Due times, overdue, escalation and rejection escalation of periods (SME R3 / R6), computed on the
 * server from the `reconciliation_sla` version in force at `asOf` — the grid, the period view and the
 * queue read them from here, never from the browser.
 */
@Injectable()
export class ReconciliationSlaService {
  constructor(private readonly policies: WorkflowPoliciesService) {}

  policy(
    manager: EntityManager,
    tenantId: string,
    asOf: Date,
  ): Promise<PolicyInForce<ReconciliationSlaPolicy>> {
    return this.policies.sla(manager, tenantId, asOf);
  }

  async statuses(
    manager: EntityManager,
    periods: readonly SlaPeriod[],
    asOf: Date,
  ): Promise<Map<string, PeriodSla>> {
    if (periods.length === 0) return new Map();
    const policy = await this.policy(manager, periods[0].tenantId, asOf);
    const inputs = await loadSlaInputs(manager, periods, asOf);
    const result = new Map<string, PeriodSla>();
    for (const [periodId, input] of inputs) {
      result.set(periodId, {
        status: slaStatus(input, policy.policy),
        inputs: input,
        onHold: input.holds.some((h) => h.endedAt === null),
        policyVersion: policy.version,
      });
    }
    return result;
  }
}
