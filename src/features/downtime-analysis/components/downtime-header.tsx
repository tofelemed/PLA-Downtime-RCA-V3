import { useCapabilities } from '@/features/auth/use-capabilities';
import { useId } from 'react';
import { useCreateExport } from '@/api/v2/queries/exports';
import { reportSnapshot } from '@/api/v2/queries/reports';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useWindowRangeText } from '@/features/event-hub/hooks/use-window-range-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ActionIcon } from '@/lib/icons';
import { useActiveFiltersText } from '../hooks/use-active-filters-text';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { hasPeriodSelection, reportBase, type DowntimeFilters } from '../model/downtime-filters';

interface DowntimeHeaderProps { filters: DowntimeFilters; bundle: DowntimeBundleResult; title?: string; description?: string; }
type Snapshot = ReturnType<typeof reportSnapshot> | null;

/** Calculated metadata/export stay tied to the same historical scope as the visible figures. */
export function DowntimeHeader({ filters, bundle, title = 'Downtime analysis', description = 'What is down, why, how often and where' }: DowntimeHeaderProps) {
  const snapshot = bundle.data ? reportSnapshot(bundle.data, reportBase(filters)) : null;
  return <PageHeader title={title} description={description}
    meta={<DowntimeMetadata filters={filters} bundle={bundle} snapshot={snapshot} />}
    actions={<DowntimeExport filters={filters} snapshot={snapshot} />} />;
}

function DowntimeMetadata({ filters, bundle, snapshot }: DowntimeHeaderProps & { snapshot: Snapshot }) {
  const env = useEventHubEnv();
  const { number } = useNumberFormat();
  const rangeText = useWindowRangeText();
  const activeFilters = useActiveFiltersText(filters);
  const scope = filters.unitIds.length === 0 ? 'All units in your scope' : filters.unitIds.map(env.unitName).join(', ');
  const windowText = rangeText({ label: filters.windowLabel, from: filters.from, to: filters.to, relative: filters.relativeWindow !== null });
  return <div className="space-y-1">
    <ScopeHeader scopeLabel={[scope, windowText, activeFilters].filter(Boolean).join(' · ')} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback}
      uom="hours and minutes" isProvisional={bundle.data?.isProvisional} asOf={bundle.data?.asOf ?? null} />
    {snapshot && <p className="text-xs" data-testid="snapshot-runs" data-run-ids={snapshot.calculationRunIds.join(',')}>
      Historical downtime summary and breakdowns use {snapshot.calculationRunIds.length === 1 ? 'the same calculation run' : `the same ${number(snapshot.calculationRunIds.length)} calculation runs`}.
    </p>}
  </div>;
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
