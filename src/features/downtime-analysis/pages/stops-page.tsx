import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { EventTable } from '@/features/event-hub/components/event-table';
import { Section } from '@/features/ux-kit/page-layout';
import { drillEventQuery } from '../model/reason-drill';
import type { DowntimePageProps } from './page-types';

const StateTimeline = lazy(() => import('../components/state-timeline').then((module) => ({ default: module.StateTimeline })));

export function DowntimeStopsPage({ filters }: DowntimePageProps) {
  const [params] = useSearchParams();
  const query = drillEventQuery(filters, null, []);
  delete query.codingStates;
  return (
    <div className="space-y-4" data-testid="downtime-view-stops">
      {params.get('presentation') === 'timeline' ? (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><StateTimeline filters={filters} /></Suspense>
      ) : (
        <Section title="Stop records" description="Open a stop to inspect its evidence, code it or close it while ongoing. Records are current operational stops; they are not restricted to approved period revisions.">
          <EventTable caption="Stops" query={query} testId="downtime-stop-list" />
        </Section>
      )}
    </div>
  );
}
