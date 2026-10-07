import { httpClient } from './httpClient';

export interface ReportQuery {
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  unitId?: string;
  userId?: string;
}

export interface ChartLabelValue {
  label: string;
  value: number;
  count?: number;
}

export interface ChartDaySeries {
  date: string;
  value: number;
  count: number;
}

export interface OeeSummaryReport {
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  summary: {
    recordCount: number;
    avgAvailability: number;
    avgPerformance: number;
    avgQuality: number;
    avgOverallOEE: number;
  };
  byPeriod: Array<{
    period: string;
    planId: string;
    availability: number;
    performance: number;
    quality: number;
    overallOEE: number;
    createdAt: string;
  }>;
  fromEvents?: {
    eventCount: number;
    totalDowntimeMinutes: number;
    totalCost: number;
  };
  charts?: {
    periodTrend: Array<{
      label: string;
      oee: number;
      availability: number;
      performance: number;
      quality: number;
    }>;
    components: Array<{ label: string; value: number }>;
  };
  data: unknown[];
}

export interface ProductionLossReport {
  tenantId?: string;
  summary: {
    lossRecordCount: number;
    eventCount: number;
    totalLossQuantity: number;
    totalLossRecordCost: number;
    totalEventCost: number;
    totalDurationMinutes: number;
  };
  byCategory: Array<{ key: string; count: number; total: number }>;
  bySeverity: Array<{ key: string; count: number; total: number }>;
  byUnit: Array<{ key: string; count: number; total: number }>;
  topEvents: Array<{
    id: string;
    description?: string;
    cost: number;
    duration: number;
    severity?: string;
    status?: string;
    unitId?: string;
    startTime?: string;
  }>;
  charts?: {
    costByCategory: ChartLabelValue[];
    costBySeverity: ChartLabelValue[];
    costByUnit: ChartLabelValue[];
    costTrendByDay: ChartDaySeries[];
    durationTrendByDay: ChartDaySeries[];
    pareto: Array<{ label: string; value: number; cumulative: number }>;
  };
  data: unknown[];
}

export interface RcaSummaryReport {
  summary: {
    total: number;
    openCount: number;
    byStatus: Array<{ key: string; count: number }>;
    byPriority: Array<{ key: string; count: number }>;
  };
  charts?: {
    byStatus: ChartLabelValue[];
    byPriority: ChartLabelValue[];
    createdTrend: ChartDaySeries[];
  };
  data: unknown[];
}

export interface AuditTrailReport {
  summary: {
    total: number;
    byAction: Array<{ key: string; count: number }>;
    byEntityType: Array<{ key: string; count: number }>;
  };
  charts?: {
    activityByDay: ChartDaySeries[];
    byAction: ChartLabelValue[];
    byEntityType: ChartLabelValue[];
  };
  recent?: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    createdAt: string;
  }>;
  data: unknown[];
}

export interface TaskSummaryReport {
  summary: {
    total: number;
    overdue: number;
    byStatus: Array<{ key: string; count: number }>;
    byPriority: Array<{ key: string; count: number }>;
  };
  charts?: {
    byStatus: ChartLabelValue[];
    byPriority: ChartLabelValue[];
    createdTrend: ChartDaySeries[];
  };
  recent?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignedTo: string;
    dueDate?: string;
    entityType?: string;
    entityId?: string;
  }>;
  data: unknown[];
}

export interface DashboardOverview {
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  kpis: {
    oeeRecords: number;
    avgOee: number;
    lossEvents: number;
    totalLossCost: number;
    rcaTotal: number;
    rcaOpen: number;
    auditEntries: number;
    taskTotal: number;
    taskOverdue: number;
  };
  charts: {
    lossCostTrend: ChartDaySeries[];
    oeePeriodTrend: Array<{
      label: string;
      oee: number;
      availability: number;
      performance: number;
      quality: number;
    }>;
    rcaByStatus: ChartLabelValue[];
    auditActivity: ChartDaySeries[];
  };
}

function buildParams(query: ReportQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.tenantId) params.tenantId = query.tenantId;
  if (query.startDate) params.startDate = query.startDate;
  if (query.endDate) params.endDate = query.endDate;
  if (query.unitId) params.unitId = query.unitId;
  if (query.userId) params.userId = query.userId;
  return params;
}

export const reportingApi = {
  async getDashboard(query: ReportQuery) {
    const response = await httpClient.get<DashboardOverview>('/reports/dashboard', { params: buildParams(query) });
    return response.data;
  },

  async getOeeSummary(query: ReportQuery) {
    const response = await httpClient.get<OeeSummaryReport>('/reports/oee-summary', { params: buildParams(query) });
    return response.data;
  },

  async getProductionLoss(query: ReportQuery) {
    const response = await httpClient.get<ProductionLossReport>('/reports/production-loss', { params: buildParams(query) });
    return response.data;
  },

  async getRcaSummary(query: ReportQuery) {
    const response = await httpClient.get<RcaSummaryReport>('/reports/rca-summary', { params: buildParams(query) });
    return response.data;
  },

  async getAuditTrail(query: ReportQuery) {
    const response = await httpClient.get<AuditTrailReport>('/reports/audit-trail', { params: buildParams(query) });
    return response.data;
  },

  async getTaskSummary(query: ReportQuery) {
    const response = await httpClient.get<TaskSummaryReport>('/reports/task-summary', { params: buildParams(query) });
    return response.data;
  },
};
