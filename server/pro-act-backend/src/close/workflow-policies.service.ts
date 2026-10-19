import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  monthCloseDefault,
  MonthClosePolicy,
  parseMonthClosePolicy,
} from '../domain/close/month-close-policy';
import {
  parseReconciliationSla,
  RECONCILIATION_SLA_DEFAULT,
  ReconciliationSlaPolicy,
} from '../domain/close/sla-policy';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { defaultSiteOf } from './close-calendar';

export interface PolicyInForce<T> {
  policy: T;
  id: string;
  version: number;
}

type WorkflowKind = 'month_close' | 'reconciliation_sla';

const SEED_NOTE = 'Built-in default; change it by recording a new version.';

const toPolicy = <T>(
  row: AccountingPolicy,
  parse: (body: unknown) => T,
): PolicyInForce<T> => ({
  policy: parse(row.body),
  id: row.id,
  version: row.version,
});

/**
 * Plant-wide workflow policies of Area 3 — `month_close` (SME R1 / R4) and `reconciliation_sla` (R3 / R6):
 * the approved tenant-wide version in force at an instant, else version 1 of the pilot default seeded on
 * first use. The month close default follows the plant (Asia/Tehran or the Persian display calendar →
 * Solar Hijri months, Thursday–Friday weekend).
 */
@Injectable()
export class WorkflowPoliciesService {
  async monthClose(
    manager: EntityManager,
    tenantId: string,
    at: Date,
  ): Promise<PolicyInForce<MonthClosePolicy>> {
    const row = await this.inForce(manager, tenantId, 'month_close', at);
    return toPolicy(row, parseMonthClosePolicy);
  }

  /** The version a month close was first acted on under (its deadlines stay with it). */
  async monthCloseVersion(
    manager: EntityManager,
    id: string,
  ): Promise<PolicyInForce<MonthClosePolicy>> {
    const row = await manager.findOneByOrFail(AccountingPolicy, { id });
    return toPolicy(row, parseMonthClosePolicy);
  }

  async sla(
    manager: EntityManager,
    tenantId: string,
    at: Date,
  ): Promise<PolicyInForce<ReconciliationSlaPolicy>> {
    const row = await this.inForce(manager, tenantId, 'reconciliation_sla', at);
    return toPolicy(row, parseReconciliationSla);
  }

  private async inForce(
    manager: EntityManager,
    tenantId: string,
    kind: WorkflowKind,
    at: Date,
  ): Promise<AccountingPolicy> {
    const found = await this.find(manager, tenantId, kind, at);
    if (found) return found;
    await this.seed(manager, tenantId, kind);
    const seeded = await this.find(manager, tenantId, kind, at);
    if (!seeded)
      throw new Error(`no ${kind} policy in force at ${at.toISOString()}`);
    return seeded;
  }

  private find(
    manager: EntityManager,
    tenantId: string,
    kind: WorkflowKind,
    at: Date,
  ): Promise<AccountingPolicy | null> {
    return manager
      .getRepository(AccountingPolicy)
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId AND p.policyKind = :kind', {
        tenantId,
        kind,
      })
      .andWhere('p.unitId IS NULL AND p.approvedAt IS NOT NULL')
      .andWhere(
        'p.effectiveFrom <= :at AND (p.effectiveTo IS NULL OR p.effectiveTo > :at)',
        { at },
      )
      .orderBy('p.version', 'DESC')
      .getOne();
  }

  private async defaultBody(
    manager: EntityManager,
    tenantId: string,
    kind: WorkflowKind,
  ): Promise<object> {
    if (kind === 'reconciliation_sla') return RECONCILIATION_SLA_DEFAULT;
    const rows: Array<{ timezone: string | null; calendar: string | null }> =
      await manager.query(
        `SELECT t."timezone", t."calendar_system" AS "calendar" FROM "tenants" t WHERE t."id" = $1`,
        [tenantId],
      );
    const site = await defaultSiteOf(manager, tenantId);
    return monthCloseDefault({
      timezone: site?.timezone ?? rows[0]?.timezone ?? null,
      calendarSystem: rows[0]?.calendar ?? null,
    });
  }

  private async seed(
    manager: EntityManager,
    tenantId: string,
    kind: WorkflowKind,
  ): Promise<void> {
    const body = await this.defaultBody(manager, tenantId, kind);
    await manager.query(
      `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
              "version", "body", "effective_from", "approved_at", "notes")
       SELECT $1, 1, $2::accounting_policy_kind, NULL, 'tenant', 1, $3::jsonb, '1970-01-01T00:00:00Z', now(), $4
        WHERE NOT EXISTS (SELECT 1 FROM "accounting_policies" WHERE "tenant_id" = $1
                             AND "policy_kind" = $2::accounting_policy_kind AND "unit_id" IS NULL)
       ON CONFLICT DO NOTHING`,
      [tenantId, kind, JSON.stringify(body), SEED_NOTE],
    );
  }
}
