import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ScheduleBreakdown,
  scheduleBreakdown,
  shiftBoundaries,
} from '../domain/calendar/schedule-metrics';
import { BoundedInterval } from '../domain/time/interval-algebra';
import { ShiftInstance } from './entities/shift-instance.entity';

/**
 * Schedule queries over stored shift instances (plan 2.1 step 3) for downtime, accounting and KPIs:
 * scheduled seconds S (KPI01), the schedule-exclusion bucket of the capacity ledger (ACC01) and the
 * boundaries downtime is split at (DT05). Windows are half-open UTC intervals; callers pass the tenant.
 */
@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(ShiftInstance)
    private readonly instances: Repository<ShiftInstance>,
  ) {}

  /** Instances of a unit overlapping the window, by start (uses `UQ_shift_instances_unit_start`). */
  instancesIn(
    tenantId: string,
    unitId: string,
    window: BoundedInterval,
  ): Promise<ShiftInstance[]> {
    return this.instances
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId AND si.unitId = :unitId', {
        tenantId,
        unitId,
      })
      .andWhere('si.utcStart < :to AND si.utcEnd > :from', {
        from: window.start,
        to: window.end,
      })
      .orderBy('si.utcStart', 'ASC')
      .getMany();
  }

  /** Σ non-excluded shift seconds inside the window (KPI01 S). */
  async scheduledSeconds(
    tenantId: string,
    unitId: string,
    window: BoundedInterval,
  ): Promise<number> {
    return (await this.scheduleBreakdown(tenantId, unitId, window))
      .scheduledSeconds;
  }

  /** Scheduled, `schedule_exclusion` (per kind) and unscheduled seconds of the window. */
  async scheduleBreakdown(
    tenantId: string,
    unitId: string,
    window: BoundedInterval,
  ): Promise<ScheduleBreakdown> {
    return scheduleBreakdown(
      await this.instancesIn(tenantId, unitId, window),
      window,
    );
  }

  /** Sorted UTC instants of shift (and exclusion) changes strictly inside the window. */
  async boundaries(
    tenantId: string,
    unitId: string,
    window: BoundedInterval,
  ): Promise<Date[]> {
    return shiftBoundaries(
      await this.instancesIn(tenantId, unitId, window),
      window,
    );
  }
}
