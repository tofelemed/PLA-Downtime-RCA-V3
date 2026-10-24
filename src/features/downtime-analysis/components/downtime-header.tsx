import { useCapabilities } from '@/features/auth/use-capabilities';
import { useId } from 'react';
import { useCreateExport } from '@/api/v2/queries/exports';
import { reportSnapshot } from '@/api/v2/queries/reports';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { usePlantFormat } from '@/features/event-hub/hooks/use-plant-format';
import { ActionIcon } from '@/lib/icons';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { hasPeriodSelection, reportBase, type DowntimeFilters } from '../model/downtime-filters';
import { FigureStatus } from './figure-status';

export interface DowntimeHeaderProps {
  filters: DowntimeFilters;
  /** the page snapshot; null on pages whose cards read their own figures (each card then carries its label) */
  bundle: DowntimeBundleResult | null;
  title: string;
}
type Snapshot = ReturnType<typeof reportSnapshot> | null;

/**
 * Title, and for snapshot pages the one Provisional / Approved label of the figures (runs and as-of in its ⓘ)
 * and the period-summary export tied to the same snapshot. No scope line or timezone: the app header has them.
 */
export function DowntimeHeader({ filters, bundle, title }: DowntimeHeaderProps) {
  const snapshot = bundle?.data ? reportSnapshot(bundle.data, reportBase(filters)) : null;
  return (
    <PageHeader
      title={title}
      meta={snapshot && bundle?.data ? <SnapshotStatus snapshot={snapshot} provisional={bundle.data.isProvisional} asOf={bundle.data.asOf} /> : undefined}
      actions={bundle ? <DowntimeExport filters={filters} snapshot={snapshot} /> : undefined}
    />
  );
}

function SnapshotStatus({ snapshot, provisional, asOf }: { snapshot: NonNullable<Snapshot>; provisional: boolean; asOf: string | null }) {
  const { number } = useNumberFormat();
  const { dateTime } = usePlantFormat();
  const runs = snapshot.calculationRunIds.length;
  const info = `Summary, trend and breakdowns use ${runs === 1 ? 'the same calculation run' : `the same ${number(runs)} calculation runs`}${asOf ? ` · as of ${dateTime(asOf)}` : ''}.`;
  return <FigureStatus provisional={provisional} info={info} testId="snapshot-runs" data={{ 'data-run-ids': snapshot.calculationRunIds.join(',') }} />;
}

function DowntimeExport({ filters, snapshot }: { filters: DowntimeFilters; snapshot: Snapshot }) {
  // QA re-test: the period summary carries value columns, so operators are not offered it (server: 403)
  const { canViewMoney } = useCapabilities();
  const exportRequest = hasPeriodSelection(filters) ? null : snapshot?.exportRequest;
  const exporter = useCreateExport();
  const reasonId = useId();
  const { toast } = useToast();
  if (!canViewMoney) return null;
  const startExport = async () => {
    if (!exportRequest) return;
    try {
      await exporter.submit(exportRequest);
      toast({ title: 'Export started', description: 'The period summary is being prepared from the approved figures.' });
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
    }
  };
  const hint = hasPeriodSelection(filters) ? 'This export supports units and dates. Clear product, shift and crew filters to export matching figures.'
    : 'Exports contain approved figures only: tick “Approved only” and wait for approved periods';
  // QA L23: the reason is on screen next to the button, not only in a tooltip
  const reason = exportRequest ? null : hint;
  return <div className="flex max-w-xs flex-col items-end gap-1 text-right">
    <Button variant="outline" disabled={!exportRequest || exporter.isPending} title={reason ?? undefined} aria-describedby={reason ? reasonId : undefined}
      onClick={startExport} data-testid="downtime-export"><ActionIcon.export aria-hidden className="mr-1 h-4 w-4" />Export period summary</Button>
    <DisabledReason id={reasonId} reason={reason} />
  </div>;
}
