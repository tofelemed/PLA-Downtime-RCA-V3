import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OEESummary } from '../oee-summary/oee-summary.entity';
import { ProductionLoss } from '../production-loss/production-loss.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { RCA } from '../rca/rca.entity';
import { Task } from '../task/task.entity';

export interface ReportDateFilter {
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  unitId?: string;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(OEESummary)
    private readonly oeeRepository: Repository<OEESummary>,
    @InjectRepository(ProductionLoss)
    private readonly lossRepository: Repository<ProductionLoss>,
    @InjectRepository(ProductionEvent)
    private readonly eventRepository: Repository<ProductionEvent>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(RCA)
    private readonly rcaRepository: Repository<RCA>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  private dateRangeWhere(
    alias: string,
    filter: ReportDateFilter,
  ): { clause: string; params: Record<string, any> } {
    const params: Record<string, any> = {};
    const parts: string[] = [];

    if (filter.tenantId) {
      parts.push(`${alias}.tenantId = :tenantId`);
      params.tenantId = filter.tenantId;
    }
    if (filter.startDate && filter.endDate) {
      parts.push(`${alias}.createdAt >= :startDate AND ${alias}.createdAt <= :endDate`);
      params.startDate = filter.startDate;
      params.endDate = filter.endDate;
    } else if (filter.startDate) {
      parts.push(`${alias}.createdAt >= :startDate`);
      params.startDate = filter.startDate;
    } else if (filter.endDate) {
      parts.push(`${alias}.createdAt <= :endDate`);
      params.endDate = filter.endDate;
    }

    return {
      clause: parts.length > 0 ? parts.join(' AND ') : '1=1',
      params,
    };
  }

  async getOeeSummary(filter: ReportDateFilter) {
    const qb = this.oeeRepository.createQueryBuilder('oee');
    const { clause, params } = this.dateRangeWhere('oee', filter);
    qb.where(clause, params);
    const records = await qb.orderBy('oee.createdAt', 'DESC').getMany();

    const avg = (values: number[]) =>
      values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    const summary = {
      recordCount: records.length,
      avgAvailability: avg(records.map((r) => Number(r.availability) || 0)),
      avgPerformance: avg(records.map((r) => Number(r.performance) || 0)),
      avgQuality: avg(records.map((r) => Number(r.quality) || 0)),
      avgOverallOEE: avg(records.map((r) => Number(r.overallOEE) || 0)),
    };

    const byPeriod = records.map((r) => ({
      period: r.period,
      planId: r.planId,
      availability: Number(r.availability) || 0,
      performance: Number(r.performance) || 0,
      quality: Number(r.quality) || 0,
      overallOEE: Number(r.overallOEE) || 0,
      createdAt: r.createdAt,
    }));

    let fromEvents: Record<string, number> | undefined;
    if (records.length === 0 && filter.tenantId) {
      const eventQb = this.eventRepository.createQueryBuilder('e');
      eventQb.where('e.tenantId = :tenantId', { tenantId: filter.tenantId });
      eventQb.andWhere('e.eventType = :eventType', { eventType: 'ProductionLoss' });
      if (filter.startDate && filter.endDate) {
        eventQb.andWhere('e.startTime >= :startDate AND e.startTime <= :endDate', {
          startDate: filter.startDate,
          endDate: filter.endDate,
        });
      }
      if (filter.unitId) {
        eventQb.andWhere('e.unitId = :unitId', { unitId: filter.unitId });
      }
      const events = await eventQb.getMany();
      const totalDuration = events.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
      const totalCost = events.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
      fromEvents = {
        eventCount: events.length,
        totalDowntimeMinutes: totalDuration,
        totalCost,
      };
    }

    return {
      tenantId: filter.tenantId,
      startDate: filter.startDate,
      endDate: filter.endDate,
      summary,
      byPeriod,
      fromEvents,
      charts: {
        periodTrend: byPeriod.map((p) => ({
          label: p.period || 'Unknown',
          oee: Number(p.overallOEE) || 0,
          availability: Number(p.availability) || 0,
          performance: Number(p.performance) || 0,
          quality: Number(p.quality) || 0,
        })),
        components: [
          { label: 'Availability', value: summary.avgAvailability },
          { label: 'Performance', value: summary.avgPerformance },
          { label: 'Quality', value: summary.avgQuality },
          { label: 'OEE', value: summary.avgOverallOEE },
        ],
      },
      data: records,
    };
  }

  async getProductionLossReport(filter: ReportDateFilter) {
    const lossQb = this.lossRepository.createQueryBuilder('loss');
    const { clause, params } = this.dateRangeWhere('loss', filter);
    lossQb.where(clause, params);
    const lossRecords = await lossQb.orderBy('loss.createdAt', 'DESC').getMany();

    const eventQb = this.eventRepository.createQueryBuilder('e');
    eventQb.where('e.eventType = :eventType', { eventType: 'ProductionLoss' });
    if (filter.tenantId) {
      eventQb.andWhere('e.tenantId = :tenantId', { tenantId: filter.tenantId });
    }
    if (filter.startDate && filter.endDate) {
      eventQb.andWhere('e.startTime >= :startDate AND e.startTime <= :endDate', {
        startDate: filter.startDate,
        endDate: filter.endDate,
      });
    }
    if (filter.unitId) {
      eventQb.andWhere('e.unitId = :unitId', { unitId: filter.unitId });
    }
    const events = await eventQb.orderBy('e.startTime', 'DESC').getMany();

    const totalLossQty = lossRecords.reduce((s, l) => s + (Number(l.losses) || 0), 0);
    const totalLossCost = lossRecords.reduce((s, l) => s + (Number(l.cost) || 0), 0);
    const eventCost = events.reduce((s, e) => s + (Number(e.cost) || 0), 0);
    const eventDuration = events.reduce((s, e) => s + (Number(e.duration) || 0), 0);

    const byCategory = this.groupAndSum(
      events,
      (e) => e.lossCategory || 'Uncategorized',
      (e) => Number(e.cost) || 0,
    );

    const bySeverity = this.groupAndSum(
      events,
      (e) => e.severity || 'Unknown',
      (e) => Number(e.cost) || 0,
    );

    const byUnit = this.groupAndSum(
      events,
      (e) => e.unitId || 'Unknown',
      (e) => Number(e.cost) || 0,
    );

    const topEvents = events
      .slice()
      .sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0))
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        description: e.description,
        cost: Number(e.cost) || 0,
        duration: Number(e.duration) || 0,
        severity: e.severity,
        status: e.status,
        unitId: e.unitId,
        startTime: e.startTime,
      }));

    const costTrendByDay = this.seriesByDay(events, (e) => e.startTime, (e) => Number(e.cost) || 0);
    const durationTrendByDay = this.seriesByDay(events, (e) => e.startTime, (e) => Number(e.duration) || 0);

    return {
      tenantId: filter.tenantId,
      startDate: filter.startDate,
      endDate: filter.endDate,
      summary: {
        lossRecordCount: lossRecords.length,
        eventCount: events.length,
        totalLossQuantity: totalLossQty,
        totalLossRecordCost: totalLossCost,
        totalEventCost: eventCost,
        totalDurationMinutes: eventDuration,
      },
      byCategory,
      bySeverity,
      byUnit,
      topEvents,
      charts: {
        costByCategory: byCategory.map((c) => ({ label: c.key, value: c.total, count: c.count })),
        costBySeverity: bySeverity.map((c) => ({ label: c.key, value: c.total, count: c.count })),
        costByUnit: byUnit.slice(0, 10).map((c) => ({ label: c.key.slice(0, 8), value: c.total, count: c.count })),
        costTrendByDay,
        durationTrendByDay,
        pareto: (() => {
          let running = 0;
          const total = byCategory.reduce((s, c) => s + c.total, 0);
          return byCategory.map((c) => {
            running += c.total;
            return {
              label: c.key,
              value: c.total,
              cumulative: total ? Math.round((running / total) * 1000) / 10 : 0,
            };
          });
        })(),
      },
      data: lossRecords,
    };
  }

  async getOeeTrends(filter: ReportDateFilter) {
    const qb = this.oeeRepository.createQueryBuilder('oee');
    const { clause, params } = this.dateRangeWhere('oee', filter);
    qb.where(clause, params);
    const data = await qb.orderBy('oee.createdAt', 'ASC').getMany();
    const trend = data.map((r) => ({
      date: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : 'Unknown',
      period: r.period,
      oee: Number(r.overallOEE) || 0,
      availability: Number(r.availability) || 0,
      performance: Number(r.performance) || 0,
      quality: Number(r.quality) || 0,
    }));
    return { data, trend };
  }

  async getLossAnalysis(filter: ReportDateFilter) {
    const qb = this.lossRepository.createQueryBuilder('loss');
    const { clause, params } = this.dateRangeWhere('loss', filter);
    qb.where(clause, params);
    const data = await qb.orderBy('loss.createdAt', 'DESC').getMany();
    return { data };
  }

  async getAuditTrail(filter: ReportDateFilter & { userId?: string }) {
    const qb = this.auditRepository.createQueryBuilder('log');
    const parts: string[] = [];
    const params: Record<string, any> = {};

    if (filter.startDate && filter.endDate) {
      parts.push('log.createdAt >= :startDate AND log.createdAt <= :endDate');
      params.startDate = filter.startDate;
      params.endDate = filter.endDate;
    }
    if (filter.userId) {
      parts.push('log.userId = :userId');
      params.userId = filter.userId;
    }
    if (filter.tenantId) {
      parts.push('log.tenantId = :tenantId');
      params.tenantId = filter.tenantId;
    }
    if (parts.length) qb.where(parts.join(' AND '), params);

    const data = await qb.orderBy('log.createdAt', 'DESC').take(500).getMany();

    const byAction = this.groupCount(data, (l) => l.action);
    const byEntityType = this.groupCount(data, (l) => l.entityType);
    const activityByDay = this.seriesByDay(data, (l) => l.createdAt);

    return {
      summary: { total: data.length, byAction, byEntityType },
      charts: {
        activityByDay,
        byAction: byAction.map((a) => ({ label: a.key, value: a.count })),
        byEntityType: byEntityType.map((a) => ({ label: a.key, value: a.count })),
      },
      recent: data.slice(0, 25).map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        userId: l.userId,
        createdAt: l.createdAt,
      })),
      data,
    };
  }

  async getRcaSummary(filter: ReportDateFilter) {
    const qb = this.rcaRepository.createQueryBuilder('rca');
    const { clause, params } = this.dateRangeWhere('rca', filter);
    qb.where(clause, params);
    const data = await qb.orderBy('rca.createdAt', 'DESC').getMany();

    const byStatus = this.groupCount(data, (r) => r.status || 'Unknown');
    const byPriority = this.groupCount(data, (r) => r.priority || 'Unknown');
    const createdTrend = this.seriesByDay(data, (r) => r.createdAt);

    return {
      summary: {
        total: data.length,
        byStatus,
        byPriority,
        openCount: data.filter((r) => r.status !== 'Closed' && r.status !== 'Published').length,
      },
      charts: {
        byStatus: byStatus.map((s) => ({ label: s.key, value: s.count })),
        byPriority: byPriority.map((p) => ({ label: p.key, value: p.count })),
        createdTrend,
      },
      data,
    };
  }

  async getTaskSummary(filter: ReportDateFilter) {
    const qb = this.taskRepository.createQueryBuilder('task');
    const { clause, params } = this.dateRangeWhere('task', filter);
    qb.where(clause, params);
    const data = await qb.orderBy('task.createdAt', 'DESC').getMany();

    const byStatus = this.groupCount(data, (t) => t.status);
    const byPriority = this.groupCount(data, (t) => t.priority);
    const createdTrend = this.seriesByDay(data, (t) => t.createdAt);

    return {
      summary: {
        total: data.length,
        byStatus,
        byPriority,
        overdue: data.filter(
          (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed',
        ).length,
      },
      charts: {
        byStatus: byStatus.map((s) => ({ label: s.key, value: s.count })),
        byPriority: byPriority.map((p) => ({ label: p.key, value: p.count })),
        createdTrend,
      },
      recent: data.slice(0, 25).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo,
        dueDate: t.dueDate,
        entityType: t.entityType,
        entityId: t.entityId,
      })),
      data,
    };
  }

  private groupAndSum<T>(
    items: T[],
    keyFn: (item: T) => string,
    valueFn: (item: T) => number,
  ): Array<{ key: string; count: number; total: number }> {
    const map = new Map<string, { count: number; total: number }>();
    for (const item of items) {
      const key = keyFn(item);
      const entry = map.get(key) || { count: 0, total: 0 };
      entry.count += 1;
      entry.total += valueFn(item);
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);
  }

  private groupCount<T>(items: T[], keyFn: (item: T) => string): Array<{ key: string; count: number }> {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = keyFn(item);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }

  private seriesByDay<T>(
    items: T[],
    dateFn: (item: T) => Date | string | undefined | null,
    valueFn?: (item: T) => number,
  ): Array<{ date: string; value: number; count: number }> {
    const map = new Map<string, { value: number; count: number }>();
    for (const item of items) {
      const raw = dateFn(item);
      if (!raw) continue;
      const date = new Date(raw).toISOString().slice(0, 10);
      const entry = map.get(date) || { value: 0, count: 0 };
      entry.count += 1;
      entry.value += valueFn ? valueFn(item) : 1;
      map.set(date, entry);
    }
    return Array.from(map.entries())
      .map(([date, v]) => ({ date, value: v.value, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getDashboardOverview(filter: ReportDateFilter) {
    const [oee, loss, rca, audit, tasks] = await Promise.all([
      this.getOeeSummary(filter),
      this.getProductionLossReport(filter),
      this.getRcaSummary(filter),
      this.getAuditTrail(filter),
      this.getTaskSummary(filter),
    ]);
    return {
      tenantId: filter.tenantId,
      startDate: filter.startDate,
      endDate: filter.endDate,
      kpis: {
        oeeRecords: oee.summary.recordCount,
        avgOee: oee.summary.avgOverallOEE,
        lossEvents: loss.summary.eventCount,
        totalLossCost: loss.summary.totalEventCost,
        rcaTotal: rca.summary.total,
        rcaOpen: rca.summary.openCount,
        auditEntries: audit.summary.total,
        taskTotal: tasks.summary.total,
        taskOverdue: tasks.summary.overdue,
      },
      charts: {
        lossCostTrend: loss.charts?.costTrendByDay || [],
        oeePeriodTrend: oee.charts?.periodTrend || [],
        rcaByStatus: rca.charts?.byStatus || [],
        auditActivity: audit.charts?.activityByDay || [],
      },
    };
  }
}
