import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { assertTenantWideWriter } from '../profiles/profile-scope';
import { PlanScenario } from './entities/plan-scenario.entity';
import { conflict, isUniqueViolation } from './plan-errors';

export interface NewScenario {
  name: string;
  description?: string | null;
  isAccountingBaseline?: boolean;
}

export const DEFAULT_SCENARIO_NAME = 'Baseline';

/**
 * Planning scenarios (PLAN04): every tenant has a default baseline scenario (created by the migration or
 * here on first use); approved plan versions must not overlap within a scenario; exactly one scenario per
 * tenant is the accounting baseline. Scenarios are tenant-wide: writing them needs a tenant-wide grant.
 */
@Injectable()
export class PlanScenariosService {
  constructor(
    @InjectRepository(PlanScenario)
    private readonly scenarios: Repository<PlanScenario>,
  ) {}

  /** The tenant's accounting-baseline scenario, created when the tenant has none yet. */
  async baselineScenario(
    manager: EntityManager,
    tenantId: string,
  ): Promise<PlanScenario> {
    const existing = await manager.findOneBy(PlanScenario, {
      tenantId,
      isAccountingBaseline: true,
    });
    if (existing) return existing;
    await manager.query(
      `INSERT INTO "plan_scenarios" ("tenant_id", "name", "description", "is_accounting_baseline", "row_version") ` +
        `VALUES ($1, $2, 'Default accounting baseline (plan 2.3)', true, 1) ON CONFLICT DO NOTHING`,
      [tenantId, DEFAULT_SCENARIO_NAME],
    );
    return manager.findOneByOrFail(PlanScenario, {
      tenantId,
      isAccountingBaseline: true,
    });
  }

  /** A new scenario; `isAccountingBaseline` moves the baseline flag to it (one per tenant). */
  async create(
    context: RequestContext,
    input: NewScenario,
  ): Promise<PlanScenario> {
    const tenantId = requireTenantId(context);
    assertTenantWideWriter(context, tenantId);
    try {
      return await this.scenarios.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `plan_scenarios:${tenantId}`,
        ]);
        await this.baselineScenario(manager, tenantId);
        if (input.isAccountingBaseline) {
          await manager.update(
            PlanScenario,
            { tenantId, isAccountingBaseline: true },
            { isAccountingBaseline: false, updatedBy: context.userId },
          );
        }
        return manager.save(
          manager.create(PlanScenario, {
            tenantId,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            isAccountingBaseline: input.isAccountingBaseline ?? false,
            createdBy: context.userId,
            updatedBy: context.userId,
          }),
        );
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw conflict('SCENARIO_EXISTS', 'a scenario with this name exists');
      }
      throw error;
    }
  }
}
