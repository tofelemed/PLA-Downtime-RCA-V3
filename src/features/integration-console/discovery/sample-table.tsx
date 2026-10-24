import type { SampleRecordView, SourceSampleView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlantTime } from '@/features/ux-kit/plant-time';

export interface SampleTableProps {
  sample: SourceSampleView;
  timezone: string;
  selectedId: string | null;
  onMap: (record: SampleRecordView) => void;
  onBind: (record: SampleRecordView) => void;
}

/** Sampled source records (nothing stored): name, template, element, times in plant time, attribute names. */
export function SampleTable({ sample, timezone, selectedId, onMap, onBind }: SampleTableProps) {
  return (
    <div className="space-y-2" data-testid="sample-table">
      <p className="text-xs text-muted-foreground" data-testid="sample-templates">
        Templates in this sample: {sample.templates.map((entry) => `${entry.name} (${entry.records})`).join(', ') || 'none'}
        {sample.truncated ? ' — more records exist in the window' : ''}
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Element</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Attributes</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sample.records.map((record) => (
              <TableRow key={record.sourceObjectId} data-testid="sample-record" data-source-id={record.sourceObjectId} aria-selected={record.sourceObjectId === selectedId}>
                <TableCell className="max-w-56 truncate" title={record.name ?? undefined}>
                  {record.name ?? '—'}
                </TableCell>
                <TableCell>{record.templateName ?? 'no template'}</TableCell>
                <TableCell className="max-w-56 truncate" title={record.element?.path ?? undefined}>
                  {record.element?.path ?? record.element?.webId ?? '—'}
                </TableCell>
                <TableCell>
                  <PlantTime iso={record.startTime} tz={timezone} withDate withZone={false} />
                </TableCell>
                <TableCell>{record.endTime ? <PlantTime iso={record.endTime} tz={timezone} withDate withZone={false} /> : 'open'}</TableCell>
                <TableCell className="text-xs">{Object.keys(record.attributes).join(', ') || '—'}</TableCell>
                <TableCell className="space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => onMap(record)} data-testid="sample-map">
                    Map
                  </Button>
                  {record.element && (
                    <Button size="sm" variant="outline" onClick={() => onBind(record)} data-testid="sample-bind">
                      Bind element
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
