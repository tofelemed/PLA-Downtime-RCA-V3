/** Read model of `GET /v2/reports/activity-summary` (work items and audit activity of a window). */
export interface ActivityCountView {
  /** status, priority, action or entity type as stored */
  key: string;
  count: number;
}

export interface ActivityDayView {
  /** plant-local calendar date (YYYY-MM-DD) */
  day: string;
  count: number;
}

export interface WorkItemSummaryView {
  /** records created in the window */
  total: number;
  /** of those, not closed */
  open: number;
  /** of those, open past their due / target date at `asOf` */
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
  /** IANA zone the days are counted in: default site, else the plant, else UTC */
  timezone: string;
  /** RCA cases of the caller's units */
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
