import { lazy, Suspense, useMemo } from 'react';
import { useSignalCatalog, useSignalSamples } from '@/api/v2/queries/signals';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ActionIcon } from '@/lib/icons';
import { MAX_TREND_DAYS, samplesCsv, tooLong, trendPoints } from './historian-model';
import { SamplesTable } from './samples-table';
import { SignalPicker } from './signal-picker';
import { useHistorianParams } from './use-historian-params';

const TrendChart = lazy(() => import('./trend-chart').then((module) => ({ default: module.TrendChart })));

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'signal-samples.csv';
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Enhanced Historian: trends of the plant's typed signals (stored samples, plant time, the plant
 * calendar), up to five signals over at most 31 days, with the samples table and a CSV export (UTC).
 * The trend is in the URL, so it can be bookmarked. Read-only: signals are defined under Connectivity.
 */
export function HistorianPage() {
  const tenantId = useV2TenantId();
  const { timezone } = usePlantTimezone();
  const { signalIds, range, setSignalIds, setRange } = useHistorianParams();
  const catalog = useSignalCatalog();
  const invalid = tooLong(range.from, range.to);
  const windows = useMemo(
    () => (invalid || !range.from || !range.to ? [] : signalIds.map((signalId) => ({ signalId, from: range.from as string, to: range.to as string }))),
    [invalid, range.from, range.to, signalIds],
  );
  const results = useSignalSamples(windows);
  const nameOf = (id: string) => catalog.items.find((signal) => signal.id === id)?.name ?? 'Unknown signal';
  const loaded = windows.flatMap((window, index) => {
    const data = results[index]?.data;
    return data ? [{ id: window.signalId, name: nameOf(window.signalId), samples: data.samples }] : [];
  });
  const failed = results.find((result) => result.isError)?.error;
  const loading = results.some((result) => result.isLoading);
  const multiDay = Boolean(range.from && range.to && Date.parse(range.to) - Date.parse(range.from) > 2 * 86_400_000);
  return (
    <Page width="wide">
      <PageHeader
        title="Enhanced Historian"
        description="Trends of the signals your connections deliver, in plant time."
        actions={loaded.length > 0 ? <Button size="sm" variant="outline" onClick={() => download(samplesCsv(loaded))} data-testid="trend-export"><ActionIcon.export className="mr-1 h-4 w-4" aria-hidden="true" /> Export CSV</Button> : undefined}
      />
      {!tenantId ? (
        <DataState state="no-permission" detail="Choose a plant to see its signals." />
      ) : (
        <>
          <Section title="Trend">
            <div className="space-y-4" data-testid="historian">
              <div className="flex flex-wrap items-end gap-4">
                <SignalPicker catalog={catalog.items} chosenIds={signalIds} isLoading={catalog.isLoading} onChange={setSignalIds} />
                <DateRangeInput label="Period" value={range} timeZone={timezone} onChange={setRange} />
              </div>
              {invalid && <p role="alert" className="text-sm text-destructive">Choose a period of at most {MAX_TREND_DAYS} days.</p>}
              {failed ? <FriendlyErrorAlert error={failed} /> : null}
              {signalIds.length === 0 ? (
                <DataState state="empty" detail={catalog.items.length === 0 && !catalog.isLoading ? 'No signals are defined yet. Integration administrators define them on a connection under Connectivity.' : 'Choose one or more signals to trend.'} />
              ) : loading ? (
                <DataState state="loading" />
              ) : (
                <Suspense fallback={<DataState state="loading" />}>
                  <TrendChart series={loaded.map((entry) => ({ id: entry.id, name: entry.name, points: trendPoints(entry.samples) }))} timezone={timezone} multiDay={multiDay} />
                </Suspense>
              )}
            </div>
          </Section>
          {loaded.length > 0 && (
            <Section title="Samples">
              <SamplesTable series={loaded} timezone={timezone} />
            </Section>
          )}
        </>
      )}
    </Page>
  );
}
