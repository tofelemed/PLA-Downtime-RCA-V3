import { useState } from 'react';
import { v2Request } from '@/api/v2/client';
import type { QueryParams } from '@/api/v2/request-url';
import { Button } from '@/components/ui/button';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { exportFileName, plantFileDay } from '@/features/ux-kit/format/export-file-name';
import { toEventQuery, type EventFilterState } from '../model/event-filters';
import { useEventHubEnv } from '../use-event-hub-env';

/** The list filters without paging: the export covers every matching event (server limit 50,000). */
function exportQuery(filters: EventFilterState): QueryParams {
  const { limit: _limit, sort: _sort, ...query } = toEventQuery(filters);
  return query as QueryParams;
}

function saveCsv(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** CSV of the filtered events (ISO UTC times, names not ids), built by the server from the same filters. */
export function ExportEventsButton({ filters }: { filters: EventFilterState }) {
  const { toast } = useToast();
  const { timezone } = useEventHubEnv();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const response = await v2Request<string>({ method: 'GET', path: '/production-events/export', query: exportQuery(filters) });
      saveCsv(response.data, exportFileName(['production-events', plantFileDay(filters.from, timezone)]));
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  const Icon = busy ? StatusIcon.loading : ActionIcon.export;
  return (
    <Button variant="outline" disabled={busy || !filters.from || !filters.to} onClick={() => void run()} data-testid="export-events">
      <Icon aria-hidden className={`mr-1 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
      Export CSV
    </Button>
  );
}
