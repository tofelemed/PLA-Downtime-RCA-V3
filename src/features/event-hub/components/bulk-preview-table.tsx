import type { BulkCodePreviewView, CodingSnapshotView } from '@/api/v2/types/event-operations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';

/** Rows shown before "and N more" (the counts are always complete). */
const SHOWN_ROWS = 50;

function Coding({ value }: { value: CodingSnapshotView }) {
  const env = useEventHubEnv();
  return (
    <span className="text-xs">
      {env.reasonName(value.reasonCodeId)} · {humanize(value.scheduleClass)} / {humanize(value.oeeComponent)} · {humanize(value.codingState)}
    </span>
  );
}

/** DT10 preview: before / after per event, exclusions with reasons, and the windows that will recalculate. */
export function BulkPreviewTable({ preview }: { preview: BulkCodePreviewView }) {
  const env = useEventHubEnv();
  return (
    <div className="space-y-3" data-testid="bulk-preview">
      <p className="text-sm">
        <strong data-testid="bulk-preview-count">{preview.count}</strong> events change ·{' '}
        <strong data-testid="bulk-preview-exclusions">{preview.exclusions.length}</strong> excluded
      </p>
      <div className="max-h-56 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Before</TableHead>
              <TableHead>After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.items.slice(0, SHOWN_ROWS).map((item) => (
              <TableRow key={item.eventId}>
                <TableCell><Coding value={item.before} /></TableCell>
                <TableCell><Coding value={item.after} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {preview.items.length > SHOWN_ROWS && <p className="text-xs text-muted-foreground">and {preview.items.length - SHOWN_ROWS} more</p>}
      </div>
      {preview.exclusions.length > 0 && (
        <ul className="text-xs text-destructive" aria-label="Excluded events">
          {preview.exclusions.map((exclusion) => (
            <li key={`${exclusion.eventId}:${exclusion.reason}`}>
              <span className="font-mono">{exclusion.eventId.slice(0, 8)}</span>: {humanize(exclusion.reason)}
              {exclusion.currentVersion !== undefined && ` (now revision ${exclusion.currentVersion})`}
            </li>
          ))}
        </ul>
      )}
      <div className="text-xs" aria-label="Windows that will recalculate">
        <span className="font-medium">Recalculates: </span>
        {preview.affectedWindows.map((window) => (
          <span key={`${window.unitId}:${window.from}`} className="mr-2 inline-block">
            {env.unitName(window.unitId)} <PlantTime iso={window.from} tz={env.timezone} withDate /> –{' '}
            {window.to ? <PlantTime iso={window.to} tz={env.timezone} withDate /> : 'running'}
          </span>
        ))}
      </div>
    </div>
  );
}
