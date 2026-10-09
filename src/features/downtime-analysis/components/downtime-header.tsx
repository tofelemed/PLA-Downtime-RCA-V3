import { useCreateExport } from '@/api/v2/queries/exports';
import { reportSnapshot, useDowntimeReport } from '@/api/v2/queries/reports';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { downtimeQuery, reportBase, type DowntimeFilters } from '../model/downtime-filters';

/**
 * Page title, the UX03 status line and the export of the shown snapshot (T24): the header, the summary
 * tiles and the export request come from one response and one filter object, so they name the same
 * calculation runs. Export covers approved figures only (2.9).
 */
export function DowntimeHeader({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const query = useDowntimeReport(downtimeQuery(filters, 'oee', { metric: 'duration', scheduleClass: 'all' }), env.timezone);
  const snapshot = query.data ? reportSnapshot(query.data, reportBase(filters)) : null;
  const exporter = useCreateExport();
  const { toast } = useToast();
  const scope = filters.unitIds.length === 0 ? 'All units in your scope' : filters.unitIds.map(env.unitName).join(', ');
  const startExport = async () => {
    if (!snapshot?.exportRequest) return;
    try {
      const job = await exporter.submit(snapshot.exportRequest);
      toast({ title: 'Export queued', description: `Job ${job.id}` });
    } catch {
      toast({ title: 'Export could not be started', variant: 'destructive' });
    }
  };
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Downtime Analysis</h1>
        <ScopeHeader
          scopeLabel={`${scope} · ${filters.windowLabel}`}
          timezone={env.timezone}
          timezoneIsFallback={env.timezoneIsFallback}
          uom="time in h:mm"
          isProvisional={query.data?.isProvisional}
          asOf={query.data?.asOf ?? null}
        />
        {snapshot && (
          <p className="text-xs text-muted-foreground" data-testid="snapshot-runs" data-run-ids={snapshot.calculationRunIds.join(',')}>
            {snapshot.calculationRunIds.length} calculation runs behind every figure on this page
          </p>
        )}
      </div>
      <Button
        variant="outline"
        disabled={!snapshot?.exportRequest || exporter.isPending}
        title={snapshot?.exportRequest ? undefined : 'Exports contain approved figures only: tick “Approved only” and wait for approved periods'}
        onClick={startExport}
        data-testid="downtime-export"
      >
        Export period summary
      </Button>
    </header>
  );
}
