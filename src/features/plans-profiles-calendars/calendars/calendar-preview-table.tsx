import { AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CalendarPreviewView } from '@/api/v2/types/calendars';
import { DurationText } from '@/features/ux-kit/duration-text';
import { isDstWarning, offsetLabel, warningsByRow, warningsOf, warningText } from '../model/calendar-preview';

/** Previewed instances: local labels, UTC bounds, offsets, server duration, exclusion, DST warnings highlighted. */
export function CalendarPreviewTable({ preview }: { preview: CalendarPreviewView }) {
  const warnings = warningsByRow(preview.warnings);
  return (
    <Table data-testid="calendar-preview-table">
      <TableHeader>
        <TableRow>
          <TableHead>Operational date</TableHead>
          <TableHead>Shift</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>UTC</TableHead>
          <TableHead>Offset</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Scheduled</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {preview.instances.map((instance) => {
          const rowWarnings = warningsOf(warnings, instance);
          const dst = rowWarnings.some(isDstWarning);
          return (
            <TableRow
              key={`${instance.utcStart}-${instance.shiftName}`}
              className={dst ? 'bg-amber-50 dark:bg-amber-950' : undefined}
              data-testid="preview-instance"
              data-dst={dst || undefined}
              data-duration={instance.durationSeconds}
            >
              <TableCell>{instance.localDate}</TableCell>
              <TableCell>{instance.shiftName}</TableCell>
              <TableCell className="text-xs">
                {instance.localStart} → {instance.localEnd}
              </TableCell>
              <TableCell className="text-xs">
                {instance.utcStart} → {instance.utcEnd}
              </TableCell>
              <TableCell className="text-xs">
                {offsetLabel(instance.utcOffsetStart)}
                {instance.utcOffsetEnd !== instance.utcOffsetStart ? ` → ${offsetLabel(instance.utcOffsetEnd)}` : ''}
              </TableCell>
              <TableCell>
                <DurationText seconds={instance.durationSeconds} />
              </TableCell>
              <TableCell className="text-xs">
                {instance.isExcluded ? `Excluded (${instance.exclusionKind ?? '—'}${instance.exclusionReason ? `: ${instance.exclusionReason}` : ''})` : 'Yes'}
                {rowWarnings.map((warning) => (
                  <span key={warning.code} className="mt-1 flex items-center gap-1 text-amber-700" data-testid="instance-warning" data-code={warning.code}>
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {warningText(warning)}
                  </span>
                ))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
