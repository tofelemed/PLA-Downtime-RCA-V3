import { useCreateExport } from '@/api/v2/queries/exports';
import { reportSnapshot } from '@/api/v2/queries/reports';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ActionIcon } from '@/lib/icons';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { reportBase, type DowntimeFilters } from '../model/downtime-filters';

/**
 * Page title, the UX03 status line (said once for every figure of the snapshot) and the export of the
 * shown snapshot (T24): header, tiles, breakdowns and export request come from one bundle response and
 * one filter object, so they name the same calculation runs. Export covers approved figures only (2.9).
 */
export function DowntimeHeader({ filters, bundle }: { filters: DowntimeFilters; bundle: DowntimeBundleResult }) {
  const env = useEventHubEnv();
  const { number } = useNumberFormat();
  const snapshot = bundle.data ? reportSnapshot(bundle.data, reportBase(filters)) : null;
  const exporter = useCreateExport();
  const { toast } = useToast();
  const scope = filters.unitIds.length === 0 ? 'All units in your scope' : filters.unitIds.map(env.unitName).join(', ');
  const startExport = async () => {
    if (!snapshot?.exportRequest) return;
    try {
      await exporter.submit(snapshot.exportRequest);
      toast({ title: 'Export started', description: 'The period summary is being prepared from the approved figures.' });
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
    }
  };
  const meta = (
    <div className="space-y-1">
      <ScopeHeader
        scopeLabel={`${scope} · ${filters.windowLabel}`}
        timezone={env.timezone}
        timezoneIsFallback={env.timezoneIsFallback}
        uom="time in h:mm"
        isProvisional={bundle.data?.isProvisional}
        asOf={bundle.data?.asOf ?? null}
      />
      {snapshot && (
        <p className="text-xs" data-testid="snapshot-runs" data-run-ids={snapshot.calculationRunIds.join(',')}>
          Every figure on this page comes from the same {snapshot.calculationRunIds.length === 1 ? 'calculation run' : `${number(snapshot.calculationRunIds.length)} calculation runs`}.
        </p>
      )}
    </div>
  );
  return (
    <PageHeader
      title="Downtime analysis"
      description="What is down, why, how often and where"
      meta={meta}
      actions={
        <Button
          variant="outline"
          disabled={!snapshot?.exportRequest || exporter.isPending}
          title={snapshot?.exportRequest ? undefined : 'Exports contain approved figures only: tick “Approved only” and wait for approved periods'}
          onClick={startExport}
          data-testid="downtime-export"
        >
          <ActionIcon.export aria-hidden className="mr-1 h-4 w-4" />
          Export period summary
        </Button>
      }
    />
  );
}
