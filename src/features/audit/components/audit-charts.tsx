import type { AuditSummaryView } from '@/api/v2/types/administration';
import { CategoryBarChart, ChartCard, TrendLineChart } from '@/components/reports/ReportCharts';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, labelOf } from '@/features/ux-kit/labels';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';

/** Activity by day, action and record type (counts from the server; loaded only when opened). */
export function AuditCharts({ summary }: { summary: AuditSummaryView }) {
  const preference = useCalendarPreference();
  const byDay = summary.byDay.map((point) => ({ date: formatOperationalDate(point.day, preference), value: point.count }));
  const byAction = summary.byAction.map((row) => ({ label: labelOf(AUDIT_ACTION_LABELS, row.key), value: row.count }));
  const byEntity = summary.byEntityType.map((row) => ({ label: labelOf(AUDIT_ENTITY_LABELS, row.key), value: row.count }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="By day">
        <TrendLineChart data={byDay} valueLabel="Entries" />
      </ChartCard>
      <ChartCard title="By action">
        <CategoryBarChart data={byAction} valueLabel="Entries" />
      </ChartCard>
      <ChartCard title="By record type">
        <CategoryBarChart data={byEntity} valueLabel="Entries" />
      </ChartCard>
    </div>
  );
}
