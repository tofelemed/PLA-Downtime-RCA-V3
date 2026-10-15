import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  monthCloseDefault,
  MonthClosePolicy,
  parseMonthClosePolicy,
} from '../domain/close/month-close-policy';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { defaultSiteOf } from './close-calendar';

export interface PolicyInForce<T> {
  policy: T;
  id: string;
  version: number;
}

const SEED_NOTE =
  'Seeded on first use from the SME R1 / R4 pilot settings (EXPERT_REVIEW §3.1, 2026-10-15); change by a new version.';

/**
 * Plant-wide workflow policies of Area 3 (SME R1 / R4 month close): the tenant-wide version in force at
 * an instant, else version 1 of the pilot default seeded on first use — whose calendar and weekend follow
 * the plant (Asia/Tehran or the Persian display calendar → Solar Hijri months, Thursday–Friday weekend).
 */
@Injectable()
export class WorkflowPoliciesService {
  async monthClose(
    manager: EntityManager,
    tenantId: string,
    at: Date,
  ): Promise<PolicyInForce<MonthClosePolicy>> {
    const row = await this.inForce(manager, tenantId, at);
    return {
      policy: parseMonthClosePolicy(row.body),
      id: row.id,
      version: row.version,
    };
  }

  /** The version a month close was first acted on under (its deadlines stay with it). */
  async monthCloseVersion(
    manager: EntityManager,
    id: string,
  ): Promise<PolicyInForce<MonthClosePolicy>> {
    const row = await manager.findOneByOrFail(AccountingPolicy, { id });
    return {
      policy: parseMonthClosePolicy(row.body),
      id: row.id,
      version: row.version,
    };
  }

  private async inForce(
    manager: EntityManager,
    tenantId: string,
    at: Date,
  ): Promise<AccountingPolicy> {
    const found = await this.find(manager, tenantId, at);
    if (found) return found;
    await this.seed(manager, tenantId);
    const seeded = await this.find(manager, tenantId, at);
    if (!seeded)
      throw new Error(`no month_close policy in force at ${at.toISOString()}`);
    return seeded;
  }

  private find(
    manager: EntityManager,
    tenantId: string,
    at: Date,
  ): Promise<AccountingPolicy | null> {
    return manager
      .getRepository(AccountingPolicy)
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId AND p.policyKind = :kind', {
        tenantId,
        kind: 'month_close',
      })
      .andWhere('p.unitId IS NULL AND p.approvedAt IS NOT NULL')
      .andWhere(
        'p.effectiveFrom <= :at AND (p.effectiveTo IS NULL OR p.effectiveTo > :at)',
        { at },
      )
      .orderBy('p.version', 'DESC')
      .getOne();
  }

  private async seed(manager: EntityManager, tenantId: string): Promise<void> {
    const rows: Array<{ timezone: string | null; calendar: string | null }> =
      await manager.query(
        `SELECT t."timezone", t."calendar_system" AS "calendar" FROM "tenants" t WHERE t."id" = $1`,
        [tenantId],
      );
    const site = await defaultSiteOf(manager, tenantId);
    const body = monthCloseDefault({
      timezone: site?.timezone ?? rows[0]?.timezone ?? null,
      calendarSystem: rows[0]?.calendar ?? null,
    });
    await manager.query(
      `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
              "version", "body", "effective_from", "approved_at", "notes")
       SELECT $1, 1, 'month_close', NULL, 'tenant', 1, $2::jsonb, '1970-01-01T00:00:00Z', now(), $3
        WHERE NOT EXISTS (SELECT 1 FROM "accounting_policies" WHERE "tenant_id" = $1
                             AND "policy_kind" = 'month_close' AND "unit_id" IS NULL)
       ON CONFLICT DO NOTHING`,
      [tenantId, JSON.stringify(body), SEED_NOTE],
    );
  }
}
