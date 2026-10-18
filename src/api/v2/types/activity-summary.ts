/** `GET /v2/reports/activity-summary` (Audit Logs → Work summary): work items and audit activity of a window. */
export interface ActivityCountView {
  /** status, priority, action or entity type as stored */
  key: string;
  count: number;
}

export interface ActivityDayView {
  /** plant-local date (YYYY-MM-DD) */
  day: string;
  count: number;
}

export interface WorkItemSummaryView {
  total: number;
  open: number;
  overdue: number;
  byStatus: ActivityCountView[];
  byPriority: ActivityCountView[];
  createdByDay: ActivityDayView[];
}

export interface AuditActivitySummaryView {
  total: number;
  byAction: ActivityCountView[];
  byEntityType: ActivityCountView[];
  byDay: ActivityDayView[];
}

export interface ActivitySummaryView {
  timezone: string;
  rcaCases: WorkItemSummaryView;
  tasks: WorkItemSummaryView;
  /** null unless the caller may read the audit log */
  audit: AuditActivitySummaryView | null;
}

export interface ActivitySummaryResponse {
  data: ActivitySummaryView;
  asOf: string;
  from: string;
  to: string;
}
