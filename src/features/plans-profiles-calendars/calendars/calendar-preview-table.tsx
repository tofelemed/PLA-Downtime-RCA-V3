import type { CalendarPreviewView, CalendarWarning, ShiftInstancePreview } from '@/api/v2/types/calendars';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { EXCLUSION_KIND_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { isDstWarning, offsetLabel, warningsByRow, warningsOf, warningText } from '../model/calendar-preview';

function Scheduled({ instance, warnings }: { instance: ShiftInstancePreview; warnings: CalendarWarning[] }) {
  const Icon = StatusIcon.warning;
  const excluded = `Excluded (${labelOf(EXCLUSION_KIND_LABELS, instance.exclusionKind)}${instance.exclusionReason ? `: ${instance.exclusionReason}` : ''})`;
  return (
    <span className="text-xs">
      {instance.isExcluded ? excluded : 'Yes'}
      {warnings.map((warning) => (
        <span key={warning.code} className="mt-1 flex items-center gap-1 text-warning" data-testid="instance-warning" data-code={warning.code}>
          <Icon className="h-3 w-3" aria-hidden="true" />
          {warningText(warning)}
        </span>
      ))}
    </span>
  );
}

/** Previewed shift instances (20 per page): date, shift, plant-clock interval, offset, server duration, exclusion, warnings. */
export function CalendarPreviewTable({ preview }: { preview: CalendarPreviewView }) {
  const pref = useCalendarPreference();
  const byRow = warningsByRow(preview.warnings);
  const columns: DataTableColumn<ShiftInstancePreview>[] = [
    {
      id: 'date',
      header: 'Operational date',
      nowrap: true,
      cell: (i) => {
        const dst = warningsOf(byRow, i).some(isDstWarning);
        return (
          <span data-testid="preview-instance" data-dst={dst || undefined} data-duration={i.durationSeconds} className={dst ? 'font-medium text-warning' : undefined}>
            {formatOperationalDate(i.localDate, pref)}
          </span>
        );
      },
    },
    { id: 'shift', header: 'Shift', cell: (i) => i.shiftName },
    { id: 'local', header: 'Interval', nowrap: true, cell: (i) => <span className="text-xs"><PlantTime iso={i.utcStart} tz={preview.timezone} withDate withZone={false} /> → <PlantTime iso={i.utcEnd} tz={preview.timezone} withZone={false} /></span> },
    { id: 'offset', header: 'UTC offset', nowrap: true, cell: (i) => `${offsetLabel(i.utcOffsetStart)}${i.utcOffsetEnd !== i.utcOffsetStart ? ` → ${offsetLabel(i.utcOffsetEnd)}` : ''}` },
    { id: 'duration', header: 'Duration', align: 'right', nowrap: true, cell: (i) => <DurationText seconds={i.durationSeconds} /> },
    { id: 'scheduled', header: 'Scheduled', cell: (i) => <Scheduled instance={i} warnings={warningsOf(byRow, i)} /> },
  ];
  return (
    <div data-testid="calendar-preview-table">
      <DataTable caption="Previewed shifts" columns={columns} rows={preview.instances} getRowKey={(i) => `${i.utcStart}-${i.shiftName}`} density="compact" />
    </div>
  );
}
