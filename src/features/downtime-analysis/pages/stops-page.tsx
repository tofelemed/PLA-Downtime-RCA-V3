import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import { EventTable } from '@/features/event-hub/components/event-table';
import { Section } from '@/features/ux-kit/page-layout';
import { drillEventQuery } from '../model/reason-drill';
import type { DowntimePageProps } from './page-types';

const StateTimeline = lazy(() => import('../components/state-timeline').then((module) => ({ default: module.StateTimeline })));
const MODES = [{ value: 'list', label: 'Stop records' }, { value: 'timeline', label: 'State timeline' }];

export function DowntimeStopsPage({ filters }: DowntimePageProps) {
  const [params] = useSearchParams();
  const query = drillEventQuery(filters, null, []);
  delete query.codingStates;
  return (
    <div className="space-y-4" data-testid="downtime-view-stops">
      <AnalysisModeSelect param="presentation" label="Show" options={MODES} />
      {params.get('presentation') === 'timeline' ? (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><StateTimeline filters={filters} /></Suspense>
      ) : (
        <Section title="Stop records" description="Open an event to inspect its evidence, code it or close an open stop. Records are current operational events; they are not restricted to approved period revisions.">
          <EventTable caption="Downtime events" query={query} testId="downtime-stop-list" />
        </Section>
      )}
    </div>
  );
}
