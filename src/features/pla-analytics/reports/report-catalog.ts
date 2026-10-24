import { OPS_VIEWS } from '@/features/ops-reports/ops-report-registry';

/** A report as the page shows it: its `?view=` key and its label. */
export interface ReportEntry {
  key: string;
  label: string;
}

/** A report type of the top bar and its reports, in menu order. */
export interface ReportType {
  key: string;
  label: string;
  views: readonly string[];
}

const LABELS: Readonly<Record<string, string>> = {
  production: 'OEE and downtime',
  reconciliation: 'Reconciliation',
  value: 'Loss value',
  exports: 'Exports',
  ...Object.fromEntries(OPS_VIEWS.map((view) => [view.key, view.label])),
};

/** Report types (owner-approved Reports redesign, 24 Oct 2026); the type of a report is derived, never in the URL. */
export const REPORT_TYPES: readonly ReportType[] = [
  { key: 'pla', label: 'Production loss (PLA)', views: ['daily', 'monthly', 'reconciliation', 'value', 'rate', 'plan', 'quality', 'transitions'] },
  { key: 'downtime', label: 'Downtime', views: ['production', 'shift', 'chronic', 'compliance'] },
  { key: 'reliability', label: 'Reliability & RCA', views: ['reliability', 'rca'] },
  { key: 'management', label: 'Management', views: ['scorecard', 'exports'] },
];

export const DEFAULT_VIEW = 'production';

/** The `?view=` value when it names a report, else the default (old links keep their report). */
export function viewOf(value: string | null): string {
  return value && value in LABELS ? value : DEFAULT_VIEW;
}

/** The type a report belongs to. */
export function typeOfView(view: string): ReportType {
  return REPORT_TYPES.find((type) => type.views.includes(view)) ?? REPORT_TYPES[1];
}

/** The reports of one type, in menu order. */
export function reportsOfType(type: ReportType): ReportEntry[] {
  return type.views.map((key) => ({ key, label: LABELS[key] }));
}

/** The report opened when the user picks a type: its first report. */
export function firstViewOf(typeKey: string): string {
  return (REPORT_TYPES.find((type) => type.key === typeKey) ?? typeOfView(DEFAULT_VIEW)).views[0];
}
