import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In } from 'typeorm';
import { appendAudit } from '../common/audit/audit-trail';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import {
  certifyRefusal,
  DayRollup,
  dayRollup,
  dayState,
  DayState,
  needsApproval,
  PeriodFigures,
} from '../domain/close/day-certification';
import { isLocalDate } from '../domain/calendar/wall-clock';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { invalid } from '../profiles/profile-errors';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { assertPeriodUnitInScope } from '../periods/period-scope';
import { sha256 } from '../reconciliation/reviewed-content';
import { lockPeriod, requireUser } from '../reconciliation/revision-access';
import { separationOfDuties } from '../reconciliation/workflow-errors';
import { loadPeriodStates } from '../v2/period-overview/period-states';
import { planFigures } from '../v2/period-overview/period-summary.view';
import { dayPeriods, DayPeriodRow } from './day-periods';
import { DayCertification } from './entities/day-certification.entity';

/** A day of the list: its periods and state, without the roll-up. */
export type DaySummary = Omit<DaySnapshot, 'rollup'>;

export interface DaySnapshot {
  unitId: string;
  localDate: string;
  state: DayState;
  periods: DayPeriodRow[];
  /** the latest certification of the day (certified, or reopened by a correction) */
  certification: DayCertification | null;
  /** the approved shift revisions rolled up per unit of measure */
  rollup: DayRollup[];
}

/**
 * Day certification (owner decision 14 Oct 2026, SME R2; phase R-E): shifts are prepared and approved per
 * period; one approval per production day of a unit certifies the roll-up of its approved shift revisions
 * — each quantity stays on its shift and is only summed. The certifier submitted none of the shifts
 * (403 SEPARATION_OF_DUTIES); a revise of a shift reopens the day (`day-reopen.ts`).
 */
@Injectable()
export class DayCertificationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
  ) {}

  day(
    context: RequestContext,
    unitId: string,
    localDate: string,
  ): Promise<DaySnapshot> {
    const tenantId = requireTenantId(context);
    assertPeriodUnitInScope(context, unitId, 'Production day');
    assertDate(localDate);
    return this.dataSource.transaction((manager) =>
      this.read(manager, { tenantId, unitId, localDate }),
    );
  }

  /** Days of a unit on `[from, to]` with their state (no roll-up; the window is bounded by the caller). */
  async list(
    context: RequestContext,
    input: { unitId: string; from: string; to: string },
  ): Promise<DaySummary[]> {
    const tenantId = requireTenantId(context);
    assertPeriodUnitInScope(context, input.unitId, 'Production day');
    const manager = this.dataSource.manager;
    const periods = await dayPeriods(manager, {
      tenantId,
      unitIds: [input.unitId],
      from: input.from,
      to: input.to,
    });
    const certified = await manager.find(DayCertification, {
      where: {
        tenantId,
        unitId: input.unitId,
        state: 'certified',
        localDate: Between(input.from, input.to),
      },
    });
    const byDate = new Map<string, DayPeriodRow[]>();
    for (const p of periods) {
      byDate.set(p.localDate, [...(byDate.get(p.localDate) ?? []), p]);
    }
    return [...byDate.entries()].map(([localDate, rows]) => {
      const certification =
        certified.find((c) => c.localDate === localDate) ?? null;
      return {
        unitId: input.unitId,
        localDate,
        state: dayState(rows, certification !== null),
        periods: rows,
        certification,
      };
    });
  }

  certify(
    context: RequestContext,
    day: { unitId: string; localDate: string },
    comment: string | null,
  ): Promise<DaySnapshot> {
    const certifier = requireUser(context);
    const tenantId = requireTenantId(context);
    assertPeriodUnitInScope(context, day.unitId, 'Production day');
    assertDate(day.localDate);
    return this.dataSource.transaction(async (manager) => {
      const key = { tenantId, ...day };
      for (const period of await dayPeriods(manager, this.range(key))) {
        await lockPeriod(manager, period.periodId);
      }
      const before = await this.read(manager, key);
      const certified = before.certification?.state === 'certified';
      const refusal = certifyRefusal(certifier, before.periods, certified);
      if (refusal) throw refusalError(refusal, before);
      const row = await manager.save(
        manager.create(DayCertification, {
          ...key,
          state: 'certified',
          revisions: before.periods.flatMap((p) =>
            p.revisionId && p.revision !== null
              ? [
                  {
                    periodId: p.periodId,
                    revisionId: p.revisionId,
                    revision: p.revision,
                  },
                ]
              : [],
          ),
          rollupHash: sha256(before.rollup),
          certifiedBy: certifier,
          certifiedAt: new Date(),
          comment,
          createdBy: certifier,
        }),
      );
      await appendAudit(manager, [
        {
          tenantId,
          actorId: certifier,
          action: 'production_day.certified',
          entityType: 'production_day_certification',
          entityId: row.id,
          reason: comment,
          afterHash: row.rollupHash,
          correlationId: context.correlationId || null,
          detail: { ...day, periods: row.revisions.length },
        },
      ]);
      return this.read(manager, key);
    });
  }

  private range(key: { tenantId: string; unitId: string; localDate: string }) {
    return {
      tenantId: key.tenantId,
      unitIds: [key.unitId],
      from: key.localDate,
      to: key.localDate,
    };
  }

  private async read(
    manager: EntityManager,
    key: { tenantId: string; unitId: string; localDate: string },
  ): Promise<DaySnapshot> {
    const periods = await dayPeriods(manager, this.range(key));
    const certification = await manager.findOne(DayCertification, {
      where: key,
      order: { certifiedAt: 'DESC' },
    });
    const certified = certification?.state === 'certified';
    return {
      ...key,
      state: dayState(periods, certified),
      periods,
      certification,
      rollup: await this.rollupOf(manager, periods),
    };
  }

  /** Plan-ledger figures of the approved revision of each shift that needs one, rolled up. */
  private async rollupOf(
    manager: EntityManager,
    periods: readonly DayPeriodRow[],
  ): Promise<DayRollup[]> {
    const ids = periods.filter(needsApproval).map((p) => p.periodId);
    if (ids.length === 0) return [];
    const rows = await manager.find(ProductionPeriod, {
      where: { id: In(ids) },
    });
    const states = await loadPeriodStates(
      manager,
      rows,
      'approved',
      this.policies,
    );
    const figures: PeriodFigures[] = states.flatMap((state) => {
      if (!state.reconciliation || !state.rule) return [];
      const plan = planFigures(state.reconciliation.slices, state.rule.epsilon);
      return plan ? [plan] : [];
    });
    return dayRollup(figures);
  }
}

function assertDate(localDate: string): void {
  if (!isLocalDate(localDate)) {
    throw invalid('INVALID_DATE', 'localDate is not a date');
  }
}

function refusalError(
  refusal: NonNullable<ReturnType<typeof certifyRefusal>>,
  day: DaySnapshot,
) {
  if (refusal === 'SEPARATION_OF_DUTIES') return separationOfDuties();
  if (refusal === 'DAY_CERTIFIED') {
    return new ConflictException({
      code: 'DAY_CERTIFIED',
      message: 'the production day is already certified',
    });
  }
  return new UnprocessableEntityException({
    code: 'DAY_NOT_READY',
    message:
      'every shift period of the day must be approved before the day is certified',
    details: {
      pending: day.periods
        .filter((p) => needsApproval(p) && p.workflow !== 'approved')
        .map((p) => ({
          periodId: p.periodId,
          shiftName: p.shiftName,
          workflow: p.workflow,
        })),
    },
  });
}
